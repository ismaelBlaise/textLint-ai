import * as vscode from "vscode";
import { Correction } from "../../core/correctionManager";

interface DecorationTypes {
  error: vscode.TextEditorDecorationType;
  warning: vscode.TextEditorDecorationType;
  info: vscode.TextEditorDecorationType;
}

let decorationTypes: DecorationTypes | undefined;

function getDecorationTypes(): DecorationTypes {
  if (!decorationTypes) {
    decorationTypes = {
      error: vscode.window.createTextEditorDecorationType({
        textDecoration: "underline wavy rgba(220, 38, 38, 0.95)",
        overviewRulerColor: "rgba(220, 38, 38, 0.9)",
        overviewRulerLane: vscode.OverviewRulerLane.Right,
      }),
      warning: vscode.window.createTextEditorDecorationType({
        textDecoration: "underline wavy rgba(245, 158, 11, 0.95)",
        overviewRulerColor: "rgba(245, 158, 11, 0.85)",
        overviewRulerLane: vscode.OverviewRulerLane.Right,
      }),
      info: vscode.window.createTextEditorDecorationType({
        textDecoration: "underline wavy rgba(59, 130, 246, 0.95)",
        overviewRulerColor: "rgba(59, 130, 246, 0.8)",
        overviewRulerLane: vscode.OverviewRulerLane.Right,
      }),
    };
  }

  return decorationTypes;
}

function getDecorationType(
  confidence?: number
): vscode.TextEditorDecorationType {
  const types = getDecorationTypes();

  if (confidence === undefined) {
    return types.warning;
  }

  if (confidence >= 0.9) {
    return types.info;
  }

  if (confidence >= 0.7) {
    return types.warning;
  }

  return types.error;
}

export function decorateCorrections(
  editor: vscode.TextEditor,
  corrections: Correction[],
  revealFirstCorrection: boolean = false
) {
  clearDecorations(editor);

  if (!corrections.length) {
    return;
  }

  const decorationsByType = new Map<
    vscode.TextEditorDecorationType,
    vscode.DecorationOptions[]
  >();

  corrections.forEach((correction) => {
    const decorationType = getDecorationType(correction.confidence);
    const existing = decorationsByType.get(decorationType) || [];

    existing.push({
      range: new vscode.Range(correction.start, correction.end),
      hoverMessage: createHoverMessage(correction),
    });

    decorationsByType.set(decorationType, existing);
  });

  decorationsByType.forEach((decorations, type) => {
    editor.setDecorations(type, decorations);
  });

  if (revealFirstCorrection) {
    const firstCorrection = corrections[0];
    const range = new vscode.Range(firstCorrection.start, firstCorrection.end);
    editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
  }
}

function createHoverMessage(correction: Correction): vscode.MarkdownString {
  const markdown = new vscode.MarkdownString(undefined, true);
  markdown.isTrusted = true;
  markdown.supportHtml = true;

  const applyCommand = createCommandUri(
    "textlint-ai.applySingleCorrection",
    correction.id
  );
  const ignoreCommand = createCommandUri(
    "textlint-ai.ignoreSingleCorrection",
    correction.id
  );
  const panelCommand = createCommandUri("textlint-ai.showPanel");

  markdown.appendMarkdown("### Correction proposee\n\n");
  markdown.appendMarkdown("**Texte detecte**\n");
  markdown.appendCodeblock(correction.original || "", "text");
  markdown.appendMarkdown("\n**Suggestion contextuelle**\n");
  markdown.appendCodeblock(correction.text, "text");

  if (correction.changes && correction.changes.length > 0) {
    markdown.appendMarkdown("\n**Details**\n");
    correction.changes.forEach((change) => {
      markdown.appendMarkdown(
        `- ${change.type}: \`${escapeMarkdown(change.original)}\` -> \`${escapeMarkdown(change.corrected)}\`\n`
      );
      if (change.explanation) {
        markdown.appendMarkdown(`  ${escapeMarkdown(change.explanation)}\n`);
      }
    });
  }

  if (correction.confidence !== undefined) {
    markdown.appendMarkdown(
      `\n**Confiance**: ${Math.round(correction.confidence * 100)}%\n`
    );
  }

  markdown.appendMarkdown(
    `\n[Corriger](${applyCommand}) | [Ignorer](${ignoreCommand}) | [Voir toutes les corrections](${panelCommand})`
  );

  return markdown;
}

function createCommandUri(command: string, ...args: unknown[]): vscode.Uri {
  return vscode.Uri.parse(
    `command:${command}?${encodeURIComponent(JSON.stringify(args))}`
  );
}

function escapeMarkdown(value: string): string {
  return value.replace(/[`*_{}[\]()#+\-.!]/g, "\\$&");
}

export function clearDecorations(editor: vscode.TextEditor) {
  if (!decorationTypes) {
    return;
  }

  Object.values(decorationTypes).forEach((type) => {
    editor.setDecorations(type, []);
  });
}

export function dispose() {
  if (!decorationTypes) {
    return;
  }

  Object.values(decorationTypes).forEach((type) => type.dispose());
  decorationTypes = undefined;
}
