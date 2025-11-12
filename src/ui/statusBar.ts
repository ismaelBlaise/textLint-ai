/* eslint-disable curly */
import * as vscode from "vscode";
import { Correction } from "../core/correctionManager";

let statusBarItem: vscode.StatusBarItem;

export function initStatusBar() {
  if (!statusBarItem) {
    statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    statusBarItem.command = "textlint-ai.scanFile";
    statusBarItem.show();
  }
}

export function updateStatusBar(corrections: Correction[]) {
  if (!statusBarItem) initStatusBar();
  statusBarItem.text = `$(pencil) TextLint AI : ${corrections.length} suggestion(s)`;
  statusBarItem.tooltip = "Cliquez pour analyser le fichier";
}

export function hideStatusBar() {
  statusBarItem?.hide();
}
