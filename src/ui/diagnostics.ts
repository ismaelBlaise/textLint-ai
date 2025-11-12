/* eslint-disable curly */
import * as vscode from "vscode";
import { Correction } from "../core/correctionManager";

let diagnosticCollection: vscode.DiagnosticCollection;

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
  if (!diagnosticCollection) initDiagnostics();

  const diagnostics: vscode.Diagnostic[] = corrections.map((c) => {
    const diag = new vscode.Diagnostic(
      new vscode.Range(c.start, c.end),
      `Correction proposée : ${c.text}`,
      vscode.DiagnosticSeverity.Information
    );
    diag.source = "TextLint AI";
    return diag;
  });

  diagnosticCollection.set(document.uri, diagnostics);
}

export function clearDiagnostics() {
  if (diagnosticCollection) diagnosticCollection.clear();
}
