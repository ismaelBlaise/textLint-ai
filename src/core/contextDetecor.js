"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContextDetector = void 0;
exports.detectTextType = detectTextType;
class ContextDetector {
    static languageDefinitions = new Map([
        [
            "javascript",
            {
                id: "javascript",
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
                    /f(['"])(?:(?!\1|\\).|\\.)*\1/,
                ],
                docstringPatterns: [/^\s*("""|''')/, /^\s*r("""|''')/],
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
                stringPatterns: [/"(?:[^"\\]|\\.)*"/, /@"(?:[^"]|"")*"/],
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
    ]);
    static detectTextType(line, language = "auto") {
        if (!line.trim()) {
            return null;
        }
        const languages = this.getLanguagesToCheck(language);
        for (const lang of languages) {
            const definition = this.languageDefinitions.get(lang);
            if (!definition) {
                continue;
            }
            for (const pattern of definition.commentPatterns.singleLine) {
                if (pattern.test(line)) {
                    return "comment";
                }
            }
            for (const pattern of definition.docstringPatterns) {
                if (pattern.test(line)) {
                    return "docstring";
                }
            }
            for (const pattern of definition.stringPatterns) {
                if (pattern.test(line) && !this.isStringInComment(line, definition)) {
                    return "string";
                }
            }
            for (const pattern of definition.commentPatterns.multiLineStart) {
                if (pattern.test(line)) {
                    return "comment";
                }
            }
        }
        return null;
    }
    static detectLanguage(code) {
        const scores = new Map();
        for (const [langId, definition] of this.languageDefinitions) {
            let score = 0;
            if (definition.keywords) {
                for (const keyword of definition.keywords) {
                    const regex = new RegExp(`\\b${keyword}\\b`, "g");
                    const matches = code.match(regex);
                    if (matches) {
                        score += matches.length;
                    }
                }
            }
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
    static isStringInComment(line, definition) {
        for (const pattern of definition.commentPatterns.singleLine) {
            const match = pattern.exec(line);
            if (match) {
                const commentStart = match.index;
                const stringMatch = line.match(/(['"`])/);
                if (stringMatch && stringMatch.index > commentStart) {
                    return true;
                }
            }
        }
        return false;
    }
    static getLanguagesToCheck(language) {
        if (language === "auto") {
            return Array.from(this.languageDefinitions.keys());
        }
        const aliases = {
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
    static analyzeCodeStructure(code, language) {
        const lines = code.split("\n");
        let comments = 0;
        let strings = 0;
        let docstrings = 0;
        for (const line of lines) {
            const type = this.detectTextType(line, language);
            if (type === "comment") {
                comments++;
            }
            else if (type === "string") {
                strings++;
            }
            else if (type === "docstring") {
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
    static registerLanguage(definition) {
        this.languageDefinitions.set(definition.id, definition);
    }
}
exports.ContextDetector = ContextDetector;
function detectTextType(line, language = "auto") {
    return ContextDetector.detectTextType(line, language);
}
//# sourceMappingURL=contextDetecor.js.map