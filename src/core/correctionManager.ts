import { AIClient } from "./aiClient";
import { cacheService, CacheService } from "../services/cacheService";

export class CorrectionManager {
  private aiClient: AIClient;

  constructor() {
    this.aiClient = new AIClient();
  }

  async correctBlocks(texts: string[]): Promise<string[]> {
    const results: string[] = [];
    for (const text of texts) {
      let correction = cacheService.get(text);
      if (!correction) {
        correction = (await this.aiClient.getCorrection(text)) || "";
        cacheService.set(text, correction);
      }
      results.push(correction);
    }

    return results;
  }

  async correctText(text: string): Promise<string> {
    let correction = cacheService.get(text);
    if (!correction) {
      correction = (await this.aiClient.getCorrection(text)) || "";
      cacheService.set(text, correction);
    }

    return correction;
  }
}
