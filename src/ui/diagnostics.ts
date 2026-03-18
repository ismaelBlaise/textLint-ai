import * as vscode from "vscode";
import { Correction } from "../core/correctionManager";

let diagnosticCollection: vscode.DiagnosticCollection | undefined;
const debounceTimers = new Map<string, NodeJS.Timeout>();

export function initDiagnostics() {
  if (!diagnosticCollection) {
    diagnosticCollection =
      vscode.languages.createDiagnosticCollection("textlint-ai");
  }
}

export function updateDiagnostics(
  document: vscode.TextDocument,
  corrections: Correction[]
) {
  if (!diagnosticCollection) {
    initDiagnostics();
  }

  const diagnostics = corrections.map((correction) => {
    const diagnostic = new vscode.Diagnostic(
      new vscode.Range(correction.start, correction.end),
      createDiagnosticMessage(correction),
      getSeverityFromConfidence(correction.confidence)
    );

    diagnostic.source = "TextLint AI";
    diagnostic.code = "textlint-ai.correction";
    diagnostic.relatedInformation = [
      new vscode.DiagnosticRelatedInformation(
        new vscode.Location(
          document.uri,
          new vscode.Range(correction.start, correction.end)
        ),
        `Suggestion: ${correction.text}`
      ),
    ];

    return diagnostic;
  });

  diagnosticCollection!.set(document.uri, diagnostics);
}

export function clearDiagnostics(document?: vscode.TextDocument) {
  if (!diagnosticCollection) {
    return;
  }

  if (document) {
    diagnosticCollection.delete(document.uri);
    return;
  }

  diagnosticCollection.clear();
}

export function getDiagnostics(
  document: vscode.TextDocument
): readonly vscode.Diagnostic[] {
  if (!diagnosticCollection) {
    return [];
  }

  return diagnosticCollection.get(document.uri) || [];
}

export function getDiagnosticsBySeverity(): {
  error: number;
  warning: number;
  info: number;
  hint: number;
} {
  const result = { error: 0, warning: 0, info: 0, hint: 0 };

  if (!diagnosticCollection) {
    return result;
  }

  diagnosticCollection.forEach((_uri, diagnostics) => {
    diagnostics.forEach((diagnostic) => {
      switch (diagnostic.severity) {
        case vscode.DiagnosticSeverity.Error:
          result.error++;
          break;
        case vscode.DiagnosticSeverity.Warning:
          result.warning++;
          break;
        case vscode.DiagnosticSeverity.Information:
          result.info++;
          break;
        case vscode.DiagnosticSeverity.Hint:
          result.hint++;
          break;
      }
    });
  });

  return result;
}

function createDiagnosticMessage(correction: Correction): string {
  const original = correction.original || "";
  const suggestion = correction.text;
  return `Correction recommandee: "${original}" -> "${suggestion}"`;
}

function getSeverityFromConfidence(
  confidence?: number
): vscode.DiagnosticSeverity {
  if (confidence === undefined) {
    return vscode.DiagnosticSeverity.Warning;
  }

  if (confidence >= 0.85) {
    return vscode.DiagnosticSeverity.Information;
  }

  if (confidence >= 0.6) {
    return vscode.DiagnosticSeverity.Warning;
  }

  return vscode.DiagnosticSeverity.Error;
}

export function enableAutoAnalysis(
  callback: (document: vscode.TextDocument) => void
): vscode.Disposable {
  return vscode.workspace.onDidChangeTextDocument((event) => {
    if (event.contentChanges.length === 0) {
      return;
    }

    const key = event.document.uri.toString();
    const existingTimer = debounceTimers.get(key);

    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      debounceTimers.delete(key);
      callback(event.document);
    }, 700);

    debounceTimers.set(key, timer);
  });
}

export async function exportDiagnostics(): Promise<void> {
  if (!diagnosticCollection) {
    vscode.window.showInformationMessage("Aucun diagnostic a exporter.");
    return;
  }

  const data: Array<Record<string, unknown>> = [];

  diagnosticCollection.forEach((uri, diagnostics) => {
    diagnostics.forEach((diagnostic) => {
      data.push({
        file: uri.fsPath,
        line: diagnostic.range.start.line + 1,
        column: diagnostic.range.start.character + 1,
        severity: diagnostic.severity,
        message: diagnostic.message,
        source: diagnostic.source,
      });
    });
  });

  const uri = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file("diagnostics.json"),
    filters: { JSON: ["json"] },
  });

  if (!uri) {
    return;
  }

  await vscode.workspace.fs.writeFile(
    uri,
    Buffer.from(JSON.stringify(data, null, 2), "utf8")
  );

  vscode.window.showInformationMessage("Diagnostics exportes.");
}

export function dispose() {
  debounceTimers.forEach((timer) => clearTimeout(timer));
  debounceTimers.clear();

  if (diagnosticCollection) {
    diagnosticCollection.dispose();
    diagnosticCollection = undefined;
  }
}
