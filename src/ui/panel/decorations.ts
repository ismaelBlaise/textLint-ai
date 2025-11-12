/* eslint-disable curly */
import * as vscode from "vscode";
import { Correction } from "../../core/correctionManager";

export function decorateCorrections(
  editor: vscode.TextEditor,
  corrections: Correction[],
  selection?: vscode.Selection
) {
  if (!editor) return;

  const decorationType = vscode.window.createTextEditorDecorationType({
    borderWidth: "0 0 2px 0",
    borderStyle: "wavy",
    light: { borderColor: "#4CAF50" },
    dark: { borderColor: "#4CAF50" },
    overviewRulerColor: "#4CAF50",
    overviewRulerLane: vscode.OverviewRulerLane.Right,
    cursor: "pointer",
  });

  const ranges: vscode.DecorationOptions[] = corrections.map((c) => ({
    range: new vscode.Range(c.start, c.end),
    hoverMessage: `Correction proposée: **${c.text}**`,
  }));

  editor.setDecorations(decorationType, ranges);
}

export function clearDecorations(editor: vscode.TextEditor) {
  editor.setDecorations(vscode.window.createTextEditorDecorationType({}), []);
}
