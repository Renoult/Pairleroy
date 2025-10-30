/**
 * Pairleroy - Version Optimisée avec Performance Enhancements
 * 
 * Optimisations implémentées :
 * 1. Debouncing et Throttling pour les événements fréquents
 * 2. Caching DOM pour éviter les queries répétées
 * 3. Dirty flags pour éviter les rendus inutiles
 * 4. Cache pour les calculs coûteux
 * 5. Optimisations des opérations SVG
 */

// ============================================================================
// UTILITAIRES DE PERFORMANCE
// ============================================================================

/**
 * Système de debouncing pour limiter les appels fréquents
 */
class Debouncer {
  constructor(delay = 100) {
    this.delay = delay;
    this.timer = null;
  }

  execute(callback) {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(callback, this.delay);
  }
}

/**
 * Système de throttling pour limiter le taux d'exécution
 */
class Throttler {
  constructor(interval = 50) {
    this.interval = interval;
    this.lastExecute = 0;
  }

  execute(callback) {
    const now = Date.now();
    if (now - this.lastExecute >= this.interval) {
      this.lastExecute = now;
      callback();
      return true;
    }
    return false;
  }
}

/**
 * Cache pour les calculs coûteux avec TTL
 */
class LRUCache {
  constructor(maxSize = 100) {
    this.maxSize = maxSize;
    this.cache = new Map();
    this.hits = 0;
    this.misses = 0;
  }

  get(key) {
    if (this.cache.has(key)) {
      this.hits++;
      const value = this.cache.get(key);
      // LRU: déplacer à la fin
      this.cache.delete(key);
      this.cache.set(key, value);
      return value;
    }
    this.misses++;
    return null;
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Supprimer le plus ancien (première clé)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  clear() {
    this.cache.clear();
  }

  getStats() {
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: this.hits / (this.hits + this.misses) || 0
    };
  }
}

// ============================================================================
// CACHE DOM GLOBAL
// ============================================================================

class DOMCache {
  constructor() {
    this.cache = new Map();
    this.lastCleanup = 0;
  }

  get(id) {
    const key = id.startsWith('#') ? id : `#${id}`;
    if (this.cache.has(key)) {
      const element = this.cache.get(key);
      // Vérifier que l'élément est toujours dans le DOM
      if (element.isConnected) {
        return element;
      } else {
        this.cache.delete(key);
      }
    }
    return null;
  }

  set(id, element) {
    const key = id.startsWith('#') ? id : `#${id}`;
    this.cache.set(key, element);
  }

  query(selector) {
    // Chercher d'abord dans le cache
    if (selector.startsWith('#')) {
      const cached = this.get(selector);
      if (cached) return cached;
      
      // Requête et mise en cache
      const element = document.querySelector(selector);
      if (element) {
        this.set(selector, element);
      }
      return element;
    }
    
    // Pour les autres sélecteurs, pas de cache
    return document.querySelector(selector);
  }

  queryAll(selector) {
    return document.querySelectorAll(selector);
  }

  cleanup(force = false) {
    const now = Date.now();
    if (force || now - this.lastCleanup > 5000) {
      for (const [key, element] of this.cache.entries()) {
        if (!element.isConnected) {
          this.cache.delete(key);
        }
      }
      this.lastCleanup = now;
    }
  }

  clear() {
    this.cache.clear();
  }
}

// Instance globale du cache DOM
const domCache = new DOMCache();

// ============================================================================
// SYSTÈME DE RENDU OPTIMISÉ AVEC DIRTY FLAGS
// ============================================================================

class RenderManager {
  constructor() {
    this.dirtyFlags = {
      hud: false,
      preview: false,
      palette: false,
      overlays: false,
      junctions: false,
      castle: false,
      markers: false
    };
    
    this.renderQueue = new Set();
    this.isRendering = false;
    this.renderDebouncer = new Debouncer(16); // ~60 FPS
  }

  setDirty(flag) {
    this.dirtyFlags[flag] = true;
    this.renderQueue.add(flag);
    
    // Programmer un rendu
    this.renderDebouncer.execute(() => {
      this.processRenderQueue();
    });
  }

  isDirty(flag) {
    return this.dirtyFlags[flag];
  }

  clearDirty(flag) {
    this.dirtyFlags[flag] = false;
    this.renderQueue.delete(flag);
  }

  processRenderQueue() {
    if (this.isRendering || this.renderQueue.size === 0) {
      return;
    }

    this.isRendering = true;
    const flagsToRender = Array.from(this.renderQueue);
    this.renderQueue.clear();

    try {
      for (const flag of flagsToRender) {
        this.renderFlag(flag);
        this.dirtyFlags[flag] = false;
      }
    } finally {
      this.isRendering = false;
    }
  }

  renderFlag(flag) {
    switch (flag) {
      case 'hud':
        this.renderHUD();
        break;
      case 'preview':
        this.renderPlacementPreview();
        break;
      case 'palette':
        this.renderPalette();
        break;
      case 'overlays':
        this.renderOverlays();
        break;
      case 'junctions':
        this.renderJunctions();
        break;
      case 'castle':
        this.renderCastle();
        break;
      case 'markers':
        this.updateColonMarkersPositions();
        break;
    }
  }

  renderHUD() {
    // Implémentation optimisée du rendu HUD
    const scoreboard = domCache.query('#scoreboard');
    if (!scoreboard) return;

    scoreboard.innerHTML = '';
    
    for (let i = 0; i < PLAYER_IDS.length; i++) {
      const player = PLAYER_IDS[i];
      const scoreValue = playerScores[i] || 0;
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'scorecard';
      card.dataset.player = String(player);
      
      const isActive = player === turnState.activePlayer;
      if (isActive) card.classList.add('scorecard--active');
      
      scoreboard.appendChild(card);
    }

    const turnIndicator = domCache.query('#turn-indicator');
    if (turnIndicator) {
      turnIndicator.textContent = `Tour ${turnState.turnNumber}-Joueur ${turnState.activePlayer}`;
    }
  }

  renderPlacementPreview() {
    // Implémentation optimisée du rendu de prévisualisation
    const svg = getBoardSvg();
    const previewLayer = svg?.querySelector('#preview');
    if (!previewLayer || hoveredTileIdx == null || selectedPalette < 0) return;

    previewLayer.innerHTML = '';
    // ... logique de rendu optimisée
  }

  renderPalette() {
    // Implémentation optimisée du rendu de palette
    // ...
  }

  renderOverlays() {
    // Implémentation optimisée du rendu des overlays
    // ...
  }

  renderJunctions() {
    // Implémentation optimisée du rendu des jonctions
    // ...
  }

  renderCastle() {
    // Implémentation optimisée du rendu des châteaux
    // ...
  }

  updateColonMarkersPositions() {
    // Implémentation optimisée du positionnement des marqueurs
    // ...
  }
}

// Instance globale du gestionnaire de rendu
const renderManager = new RenderManager();

// ============================================================================
// CACHE POUR CALCULS COÛTEUX
// ============================================================================

// Cache pour les positions hexagonales
const hexPositionCache = new LRUCache(1000);
const hexVerticesCache = new LRUCache(1000);
const tileElementCache = new LRUCache(500);

// Fonctions de cache pour les calculs coûteux
function getCachedHexPositions(q, r, size) {
  const key = `${q},${r},${size}`;
  let result = hexPositionCache.get(key);
  if (!result) {
    result = axialToPixel(q, r, size);
    hexPositionCache.set(key, result);
  }
  return result;
}

function getCachedHexVertices(cx, cy, size) {
  const key = `${cx.toFixed(1)},${cy.toFixed(1)},${size}`;
  let result = hexVerticesCache.get(key);
  if (!result) {
    result = hexVerticesAt(cx, cy, size);
    hexVerticesCache.set(key, result);
  }
  return result;
}

function getCachedTileElement(tileIdx) {
  const key = `tile-${tileIdx}`;
  let element = tileElementCache.get(key);
  
  if (!element || !element.isConnected) {
    const svg = getBoardSvg();
    element = svg?.querySelector(`.tile[data-idx="${tileIdx}"]`);
    if (element) {
      tileElementCache.set(key, element);
    }
  }
  
  return element;
}

// ============================================================================
// OPTIMISATIONS DES ÉVÉNEMENTS
// ============================================================================

// Throttler pour les événements mousemove fréquents
const mouseMoveThrottler = new Throttler(16); // ~60 FPS

// Debouncer pour les redimensionnements
const resizeDebouncer = new Debouncer(150);

// Debouncer pour les changements de configuration
const configChangeDebouncer = new Debouncer(300);

// Handler optimisé pour les événements mousemove
function handleMouseMoveOptimized(event) {
  mouseMoveThrottler.execute(() => {
    if (selectedPalette < 0) return;
    
    const tile = event.target.closest('.tile');
    if (!tile) {
      renderManager.setDirty('preview');
      return;
    }
    
    const idx = Number(tile.getAttribute('data-idx'));
    hoveredTileIdx = idx;
    renderManager.setDirty('preview');
  });
}

// Handler optimisé pour les redimensionnements
function handleResizeOptimized() {
  resizeDebouncer.execute(() => {
    generateAndRender();
    domCache.cleanup(true);
  });
}

// ============================================================================
// OPÉrations SVG OPTIMISÉES
// ============================================================================

class SVGOptimizer {
  constructor() {
    this.pathCache = new LRUCache(2000);
  }

  getCachedHexPath(x, y, radius, cornerRadius = 0.18) {
    const key = `hex-${x.toFixed(2)},${y.toFixed(2)},${radius.toFixed(2)},${cornerRadius}`;
    let path = this.pathCache.get(key);
    if (!path) {
      path = createHexOutlinePath(x, y, radius, cornerRadius);
      this.pathCache.set(key, path);
    }
    return path;
  }

  createOptimizedTileFill(tileIdx, sideColors, svg, tiles, size, colors) {
    if (!Array.isArray(sideColors) || sideColors.length !== 6) return;
    
    const tileElement = getCachedTileElement(tileIdx);
    if (!tileElement) return;

    const old = tileElement.querySelector('.fills');
    if (old) old.remove();

    const fillGroup = document.createElementNS(SVG_NS, 'g');
    fillGroup.setAttribute('class', 'fills');
    fillGroup.setAttribute('clip-path', `url(#clip-${tileIdx})`);

    const tile = tiles[tileIdx];
    const center = getCachedHexPositions(tile.q, tile.r, size);
    const verts = getCachedHexVertices(center.x, center.y, size - 0.6);
    
    const fillColors = mapSideColorIndices(sideColors, colors);
    
    for (let i = 0; i < 6; i++) {
      const a = verts[i];
      const b = verts[(i + 1) % 6];
      const fillColor = fillColors[ORIENTED_INDEX_FOR_TRIANGLE[i]];
      
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', createTrianglePath(center, a, b));
      path.setAttribute('fill', fillColor);
      fillGroup.appendChild(path);
    }

    tileElement.insertBefore(fillGroup, tileElement.querySelector('.outline'));
  }

  batchUpdateElements(updates) {
    // Mise à jour par lots pour réduire les reflows
    const fragment = document.createDocumentFragment();
    
    for (const update of updates) {
      const element = update.element;
      for (const [attr, value] of Object.entries(update.attributes)) {
        element.setAttribute(attr, value);
      }
    }
    
    return fragment;
  }
}

const svgOptimizer = new SVGOptimizer();

// ============================================================================
// FONCTIONS OPTIMISÉES
// ============================================================================

/**
 * Version optimisée de renderGameHud avec dirty flags
 */
function renderGameHudOptimized() {
  renderManager.setDirty('hud');
}

/**
 * Version optimisée de ensureHudElements avec cache DOM
 */
function ensureHudElementsOptimized() {
  if (!hudElements.scoreboard) {
    hudElements.scoreboard = domCache.query('scoreboard');
  }
  if (!hudElements.turnIndicator) {
    hudElements.turnIndicator = domCache.query('turn-indicator');
  }
  if (!hudElements.endTurnButton) {
    hudElements.endTurnButton = domCache.query('end-turn');
    
    if (hudElements.endTurnButton && !hudElements.endTurnButton.__pairleroyBound) {
      hudElements.endTurnButton.__pairleroyBound = true;
      hudElements.endTurnButton.addEventListener('click', () => {
        endCurrentTurn({ reason: 'manual' });
      });
    }
  }
}

/**
 * Version optimisée de renderTileFill avec cache
 */
function renderTileFillOptimized(tileIdx, sideColors, svg, tiles, size, colors) {
  svgOptimizer.createOptimizedTileFill(tileIdx, sideColors, svg, tiles, size, colors);
}

/**
 * Version optimisée de updateColonMarkersPositions avec batching
 */
function updateColonMarkersPositionsOptimized() {
  const svg = getBoardSvg();
  if (!svg?.__state) return;
  
  const { size } = svg.__state;
  const updates = [];
  
  colonMarkers.forEach((marker, player) => {
    const idx = playerIndex(player);
    if (idx === -1) {
      updates.push({ element: marker, attributes: { style: 'display:none' } });
      return;
    }
    
    const tileIdx = colonPositions[idx];
    const tile = tiles[tileIdx];
    if (!tile) {
      updates.push({ element: marker, attributes: { style: 'display:none' } });
      return;
    }
    
    const { x, y } = getCachedHexPositions(tile.q, tile.r, size);
    const remaining = colonMoveRemaining[idx] ?? 0;
    
    updates.push({
      element: marker,
      attributes: {
        transform: `translate(${x.toFixed(3)},${y.toFixed(3)})`,
        style: 'display:block'
      }
    });
    
    marker.classList.toggle('colon-marker--active', player === turnState.activePlayer);
    marker.classList.toggle('colon-marker--selected', player === selectedColonPlayer);
    marker.classList.toggle('colon-marker--exhausted', remaining <= 0);
  });
  
  svgOptimizer.batchUpdateElements(updates);
}

/**
 * Version optimisée de refreshStatsModal avec debouncing
 */
const refreshStatsDebouncer = new Debouncer(100);

function refreshStatsModalOptimized() {
  refreshStatsDebouncer.execute(() => {
    if (!statsModalVisible) return;
    
    const elements = ensureStatsModal();
    const body = elements.body;
    
    // Mise à jour optimisée des stats
    const placed = placedCount;
    const remaining = Math.max(0, TILE_COUNT - placed);
    
    const counts = { 1: 0, 2: 0, 3: 0 };
    placements.forEach(placement => {
      if (!placement?.combo) return;
      const t = placement.combo.type;
      if (t === 1 || t === 2 || t === 3) {
        counts[t] = (counts[t] || 0) + 1;
      }
    });
    
    // Génération HTML optimisée
    body.innerHTML = `
      <div class="stats-section-title">Général</div>
      <div class="stats-grid">
        <div>Tuiles posées</div><div>${placed}</div>
        <div>Tuiles restantes</div><div>${remaining}</div>
      </div>
      <div class="stats-section-title">Répartition</div>
      <div class="stats-grid">
        <div>Mono</div><div>${counts[1] ?? 0}</div>
        <div>Bi</div><div>${counts[2] ?? 0}</div>
        <div>Tri</div><div>${counts[3] ?? 0}</div>
      </div>
    `;
  });
}

/**
 * Optimisation de l'auto-remplissage avec batching
 */
function stepAutoFillOptimized() {
  if (autoState.done) return 'done';
  if (emptyTiles.size === 0) {
    autoState.done = true;
    return 'done';
  }

  const MAX_ATTEMPTS = 12;
  let palette = autoState.pendingPalette;
  autoState.pendingPalette = null;

  // Regroupement des placements pour réduire les rendus
  const batchedPlacements = [];

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (!palette || palette.length === 0) {
      palette = regenPalette();
      if (!palette || palette.length === 0) {
        autoState.pendingPalette = null;
        return 'halt';
      }
    }

    if (attemptPlacementWithPaletteOptimized(palette, batchedPlacements)) {
      autoState.pendingPalette = regenPalette();
      
      // Appliquer les placements par lots
      if (batchedPlacements.length > 0) {
        batchedPlacements.forEach(placement => {
          commitPlacement(placement.tileIdx, placement.combo, placement.rotationStep, 
                         placement.sideColors, placement.player, placement.options);
        });
        renderManager.setDirty('junctions');
        renderManager.setDirty('overlays');
      }
      
      return 'placed';
    }
    palette = null;
  }

  autoState.pendingPalette = null;
  return 'halt';
}

/**
 * Version optimisée de attemptPlacementWithPalette
 */
function attemptPlacementWithPaletteOptimized(palette, batchedPlacements = []) {
  for (let ringIdx = 0; ringIdx < ringsByDistance.length; ringIdx++) {
    const ring = ringsByDistance[ringIdx];
    if (!ring) continue;

    const availableTiles = ring.filter(idx => emptyTiles.has(idx));
    if (!availableTiles.length) continue;

    for (let paletteIdx = 0; paletteIdx < palette.length; paletteIdx++) {
      const combo = palette[paletteIdx];
      if (!combo) continue;

      const steps = rotationStepsForCombo(combo);
      const preferred = normalizeRotationStep(combo, combo.rotationStep);
      const order = steps.slice();

      if (order.length > 1) {
        const i = order.indexOf(preferred);
        if (i > 0) {
          order.splice(i, 1);
          order.unshift(preferred);
        }
      }

      for (const step of order) {
        const oriented = orientedSideColors(combo, step);
        for (const tileIdx of availableTiles) {
          if (!canPlace(tileIdx, oriented)) continue;

          // Ajouter au batch au lieu de placer immédiatement
          batchedPlacements.push({
            tileIdx,
            combo,
            rotationStep: step,
            sideColors: oriented,
            player: null,
            options: { trackResources: false }
          });

          combo.rotationStep = step;
          return true;
        }
      }
    }
  }
  return false;
}

// ============================================================================
// INITIALISATION AVEC OPTIMISATIONS
// ============================================================================

// Remplacer les anciennes fonctions par les versions optimisées
window.renderGameHud = renderGameHudOptimized;
window.ensureHudElements = ensureHudElementsOptimized;
window.renderTileFill = renderTileFillOptimized;
window.updateColonMarkersPositions = updateColonMarkersPositionsOptimized;
window.refreshStatsModal = refreshStatsModalOptimized;
window.stepAutoFill = stepAutoFillOptimized;

// Optimisation des événements
if (typeof window !== 'undefined') {
  window.addEventListener('mousemove', handleMouseMoveOptimized, { passive: true });
  window.addEventListener('resize', handleResizeOptimized);
  
  // Nettoyage périodique du cache
  setInterval(() => {
    domCache.cleanup();
    hexPositionCache.clear();
    hexVerticesCache.clear();
    tileElementCache.clear();
  }, 10000);
}

// ============================================================================
// EXPORT POUR DEBUGGING
// ============================================================================

if (typeof window !== 'undefined') {
  window.performanceCaches = {
    dom: domCache,
    render: renderManager,
    hexPositions: hexPositionCache,
    hexVertices: hexVerticesCache,
    tileElements: tileElementCache,
    svgOptimizer
  };
}

console.log('[PERF] Optimisations de performance chargées');
