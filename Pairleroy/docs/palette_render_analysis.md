# Audit des Modules palette.js et render.js
## Projet Pairleroy - Analyse technique approfondie

### Vue d'ensemble

Ce document présente l'audit technique des modules `palette.js` et `render.js` du projet Pairleroy. L'analyse couvre la logique métier, l'architecture, les performances, les interactions entre modules et la qualité du code.

---

## 1. Analyse de palette.js

### 1.1 Responsabilités du module

Le module `palette.js` gère la logique métier des palettes de tuiles :
- **Génération de palettes** : création aléatoire de 4 combos
- **Gestion des rotations** : normalisation et navigation des étapes de rotation
- **Rendu des miniatures** : génération SVG des combos pour la palette
- **Mapping des couleurs** : conversion des index en couleurs utilisables

### 1.2 Fonctions clés

#### Gestion des couleurs
```javascript
colorFromIndex(colorIdx, colors)
```
- ✅ **Robustesse** : Gère les chaînes et nombres, fallbacks multiples
- ✅ **Normalisation** : Conversion en lowercase, trim
- ⚠️ **Dépendance globale** : Utilise `window.__pairleroyActiveColors`

#### Logique de rotation
```javascript
normalizeRotationStep(combo, rawStep)
nextRotationStep(combo, currentStep)
orientedSideColors(combo, step)
```
- ✅ **Bien pensé** : Différenciation type 1 (mono) vs types 2-3
- ✅ **Normalisation intelligente** : Gestion des étapes paires/impaires
- ✅ **Encapsulation** : Logique de rotation centralisée

#### Génération de combos
```javascript
sampleCombo(localTypesPct, localColorPct, random)
```
- ✅ **Algorithme robuste** : Gestion des exclusions de couleurs
- ✅ **Fallback intelligent** : Mécanisme de secours si pas assez de couleurs
- ⚠️ **Complexité** : Algorithme complexe avec plusieurs branches

### 1.3 Rendu des miniatures

```javascript
renderComboSVG(combo, size, colors)
renderPalette(combos, colors, setSelectedPalette)
```

**Points positifs :**
- Génération SVG propre
- Paramétrable (size)
- Gestion correcte des events listeners
- Nettoyage DOM (`innerHTML = ''`)

**Points d'amélioration :**
- Pas de réutilisation des éléments SVG
- Pas de virtualisation pour grandes listes
- Event listeners recréés à chaque render

---

## 2. Analyse de render.js

### 2.1 Responsabilités du module

Le module `render.js` gère l'affichage DOM/SVG :
- **Construction SVG principale** : Grille hexagonale avec tous les layers
- **Rendu des overlays** : Formes des joueurs sur les tuiles
- **Mise à jour sélective** : `renderTileFill` pour updates ciblées
- **Shapes prédéfinies** : 6 formes de joueurs (rond, croix, triangle, etc.)

### 2.2 Architecture SVG

```javascript
buildSVG({ width, height, size, tiles, combos, colors })
```

**Structure en couches :**
```
viewport
├── grid (tuiles de base)
├── square-grid (grille 4x4)
├── square-indicator (sélection)
├── overlays (joueurs)
├── preview (prévisualisation)
├── colons (colons)
├── junctions (jonctions)
├── junction-overlays (overlays jonctions)
└── castle-layer (châteaux)
```

**Points forts :**
- Architecture en couches claire
- Séparation des responsabilités
- Stockage d'état dans `svg.__*`
- Accessibilité (`aria-label`)

**Points faibles :**
- ⚠️ **Performance** : Recréation complète du SVG à chaque appel
- ⚠️ **Memory leaks** : Pas de nettoyage des event listeners
- ⚠️ **Id ditingkatkan** : Création dynamique des clipPaths

### 2.3 Shapes des joueurs

```javascript
PLAYER_SHAPES[1-6] = {
  name: string,
  draw: (g, cx, cy, r) => void
}
```

**Excellente architecture :**
- ✅ Pattern Strategy/Factory
- ✅ Extensible facilement
- ✅ Code réutilisable
- ⚠️ Hardcodé (6 shapes seulement)

### 2.4 Mise à jour sélective

```javascript
renderTileFill(tileIdx, sideColors, svg, tiles, size, colors)
```

**Fonction critique :**
- ✅ **Ciblage précis** : Mise à jour d'une tuile spécifique
- ✅ **Efficace** : Suppression/création ciblée
- ⚠️ **Couplage fort** : Dépend du DOM querySelector
- ⚠️ **Pas de debouncing** : Peut être appelée fréquemment

---

## 3. Interactions entre les modules

### 3.1 Dépendances

**palette.js → core.js :**
- `comboToSideColors()` 
- `rotateSideColors()`
- `hexVerticesAt()`
- `roundedHexPathAt()`
- `axialToPixel()`
- `ORIENTED_INDEX_FOR_TRIANGLE`

**render.js → core.js :**
- Mêmes fonctions + `NEIGHBOR_DIRS`
- Constantes partagées

### 3.2 Flux de données

```
core.js (logique pure)
    ↓
palette.js (combos + miniatures)
    ↓
render.js (affichage)
```

### 3.3 Points de couplage

**ORIENTED_INDEX_FOR_TRIANGLE** : Constante magique utilisée dans les deux modules
- Duplication de dépendance
- Risque d'incohérence

---

## 4. Duplications détectées

### 4.1 Création d'éléments SVG

**palette.js ligne 144 :**
```javascript
const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
p.setAttribute('d', `M ${center.x} ${center.y} L ${a.x} ${a.y} L ${b.x} ${b.y} Z`);
```

**render.js lignes 155-157 :**
```javascript
const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
p.setAttribute('d', `M ${center.x} ${center.y} L ${a.x} ${a.y} L ${b.x} ${b.y} Z`);
```

**Identique à 100% !** → Extractor en factory

### 4.2 Calcul des couleurs orientées

**palette.js lignes 49-56 :**
```javascript
const oriented = orientedSideColors(combo, rotation);
const fillColors = mapSideColorIndices(oriented, colors);
```

**render.js lignes 291-299 :**
```javascript
const fillColors = mapSideColorIndices(sideColors, colors);
```

**Logique similaire mais pas dupliquée** → OK

### 4.3 Query du DOM

Plusieurs `querySelector` spars dans le code → candidates pour un cache DOM

---

## 5. Optimisations possibles

### 5.1 Performance

#### Rendu initial
```javascript
// Problème : rebuild complet
svg.setAttribute('viewBox', `${-width / 2} ${-height / 2} ${width} ${height}`);

// Solution : build sélectif
function updateSVGDimensions(svg, width, height) {
  // ...
}
```

#### Event delegation
```javascript
// Problème : 4 listeners pour 4 items
combos.forEach((combo, idx) => {
  div.addEventListener('click', () => setSelectedPalette(idx));
});

// Solution : event delegation
paletteEl.addEventListener('click', (e) => {
  const idx = e.target.closest('[data-idx]')?.dataset.idx;
  if (idx) setSelectedPalette(idx);
});
```

#### Virtualisation palette
```javascript
// Pour grandes listes (>100 items)
const renderPaletteVirtual = (combos, colors, setSelectedPalette) => {
  const viewportHeight = paletteEl.clientHeight;
  const itemHeight = 100;
  const visibleCount = Math.ceil(viewportHeight / itemHeight) + 2;
  // Rendu scrollé...
};
```

### 5.2 Mémoire

#### Cache DOM
```javascript
const DOMCache = {
  paletteEl: null,
  svg: null,
  getPaletteEl() {
    if (!this.paletteEl) this.paletteEl = document.getElementById('palette-items');
    return this.paletteEl;
  }
};
```

#### Object pooling SVG
```javascript
class SVGPathPool {
  constructor() { this.pool = []; }
  acquire() { return this.pool.pop() || document.createElementNS('...', 'path'); }
  release(path) { this.pool.push(path); }
}
```

### 5.3 Algorithmes

#### Debouncing renderTileFill
```javascript
const updateQueue = new Map();
let pending = false;

function queueTileUpdate(tileIdx, sideColors) {
  updateQueue.set(tileIdx, sideColors);
  if (!pending) {
    pending = true;
    requestAnimationFrame(() => {
      flushUpdates();
      pending = false;
    });
  }
}
```

---

## 6. Gestion des événements

### 6.1 Palette click handlers

**Implementation actuelle :**
```javascript
div.addEventListener('click', () => setSelectedPalette(idx));
```

**Problèmes :**
- Recréé à chaque render
- Pas de cleanup
- Pas de debouncing
- Pas de preventionDefault

**Recommandations :**
```javascript
function attachPaletteHandlers(paletteEl, setSelectedPalette) {
  // Event delegation
  paletteEl.addEventListener('click', handlePaletteClick);
  // Accessible
  paletteEl.setAttribute('role', 'listbox');
}

function handlePaletteClick(e) {
  const item = e.target.closest('.palette-item');
  if (!item) return;
  e.preventDefault();
  const idx = parseInt(item.dataset.idx, 10);
  setSelectedPalette(idx);
}
```

### 6.2 Mise à jour du DOM

**Stratégie actuelle :**
- `innerHTML = ''` → Force reflow complet
- `remove()` sur éléments individuels
- `appendChild()` en boucle

**Amélioration :**
```javascript
// Fragment pour batch inserts
const frag = document.createDocumentFragment();
combos.forEach((combo, idx) => {
  const div = createPaletteItem(combo, idx);
  frag.appendChild(div);
});
paletteEl.appendChild(frag);
// Un seul reflow !
```

---

## 7. Qualité du code

### 7.1 Commentaires

**palette.js :**
- ✅ Entête de fichier descriptif
- ✅ Commentaires sur fonctions principales
- ⚠️ Manque JSDoc sur fonctions utilitaires
- ⚠️ Magic numbers non commentés (ORIENTED_INDEX_FOR_TRIANGLE)

**render.js :**
- ✅ Entête de fichier
- ⚠️ Peu de commentaires internes
- ⚠️ Structure de données complexe sans doc

**Score : 7/10**

### 7.2 Nommage

**Points forts :**
- Noms descriptifs (`renderComboSVG`, `buildSVG`)
- Verbes d'action (`create`, `render`, `build`)
- Conventions cohérentes (camelCase, majuscules const)

**Points faibles :**
- `svg.__squareGrid` (dunderscore poco pythonesque)
- `localTypesPct` vs `typesPct` (inconsistance)

**Score : 8/10**

### 7.3 Structure

**Organisation :**
- Fonctions pures regroupées
- Exports implicites (JS module pattern)
- Pas de classes (commentable)

**Refactoring sugerido :**
```javascript
// Namespace pattern
const PaletteModule = {
  colorFromIndex,
  mapSideColorIndices,
  // ...
};

const RenderModule = {
  buildSVG,
  renderTileFill,
  // ...
};
```

**Score : 7/10**

### 7.4 Robustesse

**Erreurs gérées :**
- Type checking basique
- Fallbacks couleurs
- Validations paramètres

**Manquements :**
- Pas de try/catch sur DOM queries
- Pas de validation types (JSDoc/TS)
- Accès global non sécurisé (`window.__pairleroyActiveColors`)

**Score : 6/10**

---

## 8. Recommandations prioritaires

### 8.1 Critique (à faire maintenant)

1. **Extractor fonction de création de paths SVG**
   - Élimine duplication palette.js/render.js
   - Facilite les tests

2. **Event delegation pour la palette**
   - Évite memory leaks
   - Améliore performance

3. **Constante centralisée ORIENTED_INDEX_FOR_TRIANGLE**
   - Évite incohérences futures
   - Clarifie l'intention

### 8.2 Important (à planifier)

4. **Debouncing sur renderTileFill**
   - Critique si updates fréquentes
   - Simple à implémenter

5. **Document JSDoc complet**
   - Améliore maintenabilité
   - Facilite onboarding

6. **Cache DOM intelligent**
   - Performance significative
   - Réduit queries répétitives

### 8.3 Souhaitable (roadmap)

7. **TypeScript migration**
   - Détection erreurs compile-time
   - Auto-complétion IDE

8. **Virtualisation palette**
   - Scalabilité grandes listes
   - Complexité moyenne

9. **Tests unitaires**
   - Logique rotation
   - Génération combos

---

## 9. Métriques

| Aspect | Note | Commentaire |
|--------|------|-------------|
| Architecture | 8/10 | Bonne séparation des responsabilités |
| Performance | 6/10 | Quelques rebuilds complets |
| Maintenabilité | 7/10 | Code lisible, quelques optimisations |
| Robustesse | 6/10 | Gère les cas de base, manque de safety |
| Documentation | 7/10 | Correct mais perfectible |
| **Score global** | **7/10** | **Bon code avec points d'amélioration clairs** |

---

## 10. Conclusion

Les modules `palette.js` et `render.js` forment une base solide pour le projet Pairleroy. L'architecture est bien pensée avec une séparation claire des responsabilités. 

**Points forts majeurs :**
- Logique métier bien encapsulée dans `palette.js`
- Architecture SVG modulaire dans `render.js`
- Code généralement lisible et cohérent

**Axes d'amélioration prioritaires :**
- Élimination des duplications (paths SVG)
- Optimisations de performance (event delegation, debouncing)
- Renforcement de la robustesse (validation, error handling)

L'implémentation des recommandations critiques et importantes permettrait d'élever significativement la qualité du code et l'expérience utilisateur.

---

*Audit réalisé le 30 octobre 2025*
*Analyse basée sur les versions actuelles de palette.js et render.js*
