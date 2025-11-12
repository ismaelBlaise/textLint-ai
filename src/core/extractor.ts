/* eslint-disable curly */
import { detectTextType, TextType } from "./contextDetecor";

export interface ExtractedText {
  text: string;
  type: TextType;
  lineNumber: number;
}

export function extractTextFromCode(
  code: string,
  language: string = "auto"
): ExtractedText[] {
  const lines = code.split(/\r?\n/);
  const extracted: ExtractedText[] = [];

  let inDocString = false;
  let docstringDelimiter = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (inDocString) {
      extracted.push({
        text: line.trim(),
        type: "docstring",
        lineNumber: i + 1,
      });
      if (line.includes(docstringDelimiter)) inDocString = false;
      continue;
    }

    const type = detectTextType(line, language);

    if (type === "comment" || type === "string") {
      let text = line.trim();
      if (type === "string")
        text = text.replace(/^(['"`])|(['"`])$/g, "").trim();
      extracted.push({ text, type, lineNumber: i + 1 });
    } else if (type === "docstring") {
      inDocString = true;
      docstringDelimiter = line.includes('"""') ? '"""' : "'''";
      extracted.push({
        text: line.trim(),
        type: "docstring",
        lineNumber: i + 1,
      });
    }
  }

  return extracted;
}
