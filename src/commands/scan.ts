/* eslint-disable curly */
import * as vscode from "vscode";
import { extractTextFromCode } from "../core/extractor";
import { CorrectionManager } from "../core/correctionManager";
import { showCorrectionPanel } from "../ui/panel/panelController";
import { decorateCorrections } from "../ui/panel/decorations";

const correctionManager = new CorrectionManager();

export async function scanFile() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return vscode.window.showWarningMessage("Aucun fichier ouvert");

  const code = editor.document.getText();
  const texts = extractTextFromCode(code);

  if (!texts.length)
    return vscode.window.showInformationMessage("Aucun texte à corriger.");

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "TextLint AI : Analyse en cours...",
      cancellable: false,
    },
    async () => {
      const corrections = await correctionManager.correctBlocks(editor, texts);
      decorateCorrections(editor, corrections);
      showCorrectionPanel(corrections);
    }
  );
}

export async function scanSelection() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return vscode.window.showWarningMessage("Aucun fichier ouvert");

  const selectionText = editor.document.getText(editor.selection);
  if (!selectionText)
    return vscode.window.showWarningMessage("Aucune sélection");

  const texts = extractTextFromCode(selectionText, editor.selection.start);
  if (!texts.length)
    return vscode.window.showInformationMessage(
      "Aucun texte à corriger dans la sélection."
    );

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "TextLint AI : Analyse de la sélection...",
      cancellable: false,
    },
    async () => {
      const corrections = await correctionManager.correctBlocks(editor, texts);
      decorateCorrections(editor, corrections, editor.selection);
      showCorrectionPanel(corrections);
    }
  );
}

export async function applyCorrection() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return vscode.window.showWarningMessage("Aucun fichier ouvert");

  const corrections = await correctionManager.applyCorrections(editor);
  vscode.window.showInformationMessage(
    `TextLint AI : ${corrections.length} correction(s) appliquée(s)`
  );
}

export async function showPanel(corrections: any[] = []) {
  showCorrectionPanel(corrections);
}

export async function refresh() {
  vscode.window.showInformationMessage(
    "TextLint AI : Rafraîchissement des diagnostics..."
  );
  scanFile();
}
