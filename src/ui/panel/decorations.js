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
exports.decorateCorrections = decorateCorrections;
exports.clearDecorations = clearDecorations;
exports.updateDecoration = updateDecoration;
exports.highlightCorrection = highlightCorrection;
exports.dispose = dispose;
const vscode = __importStar(require("vscode"));
let decorationTypes;
/**
 * Crée les types de décoration avec styles modernes
 */
function getDecorationTypes() {
    if (!decorationTypes) {
        decorationTypes = {
            error: vscode.window.createTextEditorDecorationType({
                backgroundColor: "rgba(255, 0, 0, 0.15)",
                border: "1px solid rgba(255, 0, 0, 0.5)",
                borderRadius: "3px",
                overviewRulerColor: "rgba(255, 0, 0, 0.8)",
                overviewRulerLane: vscode.OverviewRulerLane.Right,
                light: {
                    border: "1px solid rgba(255, 0, 0, 0.6)",
                    backgroundColor: "rgba(255, 0, 0, 0.1)",
                },
                dark: {
                    border: "1px solid rgba(255, 0, 0, 0.5)",
                    backgroundColor: "rgba(255, 0, 0, 0.15)",
                },
            }),
            warning: vscode.window.createTextEditorDecorationType({
                backgroundColor: "rgba(255, 165, 0, 0.15)",
                border: "1px solid rgba(255, 165, 0, 0.5)",
                borderRadius: "3px",
                overviewRulerColor: "rgba(255, 165, 0, 0.8)",
                overviewRulerLane: vscode.OverviewRulerLane.Right,
                light: {
                    border: "1px solid rgba(255, 165, 0, 0.6)",
                    backgroundColor: "rgba(255, 165, 0, 0.1)",
                },
                dark: {
                    border: "1px solid rgba(255, 165, 0, 0.5)",
                    backgroundColor: "rgba(255, 165, 0, 0.15)",
                },
            }),
            info: vscode.window.createTextEditorDecorationType({
                backgroundColor: "rgba(100, 149, 237, 0.15)",
                border: "1px dashed rgba(100, 149, 237, 0.5)",
                borderRadius: "3px",
                overviewRulerColor: "rgba(100, 149, 237, 0.8)",
                overviewRulerLane: vscode.OverviewRulerLane.Right,
                light: {
                    border: "1px dashed rgba(100, 149, 237, 0.6)",
                    backgroundColor: "rgba(100, 149, 237, 0.1)",
                },
                dark: {
                    border: "1px dashed rgba(100, 149, 237, 0.5)",
                    backgroundColor: "rgba(100, 149, 237, 0.15)",
                },
            }),
            success: vscode.window.createTextEditorDecorationType({
                backgroundColor: "rgba(76, 175, 80, 0.15)",
                border: "1px solid rgba(76, 175, 80, 0.5)",
                borderRadius: "3px",
                overviewRulerColor: "rgba(76, 175, 80, 0.8)",
                overviewRulerLane: vscode.OverviewRulerLane.Right,
                light: {
                    border: "1px solid rgba(76, 175, 80, 0.6)",
                    backgroundColor: "rgba(76, 175, 80, 0.1)",
                },
                dark: {
                    border: "1px solid rgba(76, 175, 80, 0.5)",
                    backgroundColor: "rgba(76, 175, 80, 0.15)",
                },
            }),
        };
    }
    return decorationTypes;
}
/**
 * Détermine le type de décoration en fonction de la confiance
 */
function getDecorationType(confidence) {
    const types = getDecorationTypes();
    if (!confidence) {
        return types.info;
    }
    if (confidence >= 0.9) {
        return types.success;
    }
    else if (confidence >= 0.7) {
        return types.info;
    }
    else if (confidence >= 0.5) {
        return types.warning;
    }
    else {
        return types.error;
    }
}
/**
 * Applique les décorations aux corrections
 */
function decorateCorrections(editor, corrections, selectionOption) {
    // Effacer les décorations précédentes
    clearDecorations(editor);
    if (!corrections.length) {
        return;
    }
    // Grouper les corrections par niveau de confiance
    const decorationsByType = new Map();
    corrections.forEach((c) => {
        const decorationType = getDecorationType(c.confidence);
        const existing = decorationsByType.get(decorationType) || [];
        // Créer le message de hover enrichi
        const hoverMessage = createHoverMessage(c);
        existing.push({
            range: new vscode.Range(c.start, c.end),
            hoverMessage,
            renderOptions: {
                after: {
                    contentText: c.confidence
                        ? ` ${Math.round(c.confidence * 100)}%`
                        : "",
                    color: "rgba(153, 153, 153, 0.7)",
                    fontStyle: "italic",
                },
            },
        });
        decorationsByType.set(decorationType, existing);
    });
    // Appliquer toutes les décorations
    decorationsByType.forEach((decorations, type) => {
        editor.setDecorations(type, decorations);
    });
    // Révéler la première correction si demandé
    if (selectionOption && corrections.length > 0) {
        const firstCorrection = corrections[0];
        editor.revealRange(new vscode.Range(firstCorrection.start, firstCorrection.end), vscode.TextEditorRevealType.InCenter);
        editor.selection = new vscode.Selection(firstCorrection.start, firstCorrection.end);
    }
}
/**
 * Crée un message de hover enrichi avec markdown
 */
function createHoverMessage(correction) {
    const markdown = new vscode.MarkdownString();
    markdown.isTrusted = true;
    markdown.supportHtml = true;
    // En-tête
    markdown.appendMarkdown("### 📝 Correction proposée\n\n");
    // Texte original
    if (correction.original && correction.original !== correction.text) {
        markdown.appendMarkdown("**Original:**\n");
        markdown.appendCodeblock(correction.original, "text");
        markdown.appendMarkdown("\n");
        markdown.appendMarkdown("**Corrigé:**\n");
        markdown.appendCodeblock(correction.text, "text");
        markdown.appendMarkdown("\n");
    }
    else {
        markdown.appendMarkdown("**Texte:**\n");
        markdown.appendCodeblock(correction.text, "text");
        markdown.appendMarkdown("\n");
    }
    // Score de confiance
    if (correction.confidence !== undefined) {
        const percentage = Math.round(correction.confidence * 100);
        const emoji = percentage >= 90 ? "🟢" : percentage >= 70 ? "🟡" : "🔴";
        markdown.appendMarkdown(`**Confiance:** ${emoji} ${percentage}%\n\n`);
    }
    // Détail des changements
    if (correction.changes && correction.changes.length > 0) {
        markdown.appendMarkdown("**Changements:**\n\n");
        correction.changes.forEach((change, index) => {
            const icon = getChangeIcon(change.type);
            markdown.appendMarkdown(`${index + 1}. ${icon} **${change.type}**: \`${change.original}\` → \`${change.corrected}\`\n`);
            if (change.explanation) {
                markdown.appendMarkdown(`   *${change.explanation}*\n`);
            }
        });
    }
    // Actions
    markdown.appendMarkdown("\n---\n");
    markdown.appendMarkdown("*Cliquez sur la zone surlignée pour voir les options*");
    return markdown;
}
/**
 * Retourne une icône pour le type de changement
 */
function getChangeIcon(type) {
    const icons = {
        spelling: "📖",
        grammar: "✏️",
        style: "🎨",
        punctuation: "⁉️",
    };
    return icons[type] || "•";
}
/**
 * Efface toutes les décorations
 */
function clearDecorations(editor) {
    if (decorationTypes) {
        Object.values(decorationTypes).forEach((type) => {
            editor.setDecorations(type, []);
        });
    }
}
/**
 * Met à jour une seule décoration
 */
function updateDecoration(editor, correction) {
    const decorationType = getDecorationType(correction.confidence);
    const hoverMessage = createHoverMessage(correction);
    editor.setDecorations(decorationType, [
        {
            range: new vscode.Range(correction.start, correction.end),
            hoverMessage,
        },
    ]);
}
/**
 * Anime la décoration (highlight temporaire)
 */
async function highlightCorrection(editor, correction, duration = 1000) {
    const highlightType = vscode.window.createTextEditorDecorationType({
        backgroundColor: "rgba(255, 255, 0, 0.3)",
        border: "2px solid rgba(255, 255, 0, 0.8)",
    });
    editor.setDecorations(highlightType, [
        {
            range: new vscode.Range(correction.start, correction.end),
        },
    ]);
    // Révéler la correction
    editor.revealRange(new vscode.Range(correction.start, correction.end), vscode.TextEditorRevealType.InCenter);
    // Supprimer après duration
    setTimeout(() => {
        highlightType.dispose();
    }, duration);
}
/**
 * Dispose tous les types de décoration
 */
function dispose() {
    if (decorationTypes) {
        Object.values(decorationTypes).forEach((type) => type.dispose());
        decorationTypes = undefined;
    }
}
//# sourceMappingURL=decorations.js.map