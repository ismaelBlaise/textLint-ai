# TextLint AI - Extension VSCode

Extension VSCode intelligente pour la correction de texte avec l'IA OpenAI GPT.

## ✨ Fonctionnalités

- 🤖 **Correction IA avancée** - Utilise OpenAI GPT-4 pour des corrections intelligentes
- 📝 **Support multi-langages** - JavaScript, TypeScript, Python, Java, C#, PHP, Ruby, Go, Rust
- 🎯 **Analyse contextuelle** - Détecte automatiquement les commentaires, strings et docstrings
- 💾 **Cache intelligent** - Système LRU pour optimiser les performances
- 📊 **Statistiques détaillées** - Analyse de confiance et types de corrections
- 🔄 **Retry automatique** - Gestion robuste des erreurs réseau
- 👁️ **Preview interactive** - Prévisualiser avant d'appliquer
- ↩️ **Undo/Redo** - Annuler les corrections facilement
- 🌍 **Multi-langues** - Français, Anglais, Espagnol, Allemand, Italien

## 🚀 Installation

1. Installer l'extension depuis le marketplace VSCode
2. Ouvrir la palette de commandes (`Ctrl+Shift+P` / `Cmd+Shift+P`)
3. Exécuter `TextLint AI: Configurer la clé API`
4. Entrer votre clé API OpenAI

## 🔑 Configuration de la clé API

### Obtenir une clé API OpenAI

1. Créer un compte sur [platform.openai.com](https://platform.openai.com)
2. Aller dans [API Keys](https://platform.openai.com/api-keys)
3. Créer une nouvelle clé secrète
4. Copier la clé (elle commence par `sk-`)

### Configurer dans VSCode

**Méthode 1 : Via la commande**

```
Ctrl+Shift+P → TextLint AI: Configurer la clé API
```

**Méthode 2 : Via les paramètres**

```json
{
  "textlint-ai.apikey": "sk-votre-clé-ici"
}
```

## 📖 Utilisation

### Commandes principales

| Commande                  | Raccourci      | Description                            |
| ------------------------- | -------------- | -------------------------------------- |
| Analyser le fichier       | `Ctrl+Shift+L` | Analyse tout le fichier                |
| Analyser la sélection     | `Ctrl+Shift+K` | Analyse le texte sélectionné           |
| Appliquer les corrections | `Ctrl+Shift+A` | Applique toutes les corrections        |
| Prévisualiser             | -              | Voir les corrections avant application |
| Annuler                   | -              | Annule les dernières corrections       |

### Via le menu contextuel

1. Clic droit dans l'éditeur
2. Sélectionner **TextLint AI** → Choisir une action

### Via la barre d'état

Cliquer sur l'icône **TextLint AI** dans la barre d'état pour analyser le fichier actif.

## ⚙️ Configuration

### Paramètres disponibles

```json
{
  // Clé API OpenAI (obligatoire)
  "textlint-ai.apikey": "",

  // Modèle à utiliser
  "textlint-ai.model": "gpt-4o-mini",

  // Langue des corrections
  "textlint-ai.language": "fr",

  // Tokens maximum par requête
  "textlint-ai.maxTokens": 500,

  // Température (0 = déterministe, 2 = créatif)
  "textlint-ai.temperature": 0,

  // Analyse automatique
  "textlint-ai.autoCorrect": false,

  // Patterns à ignorer
  "textlint-ai.ignorePatterns": ["TODO", "FIXME", "XXX", "HACK"],

  // Prompt personnalisé
  "textlint-ai.customPrompt": ""
}
```

### Modèles disponibles

- `gpt-4o` - Meilleure qualité, plus cher
- `gpt-4o-mini` - **Recommandé** - Bon rapport qualité/prix
- `gpt-4` - Ancienne version GPT-4
- `gpt-4-turbo` - Version turbo de GPT-4
- `gpt-3.5-turbo` - Le moins cher

## 📊 Fonctionnalités avancées

### Cache intelligent

Le cache stocke les corrections en mémoire pour éviter les requêtes répétées :

- Algorithme LRU (Least Recently Used)
- Expiration automatique après 7 jours
- Limite de 10MB
- Commande pour vider le cache

### Analyse de confiance

Chaque correction reçoit un score de confiance :

- 🟢 **≥90%** - Haute confiance (vert)
- 🟡 **≥70%** - Confiance moyenne (bleu)
- 🔴 **<70%** - Faible confiance (orange/rouge)

### Types de corrections

- 📖 **Spelling** - Orthographe
- ✏️ **Grammar** - Grammaire
- 🎨 **Style** - Style d'écriture
- ⁉️ **Punctuation** - Ponctuation

### Export de rapports

Exportez les corrections au format JSON ou Markdown :

```
Commande Palette → TextLint AI: Exporter les diagnostics
```

## 🎯 Exemples

### Correction de commentaire JavaScript

**Avant :**

```javascript
// ceci est un comentaire avec des faute
function hello() {
  console.log("Hello World");
}
```

**Après :**

```javascript
// Ceci est un commentaire sans fautes
function hello() {
  console.log("Hello World");
}
```

### Correction de docstring Python

**Avant :**

```python
def calculate(x, y):
    """Cette fonction calcul la somme de deux nombre"""
    return x + y
```

**Après :**

```python
def calculate(x, y):
    """Cette fonction calcule la somme de deux nombres"""
    return x + y
```

## 🔧 Développement

### Prérequis

- Node.js ≥ 18
- VS Code ≥ 1.80

### Installation

```bash
# Cloner le repo
git clone https://github.com/yourusername/textlint-ai.git
cd textlint-ai

# Installer les dépendances
npm install

# Compiler
npm run compile

# Lancer en mode développement
npm run watch
```

### Structure du projet

```
textlint-ai/
├── src/
│   ├── config/
│   │   └── settings.ts          # Configuration
│   ├── core/
│   │   ├── aiClient.ts          # Client OpenAI
│   │   ├── correctionManager.ts # Gestionnaire
│   │   ├── extractor.ts         # Extraction de texte
│   │   └── contextDetector.ts   # Détection contextuelle
│   ├── services/
│   │   └── cacheService.ts      # Cache LRU
│   ├── ui/
│   │   ├── diagnostics.ts       # Diagnostics VSCode
│   │   ├── statusBar.ts         # Barre d'état
│   │   └── panel/
│   │       ├── decorations.ts   # Décorations
│   │       └── panelController.ts # Panneau Web
│   ├── commands/
│   │   └── scan.ts              # Commandes
│   └── extension.ts             # Point d'entrée
├── package.json
└── tsconfig.json
```

## 🐛 Dépannage

### L'extension ne s'active pas

1. Vérifier que la clé API est configurée
2. Redémarrer VSCode
3. Vérifier la console de développement (`Help > Toggle Developer Tools`)

### Erreur "Clé API manquante"

Configurer votre clé API :

```
Ctrl+Shift+P → TextLint AI: Configurer la clé API
```

### Erreur réseau / Timeout

1. Vérifier votre connexion internet
2. Vérifier les quotas OpenAI : [platform.openai.com/usage](https://platform.openai.com/usage)
3. Le système retry automatiquement 3 fois

### Performances lentes

1. Utiliser le modèle `gpt-4o-mini` (plus rapide)
2. Réduire `maxTokens` dans les paramètres
3. Vider le cache si plein : `TextLint AI: Vider le cache`

## 💰 Coûts

Les coûts dépendent du modèle utilisé (tarifs OpenAI 2024) :

| Modèle      | Prix Input      | Prix Output     |
| ----------- | --------------- | --------------- |
| gpt-4o-mini | $0.15/1M tokens | $0.60/1M tokens |
| gpt-4o      | $5/1M tokens    | $15/1M tokens   |
| gpt-4-turbo | $10/1M tokens   | $30/1M tokens   |

💡 **Recommandation** : Utiliser `gpt-4o-mini` pour un usage quotidien (très économique).

## 📝 Changelog

### Version 1.0.0

- 🎉 Version initiale
- ✅ Support de 9 langages de programmation
- ✅ Cache intelligent LRU
- ✅ Retry automatique
- ✅ Preview interactive
- ✅ Undo/Redo
- ✅ Export de rapports
- ✅ Multi-langues

## 🤝 Contribution

Les contributions sont les bienvenues !

1. Fork le projet
2. Créer une branche (`git checkout -b feature/amelioration`)
3. Commit les changements (`git commit -am 'Ajout fonctionnalité'`)
4. Push (`git push origin feature/amelioration`)
5. Créer une Pull Request

## 📄 Licence

MIT License - voir le fichier [LICENSE](LICENSE)

## 👤 Auteur

Votre Nom - [@votre-twitter](https://twitter.com/votre-twitter)

## 🙏 Remerciements

- OpenAI pour l'API GPT
- La communauté VSCode
- Tous les contributeurs

## 📧 Support

- 🐛 Bug reports : [GitHub Issues](https://github.com/yourusername/textlint-ai/issues)
- 💬 Questions : [GitHub Discussions](https://github.com/yourusername/textlint-ai/discussions)
- 📧 Email : support@example.com

---

⭐ **N'oubliez pas de mettre une étoile sur GitHub si vous aimez ce projet !**
