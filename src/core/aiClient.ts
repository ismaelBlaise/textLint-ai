/* eslint-disable curly */
import OpenAI from "openai";
import { getApiKey, getModel } from "../config/settings";

export class AIClient {
  private client: OpenAI;

  constructor() {
    const apikey = getApiKey();
    if (!apikey) throw new Error("Clé API OpenAI manquante !");

    this.client = new OpenAI({ apiKey: apikey });
  }

  async getCorrection(text: string): Promise<string | undefined> {
    const model = getModel();
    const prompt = `Corrige le texte suivant en français (orthographe, grammaire et style):\n\n"${text}"`;

    try {
      const response = await this.client.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
      });

      const content = response.choices[0]?.message?.content;
      return content || text;
    } catch (error) {
      console.error("Erreur openai", error);
    }
  }
}
