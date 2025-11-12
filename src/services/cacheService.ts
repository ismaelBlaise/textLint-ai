/* eslint-disable curly */
type CacheEntry = {
  input: string;
  correction: string;
  timestamp: number;
};

const CACHE_EXPIRATION_MS = 10000 * 60 * 60;

export class CacheService {
  private cache: Map<string, CacheEntry> = new Map();
  get(input: string): string | null {
    const entry = this.cache.get(input);
    if (!entry) return null;
    const now = Date.now();
    if (now - entry.timestamp > CACHE_EXPIRATION_MS) {
      this.cache.delete(input);
      return null;
    }

    return entry.correction;
  }

  set(input: string, correction: string) {
    this.cache.set(input, { input, correction, timestamp: Date.now() });
  }

  clear() {
    this.cache.clear();
  }
}

export const cacheService = new CacheService();
