import * as vscode from "vscode";

export interface TextlintConfig {
  apikey?: string;
  model: string;
  maxTokens: number;
  temperature: number;
  language: string;
  autoCorrect: boolean;
  ignorePatterns: string[];
  customPrompt?: string;
}

export class ConfigurationManager {
  private static readonly CONFIG_KEY = "textlint-ai";
  private static readonly DEFAULT_CONFIG: Partial<TextlintConfig> = {
    model: "gpt-4o-mini",
    maxTokens: 500,
    temperature: 0,
    language: "fr",
    autoCorrect: false,
    ignorePatterns: ["TODO", "FIXME", "XXX"],
  };

  static getConfig(): TextlintConfig {
    const config = vscode.workspace.getConfiguration(this.CONFIG_KEY);
    return {
      apikey: config.get<string>("apikey"),
      model: config.get<string>("model") || this.DEFAULT_CONFIG.model!,
      maxTokens:
        config.get<number>("maxTokens") || this.DEFAULT_CONFIG.maxTokens!,
      temperature:
        config.get<number>("temperature") || this.DEFAULT_CONFIG.temperature!,
      language: config.get<string>("language") || this.DEFAULT_CONFIG.language!,
      autoCorrect:
        config.get<boolean>("autoCorrect") || this.DEFAULT_CONFIG.autoCorrect!,
      ignorePatterns:
        config.get<string[]>("ignorePatterns") ||
        this.DEFAULT_CONFIG.ignorePatterns!,
      customPrompt: config.get<string>("customPrompt"),
    };
  }

  static getApiKey(): string | undefined {
    return this.getConfig().apikey;
  }

  static validateApiKey(apikey: string): boolean {
    return apikey.trim().length > 0;
  }

  static async promptApiKey(): Promise<boolean> {
    const apikey = await vscode.window.showInputBox({
      prompt: "Entrez votre cle API OpenAI personnelle",
      ignoreFocusOut: true,
      password: false,
      placeHolder: "Votre cle API",
      validateInput: (value) => {
        if (!value) {
          return "La cle API ne peut pas etre vide";
        }
        return null;
      },
    });

    if (apikey) {
      await this.updateConfig(
        "apikey",
        apikey,
        vscode.ConfigurationTarget.Global
      );
      vscode.window.showInformationMessage("Cle API enregistree avec succes");
      return true;
    }

    vscode.window.showWarningMessage("Cle API non definie");
    return false;
  }

  static async updateConfig<K extends keyof TextlintConfig>(
    key: K,
    value: TextlintConfig[K],
    target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global
  ): Promise<void> {
    await vscode.workspace
      .getConfiguration(this.CONFIG_KEY)
      .update(key, value, target);
  }

  static async resetConfig(): Promise<void> {
    const config = vscode.workspace.getConfiguration(this.CONFIG_KEY);
    const keys = Object.keys(this.DEFAULT_CONFIG) as (keyof TextlintConfig)[];

    for (const key of keys) {
      await config.update(
        key,
        this.DEFAULT_CONFIG[key],
        vscode.ConfigurationTarget.Global
      );
    }

    vscode.window.showInformationMessage("Configuration reinitialisee");
  }

  static isConfigValid(): boolean {
    const config = this.getConfig();
    return !!config.apikey && this.validateApiKey(config.apikey);
  }
}

export function getApiKey(): string | undefined {
  return ConfigurationManager.getApiKey();
}

export function getModel(): string {
  return ConfigurationManager.getConfig().model;
}

export async function promptApiKey(): Promise<boolean> {
  return ConfigurationManager.promptApiKey();
}
