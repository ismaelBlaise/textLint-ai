import * as vscode from "vscode";
import { ConfigurationManager, promptApiKey } from "./config/settings";
import {
  applyCorrection,
  applySingleCorrection,
  autoAnalyzeDocument,
  refresh,
  scanFile,
  scanSelection,
  showPanel,
  previewCorrections,
  ignoreSingleCorrection,
  undoCorrections,
  analyzeText,
  clearCache,
  dispose as disposeCommands,
} from "./commands/scan";
import {
  initDiagnostics,
  dispose as disposeDiagnostics,
  enableAutoAnalysis,
  exportDiagnostics,
} from "./ui/diagnostics";
import {
  initStatusBar,
  dispose as disposeStatusBar,
  resetStatusBar,
} from "./ui/statusBar";
import { dispose as disposeDecorations } from "./ui/panel/decorations";
import { dispose as disposePanel } from "./ui/panel/panelController";
import { cacheService } from "./services/cacheService";

let autoAnalysisDisposable: vscode.Disposable | undefined;

export function activate(context: vscode.ExtensionContext) {
  console.log('✓ Extension "textlint-ai" activée');

  // Initialisation
  initDiagnostics();
  initStatusBar();

  // Vérifier la configuration au démarrage
  checkConfiguration();

  // Enregistrer les commandes
  registerCommands(context);

  // Configurer les événements
  setupEventHandlers(context);

  // Configurer l'analyse automatique si activée
  setupAutoAnalysis(context);

  // Nettoyer le cache périodiquement
  setupCacheCleanup(context);

  // Afficher un message de bienvenue pour les nouveaux utilisateurs
  showWelcomeMessage(context);

  console.log("✓ TextLint AI prêt à l'emploi");
}

export function deactivate() {
  console.log('Désactivation de l\'extension "textlint-ai"');

  // Nettoyer les ressources
  if (autoAnalysisDisposable) {
    autoAnalysisDisposable.dispose();
  }

  disposeCommands();
  disposeDiagnostics();
  disposeStatusBar();
  disposeDecorations();
  disposePanel();

  console.log("✓ TextLint AI désactivé");
}

/**
 * Enregistre toutes les commandes
 */
function registerCommands(context: vscode.ExtensionContext) {
  const commands = [
    // Commandes principales
    { id: "textlint-ai.login", func: promptApiKey },
    { id: "textlint-ai.scanFile", func: scanFile },
    { id: "textlint-ai.scanSelection", func: scanSelection },
    { id: "textlint-ai.applyCorrection", func: applyCorrection },
    {
      id: "textlint-ai.applySingleCorrection",
      func: (correctionId: string) => applySingleCorrection(correctionId),
    },
    {
      id: "textlint-ai.ignoreSingleCorrection",
      func: (correctionId: string) => ignoreSingleCorrection(correctionId),
    },
    { id: "textlint-ai.showPanel", func: showPanel },
    { id: "textlint-ai.refresh", func: refresh },

    // Nouvelles commandes
    { id: "textlint-ai.previewCorrections", func: previewCorrections },
    { id: "textlint-ai.undoCorrections", func: undoCorrections },
    { id: "textlint-ai.analyzeText", func: analyzeText },
    { id: "textlint-ai.clearCache", func: clearCache },

    // Commandes de configuration
    { id: "textlint-ai.configure", func: () => showConfigurationMenu(context) },
    { id: "textlint-ai.resetConfig", func: resetConfiguration },
    { id: "textlint-ai.showStats", func: showStatistics },

    // Commandes d'export
    { id: "textlint-ai.exportDiagnostics", func: exportDiagnostics },
    { id: "textlint-ai.exportCacheStats", func: exportCacheStats },

    // Commandes d'analyse
    {
      id: "textlint-ai.toggleAutoAnalysis",
      func: () => toggleAutoAnalysis(context),
    },

    // Menu contextuel
    { id: "textlint-ai.showMenu", func: () => showContextMenu(context) },
  ];

  commands.forEach((cmd) => {
    const disposable = vscode.commands.registerCommand(cmd.id, cmd.func);
    context.subscriptions.push(disposable);
  });

  console.log(`✓ ${commands.length} commandes enregistrées`);
}

/**
 * Configure les gestionnaires d'événements
 */
function setupEventHandlers(context: vscode.ExtensionContext) {
  // Surveiller les changements de configuration
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("textlint-ai")) {
        console.log("Configuration modifiée");
        resetStatusBar();
      }
    })
  );

  // Surveiller l'ouverture de documents
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((document) => {
      if (shouldAnalyzeDocument(document)) {
        console.log(`Document ouvert: ${document.fileName}`);
      }
    })
  );

  // Surveiller la fermeture de documents
  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument((document) => {
      console.log(`Document fermé: ${document.fileName}`);
    })
  );

  // Surveiller les changements d'éditeur actif
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor && shouldAnalyzeDocument(editor.document)) {
        resetStatusBar();
      }
    })
  );
}

/**
 * Configure l'analyse automatique
 */
function setupAutoAnalysis(context: vscode.ExtensionContext) {
  const config = ConfigurationManager.getConfig();

  if (config.autoCorrect) {
    enableAutoAnalysisFeature();
    console.log("✓ Analyse automatique activée");
  }
}

/**
 * Active l'analyse automatique
 */
function enableAutoAnalysisFeature() {
  if (autoAnalysisDisposable) {
    autoAnalysisDisposable.dispose();
  }

  autoAnalysisDisposable = enableAutoAnalysis((document) => {
    if (shouldAnalyzeDocument(document)) {
      autoAnalyzeDocument(document);
    }
  });
}

/**
 * Bascule l'analyse automatique
 */
function toggleAutoAnalysis(context: vscode.ExtensionContext) {
  const config = ConfigurationManager.getConfig();
  const newValue = !config.autoCorrect;

  ConfigurationManager.updateConfig("autoCorrect", newValue);

  if (newValue) {
    enableAutoAnalysisFeature();
    vscode.window.showInformationMessage("✓ Analyse automatique activée");
  } else {
    if (autoAnalysisDisposable) {
      autoAnalysisDisposable.dispose();
      autoAnalysisDisposable = undefined;
    }
    vscode.window.showInformationMessage("✓ Analyse automatique désactivée");
  }
}

/**
 * Configure le nettoyage périodique du cache
 */
function setupCacheCleanup(context: vscode.ExtensionContext) {
  // Nettoyer le cache toutes les heures
  const interval = setInterval(() => {
    const removed = cacheService.cleanup();
    if (removed > 0) {
      console.log(`✓ ${removed} entrées de cache expirées supprimées`);
    }
  }, 60 * 60 * 1000); // 1 heure

  context.subscriptions.push({
    dispose: () => clearInterval(interval),
  });
}

/**
 * Vérifie si un document doit être analysé
 */
function shouldAnalyzeDocument(document: vscode.TextDocument): boolean {
  // Ignorer les schémas non-fichier
  if (document.uri.scheme !== "file") {
    return false;
  }

  // Ignorer les fichiers trop volumineux (> 1MB)
  if (document.getText().length > 1024 * 1024) {
    return false;
  }

  // Langages supportés
  const supportedLanguages = [
    "javascript",
    "typescript",
    "python",
    "java",
    "csharp",
    "php",
    "ruby",
    "go",
    "rust",
    "markdown",
    "plaintext",
  ];

  return supportedLanguages.includes(document.languageId);
}

/**
 * Vérifie la configuration au démarrage
 */
async function checkConfiguration() {
  if (!ConfigurationManager.isConfigValid()) {
    const response = await vscode.window.showWarningMessage(
      "TextLint AI: Clé API non configurée",
      "Configurer maintenant",
      "Plus tard"
    );

    if (response === "Configurer maintenant") {
      await promptApiKey();
    }
  }
}

/**
 * Affiche le menu de configuration
 */
async function showConfigurationMenu(context: vscode.ExtensionContext) {
  const config = ConfigurationManager.getConfig();

  const options = [
    {
      label: "$(key) Configurer la clé API",
      description: config.apikey ? "Modifier" : "Ajouter",
      action: promptApiKey,
    },
    {
      label: "$(symbol-parameter) Choisir le modèle",
      description: `Actuel: ${config.model}`,
      action: selectModel,
    },
    {
      label: "$(globe) Langue",
      description: `Actuel: ${config.language}`,
      action: selectLanguage,
    },
    {
      label: "$(gear) Analyse automatique",
      description: config.autoCorrect ? "Activée" : "Désactivée",
      action: toggleAutoAnalysis,
    },
    {
      label: "$(trash) Réinitialiser la configuration",
      description: "Revenir aux valeurs par défaut",
      action: resetConfiguration,
    },
  ];

  const selected = await vscode.window.showQuickPick(options, {
    placeHolder: "Configurer TextLint AI",
  });

  if (selected) {
    selected.action(context);
  }
}

/**
 * Sélectionne un modèle
 */
async function selectModel() {
  const models = [
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4",
    "gpt-4-turbo",
    "gpt-3.5-turbo",
  ];

  const selected = await vscode.window.showQuickPick(models, {
    placeHolder: "Sélectionnez un modèle OpenAI",
  });

  if (selected) {
    await ConfigurationManager.updateConfig("model", selected);
    vscode.window.showInformationMessage(`✓ Modèle défini: ${selected}`);
  }
}

/**
 * Sélectionne une langue
 */
async function selectLanguage() {
  const languages = [
    { label: "Français", value: "fr" },
    { label: "English", value: "en" },
    { label: "Español", value: "es" },
    { label: "Deutsch", value: "de" },
    { label: "Italiano", value: "it" },
  ];

  const selected = await vscode.window.showQuickPick(languages, {
    placeHolder: "Sélectionnez une langue",
  });

  if (selected) {
    await ConfigurationManager.updateConfig("language", selected.value);
    vscode.window.showInformationMessage(`✓ Langue définie: ${selected.label}`);
  }
}

/**
 * Réinitialise la configuration
 */
async function resetConfiguration() {
  const confirm = await vscode.window.showWarningMessage(
    "Réinitialiser toute la configuration ?",
    { modal: true },
    "Oui",
    "Non"
  );

  if (confirm === "Oui") {
    await ConfigurationManager.resetConfig();
    vscode.window.showInformationMessage("✓ Configuration réinitialisée");
  }
}

/**
 * Affiche les statistiques
 */
async function showStatistics() {
  const stats = cacheService.getStats();
  const diagnosticsStats =
    require("./ui/diagnostics").getDiagnosticsBySeverity();

  const message = `
📊 Statistiques TextLint AI

Cache:
  • Entrées: ${stats.entries}
  • Taille: ${(stats.size / 1024).toFixed(2)} KB
  • Taux de réussite: ${(stats.hitRate * 100).toFixed(1)}%
  • Hits: ${stats.hits} / Misses: ${stats.misses}

Diagnostics:
  • Erreurs: ${diagnosticsStats.error}
  • Avertissements: ${diagnosticsStats.warning}
  • Infos: ${diagnosticsStats.info}
  • Astuces: ${diagnosticsStats.hint}
  `.trim();

  vscode.window.showInformationMessage(message);
}

/**
 * Exporte les statistiques du cache
 */
async function exportCacheStats() {
  const stats = cacheService.getStats();
  const topEntries = cacheService.getTopEntries(20);

  const data = {
    timestamp: new Date().toISOString(),
    stats,
    topEntries,
  };

  const uri = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file("cache-stats.json"),
    filters: { JSON: ["json"] },
  });

  if (uri) {
    await vscode.workspace.fs.writeFile(
      uri,
      Buffer.from(JSON.stringify(data, null, 2), "utf8")
    );
    vscode.window.showInformationMessage("✓ Statistiques exportées");
  }
}

/**
 * Affiche le menu contextuel
 */
async function showContextMenu(context: vscode.ExtensionContext) {
  const actions = [
    {
      label: "$(file-code) Analyser le fichier",
      action: scanFile,
    },
    {
      label: "$(selection) Analyser la sélection",
      action: scanSelection,
    },
    {
      label: "$(eye) Prévisualiser les corrections",
      action: previewCorrections,
    },
    {
      label: "$(refresh) Rafraîchir",
      action: refresh,
    },
    {
      label: "$(gear) Configuration",
      action: () => showConfigurationMenu(context),
    },
  ];

  const selected = await vscode.window.showQuickPick(actions, {
    placeHolder: "TextLint AI - Actions",
  });

  if (selected) {
    await selected.action();
  }
}

/**
 * Affiche un message de bienvenue pour les nouveaux utilisateurs
 */
function showWelcomeMessage(context: vscode.ExtensionContext) {
  const hasSeenWelcome = context.globalState.get("textlint-ai.hasSeenWelcome");

  if (!hasSeenWelcome) {
    vscode.window
      .showInformationMessage(
        "Bienvenue dans TextLint AI ! Configurez votre clé API pour commencer.",
        "Configurer",
        "Plus tard"
      )
      .then((response) => {
        if (response === "Configurer") {
          promptApiKey();
        }
      });

    context.globalState.update("textlint-ai.hasSeenWelcome", true);
  }
}
