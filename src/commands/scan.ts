import * as vscode from "vscode";
import { CorrectionManager } from "../core/correctionManager";
import { showCorrectionPanel } from "../ui/panel/panelController";
import { decorateCorrections, clearDecorations } from "../ui/panel/decorations";
import { clearDiagnostics, updateDiagnostics } from "../ui/diagnostics";
import { updateStatusBar, hideStatusBar } from "../ui/statusBar";
import { ConfigurationManager } from "../config/settings";

const correctionManager = new CorrectionManager();

export async function scanFile() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return vscode.window.showWarningMessage("Aucun fichier ouvert");
  }

  if (!ConfigurationManager.isConfigValid()) {
    const configure = await vscode.window.showWarningMessage(
      "Clé API non configurée. Voulez-vous la configurer maintenant ?",
      "Configurer",
      "Annuler"
    );
    if (configure === "Configurer") {
      await ConfigurationManager.promptApiKey();
    }
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "TextLint AI : Analyse en cours...",
      cancellable: true,
    },
    async (progress, token) => {
      try {
        progress.report({ message: "Extraction du texte...", increment: 10 });

        const { corrections, stats } = await correctionManager.applyCorrections(
          editor,
          { language: ConfigurationManager.getConfig().language }
        );

        if (token.isCancellationRequested) {
          return;
        }

        progress.report({
          message: "Application des décorations...",
          increment: 30,
        });

        decorateCorrections(editor, corrections);
        updateDiagnostics(editor.document, corrections);
        updateStatusBar(corrections);

        progress.report({
          message: "Affichage des résultats...",
          increment: 30,
        });

        showCorrectionPanel(corrections, stats);

        if (corrections.length > 0) {
          vscode.window.showInformationMessage(
            `✓ ${stats.corrected} correction(s) trouvée(s) en ${(
              stats.duration / 1000
            ).toFixed(1)}s`
          );
        } else {
          vscode.window.showInformationMessage(
            "✓ Aucune correction nécessaire"
          );
        }
      } catch (error) {
        console.error("Erreur lors de l'analyse:", error);
        vscode.window.showErrorMessage(
          `Erreur lors de l'analyse: ${
            error instanceof Error ? error.message : "Erreur inconnue"
          }`
        );
      }
    }
  );
}

export async function scanSelection() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return vscode.window.showWarningMessage("Aucun fichier ouvert");
  }

  if (editor.selection.isEmpty) {
    return vscode.window.showWarningMessage("Aucune sélection");
  }

  if (!ConfigurationManager.isConfigValid()) {
    const configure = await vscode.window.showWarningMessage(
      "Clé API non configurée. Voulez-vous la configurer maintenant ?",
      "Configurer",
      "Annuler"
    );
    if (configure === "Configurer") {
      await ConfigurationManager.promptApiKey();
    }
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "TextLint AI : Analyse de la sélection...",
      cancellable: true,
    },
    async (progress, token) => {
      try {
        progress.report({ message: "Extraction du texte...", increment: 20 });

        const corrections = await correctionManager.correctSelection(editor, {
          language: ConfigurationManager.getConfig().language,
        });

        if (token.isCancellationRequested) {
          return;
        }

        progress.report({
          message: "Application des corrections...",
          increment: 40,
        });

        decorateCorrections(editor, corrections, editor.selection);
        showCorrectionPanel(corrections);

        if (corrections.length > 0) {
          vscode.window.showInformationMessage(
            `✓ ${corrections.length} correction(s) appliquée(s) dans la sélection`
          );
        } else {
          vscode.window.showInformationMessage(
            "✓ Aucune correction nécessaire dans la sélection"
          );
        }
      } catch (error) {
        console.error("Erreur lors de l'analyse de la sélection:", error);
        vscode.window.showErrorMessage(
          `Erreur: ${
            error instanceof Error ? error.message : "Erreur inconnue"
          }`
        );
      }
    }
  );
}

export async function applyCorrection() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return vscode.window.showWarningMessage("Aucun fichier ouvert");
  }

  const confirm = await vscode.window.showInformationMessage(
    "Appliquer toutes les corrections ?",
    { modal: true },
    "Oui",
    "Non"
  );

  if (confirm !== "Oui") {
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Application des corrections...",
      cancellable: false,
    },
    async () => {
      try {
        const { corrections, stats } = await correctionManager.applyCorrections(
          editor
        );

        clearDiagnostics();
        clearDecorations(editor);
        updateStatusBar([]);

        vscode.window.showInformationMessage(
          `✓ ${corrections.length} correction(s) appliquée(s) en ${(
            stats.duration / 1000
          ).toFixed(1)}s`
        );
      } catch (error) {
        console.error("Erreur lors de l'application:", error);
        vscode.window.showErrorMessage(
          `Erreur: ${
            error instanceof Error ? error.message : "Erreur inconnue"
          }`
        );
      }
    }
  );
}

export async function previewCorrections() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return vscode.window.showWarningMessage("Aucun fichier ouvert");
  }

  try {
    await correctionManager.previewCorrections(editor);
  } catch (error) {
    console.error("Erreur lors de la prévisualisation:", error);
    vscode.window.showErrorMessage(
      `Erreur: ${error instanceof Error ? error.message : "Erreur inconnue"}`
    );
  }
}

export async function undoCorrections() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return vscode.window.showWarningMessage("Aucun fichier ouvert");
  }

  try {
    await correctionManager.undoCorrections(editor);
    clearDiagnostics();
    clearDecorations(editor);
    updateStatusBar([]);
  } catch (error) {
    console.error("Erreur lors de l'annulation:", error);
    vscode.window.showErrorMessage(
      `Erreur: ${error instanceof Error ? error.message : "Erreur inconnue"}`
    );
  }
}

export async function analyzeText() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return vscode.window.showWarningMessage("Aucun fichier ouvert");
  }

  try {
    await correctionManager.analyzeText(editor);
  } catch (error) {
    console.error("Erreur lors de l'analyse:", error);
    vscode.window.showErrorMessage(
      `Erreur: ${error instanceof Error ? error.message : "Erreur inconnue"}`
    );
  }
}

export async function clearCache() {
  const confirm = await vscode.window.showWarningMessage(
    "Vider le cache des corrections ?",
    { modal: true },
    "Oui",
    "Non"
  );

  if (confirm === "Oui") {
    correctionManager.clearCache();
  }
}

export async function showPanel(corrections: any[] = []) {
  showCorrectionPanel(corrections);
}

export async function refresh() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  clearDiagnostics();
  clearDecorations(editor);
  await scanFile();
}

export function dispose() {
  clearDiagnostics();
  hideStatusBar();
}
