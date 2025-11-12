import * as vscode from "vscode";
import { Correction } from "../../core/correctionManager";

let panel: vscode.WebviewPanel | undefined = undefined;

export function showCorrectionPanel(corrections: Correction[]) {
  const column = vscode.ViewColumn.Beside;

  if (!panel) {
    panel = vscode.window.createWebviewPanel(
      "textlintAI",
      "TextLint AI - Corrections",
      column,
      {
        enableScripts: true,
      }
    );

    panel.onDidDispose(() => {
      panel = undefined;
    });

    panel.webview.onDidReceiveMessage((message) => {
      if (message.command === "applyCorrection") {
        vscode.commands.executeCommand("textlint-ai.applyCorrection");
      }
    });
  }

  panel.reveal(column);
  panel.webview.html = getHtml(corrections);
}

function getHtml(corrections: Correction[]): string {
  const correctionItems = corrections
    .map(
      (c) =>
        `<li class="correction-item">
          <strong>Original:</strong> ${escapeHtml(c.original || c.text)}<br>
          <strong>Correction:</strong> ${escapeHtml(c.text)}
        </li>`
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <title>TextLint AI Corrections</title>
      <link rel="stylesheet" href="panel.css">
      <style>
        body { font-family: sans-serif; padding: 1rem; background-color: #1e1e1e; color: #fff; }
        h2 { color: #4CAF50; }
        ul { list-style: none; padding: 0; }
        .correction-item { margin: 0.5rem 0; padding: 0.3rem; border-bottom: 1px solid #444; }
        button { margin-top: 1rem; background-color: #4CAF50; color: white; border: none; padding: 0.5rem 1rem; cursor: pointer; border-radius: 4px; }
      </style>
    </head>
    <body>
      <h2>Corrections proposées</h2>
      <ul>
        ${correctionItems}
      </ul>
      <button onclick="apply()">Appliquer toutes les corrections</button>

      <script>
        const vscode = acquireVsCodeApi();
        function apply() {
          vscode.postMessage({ command: 'applyCorrection' });
        }
      </script>
    </body>
    </html>
  `;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
