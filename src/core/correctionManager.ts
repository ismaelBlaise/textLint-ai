import * as vscode from "vscode";
import { AIClient, CorrectionOptions, CorrectionResult } from "./aiClient";
import { cacheService } from "../services/cacheService";
import { TextExtractor, ExtractedText } from "./extractor";
import { ConfigurationManager } from "../config/settings";

export interface Correction {
  id: string;
  text: string;
  start: vscode.Position;
  end: vscode.Position;
  original?: string;
  confidence?: number;
  changes?: CorrectionResult["changes"];
  context?: string;
  documentUri?: string;
}

export interface CorrectionStats {
  totalTexts: number;
  corrected: number;
  cached: number;
  failed: number;
  duration: number;
}

export class CorrectionManager {
  private aiClient?: AIClient;
  private textExtractor: TextExtractor;
  private pendingCorrections = new Map<string, Correction[]>();
  private correctionHistory = new Map<string, Correction[]>();
  private undoStack: Array<{ document: string; corrections: Correction[] }> = [];

  constructor() {
    this.textExtractor = new TextExtractor();
  }

  private getAIClient(): AIClient {
    if (!this.aiClient) {
      this.aiClient = new AIClient();
    }

    return this.aiClient;
  }

  async analyzeDocument(
    editor?: vscode.TextEditor,
    options: CorrectionOptions = {}
  ): Promise<{ corrections: Correction[]; stats: CorrectionStats }> {
    const activeEditor = editor || vscode.window.activeTextEditor;
    if (!activeEditor) {
      return {
        corrections: [],
        stats: this.createEmptyStats(),
      };
    }

    const document = activeEditor.document;
    const config = ConfigurationManager.getConfig();
    const texts = this.textExtractor.extractFromDocument(document, {
      language: config.language,
      ignorePatterns: config.ignorePatterns,
    });

    const result = await this.buildCorrections(activeEditor, texts, {
      ...options,
      language: options.language || config.language,
      customPrompt: options.customPrompt || config.customPrompt,
    });

    this.pendingCorrections.set(document.uri.toString(), result.corrections);
    return result;
  }

  async analyzeSelection(
    editor?: vscode.TextEditor,
    options: CorrectionOptions = {}
  ): Promise<{ corrections: Correction[]; stats: CorrectionStats }> {
    const activeEditor = editor || vscode.window.activeTextEditor;
    if (!activeEditor) {
      return {
        corrections: [],
        stats: this.createEmptyStats(),
      };
    }

    const selection = activeEditor.selection;
    if (selection.isEmpty) {
      return {
        corrections: [],
        stats: this.createEmptyStats(),
      };
    }

    const config = ConfigurationManager.getConfig();
    const texts = this.textExtractor.extractFromSelection(
      activeEditor.document,
      selection,
      {
        language: config.language,
        ignorePatterns: config.ignorePatterns,
      }
    );

    const result = await this.buildCorrections(activeEditor, texts, {
      ...options,
      language: options.language || config.language,
      customPrompt: options.customPrompt || config.customPrompt,
    });

    this.pendingCorrections.set(
      activeEditor.document.uri.toString(),
      result.corrections
    );
    return result;
  }

  async previewCorrections(editor?: vscode.TextEditor): Promise<void> {
    const activeEditor = editor || vscode.window.activeTextEditor;
    if (!activeEditor) {
      return;
    }

    let corrections = this.getPendingCorrections(activeEditor);
    if (!corrections.length) {
      corrections = (await this.analyzeDocument(activeEditor)).corrections;
    }

    if (!corrections.length) {
      vscode.window.showInformationMessage("Aucune correction necessaire.");
      return;
    }

    const items = corrections.map((correction) => ({
      label: `Ligne ${correction.start.line + 1}`,
      description: correction.original || "",
      detail: correction.text,
      correctionId: correction.id,
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: "Selectionnez les corrections a appliquer",
      canPickMany: true,
    });

    if (!selected || selected.length === 0) {
      return;
    }

    const ids = new Set(selected.map((item) => item.correctionId));
    const chosenCorrections = corrections.filter((correction) =>
      ids.has(correction.id)
    );

    await this.applyCorrections(activeEditor, chosenCorrections);
  }

  async applyCorrections(
    editor?: vscode.TextEditor,
    corrections?: Correction[]
  ): Promise<{ corrections: Correction[]; stats: CorrectionStats }> {
    const activeEditor = editor || vscode.window.activeTextEditor;
    if (!activeEditor) {
      return {
        corrections: [],
        stats: this.createEmptyStats(),
      };
    }

    const documentUri = activeEditor.document.uri.toString();
    const suggestions =
      corrections && corrections.length > 0
        ? corrections
        : this.getPendingCorrections(activeEditor);

    if (!suggestions.length) {
      const analysis = await this.analyzeDocument(activeEditor);
      if (!analysis.corrections.length) {
        return analysis;
      }
      return this.applyCorrections(activeEditor, analysis.corrections);
    }

    const sortedCorrections = [...suggestions].sort((left, right) =>
      this.comparePositionsDescending(left.start, right.start)
    );

    this.saveToUndoStack(documentUri, sortedCorrections);

    const success = await activeEditor.edit((editBuilder) => {
      sortedCorrections.forEach((correction) => {
        if (correction.original && correction.text !== correction.original) {
          editBuilder.replace(
            new vscode.Range(correction.start, correction.end),
            correction.text
          );
        }
      });
    });

    if (!success) {
      throw new Error("Impossible d'appliquer les corrections.");
    }

    const remainingCorrections = this.getPendingCorrections(activeEditor).filter(
      (pendingCorrection) =>
        !sortedCorrections.some(
          (appliedCorrection) => appliedCorrection.id === pendingCorrection.id
        )
    );

    this.pendingCorrections.set(documentUri, remainingCorrections);
    this.correctionHistory.set(documentUri, sortedCorrections);

    return {
      corrections: sortedCorrections,
      stats: {
        totalTexts: sortedCorrections.length,
        corrected: sortedCorrections.length,
        cached: 0,
        failed: 0,
        duration: 0,
      },
    };
  }

  async applyCorrectionById(
    correctionId: string,
    editor?: vscode.TextEditor
  ): Promise<Correction | undefined> {
    const activeEditor = editor || vscode.window.activeTextEditor;
    if (!activeEditor) {
      return undefined;
    }

    const correction = this.getPendingCorrections(activeEditor).find(
      (item) => item.id === correctionId
    );

    if (!correction) {
      return undefined;
    }

    await this.applyCorrections(activeEditor, [correction]);
    return correction;
  }

  ignoreCorrection(correctionId: string, editor?: vscode.TextEditor): boolean {
    const activeEditor = editor || vscode.window.activeTextEditor;
    if (!activeEditor) {
      return false;
    }

    const documentUri = activeEditor.document.uri.toString();
    const existing = this.getPendingCorrections(activeEditor);
    const filtered = existing.filter((correction) => correction.id !== correctionId);

    if (filtered.length === existing.length) {
      return false;
    }

    this.pendingCorrections.set(documentUri, filtered);
    return true;
  }

  async undoCorrections(editor?: vscode.TextEditor): Promise<void> {
    const activeEditor = editor || vscode.window.activeTextEditor;
    if (!activeEditor) {
      return;
    }

    const lastUndo = this.undoStack.pop();
    if (!lastUndo || lastUndo.document !== activeEditor.document.uri.toString()) {
      vscode.window.showInformationMessage("Aucune correction a annuler.");
      return;
    }

    const corrections = [...lastUndo.corrections].sort((left, right) =>
      this.comparePositionsDescending(left.start, right.start)
    );

    await activeEditor.edit((editBuilder) => {
      corrections.forEach((correction) => {
        if (correction.original !== undefined) {
          editBuilder.replace(
            new vscode.Range(correction.start, correction.end),
            correction.original
          );
        }
      });
    });

    vscode.window.showInformationMessage("Corrections annulees.");
  }

  clearCache(): void {
    cacheService.clear();
    vscode.window.showInformationMessage("Cache des corrections vide.");
  }

  clearPendingCorrections(editor?: vscode.TextEditor): void {
    const activeEditor = editor || vscode.window.activeTextEditor;
    if (!activeEditor) {
      return;
    }

    this.pendingCorrections.delete(activeEditor.document.uri.toString());
  }

  getPendingCorrections(editorOrUri?: vscode.TextEditor | string): Correction[] {
    if (!editorOrUri) {
      return [];
    }

    const documentUri =
      typeof editorOrUri === "string"
        ? editorOrUri
        : editorOrUri.document.uri.toString();

    return this.pendingCorrections.get(documentUri) || [];
  }

  getCorrectionAtPosition(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Correction | undefined {
    return this.getPendingCorrections(document.uri.toString()).find((correction) =>
      new vscode.Range(correction.start, correction.end).contains(position)
    );
  }

  getHistory(documentUri: string): Correction[] | undefined {
    return this.correctionHistory.get(documentUri);
  }

  async analyzeText(editor?: vscode.TextEditor): Promise<void> {
    const activeEditor = editor || vscode.window.activeTextEditor;
    if (!activeEditor) {
      return;
    }

    const texts = this.textExtractor.extractFromDocument(activeEditor.document);
    if (!texts.length) {
      vscode.window.showInformationMessage("Aucun texte a analyser.");
      return;
    }

    const totalLength = texts.reduce((sum, text) => sum + text.text.length, 0);
    const avgConfidence =
      texts.reduce((sum, text) => sum + text.confidence, 0) / texts.length;

    const message = [
      "Analyse du texte",
      `${texts.length} segment(s) detecte(s)`,
      `${totalLength} caracteres`,
      `Confiance moyenne ${(avgConfidence * 100).toFixed(1)}%`,
    ].join(" | ");

    vscode.window.showInformationMessage(message);
  }

  private async buildCorrections(
    editor: vscode.TextEditor,
    texts: ExtractedText[],
    options: CorrectionOptions
  ): Promise<{ corrections: Correction[]; stats: CorrectionStats }> {
    const startTime = Date.now();
    const corrections: Correction[] = [];
    let cached = 0;
    let failed = 0;

    for (const textBlock of texts) {
      try {
        const cachedValue = cacheService.get(textBlock.text);

        if (cachedValue && cachedValue !== textBlock.text) {
          cached++;
          corrections.push(
            this.createCorrection(editor.document, textBlock, {
              correctedText: cachedValue,
              originalText: textBlock.text,
              changes: [],
              confidence: textBlock.confidence,
              model: ConfigurationManager.getConfig().model,
            })
          );
          continue;
        }

        const result = await this.getAIClient().getCorrectionDetailed(
          textBlock.text,
          {
            ...options,
            context: textBlock.context,
          }
        );

        if (!result || result.correctedText.trim() === textBlock.text.trim()) {
          continue;
        }

        cacheService.set(textBlock.text, result.correctedText);
        corrections.push(this.createCorrection(editor.document, textBlock, result));
      } catch (error) {
        failed++;
        console.error("Erreur lors de l'analyse d'un segment:", error);
      }
    }

    const filteredCorrections = corrections.filter(
      (correction) =>
        correction.original !== undefined &&
        correction.original.trim() !== correction.text.trim()
    );

    return {
      corrections: filteredCorrections,
      stats: {
        totalTexts: texts.length,
        corrected: filteredCorrections.length,
        cached,
        failed,
        duration: Date.now() - startTime,
      },
    };
  }

  private createCorrection(
    document: vscode.TextDocument,
    textBlock: ExtractedText,
    result: CorrectionResult
  ): Correction {
    return {
      id: this.createCorrectionId(document.uri.toString(), textBlock),
      text: result.correctedText.trim(),
      start: textBlock.start,
      end: textBlock.end,
      original: textBlock.text,
      confidence: result.confidence ?? textBlock.confidence,
      changes: result.changes,
      context: textBlock.context,
      documentUri: document.uri.toString(),
    };
  }

  private createCorrectionId(documentUri: string, textBlock: ExtractedText): string {
    return [
      documentUri,
      textBlock.start.line,
      textBlock.start.character,
      textBlock.end.line,
      textBlock.end.character,
      textBlock.text,
    ].join(":");
  }

  private saveToUndoStack(documentUri: string, corrections: Correction[]): void {
    this.undoStack.push({ document: documentUri, corrections });

    if (this.undoStack.length > 20) {
      this.undoStack.shift();
    }
  }

  private createEmptyStats(): CorrectionStats {
    return {
      totalTexts: 0,
      corrected: 0,
      cached: 0,
      failed: 0,
      duration: 0,
    };
  }

  private comparePositionsDescending(
    left: vscode.Position,
    right: vscode.Position
  ): number {
    if (left.line !== right.line) {
      return right.line - left.line;
    }

    return right.character - left.character;
  }
}
