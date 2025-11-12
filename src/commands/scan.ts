/* eslint-disable curly */
import * as vscode from "vscode";
import { extractTextFromCode } from "../core/extractor";
import { CorrectionManager } from "../core/correctionManager";

const correctionManager = new CorrectionManager();

export async function scanFile() {
  const editor = vscode.window.activeTextEditor;

  if (!editor) return vscode.window.showWarningMessage("Aucun fichier ouvert");

  const code = editor.document.getText();
  const texts = extractTextFromCode(code);

  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "TextLint AI : Analyse en cours...",
      cancellable: false,
    },
    async () => {
      const corrections = await correctionManager.correctBlocks(
        texts.map((t) => t.text)
      );
    }
  );
}

export async function scanSelection() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return vscode.window.showWarningMessage("Aucun fichier ouvert");

  const selectionText = editor.document.getText(editor.selection);
  if (!selectionText)
    return vscode.window.showWarningMessage("Aucune sélection");

  const texts = extractTextFromCode(selectionText);

  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "TextLint AI : Analyse en cours...",
      cancellable: false,
    },
    async () => {
      const corrections = await correctionManager.correctBlocks(
        texts.map((t) => t.text)
      );
    }
  );
}

export async function applyCorrection() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return vscode.window.showWarningMessage("Aucun fichier  ouvert");

  const corrections = await correctionManager.applyCorrections(editor);
  vscode.window.showInformationMessage(
    `TextLint AI : ${corrections.length} corrections appliquées`
  );
}

export async function showPanel() {
  // showCorrectionPanel([]);
}

export async function refresh() {
  vscode.window.showInformationMessage(
    "TextLint AI : Rafraîchissement des diagnostics..."
  );
  scanFile();
}
