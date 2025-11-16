import * as vscode from "vscode";
import { Correction } from "../core/correctionManager";

let diagnosticCollection: vscode.DiagnosticCollection | undefined;

/**
 * Initialise la collection de diagnostics
 */
export function initDiagnostics() {
  if (!diagnosticCollection) {
    diagnosticCollection =
      vscode.languages.createDiagnosticCollection("textlint-ai");
  }
}

/**
 * Met à jour les diagnostics avec les corrections
 */
export function updateDiagnostics(
  document: vscode.TextDocument,
  corrections: Correction[]
) {
  if (!diagnosticCollection) {
    initDiagnostics();
  }

  const diagnostics: vscode.Diagnostic[] = corrections.map((c) => {
    const severity = getSeverityFromConfidence(c.confidence);
    const message = createDiagnosticMessage(c);

    const diagnostic = new vscode.Diagnostic(
      new vscode.Range(c.start, c.end),
      message,
      severity
    );

    diagnostic.source = "TextLint AI";
    diagnostic.code = {
      value: "textlint-correction",
      target: vscode.Uri.parse("https://github.com/yourusername/textlint-ai"),
    };

    // Ajouter des tags selon le type
    if (c.changes && c.changes.length > 0) {
      diagnostic.tags = c.changes.map((ch) => {
        if (ch.type === "spelling") {
          return vscode.DiagnosticTag.Unnecessary;
        }
        return vscode.DiagnosticTag.Deprecated;
      });
    }

    // Ajouter des informations supplémentaires
    if (c.changes && c.changes.length > 0) {
      diagnostic.relatedInformation = c.changes.map((ch) => {
        return new vscode.DiagnosticRelatedInformation(
          new vscode.Location(document.uri, new vscode.Range(c.start, c.end)),
          `${ch.type}: ${ch.explanation || "Correction suggérée"}`
        );
      });
    }

    return diagnostic;
  });

  diagnosticCollection!.set(document.uri, diagnostics);
}

/**
 * Met à jour un seul diagnostic
 */
export function updateSingleDiagnostic(
  document: vscode.TextDocument,
  correction: Correction
) {
  if (!diagnosticCollection) {
    initDiagnostics();
  }

  // Récupère une copie mutable du tableau de diagnostics (la collection renvoie un readonly[])
  const existing = Array.from(diagnosticCollection!.get(document.uri) || []);
  const severity = getSeverityFromConfidence(correction.confidence);
  const message = createDiagnosticMessage(correction);

  const diagnostic = new vscode.Diagnostic(
    new vscode.Range(correction.start, correction.end),
    message,
    severity
  );

  diagnostic.source = "TextLint AI";
  existing.push(diagnostic);
  diagnosticCollection!.set(document.uri, existing);
}

/**
 * Supprime les diagnostics pour un document
 */
export function clearDiagnostics(document?: vscode.TextDocument) {
  if (!diagnosticCollection) {
    return;
  }

  if (document) {
    diagnosticCollection.delete(document.uri);
  } else {
    diagnosticCollection.clear();
  }
}

/**
 * Supprime un diagnostic spécifique
 */
export function removeDiagnostic(
  document: vscode.TextDocument,
  correction: Correction
) {
  if (!diagnosticCollection) {
    return;
  }

  const existing = diagnosticCollection.get(document.uri) || [];
  const filtered = existing.filter((d) => {
    return (
      d.range.start.line !== correction.start.line ||
      d.range.start.character !== correction.start.character
    );
  });

  diagnosticCollection.set(document.uri, filtered);
}

/**
 * Obtient tous les diagnostics pour un document
 */
export function getDiagnostics(
  document: vscode.TextDocument
): readonly vscode.Diagnostic[] {
  if (!diagnosticCollection) {
    return [];
  }
  return diagnosticCollection.get(document.uri) || [];
}

/**
 * Obtient le nombre total de diagnostics
 */
export function getDiagnosticsCount(): number {
  if (!diagnosticCollection) {
    return 0;
  }

  let count = 0;
  diagnosticCollection.forEach((uri, diagnostics) => {
    count += diagnostics.length;
  });
  return count;
}

/**
 * Obtient les diagnostics par sévérité
 */
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

  diagnosticCollection.forEach((uri, diagnostics) => {
    diagnostics.forEach((d) => {
      switch (d.severity) {
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

/**
 * Crée un message de diagnostic enrichi
 */
function createDiagnosticMessage(correction: Correction): string {
  let message = "Correction suggérée";

  if (correction.original && correction.original !== correction.text) {
    message += `: "${correction.original}" → "${correction.text}"`;
  } else {
    message += `: "${correction.text}"`;
  }

  if (correction.confidence !== undefined) {
    message += ` (Confiance: ${Math.round(correction.confidence * 100)}%)`;
  }

  if (correction.changes && correction.changes.length > 0) {
    const types = [...new Set(correction.changes.map((c) => c.type))].join(
      ", "
    );
    message += ` [${types}]`;
  }

  return message;
}

/**
 * Détermine la sévérité en fonction de la confiance
 */
function getSeverityFromConfidence(
  confidence?: number
): vscode.DiagnosticSeverity {
  if (!confidence) {
    return vscode.DiagnosticSeverity.Information;
  }

  if (confidence >= 0.9) {
    return vscode.DiagnosticSeverity.Hint;
  } else if (confidence >= 0.7) {
    return vscode.DiagnosticSeverity.Information;
  } else if (confidence >= 0.5) {
    return vscode.DiagnosticSeverity.Warning;
  } else {
    return vscode.DiagnosticSeverity.Error;
  }
}

/**
 * Active l'analyse automatique au changement de document
 */
export function enableAutoAnalysis(
  callback: (document: vscode.TextDocument) => void
): vscode.Disposable {
  return vscode.workspace.onDidChangeTextDocument((event) => {
    // Analyse uniquement après une pause (debounce)
    setTimeout(() => {
      callback(event.document);
    }, 1000);
  });
}

/**
 * Exporte les diagnostics vers un fichier
 */
export async function exportDiagnostics(): Promise<void> {
  if (!diagnosticCollection) {
    vscode.window.showInformationMessage("Aucun diagnostic à exporter");
    return;
  }

  const data: any[] = [];
  diagnosticCollection.forEach((uri, diagnostics) => {
    diagnostics.forEach((d) => {
      data.push({
        file: uri.fsPath,
        line: d.range.start.line + 1,
        column: d.range.start.character + 1,
        severity: vscode.DiagnosticSeverity[d.severity],
        message: d.message,
        source: d.source,
      });
    });
  });

  const uri = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file("diagnostics.json"),
    filters: { JSON: ["json"] },
  });

  if (uri) {
    await vscode.workspace.fs.writeFile(
      uri,
      Buffer.from(JSON.stringify(data, null, 2), "utf8")
    );
    vscode.window.showInformationMessage("✓ Diagnostics exportés");
  }
}

/**
 * Dispose la collection de diagnostics
 */
export function dispose() {
  if (diagnosticCollection) {
    diagnosticCollection.dispose();
    diagnosticCollection = undefined;
  }
}
