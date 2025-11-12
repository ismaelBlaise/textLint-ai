/* eslint-disable curly */
import * as vscode from "vscode";
import { detectTextType, TextType } from "./contextDetecor";

export interface ExtractedText {
  text: string;
  type: TextType;
  start: vscode.Position;
  end: vscode.Position;
}

export function extractTextFromCode(
  code: string,
  startPosition: vscode.Position = new vscode.Position(0, 0),
  language: string = "auto"
): ExtractedText[] {
  const lines = code.split(/\r?\n/);
  const extracted: ExtractedText[] = [];

  let inDocString = false;
  let docstringDelimiter = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let lineOffset = 0;

    if (inDocString) {
      const start = new vscode.Position(startPosition.line + i, 0);
      const end = new vscode.Position(startPosition.line + i, line.length);
      extracted.push({
        text: line.trim(),
        type: "docstring",
        start,
        end,
      });
      if (line.includes(docstringDelimiter)) inDocString = false;
      continue;
    }

    const type = detectTextType(line, language);

    if (type === "comment" || type === "string") {
      let text = line.trim();
      if (type === "string")
        text = text.replace(/^(['"`])|(['"`])$/g, "").trim();

      const startCol = line.indexOf(text);
      const start = new vscode.Position(startPosition.line + i, startCol);
      const end = new vscode.Position(
        startPosition.line + i,
        startCol + text.length
      );

      extracted.push({ text, type, start, end });
    } else if (type === "docstring") {
      inDocString = true;
      docstringDelimiter = line.includes('"""') ? '"""' : "'''";
      const start = new vscode.Position(startPosition.line + i, 0);
      const end = new vscode.Position(startPosition.line + i, line.length);
      extracted.push({ text: line.trim(), type, start, end });
    }
  }

  return extracted;
}
