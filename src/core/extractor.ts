import * as vscode from "vscode";
import { detectTextType, TextType } from "./contextDetecor";

export interface ExtractedText {
  text: string;
  type: TextType;
  start: vscode.Position;
  end: vscode.Position;
  context?: string;
  confidence: number;
}

export interface ExtractionOptions {
  language?: string;
  minLength?: number;
  maxLength?: number;
  includeContext?: boolean;
  ignorePatterns?: string[];
}

export class TextExtractor {
  private readonly DEFAULT_OPTIONS: Required<ExtractionOptions> = {
    language: "auto",
    minLength: 3,
    maxLength: 1000,
    includeContext: true,
    ignorePatterns: ["TODO", "FIXME", "XXX", "HACK"],
  };

  extractFromDocument(
    document: vscode.TextDocument,
    options: ExtractionOptions = {}
  ): ExtractedText[] {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    const code = document.getText();
    const language =
      opts.language === "auto" ? document.languageId : opts.language;

    return this.extractTextFromCode(
      code,
      new vscode.Position(0, 0),
      language,
      opts
    );
  }

  extractFromSelection(
    document: vscode.TextDocument,
    selection: vscode.Selection,
    options: ExtractionOptions = {}
  ): ExtractedText[] {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    const text = document.getText(selection);
    const language =
      opts.language === "auto" ? document.languageId : opts.language;

    return this.extractTextFromCode(text, selection.start, language, opts);
  }

  extractTextFromCode(
    code: string,
    startPosition: vscode.Position = new vscode.Position(0, 0),
    language: string = "auto",
    options: Required<ExtractionOptions>
  ): ExtractedText[] {
    const lines = code.split(/\r?\n/);
    const extracted: ExtractedText[] = [];

    let inMultilineComment = false;
    let inDocstring = false;
    let docstringDelimiter = "";
    let multilineBuffer: string[] = [];
    let multilineStartLine = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      if (inDocstring) {
        multilineBuffer.push(line);
        if (line.includes(docstringDelimiter)) {
          inDocstring = false;
          this.addExtractedText(
            extracted,
            multilineBuffer.join("\n"),
            "docstring",
            startPosition,
            multilineStartLine,
            i,
            lines,
            options
          );
          multilineBuffer = [];
        }
        continue;
      }

      if (inMultilineComment) {
        multilineBuffer.push(line);
        if (line.includes("*/")) {
          inMultilineComment = false;
          this.addExtractedText(
            extracted,
            multilineBuffer.join("\n"),
            "comment",
            startPosition,
            multilineStartLine,
            i,
            lines,
            options
          );
          multilineBuffer = [];
        }
        continue;
      }

      if (line.includes("/*") && !line.includes("*/")) {
        inMultilineComment = true;
        multilineBuffer = [line];
        multilineStartLine = i;
        continue;
      }

      if (/^\s*("""|''')/.test(line) && !/("""|''').*\1/.test(line)) {
        inDocstring = true;
        docstringDelimiter = line.includes('"""') ? '"""' : "'''";
        multilineBuffer = [line];
        multilineStartLine = i;
        continue;
      }

      const extractions = this.extractFromSingleLine(
        line,
        i,
        startPosition,
        language,
        options
      );
      extracted.push(...extractions);
    }

    return this.filterAndSortExtractions(extracted, options);
  }

  private extractFromSingleLine(
    line: string,
    lineIndex: number,
    startPosition: vscode.Position,
    language: string,
    options: Required<ExtractionOptions>
  ): ExtractedText[] {
    const extracted: ExtractedText[] = [];
    const type = detectTextType(line, language);

    if (!type) {
      return extracted;
    }

    let text = "";
    let startCol = 0;
    let confidence = 1.0;

    if (type === "comment") {
      const commentMatch = line.match(
        /\/\/\s*(.+)|#\s*(.+)|\/\*\s*(.+)\s*\*\//
      );
      if (commentMatch) {
        text = (commentMatch[1] || commentMatch[2] || commentMatch[3]).trim();
        startCol = line.indexOf(text);
        confidence = this.calculateConfidence(text, type);
      }
    } else if (type === "string") {
      const stringMatches = this.extractStrings(line);
      for (const match of stringMatches) {
        extracted.push({
          text: match.text,
          type,
          start: new vscode.Position(
            startPosition.line + lineIndex,
            match.start
          ),
          end: new vscode.Position(
            startPosition.line + lineIndex,
            match.start + match.text.length
          ),
          confidence: this.calculateConfidence(match.text, type),
        });
      }
      return extracted;
    } else if (type === "docstring") {
      text = line.trim();
      startCol = line.indexOf(text);
      confidence = 0.95;
    }

    if (text && this.shouldIncludeText(text, options)) {
      extracted.push({
        text,
        type,
        start: new vscode.Position(startPosition.line + lineIndex, startCol),
        end: new vscode.Position(
          startPosition.line + lineIndex,
          startCol + text.length
        ),
        confidence,
      });
    }

    return extracted;
  }

  private extractStrings(line: string): Array<{ text: string; start: number }> {
    const strings: Array<{ text: string; start: number }> = [];
    const regex = /(['"`])(?:(?!\1|\\).|\\.)*\1/g;
    let match;

    while ((match = regex.exec(line)) !== null) {
      const text = match[0].slice(1, -1);
      if (text.trim()) {
        strings.push({ text: text.trim(), start: match.index + 1 });
      }
    }

    return strings;
  }

  private addExtractedText(
    extracted: ExtractedText[],
    text: string,
    type: TextType,
    startPosition: vscode.Position,
    startLine: number,
    endLine: number,
    lines: string[],
    options: Required<ExtractionOptions>
  ): void {
    const cleanText = this.cleanText(text, type);
    if (!this.shouldIncludeText(cleanText, options)) {
      return;
    }

    const start = new vscode.Position(startPosition.line + startLine, 0);
    const end = new vscode.Position(
      startPosition.line + endLine,
      lines[endLine].length
    );

    extracted.push({
      text: cleanText,
      type,
      start,
      end,
      context: options.includeContext
        ? this.getContext(lines, startLine, endLine)
        : undefined,
      confidence: this.calculateConfidence(cleanText, type),
    });
  }

  private cleanText(text: string, type: TextType): string {
    let cleaned = text.trim();

    if (type === "comment") {
      cleaned = cleaned
        .replace(/^\/\/\s*/, "")
        .replace(/^\/\*\s*|\s*\*\/$/g, "")
        .replace(/^#\s*/, "")
        .replace(/^\*\s*/gm, "");
    } else if (type === "docstring") {
      cleaned = cleaned.replace(/^("""|''')|(\1)$/g, "").trim();
    } else if (type === "string") {
      cleaned = cleaned.replace(/^(['"`])|(['"`])$/g, "");
    }

    return cleaned.trim();
  }

  private shouldIncludeText(
    text: string,
    options: Required<ExtractionOptions>
  ): boolean {
    if (text.length < options.minLength || text.length > options.maxLength) {
      return false;
    }

    for (const pattern of options.ignorePatterns) {
      if (text.toUpperCase().includes(pattern)) {
        return false;
      }
    }

    const codePattern = /^[\{\}\[\]\(\);,\.=<>!&\|\+\-\*\/\\]+$/;
    if (codePattern.test(text)) {
      return false;
    }

    if (/^https?:\/\//.test(text)) {
      return false;
    }

    return true;
  }

  private calculateConfidence(text: string, type: TextType): number {
    let confidence = 1.0;

    if (text.length < 10) {
      confidence -= 0.2;
    }

    if (/[.!?]$/.test(text)) {
      confidence += 0.1;
    }

    const symbolRatio =
      (text.match(/[^a-zA-Z0-9\s]/g) || []).length / text.length;
    if (symbolRatio > 0.3) {
      confidence -= symbolRatio * 0.5;
    }

    if (type === "docstring") {
      confidence += 0.1;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  private getContext(
    lines: string[],
    startLine: number,
    endLine: number
  ): string {
    const contextLines = 2;
    const start = Math.max(0, startLine - contextLines);
    const end = Math.min(lines.length - 1, endLine + contextLines);

    return lines.slice(start, end + 1).join("\n");
  }

  private filterAndSortExtractions(
    extracted: ExtractedText[],
    options: Required<ExtractionOptions>
  ): ExtractedText[] {
    return extracted
      .filter((e) => e.confidence > 0.3)
      .sort((a, b) => b.confidence - a.confidence);
  }
}

export function extractTextFromCode(
  code: string,
  startPosition: vscode.Position = new vscode.Position(0, 0),
  language: string = "auto"
): ExtractedText[] {
  const extractor = new TextExtractor();
  return extractor.extractTextFromCode(code, startPosition, language, {
    language,
    minLength: 3,
    maxLength: 1000,
    includeContext: false,
    ignorePatterns: ["TODO", "FIXME", "XXX"],
  });
}
