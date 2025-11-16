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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const settings_1 = require("./config/settings");
const scan_1 = require("./commands/scan");
const diagnostics_1 = require("./ui/diagnostics");
const statusBar_1 = require("./ui/statusBar");
const decorations_1 = require("./ui/panel/decorations");
const panelController_1 = require("./ui/panel/panelController");
const cacheService_1 = require("./services/cacheService");
let autoAnalysisDisposable;
function activate(context) {
    console.log('✓ Extension "textlint-ai" activée');
    // Initialisation
    (0, diagnostics_1.initDiagnostics)();
    (0, statusBar_1.initStatusBar)();
    // Vérifier la configuration au démarrage
    checkConfiguration();
    // Enregistrer les commandes
    registerCommands(context);
    // Configurer les événements
    setupEventHandlers(context);
    // Configurer l'analyse automatique si activée
    setupAutoAnalysis(context);
    // Nettoyer le cache périodiquement
    setupCacheCleanup(context);
    // Afficher un message de bienvenue pour les nouveaux utilisateurs
    showWelcomeMessage(context);
    console.log("✓ TextLint AI prêt à l'emploi");
}
function deactivate() {
    console.log('Désactivation de l\'extension "textlint-ai"');
    // Nettoyer les ressources
    if (autoAnalysisDisposable) {
        autoAnalysisDisposable.dispose();
    }
    (0, scan_1.dispose)();
    (0, diagnostics_1.dispose)();
    (0, statusBar_1.dispose)();
    (0, decorations_1.dispose)();
    (0, panelController_1.dispose)();
    console.log("✓ TextLint AI désactivé");
}
/**
 * Enregistre toutes les commandes
 */
function registerCommands(context) {
    const commands = [
        // Commandes principales
        { id: "textlint-ai.login", func: settings_1.promptApiKey },
        { id: "textlint-ai.scanFile", func: scan_1.scanFile },
        { id: "textlint-ai.scanSelection", func: scan_1.scanSelection },
        { id: "textlint-ai.applyCorrection", func: scan_1.applyCorrection },
        { id: "textlint-ai.showPanel", func: scan_1.showPanel },
        { id: "textlint-ai.refresh", func: scan_1.refresh },
        // Nouvelles commandes
        { id: "textlint-ai.previewCorrections", func: scan_1.previewCorrections },
        { id: "textlint-ai.undoCorrections", func: scan_1.undoCorrections },
        { id: "textlint-ai.analyzeText", func: scan_1.analyzeText },
        { id: "textlint-ai.clearCache", func: scan_1.clearCache },
        // Commandes de configuration
        { id: "textlint-ai.configure", func: () => showConfigurationMenu(context) },
        { id: "textlint-ai.resetConfig", func: resetConfiguration },
        { id: "textlint-ai.showStats", func: showStatistics },
        // Commandes d'export
        { id: "textlint-ai.exportDiagnostics", func: diagnostics_1.exportDiagnostics },
        { id: "textlint-ai.exportCacheStats", func: exportCacheStats },
        // Commandes d'analyse
        {
            id: "textlint-ai.toggleAutoAnalysis",
            func: () => toggleAutoAnalysis(context),
        },
        // Menu contextuel
        { id: "textlint-ai.showMenu", func: () => showContextMenu(context) },
    ];
    commands.forEach((cmd) => {
        const disposable = vscode.commands.registerCommand(cmd.id, cmd.func);
        context.subscriptions.push(disposable);
    });
    console.log(`✓ ${commands.length} commandes enregistrées`);
}
/**
 * Configure les gestionnaires d'événements
 */
function setupEventHandlers(context) {
    // Surveiller les changements de configuration
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("textlint-ai")) {
            console.log("Configuration modifiée");
            (0, statusBar_1.resetStatusBar)();
        }
    }));
    // Surveiller l'ouverture de documents
    context.subscriptions.push(vscode.workspace.onDidOpenTextDocument((document) => {
        if (shouldAnalyzeDocument(document)) {
            console.log(`Document ouvert: ${document.fileName}`);
        }
    }));
    // Surveiller la fermeture de documents
    context.subscriptions.push(vscode.workspace.onDidCloseTextDocument((document) => {
        console.log(`Document fermé: ${document.fileName}`);
    }));
    // Surveiller les changements d'éditeur actif
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor && shouldAnalyzeDocument(editor.document)) {
            (0, statusBar_1.resetStatusBar)();
        }
    }));
}
/**
 * Configure l'analyse automatique
 */
function setupAutoAnalysis(context) {
    const config = settings_1.ConfigurationManager.getConfig();
    if (config.autoCorrect) {
        enableAutoAnalysisFeature();
        console.log("✓ Analyse automatique activée");
    }
}
/**
 * Active l'analyse automatique
 */
function enableAutoAnalysisFeature() {
    if (autoAnalysisDisposable) {
        autoAnalysisDisposable.dispose();
    }
    autoAnalysisDisposable = (0, diagnostics_1.enableAutoAnalysis)((document) => {
        if (shouldAnalyzeDocument(document)) {
            (0, scan_1.scanFile)();
        }
    });
}
/**
 * Bascule l'analyse automatique
 */
function toggleAutoAnalysis(context) {
    const config = settings_1.ConfigurationManager.getConfig();
    const newValue = !config.autoCorrect;
    settings_1.ConfigurationManager.updateConfig("autoCorrect", newValue);
    if (newValue) {
        enableAutoAnalysisFeature();
        vscode.window.showInformationMessage("✓ Analyse automatique activée");
    }
    else {
        if (autoAnalysisDisposable) {
            autoAnalysisDisposable.dispose();
            autoAnalysisDisposable = undefined;
        }
        vscode.window.showInformationMessage("✓ Analyse automatique désactivée");
    }
}
/**
 * Configure le nettoyage périodique du cache
 */
function setupCacheCleanup(context) {
    // Nettoyer le cache toutes les heures
    const interval = setInterval(() => {
        const removed = cacheService_1.cacheService.cleanup();
        if (removed > 0) {
            console.log(`✓ ${removed} entrées de cache expirées supprimées`);
        }
    }, 60 * 60 * 1000); // 1 heure
    context.subscriptions.push({
        dispose: () => clearInterval(interval),
    });
}
/**
 * Vérifie si un document doit être analysé
 */
function shouldAnalyzeDocument(document) {
    // Ignorer les schémas non-fichier
    if (document.uri.scheme !== "file") {
        return false;
    }
    // Ignorer les fichiers trop volumineux (> 1MB)
    if (document.getText().length > 1024 * 1024) {
        return false;
    }
    // Langages supportés
    const supportedLanguages = [
        "javascript",
        "typescript",
        "python",
        "java",
        "csharp",
        "php",
        "ruby",
        "go",
        "rust",
        "markdown",
        "plaintext",
    ];
    return supportedLanguages.includes(document.languageId);
}
/**
 * Vérifie la configuration au démarrage
 */
async function checkConfiguration() {
    if (!settings_1.ConfigurationManager.isConfigValid()) {
        const response = await vscode.window.showWarningMessage("TextLint AI: Clé API non configurée", "Configurer maintenant", "Plus tard");
        if (response === "Configurer maintenant") {
            await (0, settings_1.promptApiKey)();
        }
    }
}
/**
 * Affiche le menu de configuration
 */
async function showConfigurationMenu(context) {
    const config = settings_1.ConfigurationManager.getConfig();
    const options = [
        {
            label: "$(key) Configurer la clé API",
            description: config.apikey ? "Modifier" : "Ajouter",
            action: settings_1.promptApiKey,
        },
        {
            label: "$(symbol-parameter) Choisir le modèle",
            description: `Actuel: ${config.model}`,
            action: selectModel,
        },
        {
            label: "$(globe) Langue",
            description: `Actuel: ${config.language}`,
            action: selectLanguage,
        },
        {
            label: "$(gear) Analyse automatique",
            description: config.autoCorrect ? "Activée" : "Désactivée",
            action: toggleAutoAnalysis,
        },
        {
            label: "$(trash) Réinitialiser la configuration",
            description: "Revenir aux valeurs par défaut",
            action: resetConfiguration,
        },
    ];
    const selected = await vscode.window.showQuickPick(options, {
        placeHolder: "Configurer TextLint AI",
    });
    if (selected) {
        selected.action(context);
    }
}
/**
 * Sélectionne un modèle
 */
async function selectModel() {
    const models = [
        "gpt-4o",
        "gpt-4o-mini",
        "gpt-4",
        "gpt-4-turbo",
        "gpt-3.5-turbo",
    ];
    const selected = await vscode.window.showQuickPick(models, {
        placeHolder: "Sélectionnez un modèle OpenAI",
    });
    if (selected) {
        await settings_1.ConfigurationManager.updateConfig("model", selected);
        vscode.window.showInformationMessage(`✓ Modèle défini: ${selected}`);
    }
}
/**
 * Sélectionne une langue
 */
async function selectLanguage() {
    const languages = [
        { label: "Français", value: "fr" },
        { label: "English", value: "en" },
        { label: "Español", value: "es" },
        { label: "Deutsch", value: "de" },
        { label: "Italiano", value: "it" },
    ];
    const selected = await vscode.window.showQuickPick(languages, {
        placeHolder: "Sélectionnez une langue",
    });
    if (selected) {
        await settings_1.ConfigurationManager.updateConfig("language", selected.value);
        vscode.window.showInformationMessage(`✓ Langue définie: ${selected.label}`);
    }
}
/**
 * Réinitialise la configuration
 */
async function resetConfiguration() {
    const confirm = await vscode.window.showWarningMessage("Réinitialiser toute la configuration ?", { modal: true }, "Oui", "Non");
    if (confirm === "Oui") {
        await settings_1.ConfigurationManager.resetConfig();
        vscode.window.showInformationMessage("✓ Configuration réinitialisée");
    }
}
/**
 * Affiche les statistiques
 */
async function showStatistics() {
    const stats = cacheService_1.cacheService.getStats();
    const diagnosticsStats = require("./ui/diagnostics").getDiagnosticsBySeverity();
    const message = `
📊 Statistiques TextLint AI

Cache:
  • Entrées: ${stats.entries}
  • Taille: ${(stats.size / 1024).toFixed(2)} KB
  • Taux de réussite: ${(stats.hitRate * 100).toFixed(1)}%
  • Hits: ${stats.hits} / Misses: ${stats.misses}

Diagnostics:
  • Erreurs: ${diagnosticsStats.error}
  • Avertissements: ${diagnosticsStats.warning}
  • Infos: ${diagnosticsStats.info}
  • Astuces: ${diagnosticsStats.hint}
  `.trim();
    vscode.window.showInformationMessage(message);
}
/**
 * Exporte les statistiques du cache
 */
async function exportCacheStats() {
    const stats = cacheService_1.cacheService.getStats();
    const topEntries = cacheService_1.cacheService.getTopEntries(20);
    const data = {
        timestamp: new Date().toISOString(),
        stats,
        topEntries,
    };
    const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file("cache-stats.json"),
        filters: { JSON: ["json"] },
    });
    if (uri) {
        await vscode.workspace.fs.writeFile(uri, Buffer.from(JSON.stringify(data, null, 2), "utf8"));
        vscode.window.showInformationMessage("✓ Statistiques exportées");
    }
}
/**
 * Affiche le menu contextuel
 */
async function showContextMenu(context) {
    const actions = [
        {
            label: "$(file-code) Analyser le fichier",
            action: scan_1.scanFile,
        },
        {
            label: "$(selection) Analyser la sélection",
            action: scan_1.scanSelection,
        },
        {
            label: "$(eye) Prévisualiser les corrections",
            action: scan_1.previewCorrections,
        },
        {
            label: "$(refresh) Rafraîchir",
            action: scan_1.refresh,
        },
        {
            label: "$(gear) Configuration",
            action: () => showConfigurationMenu(context),
        },
    ];
    const selected = await vscode.window.showQuickPick(actions, {
        placeHolder: "TextLint AI - Actions",
    });
    if (selected) {
        await selected.action();
    }
}
/**
 * Affiche un message de bienvenue pour les nouveaux utilisateurs
 */
function showWelcomeMessage(context) {
    const hasSeenWelcome = context.globalState.get("textlint-ai.hasSeenWelcome");
    if (!hasSeenWelcome) {
        vscode.window
            .showInformationMessage("Bienvenue dans TextLint AI ! Configurez votre clé API pour commencer.", "Configurer", "Plus tard")
            .then((response) => {
            if (response === "Configurer") {
                (0, settings_1.promptApiKey)();
            }
        });
        context.globalState.update("textlint-ai.hasSeenWelcome", true);
    }
}
//# sourceMappingURL=extension.js.map