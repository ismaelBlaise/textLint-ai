import * as vscode from "vscode";
import { Correction, CorrectionStats } from "../../core/correctionManager";

let panel: vscode.WebviewPanel | undefined;
let currentCorrections: Correction[] = [];

export function showCorrectionPanel(
  corrections: Correction[],
  stats?: CorrectionStats
) {
  currentCorrections = corrections;

  if (!panel) {
    panel = vscode.window.createWebviewPanel(
      "textlintAI",
      "TextLint AI",
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    panel.onDidDispose(() => {
      panel = undefined;
    });

    panel.webview.onDidReceiveMessage(handleMessage);
  }

  panel.reveal(vscode.ViewColumn.Beside);
  panel.webview.html = getHtml(currentCorrections, stats);
}

async function handleMessage(message: { command: string; index?: number; text?: string }) {
  switch (message.command) {
    case "applyAll":
      await vscode.commands.executeCommand("textlint-ai.applyCorrection");
      break;
    case "applyOne":
      if (typeof message.index === "number") {
        await applyOne(message.index);
      }
      break;
    case "ignoreOne":
      if (typeof message.index === "number") {
        await ignoreOne(message.index);
      }
      break;
    case "refresh":
      await vscode.commands.executeCommand("textlint-ai.refresh");
      break;
    case "copy":
      if (message.text) {
        await vscode.env.clipboard.writeText(message.text);
        vscode.window.showInformationMessage("Correction copiee.");
      }
      break;
  }
}

async function applyOne(index: number) {
  const correction = currentCorrections[index];
  if (!correction) {
    return;
  }

  await vscode.commands.executeCommand(
    "textlint-ai.applySingleCorrection",
    correction.id
  );
}

async function ignoreOne(index: number) {
  const correction = currentCorrections[index];
  if (!correction) {
    return;
  }

  await vscode.commands.executeCommand(
    "textlint-ai.ignoreSingleCorrection",
    correction.id
  );
}

function getHtml(corrections: Correction[], stats?: CorrectionStats): string {
  const statsHtml = stats
    ? `
      <section class="stats">
        <div class="stat"><span>Segments</span><strong>${stats.totalTexts}</strong></div>
        <div class="stat"><span>Corrections</span><strong>${stats.corrected}</strong></div>
        <div class="stat"><span>Cache</span><strong>${stats.cached}</strong></div>
        <div class="stat"><span>Echecs</span><strong>${stats.failed}</strong></div>
      </section>
    `
    : "";

  const itemsHtml = corrections.length
    ? corrections
        .map((correction, index) => {
          const confidence = correction.confidence
            ? `${Math.round(correction.confidence * 100)}%`
            : "N/A";

          const details = correction.changes?.length
            ? `
              <div class="details">
                ${correction.changes
                  .map(
                    (change) => `
                      <div class="detail">
                        <span class="tag">${escapeHtml(change.type)}</span>
                        <code>${escapeHtml(change.original)}</code>
                        <span class="arrow">-></span>
                        <code>${escapeHtml(change.corrected)}</code>
                      </div>
                    `
                  )
                  .join("")}
              </div>
            `
            : "";

          return `
            <article class="card">
              <header class="cardHeader">
                <div>
                  <strong>Ligne ${correction.start.line + 1}</strong>
                  <div class="meta">Confiance ${confidence}</div>
                </div>
                <span class="badge">${index + 1}</span>
              </header>

              <div class="textGrid">
                <section>
                  <label>Original</label>
                  <pre>${escapeHtml(correction.original || "")}</pre>
                </section>
                <section>
                  <label>Correction</label>
                  <pre class="corrected">${escapeHtml(correction.text)}</pre>
                </section>
              </div>

              ${details}

              <footer class="actions">
                <button class="primary" onclick="applyOne(${index})">Corriger</button>
                <button class="ghost" onclick="ignoreOne(${index})">Ignorer</button>
                <button class="ghost" onclick="copyText(${JSON.stringify(
                  correction.text
                )})">Copier</button>
              </footer>
            </article>
          `;
        })
        .join("")
    : `
      <section class="empty">
        <h3>Rien a corriger</h3>
        <p>Le texte actuel ne contient aucune suggestion active.</p>
      </section>
    `;

  return `<!DOCTYPE html>
  <html lang="fr">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>TextLint AI</title>
      <style>
        :root {
          --bg: var(--vscode-editor-background);
          --panel: color-mix(in srgb, var(--vscode-editor-background) 82%, #10233f 18%);
          --panel-2: color-mix(in srgb, var(--vscode-editor-background) 90%, #7c2d12 10%);
          --text: var(--vscode-editor-foreground);
          --muted: var(--vscode-descriptionForeground);
          --line: var(--vscode-panel-border);
          --accent: #e85d04;
          --accent-2: #2563eb;
          --good: #15803d;
        }

        * { box-sizing: border-box; }

        body {
          margin: 0;
          padding: 20px;
          background:
            radial-gradient(circle at top right, rgba(232, 93, 4, 0.16), transparent 24rem),
            radial-gradient(circle at top left, rgba(37, 99, 235, 0.18), transparent 20rem),
            var(--bg);
          color: var(--text);
          font: 13px/1.5 "Segoe UI", "Helvetica Neue", sans-serif;
        }

        .toolbar {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 18px;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
          gap: 12px;
          margin-bottom: 18px;
        }

        .stat, .card {
          border: 1px solid var(--line);
          border-radius: 16px;
          background: linear-gradient(180deg, var(--panel), var(--panel-2));
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.16);
        }

        .stat {
          padding: 14px;
        }

        .stat span, .meta, label, .empty p {
          color: var(--muted);
        }

        .stat strong {
          display: block;
          font-size: 20px;
          margin-top: 6px;
        }

        .card {
          padding: 16px;
          margin-bottom: 14px;
        }

        .cardHeader {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 14px;
        }

        .badge {
          min-width: 28px;
          height: 28px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          background: rgba(232, 93, 4, 0.18);
          color: #ffb37b;
          font-weight: 700;
        }

        .textGrid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }

        pre {
          margin: 6px 0 0;
          padding: 12px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(11, 18, 32, 0.42);
          white-space: pre-wrap;
          word-break: break-word;
          font-family: Consolas, "Courier New", monospace;
        }

        .corrected {
          border-color: rgba(21, 128, 61, 0.45);
          background: rgba(21, 128, 61, 0.14);
        }

        .details {
          margin-top: 12px;
          display: grid;
          gap: 8px;
        }

        .detail {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
          padding: 10px 12px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.04);
        }

        .tag {
          padding: 2px 8px;
          border-radius: 999px;
          background: rgba(37, 99, 235, 0.18);
          color: #93c5fd;
          text-transform: uppercase;
          font-size: 11px;
          letter-spacing: 0.05em;
        }

        .arrow {
          color: var(--muted);
        }

        .actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 14px;
        }

        button {
          border: 0;
          border-radius: 999px;
          padding: 10px 14px;
          cursor: pointer;
          color: white;
          font-weight: 600;
        }

        button.primary {
          background: linear-gradient(135deg, var(--accent), #fb923c);
        }

        button.ghost {
          background: rgba(255, 255, 255, 0.08);
          color: var(--text);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .empty {
          border: 1px dashed var(--line);
          border-radius: 18px;
          padding: 26px;
          text-align: center;
          background: rgba(255, 255, 255, 0.03);
        }
      </style>
    </head>
    <body>
      <div class="toolbar">
        <button class="primary" onclick="applyAll()">Corriger tout</button>
        <button class="ghost" onclick="refreshPanel()">Reanalyser</button>
      </div>
      ${statsHtml}
      ${itemsHtml}
      <script>
        const vscode = acquireVsCodeApi();
        function applyAll() { vscode.postMessage({ command: "applyAll" }); }
        function applyOne(index) { vscode.postMessage({ command: "applyOne", index }); }
        function ignoreOne(index) { vscode.postMessage({ command: "ignoreOne", index }); }
        function refreshPanel() { vscode.postMessage({ command: "refresh" }); }
        function copyText(text) { vscode.postMessage({ command: "copy", text }); }
      </script>
    </body>
  </html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function dispose() {
  panel?.dispose();
  panel = undefined;
}
