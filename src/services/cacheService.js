"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheService = exports.CacheService = void 0;
const crypto = __importStar(require("crypto"));
class CacheService {
    cache = new Map();
    maxSize = 10 * 1024 * 1024; // 10MB
    maxAge = 7 * 24 * 60 * 60 * 1000; // 7 jours
    hits = 0;
    misses = 0;
    /**
     * Récupère une valeur du cache
     */
    get(key) {
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
    set(key, value) {
        const hash = this.hash(key);
        const size = this.getSize(value);
        // Vérifier si on doit faire de la place
        this.ensureSpace(size);
        const entry = {
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
    delete(key) {
        const hash = this.hash(key);
        return this.cache.delete(hash);
    }
    /**
     * Vide complètement le cache
     */
    clear() {
        this.cache.clear();
        this.hits = 0;
        this.misses = 0;
    }
    /**
     * Obtient les statistiques du cache
     */
    getStats() {
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
    cleanup() {
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
    getTopEntries(limit = 10) {
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
    export() {
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
    import(json) {
        try {
            const data = JSON.parse(json);
            this.cache = new Map(data.cache);
            this.hits = data.stats.hits || 0;
            this.misses = data.stats.misses || 0;
            return true;
        }
        catch (error) {
            console.error("Erreur lors de l'import du cache:", error);
            return false;
        }
    }
    /**
     * Optimise le cache en utilisant LRU (Least Recently Used)
     */
    optimize() {
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
    preload(entries) {
        entries.forEach(({ key, value }) => {
            this.set(key, value);
        });
    }
    /**
     * Vérifie si une clé existe
     */
    has(key) {
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
    configure(options) {
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
    hash(key) {
        return crypto.createHash("sha256").update(key).digest("hex");
    }
    /**
     * Calcule la taille d'une chaîne en octets
     */
    getSize(str) {
        return Buffer.byteLength(str, "utf8");
    }
    /**
     * S'assure qu'il y a assez d'espace dans le cache
     */
    ensureSpace(requiredSize) {
        let currentSize = Array.from(this.cache.values()).reduce((sum, e) => sum + e.size, 0);
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
exports.CacheService = CacheService;
// Instance singleton
exports.cacheService = new CacheService();
//# sourceMappingURL=cacheService.js.map