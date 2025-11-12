export type TextType = "comment" | "string" | "docstring";

export function detectTextType(
  line: string,
  language: string = "auto"
): TextType | null {
  const commentRegexes: Record<string, RegExp[]> = {
    js: [/^\s*\/\//, /^\s*\/\*.*\*\/$/],
    ts: [/^\s*\/\//, /^\s*\/\*.*\*\/$/],
    python: [/^\s*#/],
    java: [/^\s*\/\//, /^\s*\/\*.*\*\/$/],
  };

  const langs = language === "auto" ? Object.keys(commentRegexes) : [language];
  for (const lang of langs) {
    for (const regex of commentRegexes[lang]) {
      if (regex.test(line)) return "comment";
    }
  }

  if (/(['"`])(?:(?!\1).)*\1/.test(line)) return "string";

  if (/^\s*("""|''')/.test(line)) return "docstring";

  return null;
}
