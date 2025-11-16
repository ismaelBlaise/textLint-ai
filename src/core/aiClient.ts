import OpenAI from "openai";
import { ConfigurationManager } from "../config/settings";

export interface CorrectionOptions {
  language?: string;
  style?: "formal" | "casual" | "technical";
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
  private requestQueue: Map<string, Promise<string>> = new Map();
  private retryAttempts = 3;
  private retryDelay = 1000;

  constructor() {
    const apikey = ConfigurationManager.getApiKey();
    if (!apikey) {
      throw new Error("Clé API OpenAI manquante !");
    }

    this.client = new OpenAI({ apiKey: apikey });
    this.config = ConfigurationManager.getConfig();
  }

  /**
   * Obtient une correction avec gestion des erreurs et retry
   */
  async getCorrection(
    text: string,
    options: CorrectionOptions = {}
  ): Promise<string | undefined> {
    // Déduplication des requêtes
    const cacheKey = this.getCacheKey(text, options);
    if (this.requestQueue.has(cacheKey)) {
      return this.requestQueue.get(cacheKey);
    }

    const promise = this.performCorrection(text, options);
    this.requestQueue.set(cacheKey, promise);

    try {
      const result = await promise;
      return result;
    } finally {
      this.requestQueue.delete(cacheKey);
    }
  }

  /**
   * Obtient une correction détaillée avec analyse des changements
   */
  async getCorrectionDetailed(
    text: string,
    options: CorrectionOptions = {}
  ): Promise<CorrectionResult | undefined> {
    const prompt = this.buildDetailedPrompt(text, options);

    try {
      const response = await this.makeRequestWithRetry(prompt, true);
      return this.parseCorrectionResult(text, response);
    } catch (error) {
      console.error("Erreur lors de la correction détaillée:", error);
      return undefined;
    }
  }

  /**
   * Corrige en streaming pour une meilleure UX
   */
  async *getCorrectionStream(
    text: string,
    options: CorrectionOptions = {}
  ): AsyncGenerator<string, void, unknown> {
    const prompt = this.buildPrompt(text, options);

    try {
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
    } catch (error) {
      console.error("Erreur de streaming:", error);
      throw error;
    }
  }

  /**
   * Corrige plusieurs textes en batch avec optimisation
   */
  async correctBatch(
    texts: string[],
    options: CorrectionOptions = {}
  ): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    const batchSize = 5;

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const promises = batch.map((text) => this.getCorrection(text, options));
      const batchResults = await Promise.allSettled(promises);

      batchResults.forEach((result, index) => {
        const text = batch[index];
        if (result.status === "fulfilled" && result.value) {
          results.set(text, result.value);
        } else {
          results.set(text, text); // Garder l'original en cas d'échec
        }
      });

      // Pause pour éviter le rate limiting
      if (i + batchSize < texts.length) {
        await this.sleep(500);
      }
    }

    return results;
  }

  /**
   * Effectue la correction avec retry automatique
   */
  private async performCorrection(
    text: string,
    options: CorrectionOptions
  ): Promise<string> {
    const prompt = this.buildPrompt(text, options);
    return this.makeRequestWithRetry(prompt);
  }

  /**
   * Fait une requête avec retry exponentiel
   */
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
          ...(jsonMode && { response_format: { type: "json_object" } }),
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error("Réponse vide du modèle");
        }

        return content;
      } catch (error) {
        lastError = error as Error;
        console.error(`Tentative ${attempt + 1} échouée:`, error);

        if (attempt < this.retryAttempts - 1) {
          const delay = this.retryDelay * Math.pow(2, attempt);
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error("Échec après plusieurs tentatives");
  }

  /**
   * Construit le prompt de correction
   */
  private buildPrompt(text: string, options: CorrectionOptions): string {
    if (options.customPrompt) {
      return options.customPrompt.replace("{text}", text);
    }

    const language = options.language || this.config.language;
    const style = options.style || "neutral";

    let prompt = `Corrige le texte suivant en ${language} (orthographe, grammaire et style)`;

    if (style !== "neutral") {
      prompt += ` avec un style ${style}`;
    }

    if (options.context) {
      prompt += `\n\nContexte: ${options.context}`;
    }

    prompt += `\n\nTexte à corriger:\n"${text}"\n\nRéponds uniquement avec le texte corrigé, sans explication.`;

    return prompt;
  }

  /**
   * Construit un prompt pour correction détaillée
   */
  private buildDetailedPrompt(
    text: string,
    options: CorrectionOptions
  ): string {
    const language = options.language || this.config.language;

    return `Analyse et corrige le texte suivant en ${language}. Réponds en JSON avec:
{
  "correctedText": "texte corrigé",
  "changes": [
    {
      "type": "spelling|grammar|style|punctuation",
      "original": "texte original",
      "corrected": "texte corrigé",
      "explanation": "explication courte"
    }
  ],
  "confidence": 0.95
}

Texte à corriger:
"${text}"`;
  }

  /**
   * Parse le résultat de correction détaillée
   */
  private parseCorrectionResult(
    originalText: string,
    response: string
  ): CorrectionResult | undefined {
    try {
      const parsed = JSON.parse(response);
      return {
        correctedText: parsed.correctedText || originalText,
        originalText,
        changes: parsed.changes || [],
        confidence: parsed.confidence || 0.8,
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

  /**
   * Génère une clé de cache
   */
  private getCacheKey(text: string, options: CorrectionOptions): string {
    return `${text}:${JSON.stringify(options)}`;
  }

  /**
   * Utilitaire de pause
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Vérifie la santé de l'API
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 5,
      });
      return !!response.choices[0]?.message?.content;
    } catch (error) {
      console.error("Health check failed:", error);
      return false;
    }
  }

  /**
   * Obtient les modèles disponibles
   */
  async getAvailableModels(): Promise<string[]> {
    try {
      const models = await this.client.models.list();
      return models.data
        .filter((m) => m.id.includes("gpt"))
        .map((m) => m.id)
        .sort();
    } catch (error) {
      console.error("Erreur lors de la récupération des modèles:", error);
      return ["gpt-4o-mini", "gpt-4o", "gpt-4"];
    }
  }
}
