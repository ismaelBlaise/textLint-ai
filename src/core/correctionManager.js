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
exports.CorrectionManager = void 0;
const vscode = __importStar(require("vscode"));
const aiClient_1 = require("./aiClient");
const cacheService_1 = require("../services/cacheService");
const extractor_1 = require("./extractor");
const settings_1 = require("../config/settings");
class CorrectionManager {
    aiClient;
    textExtractor;
    correctionHistory = new Map();
    undoStack = [];
    constructor() {
        this.aiClient = new aiClient_1.AIClient();
        this.textExtractor = new extractor_1.TextExtractor();
    }
    async correctBlocks(editor, texts, options = {}) {
        const startTime = Date.now();
        const corrections = [];
        let cached = 0;
        let failed = 0;
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Correction en cours...",
            cancellable: true,
        }, async (progress, token) => {
            for (let i = 0; i < texts.length; i++) {
                if (token.isCancellationRequested) {
                    break;
                }
                const text = texts[i];
                progress.report({
                    message: `${i + 1}/${texts.length}`,
                    increment: 100 / texts.length,
                });
                try {
                    let corrected = cacheService_1.cacheService.get(text.text);
                    let fromCache = false;
                    if (corrected) {
                        fromCache = true;
                        cached++;
                    }
                    else {
                        corrected = await this.aiClient.getCorrection(text.text, options);
                        if (corrected) {
                            cacheService_1.cacheService.set(text.text, corrected);
                        }
                        else {
                            corrected = text.text;
                            failed++;
                        }
                    }
                    corrections.push({
                        text: corrected,
                        start: text.start,
                        end: text.end,
                        original: text.text,
                        confidence: text.confidence,
                    });
                }
                catch (error) {
                    console.error(`Erreur lors de la correction de "${text.text}":`, error);
                    failed++;
                    corrections.push({
                        text: text.text,
                        start: text.start,
                        end: text.end,
                        original: text.text,
                        confidence: 0,
                    });
                }
            }
        });
        const stats = {
            totalTexts: texts.length,
            corrected: corrections.length - failed,
            cached,
            failed,
            duration: Date.now() - startTime,
        };
        return { corrections, stats };
    }
    async correctTextDetailed(textBlock, options = {}) {
        let result = await this.aiClient.getCorrectionDetailed(textBlock.text, options);
        if (!result) {
            const corrected = await this.aiClient.getCorrection(textBlock.text, options);
            if (corrected) {
                cacheService_1.cacheService.set(textBlock.text, corrected);
            }
            return {
                text: corrected || textBlock.text,
                start: textBlock.start,
                end: textBlock.end,
                original: textBlock.text,
                confidence: textBlock.confidence,
            };
        }
        cacheService_1.cacheService.set(textBlock.text, result.correctedText);
        return {
            text: result.correctedText,
            start: textBlock.start,
            end: textBlock.end,
            original: textBlock.text,
            confidence: result.confidence,
            changes: result.changes,
            result,
        };
    }
    async applyCorrections(editor, options = {}) {
        editor = editor || vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage("Aucun éditeur actif pour appliquer les corrections.");
            return {
                corrections: [],
                stats: {
                    totalTexts: 0,
                    corrected: 0,
                    cached: 0,
                    failed: 0,
                    duration: 0,
                },
            };
        }
        const document = editor.document;
        const config = settings_1.ConfigurationManager.getConfig();
        const texts = this.textExtractor.extractFromDocument(document, {
            language: config.language,
            ignorePatterns: config.ignorePatterns,
        });
        if (!texts.length) {
            vscode.window.showInformationMessage("Aucun texte à corriger trouvé.");
            return {
                corrections: [],
                stats: {
                    totalTexts: 0,
                    corrected: 0,
                    cached: 0,
                    failed: 0,
                    duration: 0,
                },
            };
        }
        const { corrections, stats } = await this.correctBlocks(editor, texts, options);
        this.saveToUndoStack(document.uri.toString(), corrections);
        const success = await editor.edit((editBuilder) => {
            corrections.forEach((c) => {
                if (c.text !== c.original) {
                    editBuilder.replace(new vscode.Range(c.start, c.end), c.text);
                }
            });
        });
        if (success) {
            this.showStats(stats);
            this.correctionHistory.set(document.uri.toString(), corrections);
        }
        return { corrections, stats };
    }
    async correctSelection(editor, options = {}) {
        editor = editor || vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage("Aucun éditeur actif.");
            return [];
        }
        const selection = editor.selection;
        if (selection.isEmpty) {
            vscode.window.showInformationMessage("Aucune sélection.");
            return [];
        }
        const document = editor.document;
        const texts = this.textExtractor.extractFromSelection(document, selection, {
            ignorePatterns: settings_1.ConfigurationManager.getConfig().ignorePatterns,
        });
        if (!texts.length) {
            vscode.window.showInformationMessage("Aucun texte à corriger dans la sélection.");
            return [];
        }
        const { corrections } = await this.correctBlocks(editor, texts, options);
        await editor.edit((editBuilder) => {
            corrections.forEach((c) => {
                if (c.text !== c.original) {
                    editBuilder.replace(new vscode.Range(c.start, c.end), c.text);
                }
            });
        });
        return corrections;
    }
    async previewCorrections(editor) {
        editor = editor || vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }
        const document = editor.document;
        const texts = this.textExtractor.extractFromDocument(document);
        if (!texts.length) {
            vscode.window.showInformationMessage("Aucun texte à corriger trouvé.");
            return;
        }
        const { corrections } = await this.correctBlocks(editor, texts);
        const changes = corrections.filter((c) => c.text !== c.original);
        if (!changes.length) {
            vscode.window.showInformationMessage("Aucune correction nécessaire.");
            return;
        }
        const items = changes.map((c) => ({
            label: `Ligne ${c.start.line + 1}`,
            description: c.original,
            detail: `→ ${c.text}`,
            correction: c,
        }));
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: "Sélectionnez une correction à appliquer",
            canPickMany: true,
        });
        if (selected && selected.length > 0) {
            await editor.edit((editBuilder) => {
                selected.forEach((item) => {
                    const c = item.correction;
                    editBuilder.replace(new vscode.Range(c.start, c.end), c.text);
                });
            });
        }
    }
    async undoCorrections(editor) {
        editor = editor || vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }
        const lastUndo = this.undoStack.pop();
        if (!lastUndo || lastUndo.document !== editor.document.uri.toString()) {
            vscode.window.showInformationMessage("Aucune correction à annuler.");
            return;
        }
        await editor.edit((editBuilder) => {
            lastUndo.corrections.forEach((c) => {
                if (c.original) {
                    editBuilder.replace(new vscode.Range(c.start, c.end), c.original);
                }
            });
        });
        vscode.window.showInformationMessage("Corrections annulées.");
    }
    clearCache() {
        cacheService_1.cacheService.clear();
        vscode.window.showInformationMessage("Cache de corrections effacé.");
    }
    getHistory(documentUri) {
        return this.correctionHistory.get(documentUri);
    }
    saveToUndoStack(documentUri, corrections) {
        this.undoStack.push({ document: documentUri, corrections });
        if (this.undoStack.length > 10) {
            this.undoStack.shift();
        }
    }
    showStats(stats) {
        const message = `✓ Correction terminée: ${stats.corrected}/${stats.totalTexts} textes corrigés (${stats.cached} depuis le cache) en ${(stats.duration / 1000).toFixed(1)}s`;
        if (stats.failed > 0) {
            vscode.window.showWarningMessage(`${message} - ${stats.failed} échecs`);
        }
        else {
            vscode.window.showInformationMessage(message);
        }
    }
    async analyzeText(editor) {
        editor = editor || vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }
        const texts = this.textExtractor.extractFromDocument(editor.document);
        if (!texts.length) {
            vscode.window.showInformationMessage("Aucun texte à analyser.");
            return;
        }
        const totalLength = texts.reduce((sum, t) => sum + t.text.length, 0);
        const avgConfidence = texts.reduce((sum, t) => sum + t.confidence, 0) / texts.length;
        const byType = texts.reduce((acc, t) => {
            acc[t.type] = (acc[t.type] || 0) + 1;
            return acc;
        }, {});
        const info = `
Analyse du texte:
- ${texts.length} segments détectés
- ${totalLength} caractères au total
- Confiance moyenne: ${(avgConfidence * 100).toFixed(1)}%
- Commentaires: ${byType.comment || 0}
- Chaînes: ${byType.string || 0}
- Docstrings: ${byType.docstring || 0}
    `.trim();
        vscode.window.showInformationMessage(info);
    }
}
exports.CorrectionManager = CorrectionManager;
//# sourceMappingURL=correctionManager.js.map