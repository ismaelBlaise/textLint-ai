import * as vscode from "vscode";
import { Correction } from "../../core/correctionManager";
import { CorrectionStats } from "../../core/correctionManager";

let panel: vscode.WebviewPanel | undefined = undefined;
let currentCorrections: Correction[] = [];

export function showCorrectionPanel(
  corrections: Correction[],
  stats?: CorrectionStats
) {
  currentCorrections = corrections;
  const column = vscode.ViewColumn.Beside;

  if (!panel) {
    panel = vscode.window.createWebviewPanel(
      "textlintAI",
      "TextLint AI - Corrections",
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [],
      }
    );

    panel.onDidDispose(() => {
      panel = undefined;
    });

    panel.webview.onDidReceiveMessage(handleMessage);
  }

  panel.reveal(column);
  panel.webview.html = getHtml(corrections, stats);
}

async function handleMessage(message: any) {
  switch (message.command) {
    case "applyCorrection":
      await vscode.commands.executeCommand("textlint-ai.applyCorrection");
      break;

    case "applyOne":
      await applySingleCorrection(message.index);
      break;

    case "ignoreOne":
      ignoreSingleCorrection(message.index);
      break;

    case "copyCorrection":
      await vscode.env.clipboard.writeText(message.text);
      vscode.window.showInformationMessage("Correction copiée");
      break;

    case "refresh":
      await vscode.commands.executeCommand("textlint-ai.refresh");
      break;

    case "exportReport":
      await exportReport(currentCorrections);
      break;
  }
}

async function applySingleCorrection(index: number) {
  const editor = vscode.window.activeTextEditor;
  if (!editor || !currentCorrections[index]) {
    return;
  }

  const correction = currentCorrections[index];
  await editor.edit((editBuilder) => {
    editBuilder.replace(
      new vscode.Range(correction.start, correction.end),
      correction.text
    );
  });

  vscode.window.showInformationMessage("✓ Correction appliquée");

  // Retirer de la liste
  currentCorrections.splice(index, 1);
  if (panel) {
    panel.webview.html = getHtml(currentCorrections);
  }
}

function ignoreSingleCorrection(index: number) {
  currentCorrections.splice(index, 1);
  if (panel) {
    panel.webview.html = getHtml(currentCorrections);
  }
  vscode.window.showInformationMessage("Correction ignorée");
}

async function exportReport(corrections: Correction[]) {
  const uri = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file("textlint-report.json"),
    filters: {
      JSON: ["json"],
      Markdown: ["md"],
    },
  });

  if (!uri) {
    return;
  }

  let content: string;
  if (uri.fsPath.endsWith(".json")) {
    content = JSON.stringify(corrections, null, 2);
  } else {
    content = generateMarkdownReport(corrections);
  }

  await vscode.workspace.fs.writeFile(uri, Buffer.from(content, "utf8"));
  vscode.window.showInformationMessage("✓ Rapport exporté");
}

function generateMarkdownReport(corrections: Correction[]): string {
  let report = "# Rapport de Corrections TextLint AI\n\n";
  report += `**Date:** ${new Date().toLocaleString()}\n`;
  report += `**Nombre de corrections:** ${corrections.length}\n\n`;
  report += "---\n\n";

  corrections.forEach((c, i) => {
    report += `## Correction ${i + 1}\n\n`;
    report += `**Position:** Ligne ${c.start.line + 1}, Colonne ${
      c.start.character + 1
    }\n`;
    if (c.confidence) {
      report += `**Confiance:** ${Math.round(c.confidence * 100)}%\n`;
    }
    report += `\n**Original:**\n\`\`\`\n${c.original || c.text}\n\`\`\`\n`;
    report += `\n**Corrigé:**\n\`\`\`\n${c.text}\n\`\`\`\n\n`;

    if (c.changes && c.changes.length > 0) {
      report += "**Détails des changements:**\n";
      c.changes.forEach((change) => {
        report += `- **${change.type}**: \`${change.original}\` → \`${change.corrected}\`\n`;
        if (change.explanation) {
          report += `  - ${change.explanation}\n`;
        }
      });
      report += "\n";
    }

    report += "---\n\n";
  });

  return report;
}

function getHtml(corrections: Correction[], stats?: CorrectionStats): string {
  const correctionItems = corrections
    .map((c, index) => {
      const confidenceColor = getConfidenceColor(c.confidence);
      const confidenceText = c.confidence
        ? `${Math.round(c.confidence * 100)}%`
        : "N/A";

      const changesHtml =
        c.changes && c.changes.length > 0
          ? `
        <div class="changes">
          <strong>Changements détaillés:</strong>
          <ul>
            ${c.changes
              .map(
                (ch) => `
              <li>
                <span class="change-type ${ch.type}">${ch.type}</span>:
                <code>${escapeHtml(ch.original)}</code> → <code>${escapeHtml(
                  ch.corrected
                )}</code>
                ${
                  ch.explanation
                    ? `<br><em>${escapeHtml(ch.explanation)}</em>`
                    : ""
                }
              </li>
            `
              )
              .join("")}
          </ul>
        </div>
      `
          : "";

      return `
        <div class="correction-item" data-index="${index}">
          <div class="correction-header">
            <span class="correction-number">#${index + 1}</span>
            <span class="confidence-badge" style="background-color: ${confidenceColor}">
              ${confidenceText}
            </span>
            <span class="position">Ligne ${c.start.line + 1}</span>
          </div>
          
          <div class="correction-content">
            <div class="text-block">
              <label>Original:</label>
              <pre>${escapeHtml(c.original || c.text)}</pre>
            </div>
            
            <div class="arrow">→</div>
            
            <div class="text-block corrected">
              <label>Corrigé:</label>
              <pre>${escapeHtml(c.text)}</pre>
            </div>
          </div>

          ${changesHtml}
          
          <div class="correction-actions">
            <button class="btn btn-apply" onclick="applyOne(${index})">
              ✓ Appliquer
            </button>
            <button class="btn btn-ignore" onclick="ignoreOne(${index})">
              ✕ Ignorer
            </button>
            <button class="btn btn-copy" onclick="copyCorrection('${escapeHtml(
              c.text
            ).replace(/'/g, "\\'")}')">
              📋 Copier
            </button>
          </div>
        </div>
      `;
    })
    .join("");

  const statsHtml = stats
    ? `
    <div class="stats-panel">
      <div class="stat-item">
        <span class="stat-label">Total</span>
        <span class="stat-value">${stats.totalTexts}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Corrigés</span>
        <span class="stat-value success">${stats.corrected}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Cache</span>
        <span class="stat-value info">${stats.cached}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Échecs</span>
        <span class="stat-value error">${stats.failed}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Durée</span>
        <span class="stat-value">${(stats.duration / 1000).toFixed(1)}s</span>
      </div>
    </div>
  `
    : "";

  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>TextLint AI Corrections</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          padding: 1.5rem;
          background-color: var(--vscode-editor-background);
          color: var(--vscode-editor-foreground);
          line-height: 1.6;
        }
        
        h2 {
          color: var(--vscode-textLink-foreground);
          margin-bottom: 1rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid var(--vscode-panel-border);
        }
        
        .stats-panel {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
          gap: 1rem;
          margin-bottom: 1.5rem;
          padding: 1rem;
          background-color: var(--vscode-textBlockQuote-background);
          border-radius: 6px;
        }
        
        .stat-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.25rem;
        }
        
        .stat-label {
          font-size: 0.75rem;
          opacity: 0.7;
          text-transform: uppercase;
        }
        
        .stat-value {
          font-size: 1.5rem;
          font-weight: bold;
        }
        
        .stat-value.success { color: #4CAF50; }
        .stat-value.error { color: #f44336; }
        .stat-value.info { color: #2196F3; }
        
        .correction-item {
          margin-bottom: 1.5rem;
          padding: 1rem;
          background-color: var(--vscode-textBlockQuote-background);
          border-left: 3px solid var(--vscode-textLink-foreground);
          border-radius: 6px;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        
        .correction-item:hover {
          transform: translateX(4px);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }
        
        .correction-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1rem;
        }
        
        .correction-number {
          font-weight: bold;
          color: var(--vscode-textLink-foreground);
        }
        
        .confidence-badge {
          padding: 0.2rem 0.6rem;
          border-radius: 12px;
          font-size: 0.75rem;
          font-weight: bold;
          color: white;
        }
        
        .position {
          font-size: 0.85rem;
          opacity: 0.7;
          margin-left: auto;
        }
        
        .correction-content {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          gap: 1rem;
          margin-bottom: 1rem;
        }
        
        .text-block {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        
        .text-block label {
          font-size: 0.85rem;
          font-weight: bold;
          opacity: 0.8;
        }
        
        .text-block pre {
          padding: 0.75rem;
          background-color: var(--vscode-editor-background);
          border: 1px solid var(--vscode-panel-border);
          border-radius: 4px;
          font-family: 'Courier New', monospace;
          font-size: 0.9rem;
          white-space: pre-wrap;
          word-wrap: break-word;
        }
        
        .text-block.corrected pre {
          border-color: #4CAF50;
          background-color: rgba(76, 175, 80, 0.1);
        }
        
        .arrow {
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
          color: var(--vscode-textLink-foreground);
        }
        
        .changes {
          margin-bottom: 1rem;
          padding: 0.75rem;
          background-color: var(--vscode-editor-background);
          border-radius: 4px;
        }
        
        .changes strong {
          display: block;
          margin-bottom: 0.5rem;
        }
        
        .changes ul {
          list-style: none;
          padding-left: 1rem;
        }
        
        .changes li {
          margin-bottom: 0.5rem;
        }
        
        .change-type {
          display: inline-block;
          padding: 0.1rem 0.4rem;
          border-radius: 3px;
          font-size: 0.75rem;
          font-weight: bold;
          text-transform: uppercase;
        }
        
        .change-type.spelling { background-color: #FF9800; color: white; }
        .change-type.grammar { background-color: #2196F3; color: white; }
        .change-type.style { background-color: #9C27B0; color: white; }
        .change-type.punctuation { background-color: #F44336; color: white; }
        
        .correction-actions {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }
        
        .btn {
          padding: 0.5rem 1rem;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.9rem;
          font-weight: 500;
          transition: all 0.2s;
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
        }
        
        .btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
        
        .btn-apply {
          background-color: #4CAF50;
          color: white;
        }
        
        .btn-ignore {
          background-color: #f44336;
          color: white;
        }
        
        .btn-copy {
          background-color: #2196F3;
          color: white;
        }
        
        .btn-primary {
          background-color: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
        }
        
        .btn-secondary {
          background-color: var(--vscode-button-secondaryBackground);
          color: var(--vscode-button-secondaryForeground);
        }
        
        .main-actions {
          display: flex;
          gap: 0.75rem;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
        }
        
        .empty-state {
          text-align: center;
          padding: 3rem 1rem;
          opacity: 0.7;
        }
        
        .empty-state-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
        }
        
        code {
          padding: 0.1rem 0.3rem;
          background-color: var(--vscode-textCodeBlock-background);
          border-radius: 3px;
          font-family: 'Courier New', monospace;
          font-size: 0.9em;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>📝 Corrections proposées (${corrections.length})</h2>
      </div>
      
      ${statsHtml}
      
      ${
        corrections.length > 0
          ? `
        <div class="main-actions">
          <button class="btn btn-primary" onclick="applyAll()">
            ✓ Appliquer toutes les corrections
          </button>
          <button class="btn btn-secondary" onclick="refresh()">
            🔄 Rafraîchir
          </button>
          <button class="btn btn-secondary" onclick="exportReport()">
            📄 Exporter le rapport
          </button>
        </div>
        
        <div class="corrections-list">
          ${correctionItems}
        </div>
      `
          : `
        <div class="empty-state">
          <div class="empty-state-icon">✨</div>
          <h3>Aucune correction nécessaire</h3>
          <p>Votre texte est parfait !</p>
        </div>
      `
      }

      <script>
        const vscode = acquireVsCodeApi();
        
        function applyAll() {
          vscode.postMessage({ command: 'applyCorrection' });
        }
        
        function applyOne(index) {
          vscode.postMessage({ command: 'applyOne', index });
        }
        
        function ignoreOne(index) {
          vscode.postMessage({ command: 'ignoreOne', index });
        }
        
        function copyCorrection(text) {
          vscode.postMessage({ command: 'copyCorrection', text });
        }
        
        function refresh() {
          vscode.postMessage({ command: 'refresh' });
        }
        
        function exportReport() {
          vscode.postMessage({ command: 'exportReport' });
        }
      </script>
    </body>
    </html>
  `;
}

function getConfidenceColor(confidence?: number): string {
  if (!confidence) {
    return "#757575";
  }
  if (confidence >= 0.9) {
    return "#4CAF50";
  }
  if (confidence >= 0.7) {
    return "#2196F3";
  }
  if (confidence >= 0.5) {
    return "#FF9800";
  }
  return "#f44336";
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function dispose() {
  if (panel) {
    panel.dispose();
    panel = undefined;
  }
}
