// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { promptApiKey } from "./config/settings";
import {
  applyCorrection,
  refresh,
  scanFile,
  scanSelection,
  showPanel,
} from "./commands/scan";

export function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "textlint-ai" is now active!');

  const commands = [
    { id: "textlint-ai.login", func: promptApiKey },
    { id: "textlint-ai.scanFile", func: scanFile },
    { id: "textlint-ai.scanSelection", func: scanSelection },
    { id: "textlint-ai.applyCorrection", func: applyCorrection },
    { id: "textlint-ai.showPanel", func: showPanel },
    { id: "textlint-ai.refresh", func: refresh },
  ];

  commands.forEach((cmd) => {
    const disposable = vscode.commands.registerCommand(cmd.id, cmd.func);
    context.subscriptions.push(disposable);
  });
}

export function deactivate() {}
