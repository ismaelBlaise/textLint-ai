import OpenAI from "openai";
import { ConfigurationManager } from "../config/settings";

export interface CorrectionOptions {
  language?: string;
  style?: "formal" | "casual" | "technical" | "neutral";
  context?: string;
  customPrompt?: string;
}

export interface CorrectionResult {
  correctedText: string;
  originalText: string;
  changes: Change[];
  confidence: number;
  model: string;
  tokensUsed?: number;
}

export interface Change {
  type: "spelling" | "grammar" | "style" | "punctuation";
  original: string;
  corrected: string;
  explanation?: string;
}

export class AIClient {
  private client: OpenAI;
  private config: ReturnType<typeof ConfigurationManager.getConfig>;
  private requestQueue = new Map<string, Promise<string>>();
  private retryAttempts = 3;
  private retryDelay = 1000;

  constructor() {
    const apiKey = ConfigurationManager.getApiKey();
    if (!apiKey) {
      throw new Error("Cle API OpenAI manquante.");
    }

    this.client = new OpenAI({ apiKey });
    this.config = ConfigurationManager.getConfig();
  }

  async getCorrection(
    text: string,
    options: CorrectionOptions = {}
  ): Promise<string | undefined> {
    const cacheKey = this.getCacheKey(text, options);
    if (this.requestQueue.has(cacheKey)) {
      return this.requestQueue.get(cacheKey);
    }

    const promise = this.performCorrection(text, options);
    this.requestQueue.set(cacheKey, promise);

    try {
      return await promise;
    } finally {
      this.requestQueue.delete(cacheKey);
    }
  }

  async getCorrectionDetailed(
    text: string,
    options: CorrectionOptions = {}
  ): Promise<CorrectionResult | undefined> {
    const prompt = this.buildDetailedPrompt(text, options);

    try {
      const response = await this.makeRequestWithRetry(prompt, true);
      return this.parseCorrectionResult(text, response);
    } catch (error) {
      console.error("Erreur lors de la correction detaillee:", error);
      return undefined;
    }
  }

  async *getCorrectionStream(
    text: string,
    options: CorrectionOptions = {}
  ): AsyncGenerator<string, void, unknown> {
    const prompt = this.buildPrompt(text, options);

    const stream = await this.client.chat.completions.create({
      model: this.config.model,
      messages: [{ role: "user", content: prompt }],
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  }

  async correctBatch(
    texts: string[],
    options: CorrectionOptions = {}
  ): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    const batchSize = 5;

    for (let index = 0; index < texts.length; index += batchSize) {
      const batch = texts.slice(index, index + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map((text) => this.getCorrection(text, options))
      );

      batchResults.forEach((result, itemIndex) => {
        const originalText = batch[itemIndex];
        if (result.status === "fulfilled" && result.value) {
          results.set(originalText, result.value);
        } else {
          results.set(originalText, originalText);
        }
      });

      if (index + batchSize < texts.length) {
        await this.sleep(500);
      }
    }

    return results;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 5,
      });

      return Boolean(response.choices[0]?.message?.content);
    } catch (error) {
      console.error("Health check failed:", error);
      return false;
    }
  }

  async getAvailableModels(): Promise<string[]> {
    try {
      const models = await this.client.models.list();
      return models.data
        .filter((model) => model.id.includes("gpt"))
        .map((model) => model.id)
        .sort();
    } catch (error) {
      console.error("Erreur lors de la recuperation des modeles:", error);
      return ["gpt-4o-mini", "gpt-4o", "gpt-4"];
    }
  }

  private async performCorrection(
    text: string,
    options: CorrectionOptions
  ): Promise<string> {
    const prompt = this.buildPrompt(text, options);
    return this.makeRequestWithRetry(prompt);
  }

  private async makeRequestWithRetry(
    prompt: string,
    jsonMode: boolean = false
  ): Promise<string> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < this.retryAttempts; attempt++) {
      try {
        const response = await this.client.chat.completions.create({
          model: this.config.model,
          messages: [{ role: "user", content: prompt }],
          temperature: this.config.temperature,
          max_tokens: this.config.maxTokens,
          ...(jsonMode ? { response_format: { type: "json_object" as const } } : {}),
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error("Reponse vide du modele.");
        }

        return content;
      } catch (error) {
        lastError = error as Error;

        if (attempt < this.retryAttempts - 1) {
          await this.sleep(this.retryDelay * Math.pow(2, attempt));
        }
      }
    }

    throw lastError || new Error("Echec apres plusieurs tentatives.");
  }

  private buildPrompt(text: string, options: CorrectionOptions): string {
    if (options.customPrompt) {
      return options.customPrompt.replace("{text}", text);
    }

    const language = options.language || this.config.language;
    const style = options.style || "neutral";
    const styleInstruction =
      style !== "neutral" ? ` avec un style ${style}` : "";
    const contextBlock = options.context
      ? `\nContexte complet:\n"""${options.context}"""`
      : "";

    return `Corrige le texte suivant en ${language}${styleInstruction}. Respecte le sens de la phrase, le contexte, l'ordre des mots, l'orthographe, la grammaire et la ponctuation.${contextBlock}

Texte a corriger:
"${text}"

Reponds uniquement avec le texte corrige.`;
  }

  private buildDetailedPrompt(
    text: string,
    options: CorrectionOptions
  ): string {
    const language = options.language || this.config.language;
    const contextBlock = options.context
      ? `\nContexte complet:\n"""${options.context}"""\n`
      : "";

    return `Analyse et corrige le texte suivant en ${language}. Corrige la phrase complete avec le bon contexte, le bon ordre des mots, l'orthographe, la grammaire, le style et la ponctuation.${contextBlock}
Reponds uniquement en JSON avec cette structure:
{
  "correctedText": "texte corrige",
  "changes": [
    {
      "type": "spelling|grammar|style|punctuation",
      "original": "texte original",
      "corrected": "texte corrige",
      "explanation": "explication courte"
    }
  ],
  "confidence": 0.95
}

Texte a corriger:
"${text}"`;
  }

  private parseCorrectionResult(
    originalText: string,
    response: string
  ): CorrectionResult {
    try {
      const parsed = JSON.parse(response);
      return {
        correctedText: parsed.correctedText || originalText,
        originalText,
        changes: Array.isArray(parsed.changes) ? parsed.changes : [],
        confidence:
          typeof parsed.confidence === "number" ? parsed.confidence : 0.8,
        model: this.config.model,
      };
    } catch (error) {
      console.error("Erreur de parsing JSON:", error);
      return {
        correctedText: response,
        originalText,
        changes: [],
        confidence: 0.5,
        model: this.config.model,
      };
    }
  }

  private getCacheKey(text: string, options: CorrectionOptions): string {
    return `${text}:${JSON.stringify(options)}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
