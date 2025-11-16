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
exports.initStatusBar = initStatusBar;
exports.updateStatusBar = updateStatusBar;
exports.showProgress = showProgress;
exports.hideProgress = hideProgress;
exports.showTemporaryMessage = showTemporaryMessage;
exports.showError = showError;
exports.showWarning = showWarning;
exports.resetStatusBar = resetStatusBar;
exports.hideStatusBar = hideStatusBar;
exports.showStatusBar = showStatusBar;
exports.animateStatusBar = animateStatusBar;
exports.createStatusBarMenu = createStatusBarMenu;
exports.dispose = dispose;
const vscode = __importStar(require("vscode"));
let statusBarItem;
let progressBarItem;
/**
 * Initialise la barre d'état
 */
function initStatusBar() {
    if (!statusBarItem) {
        statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        statusBarItem.command = "textlint-ai.scanFile";
        statusBarItem.text = "$(pencil) TextLint AI";
        statusBarItem.tooltip = "Cliquez pour analyser le fichier";
        statusBarItem.show();
    }
    if (!progressBarItem) {
        progressBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
    }
}
/**
 * Met à jour la barre d'état avec les corrections
 */
function updateStatusBar(corrections) {
    if (!statusBarItem) {
        initStatusBar();
    }
    const count = corrections.length;
    const icon = getIconForCount(count);
    const color = getColorForCount(count);
    if (count === 0) {
        statusBarItem.text = `$(check) TextLint AI: Aucune correction`;
        statusBarItem.backgroundColor = new vscode.ThemeColor("statusBarItem.prominentBackground");
        statusBarItem.color = undefined;
    }
    else {
        statusBarItem.text = `${icon} TextLint AI: ${count} suggestion${count > 1 ? "s" : ""}`;
        statusBarItem.backgroundColor = undefined;
        statusBarItem.color = color;
    }
    // Ajouter des statistiques dans le tooltip
    const stats = calculateStats(corrections);
    statusBarItem.tooltip = createTooltip(stats);
}
/**
 * Affiche une barre de progression
 */
function showProgress(message, percentage) {
    if (!progressBarItem) {
        initStatusBar();
    }
    let text = `$(sync~spin) ${message}`;
    if (percentage !== undefined) {
        text += ` ${Math.round(percentage)}%`;
    }
    progressBarItem.text = text;
    progressBarItem.show();
}
/**
 * Cache la barre de progression
 */
function hideProgress() {
    if (progressBarItem) {
        progressBarItem.hide();
    }
}
/**
 * Affiche un message temporaire
 */
function showTemporaryMessage(message, duration = 3000) {
    if (!statusBarItem) {
        initStatusBar();
    }
    const originalText = statusBarItem.text;
    const originalTooltip = statusBarItem.tooltip;
    statusBarItem.text = message;
    statusBarItem.tooltip = "";
    setTimeout(() => {
        statusBarItem.text = originalText;
        statusBarItem.tooltip = originalTooltip;
    }, duration);
}
/**
 * Met à jour avec un état d'erreur
 */
function showError(message) {
    if (!statusBarItem) {
        initStatusBar();
    }
    statusBarItem.text = `$(error) TextLint AI: Erreur`;
    statusBarItem.tooltip = message;
    statusBarItem.backgroundColor = new vscode.ThemeColor("statusBarItem.errorBackground");
}
/**
 * Met à jour avec un état d'avertissement
 */
function showWarning(message) {
    if (!statusBarItem) {
        initStatusBar();
    }
    statusBarItem.text = `$(warning) TextLint AI: Attention`;
    statusBarItem.tooltip = message;
    statusBarItem.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
}
/**
 * Réinitialise la barre d'état
 */
function resetStatusBar() {
    if (!statusBarItem) {
        initStatusBar();
    }
    statusBarItem.text = "$(pencil) TextLint AI";
    statusBarItem.tooltip = "Cliquez pour analyser le fichier";
    statusBarItem.backgroundColor = undefined;
    statusBarItem.color = undefined;
}
/**
 * Cache la barre d'état
 */
function hideStatusBar() {
    if (statusBarItem) {
        statusBarItem.hide();
    }
    if (progressBarItem) {
        progressBarItem.hide();
    }
}
/**
 * Affiche la barre d'état
 */
function showStatusBar() {
    if (!statusBarItem) {
        initStatusBar();
    }
    statusBarItem.show();
}
/**
 * Calcule les statistiques des corrections
 */
function calculateStats(corrections) {
    const stats = {
        total: corrections.length,
        highConfidence: 0,
        mediumConfidence: 0,
        lowConfidence: 0,
        types: new Map(),
    };
    corrections.forEach((c) => {
        if (c.confidence) {
            if (c.confidence >= 0.9) {
                stats.highConfidence++;
            }
            else if (c.confidence >= 0.7) {
                stats.mediumConfidence++;
            }
            else {
                stats.lowConfidence++;
            }
        }
        if (c.changes) {
            c.changes.forEach((change) => {
                const count = stats.types.get(change.type) || 0;
                stats.types.set(change.type, count + 1);
            });
        }
    });
    return stats;
}
/**
 * Crée un tooltip enrichi
 */
function createTooltip(stats) {
    let tooltip = `TextLint AI - ${stats.total} suggestion${stats.total > 1 ? "s" : ""}\n\n`;
    if (stats.total > 0) {
        tooltip += "Confiance:\n";
        tooltip += `  • Haute (≥90%): ${stats.highConfidence}\n`;
        tooltip += `  • Moyenne (≥70%): ${stats.mediumConfidence}\n`;
        tooltip += `  • Basse (<70%): ${stats.lowConfidence}\n\n`;
        if (stats.types.size > 0) {
            tooltip += "Types de corrections:\n";
            stats.types.forEach((count, type) => {
                tooltip += `  • ${type}: ${count}\n`;
            });
            tooltip += "\n";
        }
    }
    tooltip += "Cliquez pour analyser le fichier";
    return tooltip;
}
/**
 * Retourne l'icône appropriée selon le nombre de corrections
 */
function getIconForCount(count) {
    if (count === 0) {
        return "$(check)";
    }
    else if (count <= 5) {
        return "$(info)";
    }
    else if (count <= 10) {
        return "$(warning)";
    }
    else {
        return "$(error)";
    }
}
/**
 * Retourne la couleur appropriée selon le nombre de corrections
 */
function getColorForCount(count) {
    if (count === 0) {
        return "#4CAF50"; // Vert
    }
    else if (count <= 5) {
        return "#2196F3"; // Bleu
    }
    else if (count <= 10) {
        return "#FF9800"; // Orange
    }
    else {
        return "#f44336"; // Rouge
    }
}
/**
 * Anime la barre d'état (effet de pulsation)
 */
function animateStatusBar(duration = 2000) {
    if (!statusBarItem) {
        return;
    }
    let frame = 0;
    const frames = ["$(loading~spin)", "$(sync~spin)", "$(gear~spin)"];
    const interval = setInterval(() => {
        if (statusBarItem) {
            const text = statusBarItem.text.split(" ");
            text[0] = frames[frame % frames.length];
            statusBarItem.text = text.join(" ");
            frame++;
        }
    }, 200);
    setTimeout(() => {
        clearInterval(interval);
    }, duration);
}
/**
 * Crée un menu contextuel pour la barre d'état
 */
function createStatusBarMenu() {
    const menuItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 98);
    menuItem.text = "$(chevron-down)";
    menuItem.tooltip = "Options TextLint AI";
    menuItem.command = "textlint-ai.showMenu";
    return menuItem;
}
/**
 * Dispose les éléments de la barre d'état
 */
function dispose() {
    if (statusBarItem) {
        statusBarItem.dispose();
        statusBarItem = undefined;
    }
    if (progressBarItem) {
        progressBarItem.dispose();
        progressBarItem = undefined;
    }
}
//# sourceMappingURL=statusBar.js.map