import * as vscode from "vscode";

export function getApiKey(): string | undefined {
  const config = vscode.workspace.getConfiguration("textlint-ai");
  return config.get<string>("apikey");
}

export function getModel(): string {
  const config = vscode.workspace.getConfiguration("textlint-ai");
  return config.get<string>("model") || "gpt-4o-mini";
}

export async function promptApiKey() {
  const apikey = await vscode.window.showInputBox({
    prompt: "Entrez votre clé API OpenAI personnelle",
    ignoreFocusOut: true,
    password: true,
  });

  if (apikey) {
    await vscode.workspace
      .getConfiguration("textlint-ai")
      .update("apikey", apikey, vscode.ConfigurationTarget.Global);
    vscode.window.showInformationMessage("Clé API enregistrée");
  } else {
    vscode.window.showWarningMessage("Clé API non définie");
  }
}
