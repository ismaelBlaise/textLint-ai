import * as vscode from "vscode";
import { Correction, CorrectionManager } from "../core/correctionManager";
import { ConfigurationManager } from "../config/settings";
import { clearDiagnostics, updateDiagnostics } from "../ui/diagnostics";
import { decorateCorrections, clearDecorations } from "../ui/panel/decorations";
import { showCorrectionPanel } from "../ui/panel/panelController";
import { hideStatusBar, updateStatusBar } from "../ui/statusBar";

const correctionManager = new CorrectionManager();

interface AnalyzeOptions {
  selectionOnly?: boolean;
  silent?: boolean;
  openPanel?: boolean;
}

async function ensureConfigured(): Promise<boolean> {
  if (ConfigurationManager.isConfigValid()) {
    return true;
  }

  const configure = await vscode.window.showWarningMessage(
    "La cle API n'est pas configuree.",
    "Configurer",
    "Annuler"
  );

  if (configure === "Configurer") {
    return ConfigurationManager.promptApiKey();
  }

  return false;
}

async function analyzeEditor(
  editor: vscode.TextEditor,
  options: AnalyzeOptions = {}
): Promise<Correction[]> {
  if (!(await ensureConfigured())) {
    return [];
  }

  const runAnalysis = async (): Promise<Correction[]> => {
    const result = options.selectionOnly
      ? await correctionManager.analyzeSelection(editor, {
          language: ConfigurationManager.getConfig().language,
        })
      : await correctionManager.analyzeDocument(editor, {
          language: ConfigurationManager.getConfig().language,
        });

    const corrections = result.corrections;

    clearDiagnostics(editor.document);
    clearDecorations(editor);
    updateDiagnostics(editor.document, corrections);
    decorateCorrections(editor, corrections, options.selectionOnly);
    updateStatusBar(corrections);

    if (options.openPanel !== false) {
      showCorrectionPanel(corrections, result.stats);
    }

    if (!options.silent) {
      if (corrections.length > 0) {
        vscode.window.showInformationMessage(
          `${corrections.length} correction(s) detectee(s). Survolez le texte souligne pour corriger.`
        );
      } else {
        vscode.window.showInformationMessage("Aucune correction necessaire.");
      }
    }

    return corrections;
  };

  if (options.silent) {
    return runAnalysis();
  }

  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: options.selectionOnly
        ? "Analyse de la selection..."
        : "Analyse du document...",
    },
    runAnalysis
  );
}

export async function scanFile(silent: boolean = false) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return vscode.window.showWarningMessage("Aucun fichier ouvert.");
  }

  return analyzeEditor(editor, {
    silent,
    openPanel: !silent,
  });
}

export async function scanSelection() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return vscode.window.showWarningMessage("Aucun fichier ouvert.");
  }

  if (editor.selection.isEmpty) {
    return vscode.window.showWarningMessage("Aucune selection.");
  }

  return analyzeEditor(editor, {
    selectionOnly: true,
  });
}

export async function applyCorrection() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return vscode.window.showWarningMessage("Aucun fichier ouvert.");
  }

  const pendingCorrections = correctionManager.getPendingCorrections(editor);
  if (!pendingCorrections.length) {
    await analyzeEditor(editor, { silent: true, openPanel: false });
  }

  const correctionsToApply = correctionManager.getPendingCorrections(editor);
  if (!correctionsToApply.length) {
    return vscode.window.showInformationMessage("Aucune correction a appliquer.");
  }

  await correctionManager.applyCorrections(editor, correctionsToApply);
  correctionManager.clearPendingCorrections(editor);
  clearDiagnostics(editor.document);
  clearDecorations(editor);
  updateStatusBar([]);

  vscode.window.showInformationMessage(
    `${correctionsToApply.length} correction(s) appliquee(s).`
  );
}

export async function applySingleCorrection(correctionId: string) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const appliedCorrection = await correctionManager.applyCorrectionById(
    correctionId,
    editor
  );

  if (!appliedCorrection) {
    return;
  }

  const remainingCorrections = correctionManager.getPendingCorrections(editor);
  clearDiagnostics(editor.document);
  clearDecorations(editor);
  updateDiagnostics(editor.document, remainingCorrections);
  decorateCorrections(editor, remainingCorrections);
  updateStatusBar(remainingCorrections);
  showCorrectionPanel(remainingCorrections);

  vscode.window.showInformationMessage("Correction appliquee.");
}

export async function ignoreSingleCorrection(correctionId: string) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const removed = correctionManager.ignoreCorrection(correctionId, editor);
  if (!removed) {
    return;
  }

  const remainingCorrections = correctionManager.getPendingCorrections(editor);
  clearDiagnostics(editor.document);
  clearDecorations(editor);
  updateDiagnostics(editor.document, remainingCorrections);
  decorateCorrections(editor, remainingCorrections);
  updateStatusBar(remainingCorrections);
  showCorrectionPanel(remainingCorrections);

  vscode.window.showInformationMessage("Correction ignoree.");
}

export async function previewCorrections() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return vscode.window.showWarningMessage("Aucun fichier ouvert.");
  }

  await correctionManager.previewCorrections(editor);

  const remainingCorrections = correctionManager.getPendingCorrections(editor);
  clearDiagnostics(editor.document);
  clearDecorations(editor);
  updateDiagnostics(editor.document, remainingCorrections);
  decorateCorrections(editor, remainingCorrections);
  updateStatusBar(remainingCorrections);
  showCorrectionPanel(remainingCorrections);
}

export async function undoCorrections() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return vscode.window.showWarningMessage("Aucun fichier ouvert.");
  }

  await correctionManager.undoCorrections(editor);
  clearDiagnostics(editor.document);
  clearDecorations(editor);
  updateStatusBar([]);
}

export async function analyzeText() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return vscode.window.showWarningMessage("Aucun fichier ouvert.");
  }

  await correctionManager.analyzeText(editor);
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

export async function showPanel(corrections?: Correction[]) {
  const editor = vscode.window.activeTextEditor;
  const items =
    corrections || (editor ? correctionManager.getPendingCorrections(editor) : []);

  showCorrectionPanel(items);
}

export async function refresh() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  await analyzeEditor(editor, { silent: false });
}

export async function autoAnalyzeDocument(document: vscode.TextDocument) {
  const editor = vscode.window.visibleTextEditors.find(
    (item) => item.document.uri.toString() === document.uri.toString()
  );

  if (!editor || !ConfigurationManager.isConfigValid()) {
    return;
  }

  await analyzeEditor(editor, {
    silent: true,
    openPanel: false,
  });
}

export function getPendingCorrectionsForDocument(
  document: vscode.TextDocument
): Correction[] {
  return correctionManager.getPendingCorrections(document.uri.toString());
}

export function getCorrectionAtPosition(
  document: vscode.TextDocument,
  position: vscode.Position
): Correction | undefined {
  return correctionManager.getCorrectionAtPosition(document, position);
}

export function dispose() {
  clearDiagnostics();
  hideStatusBar();
}
