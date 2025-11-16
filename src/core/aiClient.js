"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIClient = void 0;
const openai_1 = __importDefault(require("openai"));
const settings_1 = require("../config/settings");
class AIClient {
    client;
    config;
    requestQueue = new Map();
    retryAttempts = 3;
    retryDelay = 1000;
    constructor() {
        const apikey = settings_1.ConfigurationManager.getApiKey();
        if (!apikey) {
            throw new Error("Clé API OpenAI manquante !");
        }
        this.client = new openai_1.default({ apiKey: apikey });
        this.config = settings_1.ConfigurationManager.getConfig();
    }
    async getCorrection(text, options = {}) {
        const cacheKey = this.getCacheKey(text, options);
        if (this.requestQueue.has(cacheKey)) {
            return this.requestQueue.get(cacheKey);
        }
        const promise = this.performCorrection(text, options);
        this.requestQueue.set(cacheKey, promise);
        try {
            const result = await promise;
            return result;
        }
        finally {
            this.requestQueue.delete(cacheKey);
        }
    }
    async getCorrectionDetailed(text, options = {}) {
        const prompt = this.buildDetailedPrompt(text, options);
        try {
            const response = await this.makeRequestWithRetry(prompt, true);
            return this.parseCorrectionResult(text, response);
        }
        catch (error) {
            console.error("Erreur lors de la correction détaillée:", error);
            return undefined;
        }
    }
    async *getCorrectionStream(text, options = {}) {
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
        }
        catch (error) {
            console.error("Erreur de streaming:", error);
            throw error;
        }
    }
    async correctBatch(texts, options = {}) {
        const results = new Map();
        const batchSize = 5;
        for (let i = 0; i < texts.length; i += batchSize) {
            const batch = texts.slice(i, i + batchSize);
            const promises = batch.map((text) => this.getCorrection(text, options));
            const batchResults = await Promise.allSettled(promises);
            batchResults.forEach((result, index) => {
                const text = batch[index];
                if (result.status === "fulfilled" && result.value) {
                    results.set(text, result.value);
                }
                else {
                    results.set(text, text);
                }
            });
            if (i + batchSize < texts.length) {
                await this.sleep(500);
            }
        }
        return results;
    }
    async performCorrection(text, options) {
        const prompt = this.buildPrompt(text, options);
        return this.makeRequestWithRetry(prompt);
    }
    async makeRequestWithRetry(prompt, jsonMode = false) {
        let lastError;
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
            }
            catch (error) {
                lastError = error;
                console.error(`Tentative ${attempt + 1} échouée:`, error);
                if (attempt < this.retryAttempts - 1) {
                    const delay = this.retryDelay * Math.pow(2, attempt);
                    await this.sleep(delay);
                }
            }
        }
        throw lastError || new Error("Échec après plusieurs tentatives");
    }
    buildPrompt(text, options) {
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
    buildDetailedPrompt(text, options) {
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
    parseCorrectionResult(originalText, response) {
        try {
            const parsed = JSON.parse(response);
            return {
                correctedText: parsed.correctedText || originalText,
                originalText,
                changes: parsed.changes || [],
                confidence: parsed.confidence || 0.8,
                model: this.config.model,
            };
        }
        catch (error) {
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
    getCacheKey(text, options) {
        return `${text}:${JSON.stringify(options)}`;
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    async healthCheck() {
        try {
            const response = await this.client.chat.completions.create({
                model: this.config.model,
                messages: [{ role: "user", content: "ping" }],
                max_tokens: 5,
            });
            return !!response.choices[0]?.message?.content;
        }
        catch (error) {
            console.error("Health check failed:", error);
            return false;
        }
    }
    async getAvailableModels() {
        try {
            const models = await this.client.models.list();
            return models.data
                .filter((m) => m.id.includes("gpt"))
                .map((m) => m.id)
                .sort();
        }
        catch (error) {
            console.error("Erreur lors de la récupération des modèles:", error);
            return ["gpt-4o-mini", "gpt-4o", "gpt-4"];
        }
    }
}
exports.AIClient = AIClient;
//# sourceMappingURL=aiClient.js.map