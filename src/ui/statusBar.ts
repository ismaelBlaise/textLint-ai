import * as vscode from "vscode";
import { Correction } from "../core/correctionManager";

let statusBarItem: vscode.StatusBarItem | undefined;
let progressBarItem: vscode.StatusBarItem | undefined;

/**
 * Initialise la barre d'état
 */
export function initStatusBar() {
  if (!statusBarItem) {
    statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    statusBarItem.command = "textlint-ai.scanFile";
    statusBarItem.text = "$(pencil) TextLint AI";
    statusBarItem.tooltip = "Cliquez pour analyser le fichier";
    statusBarItem.show();
  }

  if (!progressBarItem) {
    progressBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      99
    );
  }
}

/**
 * Met à jour la barre d'état avec les corrections
 */
export function updateStatusBar(corrections: Correction[]) {
  if (!statusBarItem) {
    initStatusBar();
  }

  const count = corrections.length;
  const icon = getIconForCount(count);
  const color = getColorForCount(count);

  if (count === 0) {
    statusBarItem!.text = `$(check) TextLint AI: Aucune correction`;
    statusBarItem!.backgroundColor = new vscode.ThemeColor(
      "statusBarItem.prominentBackground"
    );
    statusBarItem!.color = undefined;
  } else {
    statusBarItem!.text = `${icon} TextLint AI: ${count} suggestion${
      count > 1 ? "s" : ""
    }`;
    statusBarItem!.backgroundColor = undefined;
    statusBarItem!.color = color;
  }

  // Ajouter des statistiques dans le tooltip
  const stats = calculateStats(corrections);
  statusBarItem!.tooltip = createTooltip(stats);
}

/**
 * Affiche une barre de progression
 */
export function showProgress(message: string, percentage?: number) {
  if (!progressBarItem) {
    initStatusBar();
  }

  let text = `$(sync~spin) ${message}`;
  if (percentage !== undefined) {
    text += ` ${Math.round(percentage)}%`;
  }

  progressBarItem!.text = text;
  progressBarItem!.show();
}

/**
 * Cache la barre de progression
 */
export function hideProgress() {
  if (progressBarItem) {
    progressBarItem.hide();
  }
}

/**
 * Affiche un message temporaire
 */
export function showTemporaryMessage(message: string, duration: number = 3000) {
  if (!statusBarItem) {
    initStatusBar();
  }

  const originalText = statusBarItem!.text;
  const originalTooltip = statusBarItem!.tooltip;

  statusBarItem!.text = message;
  statusBarItem!.tooltip = "";

  setTimeout(() => {
    statusBarItem!.text = originalText;
    statusBarItem!.tooltip = originalTooltip;
  }, duration);
}

/**
 * Met à jour avec un état d'erreur
 */
export function showError(message: string) {
  if (!statusBarItem) {
    initStatusBar();
  }

  statusBarItem!.text = `$(error) TextLint AI: Erreur`;
  statusBarItem!.tooltip = message;
  statusBarItem!.backgroundColor = new vscode.ThemeColor(
    "statusBarItem.errorBackground"
  );
}

/**
 * Met à jour avec un état d'avertissement
 */
export function showWarning(message: string) {
  if (!statusBarItem) {
    initStatusBar();
  }

  statusBarItem!.text = `$(warning) TextLint AI: Attention`;
  statusBarItem!.tooltip = message;
  statusBarItem!.backgroundColor = new vscode.ThemeColor(
    "statusBarItem.warningBackground"
  );
}

/**
 * Réinitialise la barre d'état
 */
export function resetStatusBar() {
  if (!statusBarItem) {
    initStatusBar();
  }

  statusBarItem!.text = "$(pencil) TextLint AI";
  statusBarItem!.tooltip = "Cliquez pour analyser le fichier";
  statusBarItem!.backgroundColor = undefined;
  statusBarItem!.color = undefined;
}

/**
 * Cache la barre d'état
 */
export function hideStatusBar() {
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
export function showStatusBar() {
  if (!statusBarItem) {
    initStatusBar();
  }
  statusBarItem!.show();
}

/**
 * Calcule les statistiques des corrections
 */
function calculateStats(corrections: Correction[]) {
  const stats = {
    total: corrections.length,
    highConfidence: 0,
    mediumConfidence: 0,
    lowConfidence: 0,
    types: new Map<string, number>(),
  };

  corrections.forEach((c) => {
    if (c.confidence) {
      if (c.confidence >= 0.9) {
        stats.highConfidence++;
      } else if (c.confidence >= 0.7) {
        stats.mediumConfidence++;
      } else {
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
function createTooltip(stats: ReturnType<typeof calculateStats>): string {
  let tooltip = `TextLint AI - ${stats.total} suggestion${
    stats.total > 1 ? "s" : ""
  }\n\n`;

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
function getIconForCount(count: number): string {
  if (count === 0) {
    return "$(check)";
  } else if (count <= 5) {
    return "$(info)";
  } else if (count <= 10) {
    return "$(warning)";
  } else {
    return "$(error)";
  }
}

/**
 * Retourne la couleur appropriée selon le nombre de corrections
 */
function getColorForCount(count: number): string | undefined {
  if (count === 0) {
    return "#4CAF50"; // Vert
  } else if (count <= 5) {
    return "#2196F3"; // Bleu
  } else if (count <= 10) {
    return "#FF9800"; // Orange
  } else {
    return "#f44336"; // Rouge
  }
}

/**
 * Anime la barre d'état (effet de pulsation)
 */
export function animateStatusBar(duration: number = 2000) {
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
export function createStatusBarMenu(): vscode.StatusBarItem {
  const menuItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    98
  );

  menuItem.text = "$(chevron-down)";
  menuItem.tooltip = "Options TextLint AI";
  menuItem.command = "textlint-ai.showMenu";

  return menuItem;
}

/**
 * Dispose les éléments de la barre d'état
 */
export function dispose() {
  if (statusBarItem) {
    statusBarItem.dispose();
    statusBarItem = undefined;
  }
  if (progressBarItem) {
    progressBarItem.dispose();
    progressBarItem = undefined;
  }
}
