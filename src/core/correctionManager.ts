import * as vscode from "vscode";
import { AIClient } from "./aiClient";
import { cacheService } from "../services/cacheService";
import { extractTextFromCode } from "./extractor";

export interface Correction {
  text: string;
  start: vscode.Position;
  end: vscode.Position;
  original?: string;
}

export class CorrectionManager {
  private aiClient: AIClient;

  constructor() {
    this.aiClient = new AIClient();
  }

  async correctBlocks(
    editor: vscode.TextEditor,
    texts: { text: string; start: vscode.Position; end: vscode.Position }[]
  ): Promise<Correction[]> {
    const corrections: Correction[] = [];

    for (const t of texts) {
      let corrected = cacheService.get(t.text);
      if (!corrected) {
        corrected = (await this.aiClient.getCorrection(t.text)) || t.text;
        cacheService.set(t.text, corrected);
      }

      corrections.push({
        text: corrected,
        start: t.start,
        end: t.end,
        original: t.text,
      });
    }

    return corrections;
  }

  async correctText(
    editor: vscode.TextEditor,
    textBlock: { text: string; start: vscode.Position; end: vscode.Position }
  ): Promise<Correction> {
    let corrected = cacheService.get(textBlock.text);
    if (!corrected) {
      corrected =
        (await this.aiClient.getCorrection(textBlock.text)) || textBlock.text;
      cacheService.set(textBlock.text, corrected);
    }

    return {
      text: corrected,
      start: textBlock.start,
      end: textBlock.end,
      original: textBlock.text,
    };
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

    const texts = extractTextFromCode(code).map((text) => {
      const startOffset = code.indexOf(text.text);
      const start = document.positionAt(startOffset);
      const end = document.positionAt(startOffset + text.text.length);
      return { text: text.text, start, end };
    });

    if (!texts.length) {
      vscode.window.showInformationMessage("Aucun texte à corriger trouvé.");
      return [];
    }

    const corrections = await this.correctBlocks(editor, texts);

    await editor.edit((editBuilder) => {
      corrections.forEach((c) => {
        editBuilder.replace(new vscode.Range(c.start, c.end), c.text);
      });
    });

    return corrections;
  }
}
