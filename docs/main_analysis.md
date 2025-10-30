# Audit des modules main.js et index.html - Projet Pairleroy

## Vue d'ensemble

Ce document présente l'audit complet des modules principaux `main.js` et `index.html` du projet Pairleroy, un jeu de stratégie sur grille hexagonale. L'analyse couvre l'architecture, la gestion d'état, les interactions utilisateur et les problèmes d'organisation du code.

## 1. Orchestration générale de l'application

### 1.1 Architecture modulaire

L'application suit une architecture modulaire séparation des responsabilités :

- **`core.js`** : Logique pure (mathématiques hexagonales, RNG, quotas)
- **`palette.js`** : Gestion des tuiles et sélection de combinaisons
- **`render.js`** : Rendu SVG et construction de l'interface visuelle
- **`main.js`** : Orchestration et coordination (1862 lignes)

### 1.2 Point d'entrée et initialisation

Le processus d'initialisation se déroule dans `generateAndRender()` (lignes 697-1535) :

```javascript
function generateAndRender(config, forceReset = false) {
    // Génération de la grille
    const gridSide = generateAxialGrid(config.gridSize);
    
    // Assignation des combinaisons de tuiles
    const tileCombos = assignTileCombos(gridSide, config);
    
    // Construction du SVG et rendu initial
    buildSVG();
    svg.__state.renderInitialGrid(gridSide, tileCombos);
    
    // Initialisation des ressources joueurs
    playerResources = Array(6).fill().map(() => ({...RESOURCE_DEFAULTS}));
    playerScores = Array(6).fill(0);
    
    // Calcul des jonctions et rendu des overlays
    svg.__state.computeAndRenderJunctions();
}
```

### 1.3 État global dispersé

**Problème critique** : L'état est réparti sur plus de 20 variables globales :

```javascript
// Variables d'état dispersées dans main.js (lignes 4-93)
let colonPositions = {};           // Positions des colons
let colonMoveRemaining = {};       // Mouvements restants par joueur
let playerScores = [];             // Scores des 6 joueurs
let playerResources = [];          // Ressources par joueur
let placements = [];               // Tuiles placées
let turnState = {};                // État du tour actuel
let selectedColonPlayer = null;    // Joueur sélectionné pour déplacer un colon
let panSuppressClick = false;      // État du pan/zoom
let autoFillActive = false;        // État de l'auto-remplissage
```

**Impact** : Difficulté de traçabilité des changements d'état, bugs difficiles à reproduire, tests unitaires complexes.

## 2. Lecture des réglages utilisateur

### 2.1 Sources de configuration

Trois sources de configuration sont gérées :

```javascript
// 1. Valeurs par défaut (ligne 602-610)
function readConfig() {
    const gridSize = parseInt(document.getElementById('gridSize').value) || 9;
    const tileTypePercents = {
        road: parseInt(document.getElementById('roadPercent').value) || 50,
        city: parseInt(document.getElementById('cityPercent').value) || 30,
        monastery: parseInt(document.getElementById('monasteryPercent').value) || 20
    };
    // ... configuration des couleurs
}
```

```javascript
// 2. URL (lignes 633-645)
function parseConfigFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return {
        gridSize: parseInt(urlParams.get('size')) || 9,
        tileTypePercents: { /* ... */ },
        tileColorPercents: { /* ... */ }
    };
}

// 3. URL avec sérialisation (lignes 647-665)
function serializeConfigToURL(config) {
    const urlParams = new URLSearchParams();
    urlParams.set('size', config.gridSize);
    // Serialisation des pourcentages de types
    // Serialisation des pourcentages de couleurs
    history.replaceState(null, null, '?' + urlParams.toString());
}
```

### 2.2 Problèmes identifiés

1. **Duplication de logique** : La même sérialisation est réécrite à plusieurs endroits
2. **Pas de validation** : Aucune vérification de cohérence des pourcentages (doivent sommeer à 100)
3. **État source de vérité** : Incertitude sur quelle source est prioritaire

## 3. Gestion des événements

### 3.1 Événements DOM et clavier

Le binding des événements se fait sur 140 lignes (lignes 1718-1856) :

```javascript
// Contrôles de configuration
document.getElementById('gridSize').addEventListener('change', updateConfigAndRerender);
document.getElementById('roadPercent').addEventListener('change', handleTileTypeChange);
// ... 10 autres listeners similaires

// Touche clavier pour la rotation
document.addEventListener('keydown', (event) => {
    if (event.key === 'r' || event.key === 'R') {
        if (selectedTile) {
            selectedTile.rotate();
            renderTilePreview();
        }
    }
});

// Touches numériques pour changement de joueur (lignes 1805-1815)
document.addEventListener('keydown', (event) => {
    if (event.key >= '1' && event.key <= '6') {
        const playerIndex = parseInt(event.key) - 1;
        selectPlayer(playerIndex);
        event.preventDefault();
    }
});
```

### 3.2 Gestion complexe des événements pan/zoom

Le système pan/zoom interfère avec les interactions de placement :

```javascript
// Suppression des clics pendant le pan (ligne 1519)
function enablePanning() {
    let lastMousePos = { x: 0, y: 0 };
    let isPanning = false;
    
    svgElement.addEventListener('mousedown', (e) => {
        isPanning = true;
        panSuppressClick = true; // Variable globale critique
        lastMousePos = { x: e.clientX, y: e.clientY };
    });
    
    svgElement.addEventListener('mouseup', () => {
        isPanning = false;
        setTimeout(() => { panSuppressClick = false; }, 50); // Hack pour l'ordre des événements
    });
}
```

### 3.3 Raccourcis clavier spéciaux

Système de statistiques avancé avec combo de touches (lignes 1537-1592) :

```javascript
let statKeyCombo = [];
document.addEventListener('keydown', (event) => {
    statKeyCombo.push(event.key.toLowerCase());
    statKeyCombo = statKeyCombo.slice(-3); // Garde les 3 dernières touches
    
    if (statKeyCombo.join('') === 'sta') {
        toggleStatsModal();
        statKeyCombo = []; // Reset le combo
    }
});
```

### 3.4 Problèmes identifiés

1. **Multiple listeners sur les mêmes éléments** : Risque de conflits et de comportements imprévisibles
2. **Variable globale panSuppressClick** : Solution fragile pour éviter les conflits
3. **Pas de système centralisé** : Gestion des événements dispersée dans le code
4. **Absence de cleanup** : Aucun listener.removeEventListener() visible

## 4. Interface utilisateur et interactions

### 4.1 Structure HTML (index.html)

L'interface est organisée en zones fonctionnelles :

```html
<!-- Topbar avec contrôles de configuration -->
<div id="topbar">
    <label>Taille grille: <input type="number" id="gridSize" value="9"></label>
    <div class="percent-group">
        <label>Route %: <input type="number" id="roadPercent" value="50"></label>
        <label>Ville %: <input type="number" id="cityPercent" value="30"></label>
        <label>Abbaye %: <input type="number" id="monasteryPercent" value="20"></label>
    </div>
    <!-- ... autres contrôles -->
</div>

<!-- Indicateur de tour et scoreboard -->
<div id="turnIndicator">Tour du Joueur 1</div>
<div id="scoreboard"></div>

<!-- Zone de jeu principale -->
<div id="board-container">
    <svg id="game-svg"></svg>
</div>

<!-- Palette latérale -->
<div id="palette">
    <div id="paletteTitle">Palette de Tuiles</div>
    <div id="paletteContainer"></div>
</div>
```

### 4.2 Système HUD dynamique

Le HUD des joueurs est généré dynamiquement (lignes 94-279) :

```javascript
function ensureHudElements() {
    for (let i = 0; i < 6; i++) {
        const hudElement = document.createElement('div');
        hudElement.className = 'player-hud';
        hudElement.innerHTML = `
            <div class="player-header">
                ${PLAYER_SHAPES[i]} ${PLAYER_NAMES[i]}
            </div>
            <div class="player-stats">
                <div class="stat-item">Routes: <span class="stat-value">0</span></div>
                <div class="stat-item">Villes: <span class="stat-value">0</span></div>
                <div class="stat-item">Abbayes: <span class="stat-value">0</span></div>
                <div class="stat-item">Score: <span class="stat-value">0</span></div>
            </div>
        `;
        scoreboard.appendChild(hudElement);
    }
}
```

### 4.3 Gestion des colons

Système de marqueurs déplaçables avec contraintes (lignes 141-278) :

```javascript
function handleColonMarkerClick(event, playerIndex) {
    const clickedMarker = event.currentTarget;
    const currentPosition = colonPositions[playerIndex];
    
    // Désélection des autres colons
    document.querySelectorAll('.colon-marker').forEach(marker => {
        marker.classList.remove('selected');
    });
    
    // Sélection du colon cliqué
    selectedColonPlayer = playerIndex;
    clickedMarker.classList.add('selected');
    
    // Affichage des cases possibles
    highlightPossibleMoves(currentPosition, playerIndex);
}

function attemptColonMoveTo(targetCoordinate, playerIndex) {
    if (colonMoveRemaining[playerIndex] <= 0) return false;
    
    const distance = axialDistance(colonPositions[playerIndex], targetCoordinate);
    if (distance > 2) return false; // Maximum 2 cases par tour
    
    // Animation et mise à jour
    animateColonMovement(playerIndex, targetCoordinate);
    colonPositions[playerIndex] = targetCoordinate;
    colonMoveRemaining[playerIndex]--;
    
    return true;
}
```

### 4.4 Problèmes d'interface identifiés

1. **Génération DOM en JavaScript** : Aucun template, HTML généré dynamiquement
2. **CSS injections** : Styles JS injectés dans le DOM (lignes 1589-1592)
3. **Pas d'accessibilité** : Aucune prise en charge des lecteurs d'écran ou de la navigation clavier
4. **Responsivité limitée** : Interface optimisée pour desktop uniquement

## 5. Superpositions de logique avec les autres modules

### 5.1 Dépendances cycliques potentielles

Le fichier main.js dépend fortement des autres modules :

```javascript
// Import des modules (concaténés dans app.js)
const core = require('./core.js');
const palette = require('./palette.js');
const render = require('./render.js');

// Usage dispersé des modules
const gridSide = core.generateAxialGrid(config.gridSize);
const tileCombos = palette.assignTileCombos(gridSide, config);
svg.__state.renderInitialGrid(gridSide, tileCombos);
```

### 5.2 Logique dupliquée entre modules

**Exemple dans render.js** : Rendu des overlays de jonctions

```javascript
// render.js (lignes 200-250)
function renderJunctionOverlays(junctions) {
    // Calcul et rendu des cercles de jonction
    junctions.forEach(junction => {
        const overlay = createJunctionCircle(junction.coordinate);
        svgElement.appendChild(overlay);
        
        // Attachement des événements
        overlay.addEventListener('click', (event) => {
            // Logique de gestion des événements...
        });
    });
}

// main.js (lignes 1200-1250) - Logique similaire
function renderCastleOverlays() {
    // Double implémentation du même concept
    // Pas de réutilisation du code de render.js
}
```

### 5.3 svg.__state : objet monolithique

Un objet d'état massif attaché au SVG contient toutes les méthodes :

```javascript
svg.__state = {
    // Données
    gridSide: null,
    tileCombos: [],
    junctions: [],
    placedTiles: [],
    
    // Méthodes de rendu
    renderInitialGrid: function() { /* ... */ },
    renderTilePreview: function() { /* ... */ },
    renderColonMarkers: function() { /* ... */ },
    updateColonMarkersPositions: function() { /* ... */ },
    
    // Méthodes logiques
    computeAndRenderJunctions: function() { /* ... */ },
    attemptTilePlacement: function() { /* ... */ },
    
    // Event handlers
    handleTileClick: function() { /* ... */ },
    handleJunctionClick: function() { /* ... */ }
};
```

### 5.4 Problèmes d'overlap identifiés

1. **Responsabilité floue** : Aucune séparation claire entre rendu et logique
2. **Méthodes dupliquées** : Même fonctionnalité implémentée dans plusieurs modules
3. **Objets globaux** : svg.__state contient à la fois données et méthodes
4. **Couplage fort** : Difficile de modifier un module sans impacter les autres

## 6. Problèmes de gestion d'état global

### 6.1 État non centralisé : 20+ variables globales

```javascript
// Dans main.js - Variables d'état dispersées
let colonPositions = {};           // Position des 6 colons
let colonMoveRemaining = {};       // Mouvements restants par joueur  
let playerScores = [];             // Scores des 6 joueurs
let playerResources = [];          // Ressources par joueur (routes, villes, abbayes)
let placements = [];               // Tuiles placées avec coordonnées
let gridSideColors = {};           // Couleurs de tuiles par coordinate
let turnState = {};                // État actuel du tour
let selectedColonPlayer = null;    // Joueur sélectionné
let panSuppressClick = false;      // État du pan
let autoFillActive = false;        // État auto-remplissage
let selectedTile = null;           // Tuile sélectionnée dans la palette
let currentPlayerIndex = 0;        // Joueur actuel (0-5)
let gridSize = 9;                  // Taille de la grille
let config = {};                   // Configuration actuelle
let statKeyCombo = [];             // Combo de touches pour stats
let statsModalOpen = false;        // État de la modal
let pendingPlacement = null;       // Placement en attente
```

### 6.2 Mutations directes non traçables

Exemple de mutations directes sans système de tracking :

```javascript
//awardPoints() - Ligne 340-380
function awardPoints(playerIndex, points, source) {
    playerScores[playerIndex] += points; // Mutation directe
    
    // Mise à jour du HUD (double appel de render)
    updatePlayerHud(playerIndex);
    renderGameHud(); // Re-rendu complet
    
    // Vérification de fin de jeu dispersée
    if (isGameOver()) {
        endGame();
    }
}

// Multiple appels de renderGameHud() dans le code
function endCurrentTurn() {
    // ... logique de fin de tour
    renderGameHud(); // +1 appel
}

function handleColonMarkerClick() {
    // ... logique de sélection
    renderGameHud(); // +1 appel
}

function attemptTilePlacement() {
    // ... placement de tuile
    renderGameHud(); // +1 appel
}
```

### 6.3 Cascade de rendus non optimisée

Exemple de cascade de rendus problématique (lignes 1200-1300) :

```javascript
function renderJunctionOverlays() {
    // Calcul des jonctions (coûteux)
    const junctions = computeJunctions();
    
    // Rendu des overlays
    junctions.forEach(junction => {
        createJunctionOverlay(junction);
    });
    
    // Appel à renderCastleOverlays() - nouvelle cascade
    renderCastleOverlays();
}

function renderCastleOverlays() {
    // Qui elle-même appelle refreshStatsModal()
    refreshStatsModal();
}

function refreshStatsModal() {
    // Re-calcul complet des statistiques à chaque fois
    const stats = computeGameStatistics();
    updateStatsDisplay(stats);
    
    // Plus de 10 calculs redondants dans cette fonction
}
```

### 6.4 Absence de patterns de gestion d'état

**État actuel** : Variables globales et mutations directes
**Recommandations** : Implémentation d'un store centralisé

```javascript
// Exemple de store conceptuel
class GameStore {
    constructor() {
        this.state = {
            players: Array(6).fill().map(() => ({
                score: 0,
                resources: { road: 0, city: 0, monastery: 0 },
                colonPosition: null,
                movesRemaining: 2
            })),
            game: {
                currentPlayer: 0,
                gridSize: 9,
                placedTiles: [],
                junctions: [],
                turnNumber: 1
            },
            ui: {
                selectedColonPlayer: null,
                selectedTile: null,
                statsModalOpen: false,
                panActive: false
            }
        };
        this.listeners = [];
    }
    
    // Actions au lieu de mutations directes
    awardPoints(playerIndex, points) {
        this.updateState(state => {
            state.players[playerIndex].score += points;
        }, 'AWARD_POINTS');
    }
    
    // Système de subscriptions pour les rendus
    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }
    
    updateState(updater, actionType) {
        const prevState = this.state;
        this.state = updater({ ...this.state });
        this.notifyListeners(prevState, this.state, actionType);
    }
}
```

## Recommandations d'amélioration

### 1. Centralisation de l'état

**Priorité : Haute**

Implémenter un store centralisé (Redux-like ou custom) pour :
- Éliminer les variables globales
- Permettre le time-travel debugging
- Simplifier les tests unitaires
- Optimiser les rendus avec des subscriptions sélectives

### 2. Séparation des responsabilités

**Priorité : Haute**

Réorganiser les modules pour clarifier les responsabilités :
- **`store/`** : Gestion d'état centralisée
- **`actions/`** : Actions utilisateur et logique métier
- **`reducers/`** : Mutations d'état pures
- **`selectors/`** : Dérivations de données (computed)
- **`components/`** : Composants UI réutilisables

### 3. Optimisation des rendus

**Priorité : Moyenne**

Implémenter un système de rendu optimisé :
- Rendus sélectifs basés sur les changements d'état
- Debouncing des événements de souris
- Mise en cache des calculs coûteux (jonctions, statistiques)
- Virtual DOM ou système de diffing pour le SVG

### 4. Architecture événementielle

**Priorité : Moyenne**

Créer un système centralisé de gestion d'événements :
- Event bus pour les communications inter-modules
- Command pattern pour les actions utilisateur
- Middleware pour la logging et debugging
- Cleanup automatique des listeners

### 5. Tests et qualité

**Priorité : Moyenne**

Améliorer la testabilité et la qualité :
- Tests unitaires pour la logique pure
- Tests d'intégration pour les interactions
- Tests end-to-end pour les scénarios de jeu
- Code coverage > 80%

## Conclusion

Le projet Pairleroy présente une architecture fonctionnelle mais suffer de problèmes architecturaux critiques qui impactent la maintenabilité et l'évolutivité. La gestion d'état globale, les superpositions de logique et l'absence de patterns établis créent une dette technique significative.

Les recommandations proposées permettraient de transformer cette base de code en une application moderne, maintenable et extensible, tout en conservant les fonctionnalités existantes.

---

**Date d'audit** : 30 octobre 2025  
**Version analysée** : État actuel du dépôt  
**Prochaines étapes** : Prioriser les refactoring selon l'impact/effort