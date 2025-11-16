"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.scanFile = scanFile;
exports.scanSelection = scanSelection;
exports.applyCorrection = applyCorrection;
exports.previewCorrections = previewCorrections;
exports.undoCorrections = undoCorrections;
exports.analyzeText = analyzeText;
exports.clearCache = clearCache;
exports.showPanel = showPanel;
exports.refresh = refresh;
exports.dispose = dispose;
const vscode = __importStar(require("vscode"));
const correctionManager_1 = require("../core/correctionManager");
const panelController_1 = require("../ui/panel/panelController");
const decorations_1 = require("../ui/panel/decorations");
const diagnostics_1 = require("../ui/diagnostics");
const statusBar_1 = require("../ui/statusBar");
const settings_1 = require("../config/settings");
const correctionManager = new correctionManager_1.CorrectionManager();
async function scanFile() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return vscode.window.showWarningMessage("Aucun fichier ouvert");
    }
    if (!settings_1.ConfigurationManager.isConfigValid()) {
        const configure = await vscode.window.showWarningMessage("Clé API non configurée. Voulez-vous la configurer maintenant ?", "Configurer", "Annuler");
        if (configure === "Configurer") {
            await settings_1.ConfigurationManager.promptApiKey();
        }
        return;
    }
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "TextLint AI : Analyse en cours...",
        cancellable: true,
    }, async (progress, token) => {
        try {
            progress.report({ message: "Extraction du texte...", increment: 10 });
            const { corrections, stats } = await correctionManager.applyCorrections(editor, { language: settings_1.ConfigurationManager.getConfig().language });
            if (token.isCancellationRequested) {
                return;
            }
            progress.report({
                message: "Application des décorations...",
                increment: 30,
            });
            (0, decorations_1.decorateCorrections)(editor, corrections);
            (0, diagnostics_1.updateDiagnostics)(editor.document, corrections);
            (0, statusBar_1.updateStatusBar)(corrections);
            progress.report({
                message: "Affichage des résultats...",
                increment: 30,
            });
            (0, panelController_1.showCorrectionPanel)(corrections, stats);
            if (corrections.length > 0) {
                vscode.window.showInformationMessage(`✓ ${stats.corrected} correction(s) trouvée(s) en ${(stats.duration / 1000).toFixed(1)}s`);
            }
            else {
                vscode.window.showInformationMessage("✓ Aucune correction nécessaire");
            }
        }
        catch (error) {
            console.error("Erreur lors de l'analyse:", error);
            vscode.window.showErrorMessage(`Erreur lors de l'analyse: ${error instanceof Error ? error.message : "Erreur inconnue"}`);
        }
    });
}
async function scanSelection() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return vscode.window.showWarningMessage("Aucun fichier ouvert");
    }
    if (editor.selection.isEmpty) {
        return vscode.window.showWarningMessage("Aucune sélection");
    }
    if (!settings_1.ConfigurationManager.isConfigValid()) {
        const configure = await vscode.window.showWarningMessage("Clé API non configurée. Voulez-vous la configurer maintenant ?", "Configurer", "Annuler");
        if (configure === "Configurer") {
            await settings_1.ConfigurationManager.promptApiKey();
        }
        return;
    }
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "TextLint AI : Analyse de la sélection...",
        cancellable: true,
    }, async (progress, token) => {
        try {
            progress.report({ message: "Extraction du texte...", increment: 20 });
            const corrections = await correctionManager.correctSelection(editor, {
                language: settings_1.ConfigurationManager.getConfig().language,
            });
            if (token.isCancellationRequested) {
                return;
            }
            progress.report({
                message: "Application des corrections...",
                increment: 40,
            });
            (0, decorations_1.decorateCorrections)(editor, corrections, editor.selection);
            (0, panelController_1.showCorrectionPanel)(corrections);
            if (corrections.length > 0) {
                vscode.window.showInformationMessage(`✓ ${corrections.length} correction(s) appliquée(s) dans la sélection`);
            }
            else {
                vscode.window.showInformationMessage("✓ Aucune correction nécessaire dans la sélection");
            }
        }
        catch (error) {
            console.error("Erreur lors de l'analyse de la sélection:", error);
            vscode.window.showErrorMessage(`Erreur: ${error instanceof Error ? error.message : "Erreur inconnue"}`);
        }
    });
}
async function applyCorrection() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return vscode.window.showWarningMessage("Aucun fichier ouvert");
    }
    const confirm = await vscode.window.showInformationMessage("Appliquer toutes les corrections ?", { modal: true }, "Oui", "Non");
    if (confirm !== "Oui") {
        return;
    }
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Application des corrections...",
        cancellable: false,
    }, async () => {
        try {
            const { corrections, stats } = await correctionManager.applyCorrections(editor);
            (0, diagnostics_1.clearDiagnostics)();
            (0, decorations_1.clearDecorations)(editor);
            (0, statusBar_1.updateStatusBar)([]);
            vscode.window.showInformationMessage(`✓ ${corrections.length} correction(s) appliquée(s) en ${(stats.duration / 1000).toFixed(1)}s`);
        }
        catch (error) {
            console.error("Erreur lors de l'application:", error);
            vscode.window.showErrorMessage(`Erreur: ${error instanceof Error ? error.message : "Erreur inconnue"}`);
        }
    });
}
async function previewCorrections() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return vscode.window.showWarningMessage("Aucun fichier ouvert");
    }
    try {
        await correctionManager.previewCorrections(editor);
    }
    catch (error) {
        console.error("Erreur lors de la prévisualisation:", error);
        vscode.window.showErrorMessage(`Erreur: ${error instanceof Error ? error.message : "Erreur inconnue"}`);
    }
}
async function undoCorrections() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return vscode.window.showWarningMessage("Aucun fichier ouvert");
    }
    try {
        await correctionManager.undoCorrections(editor);
        (0, diagnostics_1.clearDiagnostics)();
        (0, decorations_1.clearDecorations)(editor);
        (0, statusBar_1.updateStatusBar)([]);
    }
    catch (error) {
        console.error("Erreur lors de l'annulation:", error);
        vscode.window.showErrorMessage(`Erreur: ${error instanceof Error ? error.message : "Erreur inconnue"}`);
    }
}
async function analyzeText() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return vscode.window.showWarningMessage("Aucun fichier ouvert");
    }
    try {
        await correctionManager.analyzeText(editor);
    }
    catch (error) {
        console.error("Erreur lors de l'analyse:", error);
        vscode.window.showErrorMessage(`Erreur: ${error instanceof Error ? error.message : "Erreur inconnue"}`);
    }
}
async function clearCache() {
    const confirm = await vscode.window.showWarningMessage("Vider le cache des corrections ?", { modal: true }, "Oui", "Non");
    if (confirm === "Oui") {
        correctionManager.clearCache();
    }
}
async function showPanel(corrections = []) {
    (0, panelController_1.showCorrectionPanel)(corrections);
}
async function refresh() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return;
    }
    (0, diagnostics_1.clearDiagnostics)();
    (0, decorations_1.clearDecorations)(editor);
    await scanFile();
}
function dispose() {
    (0, diagnostics_1.clearDiagnostics)();
    (0, statusBar_1.hideStatusBar)();
}
//# sourceMappingURL=scan.js.map