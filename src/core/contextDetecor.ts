export type TextType = "comment" | "string" | "docstring";

export interface LanguageDefinition {
  id: string;
  commentPatterns: {
    singleLine: RegExp[];
    multiLineStart: RegExp[];
    multiLineEnd: RegExp[];
  };
  stringPatterns: RegExp[];
  docstringPatterns: RegExp[];
  keywords?: string[];
}

export class ContextDetector {
  private static languageDefinitions: Map<string, LanguageDefinition> = new Map(
    [
      [
        "javascript",
        {
          id: "javascript",
          commentPatterns: {
            singleLine: [/^\s*\/\//],
            multiLineStart: [/^\s*\/\*/],
            multiLineEnd: [/\*\/\s*$/],
          },
          stringPatterns: [
            /(['"`])(?:(?!\1|\\).|\\.)*\1/,
            /`(?:[^`\\]|\\.)*`/, // Template literals
          ],
          docstringPatterns: [/^\s*\/\*\*[\s\S]*?\*\//],
          keywords: [
            "function",
            "const",
            "let",
            "var",
            "class",
            "import",
            "export",
          ],
        },
      ],
      [
        "typescript",
        {
          id: "typescript",
          commentPatterns: {
            singleLine: [/^\s*\/\//],
            multiLineStart: [/^\s*\/\*/],
            multiLineEnd: [/\*\/\s*$/],
          },
          stringPatterns: [/(['"`])(?:(?!\1|\\).|\\.)*\1/, /`(?:[^`\\]|\\.)*`/],
          docstringPatterns: [/^\s*\/\*\*[\s\S]*?\*\//],
          keywords: [
            "function",
            "const",
            "let",
            "var",
            "class",
            "interface",
            "type",
            "import",
            "export",
          ],
        },
      ],
      [
        "python",
        {
          id: "python",
          commentPatterns: {
            singleLine: [/^\s*#/],
            multiLineStart: [],
            multiLineEnd: [],
          },
          stringPatterns: [
            /(['"])(?:(?!\1|\\).|\\.)*\1/,
            /f(['"])(?:(?!\1|\\).|\\.)*\1/, // f-strings
          ],
          docstringPatterns: [
            /^\s*("""|''')/,
            /^\s*r("""|''')/, // Raw docstrings
          ],
          keywords: ["def", "class", "import", "from", "if", "for", "while"],
        },
      ],
      [
        "java",
        {
          id: "java",
          commentPatterns: {
            singleLine: [/^\s*\/\//],
            multiLineStart: [/^\s*\/\*/],
            multiLineEnd: [/\*\/\s*$/],
          },
          stringPatterns: [/"(?:[^"\\]|\\.)*"/],
          docstringPatterns: [/^\s*\/\*\*[\s\S]*?\*\//],
          keywords: [
            "public",
            "private",
            "class",
            "interface",
            "void",
            "return",
          ],
        },
      ],
      [
        "csharp",
        {
          id: "csharp",
          commentPatterns: {
            singleLine: [/^\s*\/\//, /^\s*\/\/\//],
            multiLineStart: [/^\s*\/\*/],
            multiLineEnd: [/\*\/\s*$/],
          },
          stringPatterns: [
            /"(?:[^"\\]|\\.)*"/,
            /@"(?:[^"]|"")*"/, // Verbatim strings
          ],
          docstringPatterns: [/^\s*\/\/\//, /^\s*\/\*\*[\s\S]*?\*\//],
          keywords: [
            "public",
            "private",
            "class",
            "interface",
            "void",
            "namespace",
          ],
        },
      ],
      [
        "php",
        {
          id: "php",
          commentPatterns: {
            singleLine: [/^\s*\/\//, /^\s*#/],
            multiLineStart: [/^\s*\/\*/],
            multiLineEnd: [/\*\/\s*$/],
          },
          stringPatterns: [/(['"])(?:(?!\1|\\).|\\.)*\1/],
          docstringPatterns: [/^\s*\/\*\*[\s\S]*?\*\//],
          keywords: ["function", "class", "public", "private", "namespace"],
        },
      ],
      [
        "ruby",
        {
          id: "ruby",
          commentPatterns: {
            singleLine: [/^\s*#/],
            multiLineStart: [/^\s*=begin/],
            multiLineEnd: [/^\s*=end/],
          },
          stringPatterns: [/(['"])(?:(?!\1|\\).|\\.)*\1/],
          docstringPatterns: [],
          keywords: ["def", "class", "module", "end", "require"],
        },
      ],
      [
        "go",
        {
          id: "go",
          commentPatterns: {
            singleLine: [/^\s*\/\//],
            multiLineStart: [/^\s*\/\*/],
            multiLineEnd: [/\*\/\s*$/],
          },
          stringPatterns: [/"(?:[^"\\]|\\.)*"/, /`[^`]*`/],
          docstringPatterns: [],
          keywords: [
            "func",
            "type",
            "struct",
            "interface",
            "package",
            "import",
          ],
        },
      ],
      [
        "rust",
        {
          id: "rust",
          commentPatterns: {
            singleLine: [/^\s*\/\//, /^\s*\/\/\//],
            multiLineStart: [/^\s*\/\*/],
            multiLineEnd: [/\*\/\s*$/],
          },
          stringPatterns: [/"(?:[^"\\]|\\.)*"/, /r#*"[^"]*"#*/],
          docstringPatterns: [/^\s*\/\/\//],
          keywords: ["fn", "struct", "enum", "impl", "trait", "use"],
        },
      ],
    ]
  );

  /**
   * Détecte le type de texte avec analyse contextuelle
   */
  static detectTextType(
    line: string,
    language: string = "auto"
  ): TextType | null {
    if (!line.trim()) {
      return null;
    }

    const languages = this.getLanguagesToCheck(language);

    for (const lang of languages) {
      const definition = this.languageDefinitions.get(lang);
      if (!definition) {
        continue;
      }

      // Vérifier les commentaires sur une seule ligne
      for (const pattern of definition.commentPatterns.singleLine) {
        if (pattern.test(line)) {
          return "comment";
        }
      }

      // Vérifier les docstrings
      for (const pattern of definition.docstringPatterns) {
        if (pattern.test(line)) {
          return "docstring";
        }
      }

      // Vérifier les chaînes de caractères
      for (const pattern of definition.stringPatterns) {
        if (pattern.test(line) && !this.isStringInComment(line, definition)) {
          return "string";
        }
      }

      // Vérifier le début de commentaires multilignes
      for (const pattern of definition.commentPatterns.multiLineStart) {
        if (pattern.test(line)) {
          return "comment";
        }
      }
    }

    return null;
  }

  /**
   * Détecte le langage à partir du contenu
   */
  static detectLanguage(code: string): string {
    const scores = new Map<string, number>();

    for (const [langId, definition] of this.languageDefinitions) {
      let score = 0;

      // Vérifier les mots-clés
      if (definition.keywords) {
        for (const keyword of definition.keywords) {
          const regex = new RegExp(`\\b${keyword}\\b`, "g");
          const matches = code.match(regex);
          if (matches) {
            score += matches.length;
          }
        }
      }

      // Vérifier les patterns de commentaires
      const lines = code.split("\n");
      for (const line of lines) {
        for (const pattern of definition.commentPatterns.singleLine) {
          if (pattern.test(line)) {
            score += 0.5;
          }
        }
      }

      scores.set(langId, score);
    }

    // Retourner le langage avec le score le plus élevé
    let maxScore = 0;
    let detectedLang = "javascript";

    for (const [lang, score] of scores) {
      if (score > maxScore) {
        maxScore = score;
        detectedLang = lang;
      }
    }

    return detectedLang;
  }

  /**
   * Vérifie si une chaîne est dans un commentaire
   */
  private static isStringInComment(
    line: string,
    definition: LanguageDefinition
  ): boolean {
    for (const pattern of definition.commentPatterns.singleLine) {
      const match = pattern.exec(line);
      if (match) {
        const commentStart = match.index;
        const stringMatch = line.match(/(['"`])/);
        if (stringMatch && stringMatch.index! > commentStart) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Détermine les langages à vérifier
   */
  private static getLanguagesToCheck(language: string): string[] {
    if (language === "auto") {
      return Array.from(this.languageDefinitions.keys());
    }

    // Mapping des alias
    const aliases: Record<string, string> = {
      js: "javascript",
      ts: "typescript",
      py: "python",
      cs: "csharp",
      rb: "ruby",
      rs: "rust",
    };

    const normalized = aliases[language] || language;
    return this.languageDefinitions.has(normalized)
      ? [normalized]
      : ["javascript"];
  }

  /**
   * Analyse la structure du code pour détecter les blocs
   */
  static analyzeCodeStructure(
    code: string,
    language: string
  ): {
    comments: number;
    strings: number;
    docstrings: number;
    lines: number;
  } {
    const lines = code.split("\n");
    let comments = 0;
    let strings = 0;
    let docstrings = 0;

    for (const line of lines) {
      const type = this.detectTextType(line, language);
      if (type === "comment") {
        comments++;
      } else if (type === "string") {
        strings++;
      } else if (type === "docstring") {
        docstrings++;
      }
    }

    return {
      comments,
      strings,
      docstrings,
      lines: lines.length,
    };
  }

  /**
   * Enregistre une nouvelle définition de langage
   */
  static registerLanguage(definition: LanguageDefinition): void {
    this.languageDefinitions.set(definition.id, definition);
  }
}

// Fonction de compatibilité
export function detectTextType(
  line: string,
  language: string = "auto"
): TextType | null {
  return ContextDetector.detectTextType(line, language);
}
