import * as vscode from "vscode";
import { Correction } from "../../core/correctionManager";

let decorationType: vscode.TextEditorDecorationType | undefined;

function getDecorationType(): vscode.TextEditorDecorationType {
  if (!decorationType) {
    decorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: "rgba(255, 215, 0, 0.2)",
      border: "1px dashed #FFD700",
      borderRadius: "2px",
      overviewRulerColor: "#FFD700",
      overviewRulerLane: vscode.OverviewRulerLane.Right,
      light: {
        border: "1px dashed #FFD700",
        backgroundColor: "rgba(255, 215, 0, 0.2)",
      },
      dark: {
        border: "1px dashed #FFD700",
        backgroundColor: "rgba(255, 215, 0, 0.2)",
      },
    });
  }
  return decorationType;
}

export function decorateCorrections(
  editor: vscode.TextEditor,
  corrections: Correction[],
  selectionOption?: vscode.Selection
) {
  const decorations: vscode.DecorationOptions[] = corrections.map((c) => ({
    range: new vscode.Range(c.start, c.end),
    hoverMessage: `**Correction proposée :** ${c.text}`,
  }));

  editor.setDecorations(getDecorationType(), decorations);

  if (selectionOption && corrections.length) {
    editor.revealRange(
      new vscode.Range(corrections[0].start, corrections[0].end)
    );
    editor.selection = new vscode.Selection(
      corrections[0].start,
      corrections[0].end
    );
  }
}
