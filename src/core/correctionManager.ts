/* eslint-disable curly */
import * as vscode from "vscode";
import { AIClient } from "./aiClient";
import { cacheService, CacheService } from "../services/cacheService";
import { extractTextFromCode } from "./extractor";

export interface Correction {
  text: string;
  start: vscode.Position;
  end: vscode.Position;
}
export class CorrectionManager {
  private aiClient: AIClient;

  constructor() {
    this.aiClient = new AIClient();
  }

  async correctBlocks(texts: string[]): Promise<string[]> {
    const results: string[] = [];
    for (const text of texts) {
      let correction = cacheService.get(text);
      if (!correction) {
        correction = (await this.aiClient.getCorrection(text)) || "";
        cacheService.set(text, correction);
      }
      results.push(correction);
    }

    return results;
  }

  async correctText(text: string): Promise<string> {
    let correction = cacheService.get(text);
    if (!correction) {
      correction = (await this.aiClient.getCorrection(text)) || "";
      cacheService.set(text, correction);
    }

    return correction;
  }

  async applyCorrections(editor?: vscode.TextEditor): Promise<Correction[]> {
    editor = editor || vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage(
        "Aucun éditeur actif pour appliquer les corrections."
      );
      return [];
    }

    const document = editor.document;
    const code = document.getText();

    const texts = extractTextFromCode(code);

    if (!texts.length) {
      vscode.window.showInformationMessage("Aucun texte à corriger trouvé.");
      return [];
    }

    const correctedTexts = await this.correctBlocks(texts.map((t) => t.text));

    const corrections: Correction[] = [];

    texts.forEach((originalText, index) => {
      const startOffset = code.indexOf(originalText.text);
      if (startOffset === -1) return;

      const start = document.positionAt(startOffset);
      const end = document.positionAt(startOffset + originalText.text.length);

      corrections.push({
        text: correctedTexts[index],
        start,
        end,
      });
    });

    await editor.edit((editBuilder) => {
      corrections.forEach((correction) => {
        editBuilder.replace(
          new vscode.Range(correction.start, correction.end),
          correction.text
        );
      });
    });

    return corrections;
  }
}
