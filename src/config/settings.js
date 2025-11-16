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
exports.ConfigurationManager = void 0;
exports.getApiKey = getApiKey;
exports.getModel = getModel;
exports.promptApiKey = promptApiKey;
const vscode = __importStar(require("vscode"));
class ConfigurationManager {
    static CONFIG_KEY = "textlint-ai";
    static DEFAULT_CONFIG = {
        model: "gpt-4o-mini",
        maxTokens: 500,
        temperature: 0,
        language: "fr",
        autoCorrect: false,
        ignorePatterns: ["TODO", "FIXME", "XXX"],
    };
    static getConfig() {
        const config = vscode.workspace.getConfiguration(this.CONFIG_KEY);
        return {
            apikey: config.get("apikey"),
            model: config.get("model") || this.DEFAULT_CONFIG.model,
            maxTokens: config.get("maxTokens") || this.DEFAULT_CONFIG.maxTokens,
            temperature: config.get("temperature") || this.DEFAULT_CONFIG.temperature,
            language: config.get("language") || this.DEFAULT_CONFIG.language,
            autoCorrect: config.get("autoCorrect") || this.DEFAULT_CONFIG.autoCorrect,
            ignorePatterns: config.get("ignorePatterns") ||
                this.DEFAULT_CONFIG.ignorePatterns,
            customPrompt: config.get("customPrompt"),
        };
    }
    static getApiKey() {
        return this.getConfig().apikey;
    }
    static validateApiKey(apikey) {
        return /^sk-[a-zA-Z0-9]{32,}$/.test(apikey);
    }
    static async promptApiKey() {
        const apikey = await vscode.window.showInputBox({
            prompt: "Entrez votre clé API OpenAI personnelle",
            ignoreFocusOut: true,
            password: true,
            placeHolder: "sk-...",
            validateInput: (value) => {
                if (!value) {
                    return "La clé API ne peut pas être vide";
                }
                if (!this.validateApiKey(value)) {
                    return "Format de clé API invalide (doit commencer par 'sk-')";
                }
                return null;
            },
        });
        if (apikey) {
            await this.updateConfig("apikey", apikey, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage("✓ Clé API enregistrée avec succès");
            return true;
        }
        else {
            vscode.window.showWarningMessage("⚠ Clé API non définie");
            return false;
        }
    }
    static async updateConfig(key, value, target = vscode.ConfigurationTarget.Global) {
        await vscode.workspace
            .getConfiguration(this.CONFIG_KEY)
            .update(key, value, target);
    }
    static async resetConfig() {
        const config = vscode.workspace.getConfiguration(this.CONFIG_KEY);
        const keys = Object.keys(this.DEFAULT_CONFIG);
        for (const key of keys) {
            await config.update(key, this.DEFAULT_CONFIG[key], vscode.ConfigurationTarget.Global);
        }
        vscode.window.showInformationMessage("Configuration réinitialisée");
    }
    static isConfigValid() {
        const config = this.getConfig();
        return !!config.apikey && this.validateApiKey(config.apikey);
    }
}
exports.ConfigurationManager = ConfigurationManager;
function getApiKey() {
    return ConfigurationManager.getApiKey();
}
function getModel() {
    return ConfigurationManager.getConfig().model;
}
async function promptApiKey() {
    return ConfigurationManager.promptApiKey();
}
//# sourceMappingURL=settings.js.map