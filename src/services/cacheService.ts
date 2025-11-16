import * as crypto from "crypto";

export interface CacheEntry {
  value: string;
  timestamp: number;
  hits: number;
  size: number;
}

export interface CacheStats {
  size: number;
  entries: number;
  hits: number;
  misses: number;
  hitRate: number;
  oldestEntry: number;
  newestEntry: number;
}

export class CacheService {
  private cache: Map<string, CacheEntry> = new Map();
  private maxSize: number = 10 * 1024 * 1024; // 10MB
  private maxAge: number = 7 * 24 * 60 * 60 * 1000; // 7 jours
  private hits: number = 0;
  private misses: number = 0;

  /**
   * Récupère une valeur du cache
   */
  get(key: string): string | undefined {
    const hash = this.hash(key);
    const entry = this.cache.get(hash);

    if (!entry) {
      this.misses++;
      return undefined;
    }

    // Vérifier l'expiration
    if (Date.now() - entry.timestamp > this.maxAge) {
      this.cache.delete(hash);
      this.misses++;
      return undefined;
    }

    entry.hits++;
    this.hits++;
    return entry.value;
  }

  /**
   * Stocke une valeur dans le cache avec LRU
   */
  set(key: string, value: string): void {
    const hash = this.hash(key);
    const size = this.getSize(value);

    // Vérifier si on doit faire de la place
    this.ensureSpace(size);

    const entry: CacheEntry = {
      value,
      timestamp: Date.now(),
      hits: 0,
      size,
    };

    this.cache.set(hash, entry);
  }

  /**
   * Supprime une entrée du cache
   */
  delete(key: string): boolean {
    const hash = this.hash(key);
    return this.cache.delete(hash);
  }

  /**
   * Vide complètement le cache
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Obtient les statistiques du cache
   */
  getStats(): CacheStats {
    const entries = Array.from(this.cache.values());
    const totalSize = entries.reduce((sum, e) => sum + e.size, 0);
    const timestamps = entries.map((e) => e.timestamp);

    return {
      size: totalSize,
      entries: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: this.hits / (this.hits + this.misses) || 0,
      oldestEntry: Math.min(...timestamps, Date.now()),
      newestEntry: Math.max(...timestamps, 0),
    };
  }

  /**
   * Nettoie les entrées expirées
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;

    for (const [hash, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.maxAge) {
        this.cache.delete(hash);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Obtient les entrées les plus populaires
   */
  getTopEntries(limit: number = 10): Array<{ key: string; hits: number }> {
    return Array.from(this.cache.entries())
      .sort((a, b) => b[1].hits - a[1].hits)
      .slice(0, limit)
      .map(([hash, entry]) => ({
        key: hash.substring(0, 16),
        hits: entry.hits,
      }));
  }

  /**
   * Exporte le cache vers JSON
   */
  export(): string {
    const data = {
      cache: Array.from(this.cache.entries()),
      stats: {
        hits: this.hits,
        misses: this.misses,
      },
      timestamp: Date.now(),
    };
    return JSON.stringify(data);
  }

  /**
   * Importe le cache depuis JSON
   */
  import(json: string): boolean {
    try {
      const data = JSON.parse(json);
      this.cache = new Map(data.cache);
      this.hits = data.stats.hits || 0;
      this.misses = data.stats.misses || 0;
      return true;
    } catch (error) {
      console.error("Erreur lors de l'import du cache:", error);
      return false;
    }
  }

  /**
   * Optimise le cache en utilisant LRU (Least Recently Used)
   */
  optimize(): void {
    const entries = Array.from(this.cache.entries());

    // Trier par hits et timestamp
    entries.sort((a, b) => {
      const scoreA = a[1].hits / (Date.now() - a[1].timestamp);
      const scoreB = b[1].hits / (Date.now() - b[1].timestamp);
      return scoreB - scoreA;
    });

    // Garder seulement les meilleures entrées
    const maxEntries = 1000;
    if (entries.length > maxEntries) {
      this.cache = new Map(entries.slice(0, maxEntries));
    }
  }

  /**
   * Précharge plusieurs entrées
   */
  preload(entries: Array<{ key: string; value: string }>): void {
    entries.forEach(({ key, value }) => {
      this.set(key, value);
    });
  }

  /**
   * Vérifie si une clé existe
   */
  has(key: string): boolean {
    const hash = this.hash(key);
    const entry = this.cache.get(hash);

    if (!entry) {
      return false;
    }

    // Vérifier l'expiration
    if (Date.now() - entry.timestamp > this.maxAge) {
      this.cache.delete(hash);
      return false;
    }

    return true;
  }

  /**
   * Configure les paramètres du cache
   */
  configure(options: { maxSize?: number; maxAge?: number }): void {
    if (options.maxSize !== undefined) {
      this.maxSize = options.maxSize;
    }
    if (options.maxAge !== undefined) {
      this.maxAge = options.maxAge;
    }
  }

  /**
   * Hash une clé pour l'utiliser comme identifiant
   */
  private hash(key: string): string {
    return crypto.createHash("sha256").update(key).digest("hex");
  }

  /**
   * Calcule la taille d'une chaîne en octets
   */
  private getSize(str: string): number {
    return Buffer.byteLength(str, "utf8");
  }

  /**
   * S'assure qu'il y a assez d'espace dans le cache
   */
  private ensureSpace(requiredSize: number): void {
    let currentSize = Array.from(this.cache.values()).reduce(
      (sum, e) => sum + e.size,
      0
    );

    if (currentSize + requiredSize <= this.maxSize) {
      return;
    }

    // Supprimer les entrées les moins utilisées (LRU)
    const entries = Array.from(this.cache.entries()).sort((a, b) => {
      const scoreA = a[1].hits / (Date.now() - a[1].timestamp);
      const scoreB = b[1].hits / (Date.now() - b[1].timestamp);
      return scoreA - scoreB;
    });

    for (const [hash, entry] of entries) {
      if (currentSize + requiredSize <= this.maxSize) {
        break;
      }
      this.cache.delete(hash);
      currentSize -= entry.size;
    }
  }
}

// Instance singleton
export const cacheService = new CacheService();
