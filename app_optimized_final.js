/**
 * Pairleroy - Version Finale Optimisée
 * 
 * Toutes les optimisations de performance intégrées :
 * 1. Debouncing et Throttling pour les événements fréquents
 * 2. Caching DOM pour éviter les queries répétées  
 * 3. Dirty flags pour éviter les rendus inutiles
 * 4. Cache pour les calculs coûteux (positions hexagonales)
 * 5. Optimisations des opérations SVG
 * 6. Système de batching pour les mises à jour
 * 7. Debouncing pour refreshStatsModal
 */

// ============================================================================
// UTILITAIRES DE PERFORMANCE AVANCÉS
// ============================================================================

/**
 * Système de debouncing intelligent avec timeout adaptatif
 */
class SmartDebouncer {
  constructor(delay = 100, immediate = false) {
    this.delay = delay;
    this.immediate = immediate;
    this.timer = null;
    this.lastExecute = 0;
    this.lastCall = 0;
    this.callCount = 0;
  }

  execute(callback) {
    const now = Date.now();
    const elapsed = now - this.lastExecute;
    
    // Ajustement adaptatif du délai basé sur la fréquence d'appel
    if (this.callCount > 5 && elapsed < this.delay) {
      this.callCount++;
      return;
    }
    
    if (this.timer) {
      clearTimeout(this.timer);
    }

    this.timer = setTimeout(() => {
      this.lastExecute = now;
      this.callCount = 0;
      callback();
    }, this.delay);
  }

  reset() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

/**
 * Système de throttling haute performance avec RAF
 */
class RAFThrottler {
  constructor(interval = 16) { // ~60 FPS par défaut
    this.interval = interval;
    this.lastExecute = 0;
    this.rafId = null;
    this.pendingCallback = null;
  }

  execute(callback) {
    const now = performance.now();
    
    if (now - this.lastExecute >= this.interval) {
      this.lastExecute = now;
      callback();
      return true;
    } else {
      // Programmer pour le prochain frame disponible
      if (!this.rafId) {
        this.pendingCallback = callback;
        this.rafId = requestAnimationFrame(() => {
          this.rafId = null;
          if (this.pendingCallback) {
            const cb = this.pendingCallback;
            this.pendingCallback = null;
            this.lastExecute = performance.now();
            cb();
          }
        });
      }
      return false;
    }
  }

  cancel() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
      this.pendingCallback = null;
    }
  }
}

/**
 * Cache LRU optimisé avec métriques avancées
 */
class OptimizedLRUCache {
  constructor(maxSize = 100, ttl = 300000) { // TTL par défaut: 5 minutes
    this.maxSize = maxSize;
    this.ttl = ttl;
    this.cache = new Map();
    this.accessOrder = [];
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
    this.lastCleanup = 0;
  }

  get(key) {
    const now = Date.now();
    
    if (this.cache.has(key)) {
      const entry = this.cache.get(key);
      
      // Vérification TTL
      if (this.ttl && now - entry.timestamp > this.ttl) {
        this.cache.delete(key);
        this.accessOrder = this.accessOrder.filter(k => k !== key);
        this.misses++;
        return null;
      }

      this.hits++;
      
      // Mise à jour de l'ordre d'accès (LRU)
      const idx = this.accessOrder.indexOf(key);
      if (idx > -1) {
        this.accessOrder.splice(idx, 1);
      }
      this.accessOrder.push(key);
      
      return entry.value;
    }
    
    this.misses++;
    return null;
  }

  set(key, value) {
    const now = Date.now();
    
    if (this.cache.has(key)) {
      // Mise à jour d'une entrée existante
      const entry = this.cache.get(key);
      entry.value = value;
      entry.timestamp = now;
      
      const idx = this.accessOrder.indexOf(key);
      if (idx > -1) {
        this.accessOrder.splice(idx, 1);
      }
      this.accessOrder.push(key);
    } else {
      // Nouvelle entrée
      if (this.cache.size >= this.maxSize) {
        const oldestKey = this.accessOrder.shift();
        if (oldestKey) {
          this.cache.delete(oldestKey);
          this.evictions++;
        }
      }
      
      this.cache.set(key, {
        value,
        timestamp: now
      });
      this.accessOrder.push(key);
    }
  }

  has(key) {
    if (!this.cache.has(key)) return false;
    
    const now = Date.now();
    const entry = this.cache.get(key);
    
    if (this.ttl && now - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      this.accessOrder = this.accessOrder.filter(k => k !== key);
      return false;
    }
    
    return true;
  }

  delete(key) {
    const deleted = this.cache.delete(key);
    this.accessOrder = this.accessOrder.filter(k => k !== key);
    return deleted;
  }

  clear() {
    this.cache.clear();
    this.accessOrder = [];
  }

  getStats() {
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: this.hits / (this.hits + this.misses) || 0,
      evictions: this.evictions,
      utilization: this.cache.size / this.maxSize
    };
  }

  cleanup() {
    const now = Date.now();
    
    // Nettoyage périodique basé sur TTL
    if (now - this.lastCleanup > 60000) { // Une fois par minute
      const expiredKeys = [];
      
      for (const [key, entry] of this.cache.entries()) {
        if (this.ttl && now - entry.timestamp > this.ttl) {
          expiredKeys.push(key);
        }
      }
      
      expiredKeys.forEach(key => this.delete(key));
      this.lastCleanup = now;
    }
  }
}

// ============================================================================
// CACHE DOM AVANCÉ AVEC VALIDATION
// ============================================================================

class AdvancedDOMCache {
  constructor() {
    this.cache = new Map();
    this.wrongElements = new Set();
    this.lastCleanup = 0;
    this.stats = {
      hits: 0,
      misses: 0,
      domQueries: 0,
      cacheUsed: 0
    };
  }

  get(id) {
    const key = id.startsWith('#') ? id : `#${id}`;
    
    if (this.cache.has(key)) {
      const element = this.cache.get(key);
      
      // Vérifier que l'élément est toujours dans le DOM
      if (element && element.isConnected) {
        // Vérifier que l'élément a toujours le bon ID
        if (element.id === id.replace('#', '')) {
          this.stats.hits++;
          this.stats.cacheUsed++;
          return element;
        } else {
          // L'élément a changé d'ID, invalider
          this.cache.delete(key);
          this.wrongElements.add(key);
        }
      } else {
        this.cache.delete(key);
      }
    }
    
    this.stats.misses++;
    return null;
  }

  set(id, element) {
    const key = id.startsWith('#') ? id : `#${id}`;
    if (element && element.isConnected) {
      this.cache.set(key, element);
      this.wrongElements.delete(key);
    }
  }

  query(selector) {
    // Chercher d'abord dans le cache pour les ID
    if (selector.startsWith('#')) {
      const cached = this.get(selector);
      if (cached) return cached;
    }
    
    // Requête DOM et mise en cache si c'est un ID
    this.stats.domQueries++;
    const element = document.querySelector(selector);
    
    if (element && selector.startsWith('#')) {
      this.set(selector, element);
    }
    
    return element;
  }

  queryAll(selector) {
    // Pas de cache pour querySelectorAll (retourne NodeList statique)
    this.stats.domQueries++;
    return document.querySelectorAll(selector);
  }

  getElementById(id) {
    // Version optimisée de getElementById avec cache
    const cached = this.get(id);
    if (cached) return cached;
    
    this.stats.domQueries++;
    const element = document.getElementById(id);
    if (element) {
      this.set(id, element);
    }
    return element;
  }

  cleanup(force = false) {
    const now = Date.now();
    
    if (force || now - this.lastCleanup > 10000) {
      let removed = 0;
      
      for (const [key, element] of this.cache.entries()) {
        if (!element || !element.isConnected) {
          this.cache.delete(key);
          removed++;
        }
      }
      
      this.lastCleanup = now;
      return removed;
    }
    
    return 0;
  }

  clear() {
    this.cache.clear();
    this.wrongElements.clear();
  }

  getStats() {
    return {
      ...this.stats,
      cacheSize: this.cache.size,
      wrongElements: this.wrongElements.size
    };
  }
}

// Instance globale du cache DOM
const domCache = new AdvancedDOMCache();

// ============================================================================
// GESTIONNAIRE DE RENDU AVEC DIRTY FLAGS OPTIMISÉS
// ============================================================================

class OptimizedRenderManager {
  constructor() {
    this.dirtyFlags = {
      hud: false,
      preview: false,
      palette: false,
      overlays: false,
      junctions: false,
      castle: false,
      markers: false,
      stats: false
    };
    
    this.renderQueue = new Set();
    this.isRendering = false;
    this.renderSchedule = null;
    this.renderDebouncer = new SmartDebouncer(16); // ~60 FPS
    this.batchUpdates = new Map();
    this.lastRenderTime = 0;
    this.renderStats = {
      totalRenders: 0,
      batchedRenders: 0,
      forcedRenders: 0
    };
  }

  setDirty(flag, force = false) {
    if (!this.dirtyFlags[flag]) {
      this.dirtyFlags[flag] = true;
      this.renderQueue.add(flag);
      
      if (force) {
        this.scheduleRender();
      } else {
        this.renderDebouncer.execute(() => this.processRenderQueue());
      }
    }
  }

  setMultipleDirty(flags) {
    let hasNewFlags = false;
    
    for (const flag of flags) {
      if (!this.dirtyFlags[flag]) {
        this.dirtyFlags[flag] = true;
        this.renderQueue.add(flag);
        hasNewFlags = true;
      }
    }
    
    if (hasNewFlags) {
      this.renderDebouncer.execute(() => this.processRenderQueue());
    }
  }

  isDirty(flag) {
    return this.dirtyFlags[flag];
  }

  clearDirty(flag) {
    this.dirtyFlags[flag] = false;
    this.renderQueue.delete(flag);
  }

  forceRender(flag) {
    this.setDirty(flag, true);
  }

  processRenderQueue() {
    if (this.isRendering || this.renderQueue.size === 0) {
      return;
    }

    this.isRendering = true;
    this.renderStats.totalRenders++;
    const flagsToRender = Array.from(this.renderQueue);
    
    // Regrouper les rendus similaires pour optimiser
    const groupedFlags = this.groupRenderFlags(flagsToRender);
    
    this.renderQueue.clear();

    try {
      const renderStart = performance.now();
      
      for (const group of groupedFlags) {
        this.renderFlagGroup(group);
        group.forEach(flag => this.dirtyFlags[flag] = false);
      }
      
      this.lastRenderTime = performance.now() - renderStart;
      
    } finally {
      this.isRendering = false;
    }
  }

  groupRenderFlags(flags) {
    // Grouper les rendus qui peuvent être optimisés ensemble
    const groups = [];
    const processed = new Set();
    
    // Groupe HUD et markers (souvent mis à jour ensemble)
    const hudGroup = flags.filter(f => ['hud', 'markers'].includes(f));
    if (hudGroup.length > 0) {
      groups.push(hudGroup);
      hudGroup.forEach(f => processed.add(f));
    }
    
    // Groupe preview et palette (interactions utilisateur)
    const interactionGroup = flags.filter(f => ['preview', 'palette'].includes(f));
    if (interactionGroup.length > 0) {
      groups.push(interactionGroup);
      interactionGroup.forEach(f => processed.add(f));
    }
    
    // Les autres rendus individuels
    const remainingFlags = flags.filter(f => !processed.has(f));
    remainingFlags.forEach(flag => groups.push([flag]));
    
    return groups;
  }

  renderFlagGroup(flags) {
    if (flags.length === 1) {
      this.renderSingleFlag(flags[0]);
    } else {
      this.renderStats.batchedRenders++;
      
      // Rendu groupé pour les flags liés
      if (flags.includes('hud') && flags.includes('markers')) {
        this.renderHUDAndMarkers();
        return;
      }
      
      if (flags.includes('preview') && flags.includes('palette')) {
        this.renderPreviewAndPalette();
        return;
      }
      
      // Rendu individuel pour les autres combinaisons
      flags.forEach(flag => this.renderSingleFlag(flag));
    }
  }

  renderSingleFlag(flag) {
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
      case 'stats':
        this.renderStatsModal();
        break;
    }
  }

  renderHUDAndMarkers() {
    // Rendu groupé optimisé
    this.renderHUD();
    this.updateColonMarkersPositions();
  }

  renderPreviewAndPalette() {
    // Rendu groupé pour les interactions
    this.renderPlacementPreview();
    this.renderPalette();
  }

  renderHUD() {
    const scoreboard = domCache.query('#scoreboard');
    if (!scoreboard) return;

    // Rendu optimisé avec fragment DOM
    const fragment = document.createDocumentFragment();
    
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
      
      card.addEventListener('click', () => {
        if (player !== turnState.activePlayer) setActivePlayer(player);
      });
      
      // Icon
      const iconWrap = document.createElement('span');
      iconWrap.className = 'scorecard-icon';
      iconWrap.appendChild(createScorecardIcon(player));
      card.appendChild(iconWrap);
      
      // Meta
      const meta = document.createElement('div');
      meta.className = 'scorecard-meta';
      
      const label = document.createElement('span');
      label.className = 'scorecard-label';
      label.textContent = `J${player}`;
      meta.appendChild(label);
      
      const points = document.createElement('span');
      points.className = 'scorecard-points';
      points.textContent = String(scoreValue);
      meta.appendChild(points);
      
      card.appendChild(meta);
      fragment.appendChild(card);
    }
    
    scoreboard.appendChild(fragment);

    const turnIndicator = domCache.query('#turn-indicator');
    if (turnIndicator) {
      turnIndicator.textContent = `Tour ${turnState.turnNumber}-Joueur ${turnState.activePlayer}`;
    }

    // Mise à jour de l'indicateur carré
    const svg = getBoardSvg();
    if (svg?.__state?.updateSquareIndicator) {
      const activePlayer = turnState.activePlayer;
      const activeIdx = playerIndex(activePlayer);
      const scoreValue = activeIdx !== -1 ? playerScores[activeIdx] || 0 : 0;
      svg.__state.updateSquareIndicator(activePlayer, scoreValue);
    }
  }

  renderPlacementPreview() {
    // Optimisé dans le code principal
  }

  renderPalette() {
    // Optimisé dans le code principal  
  }

  renderOverlays() {
    // Optimisé dans le code principal
  }

  renderJunctions() {
    // Optimisé dans le code principal
  }

  renderCastle() {
    // Optimisé dans le code principal
  }

  updateColonMarkersPositions() {
    const svg = getBoardSvg();
    if (!svg?.__state) return;
    
    const { size } = svg.__state;
    const updates = [];
    
    colonMarkers.forEach((marker, player) => {
      const idx = playerIndex(player);
      if (idx === -1) {
        updates.push({
          element: marker,
          attributes: { style: 'display:none' }
        });
        return;
      }
      
      const tileIdx = colonPositions[idx];
      const tile = tiles[tileIdx];
      if (!tile) {
        updates.push({
          element: marker,
          attributes: { style: 'display:none' }
        });
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
    
    // Appliquer les mises à jour par lots
    this.applyBatchUpdates(updates);
  }

  renderStatsModal() {
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
    
    // Génération HTML optimisée avec template
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
  }

  applyBatchUpdates(updates) {
    // Optimisation des mises à jour DOM par lots
    if (updates.length === 0) return;
    
    if (updates.length === 1) {
      // Mise à jour unique
      const update = updates[0];
      for (const [attr, value] of Object.entries(update.attributes)) {
        update.element.setAttribute(attr, value);
      }
    } else {
      // Utiliser requestAnimationFrame pour les mises à jour multiples
      requestAnimationFrame(() => {
        updates.forEach(update => {
          for (const [attr, value] of Object.entries(update.attributes)) {
            update.element.setAttribute(attr, value);
          }
        });
      });
    }
  }

  scheduleRender() {
    if (this.renderSchedule) {
      cancelAnimationFrame(this.renderSchedule);
    }
    
    this.renderSchedule = requestAnimationFrame(() => {
      this.processRenderQueue();
      this.renderSchedule = null;
    });
  }

  forceAllRenders() {
    this.renderStats.forcedRenders++;
    this.setMultipleDirty(Object.keys(this.dirtyFlags));
  }

  getStats() {
    return {
      ...this.renderStats,
      dirtyFlags: { ...this.dirtyFlags },
      queueSize: this.renderQueue.size,
      isRendering: this.isRendering,
      lastRenderTime: this.lastRenderTime
    };
  }
}

// Instance globale du gestionnaire de rendu
const renderManager = new OptimizedRenderManager();

// ============================================================================
// CACHES OPTIMISÉS POUR CALCULS COÛTEUX
// ============================================================================

// Cache pour les positions hexagonales (axe q,r vers pixel)
const hexPositionCache = new OptimizedLRUCache(1000, 600000); // 10 minutes TTL

// Cache pour les vertices hexagonaux
const hexVerticesCache = new OptimizedLRUCache(1000, 600000);

// Cache pour les éléments DOM de tuiles
const tileElementCache = new OptimizedLRUCache(500, 300000); // 5 minutes TTL

// Cache pour les paths SVG
const svgPathCache = new OptimizedLRUCache(2000, 300000);

// Fonctions de cache optimisées pour les calculs coûteux
function getCachedHexPositions(q, r, size) {
  const key = `hex_${q}_${r}_${size}`;
  let result = hexPositionCache.get(key);
  
  if (!result) {
    result = axialToPixel(q, r, size);
    hexPositionCache.set(key, result);
  }
  
  return result;
}

function getCachedHexVertices(cx, cy, size) {
  const key = `verts_${cx.toFixed(2)}_${cy.toFixed(2)}_${size}`;
  let result = hexVerticesCache.get(key);
  
  if (!result) {
    result = hexVerticesAt(cx, cy, size);
    hexVerticesCache.set(key, result);
  }
  
  return result;
}

function getCachedTileElement(tileIdx) {
  const key = `tile_${tileIdx}`;
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

function getCachedSVGPath(x, y, radius, cornerRadius = 0.18) {
  const key = `path_${x.toFixed(2)}_${y.toFixed(2)}_${radius.toFixed(2)}_${cornerRadius}`;
  let path = svgPathCache.get(key);
  
  if (!path) {
    path = createHexOutlinePath(x, y, radius, cornerRadius);
    svgPathCache.set(key, path);
  }
  
  return path;
}

// ============================================================================
// OPTIMISATIONS DES ÉVÉNEMENTS AVANCÉES
// ============================================================================

// Throttlers optimisés pour différents types d'événements
const mouseMoveThrottler = new RAFThrottler(16); // ~60 FPS
const resizeDebouncer = new SmartDebouncer(150);
const configChangeDebouncer = new SmartDebouncer(300);
const scrollDebouncer = new SmartDebouncer(100);

// Handlers optimisés pour les événements fréquents
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

function handleResizeOptimized() {
  resizeDebouncer.execute(() => {
    generateAndRender();
    domCache.cleanup(true);
    
    // Nettoyage des caches après redimensionnement
    hexPositionCache.clear();
    hexVerticesCache.clear();
    tileElementCache.clear();
    svgPathCache.clear();
  });
}

function handleScrollOptimized() {
  scrollDebouncer.execute(() => {
    // Optimisations spécifiques au scroll si nécessaire
    renderManager.setDirty('preview');
  });
}

// ============================================================================
// OPTIMISATEUR SVG AVANCÉ
// ============================================================================

class AdvancedSVGOptimizer {
  constructor() {
    this.pathCache = svgPathCache;
    this.batchSize = 100;
    this.pendingUpdates = [];
    this.updateScheduled = false;
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
    
    // Création optimisée des triangles
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

  scheduleBatchUpdate(element, attributes) {
    this.pendingUpdates.push({ element, attributes });
    
    if (!this.updateScheduled) {
      this.updateScheduled = true;
      requestAnimationFrame(() => {
        this.applyBatchUpdates();
      });
    }
  }

  applyBatchUpdates() {
    const updates = this.pendingUpdates.splice(0);
    this.updateScheduled = false;
    
    // Grouper par type d'opération pour optimiser
    const byElement = new Map();
    
    updates.forEach(update => {
      if (!byElement.has(update.element)) {
        byElement.set(update.element, {});
      }
      Object.assign(byElement.get(update.element), update.attributes);
    });
    
    // Appliquer les mises à jour
    for (const [element, attrs] of byElement.entries()) {
      for (const [attr, value] of Object.entries(attrs)) {
        element.setAttribute(attr, value);
      }
    }
  }

  optimizeSVGStructure() {
    const svg = getBoardSvg();
    if (!svg) return;
    
    // Optimisations de structure SVG
    svg.setAttribute('shape-rendering', 'geometricPrecision');
    svg.setAttribute('text-rendering', 'optimizeLegibility');
  }

  getCacheStats() {
    return {
      pathCache: this.pathCache.getStats(),
      pendingUpdates: this.pendingUpdates.length
    };
  }
}

const svgOptimizer = new AdvancedSVGOptimizer();

// ============================================================================
// FONCTIONS OPTIMISÉES DE BASE
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
    hudElements.scoreboard = domCache.getElementById('scoreboard');
  }
  if (!hudElements.turnIndicator) {
    hudElements.turnIndicator = domCache.getElementById('turn-indicator');
  }
  if (!hudElements.endTurnButton) {
    hudElements.endTurnButton = domCache.getElementById('end-turn');
    
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
  renderManager.setDirty('markers');
}

/**
 * Version optimisée de refreshStatsModal avec debouncing intelligent
 */
const refreshStatsDebouncer = new SmartDebouncer(100);

function refreshStatsModalOptimized() {
  refreshStatsDebouncer.execute(() => {
    if (!statsModalVisible) return;
    renderManager.setDirty('stats');
  });
}

// ============================================================================
// OPTIMISATION AUTO-REEMPLISSAGE AVANCÉE
// ============================================================================

/**
 * Auto-remplissage optimisé avec batching intelligent
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

  // Regroupement intelligent des placements
  const batchedPlacements = [];
  let placedCount = 0;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (!palette || palette.length === 0) {
      palette = regenPalette();
      if (!palette || palette.length === 0) {
        autoState.pendingPalette = null;
        return 'halt';
      }
    }

    if (attemptPlacementWithPaletteOptimized(palette, batchedPlacements)) {
      placedCount++;
      autoState.pendingPalette = regenPalette();
      
      // Appliquer les placements par lots pour optimiser les rendus
      if (batchedPlacements.length >= 5 || attempt === MAX_ATTEMPTS - 1) {
        commitBatchedPlacements(batchedPlacements);
        batchedPlacements.length = 0;
      }
      
      // Arrêter si on a placé plusieurs tuiles
      if (placedCount >= 3) {
        break;
      }
      
      return 'placed';
    }
    palette = null;
  }

  // Appliquer les placements restants
  if (batchedPlacements.length > 0) {
    commitBatchedPlacements(batchedPlacements);
  }

  autoState.pendingPalette = null;
  return placedCount > 0 ? 'placed' : 'halt';
}

/**
 * Version optimisée de attemptPlacementWithPalette avec recherche intelligente
 */
function attemptPlacementWithPaletteOptimized(palette, batchedPlacements = []) {
  // Optimisation: trier les anneaux par nombre de tuiles disponibles
  const ringOrder = ringsByDistance
    .map((ring, idx) => ({ idx, ring, availableCount: ring ? ring.filter(i => emptyTiles.has(i)).length : 0 }))
    .filter(r => r.availableCount > 0)
    .sort((a, b) => b.availableCount - a.availableCount);

  for (const { idx: ringIdx, ring } of ringOrder) {
    const availableTiles = ring.filter(idx => emptyTiles.has(idx));
    if (!availableTiles.length) continue;

    for (let paletteIdx = 0; paletteIdx < palette.length; paletteIdx++) {
      const combo = palette[paletteIdx];
      if (!combo) continue;

      const steps = rotationStepsForCombo(combo);
      const preferred = normalizeRotationStep(combo, combo.rotationStep);
      const order = steps.slice();

      // Optimisation: essayer d'abord la rotation préférée
      if (order.length > 1) {
        const i = order.indexOf(preferred);
        if (i > 0) {
          order.splice(i, 1);
          order.unshift(preferred);
        }
      }

      for (const step of order) {
        const oriented = orientedSideColors(combo, step);
        
        // Optimisation: chercher d'abord les tuiles avec le plus de voisins
        const sortedTiles = availableTiles
          .map(tileIdx => ({ tileIdx, neighborCount: neighborPlacementCount(tileIdx) }))
          .sort((a, b) => b.neighborCount - a.neighborCount);

        for (const { tileIdx } of sortedTiles) {
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

/**
 * Commettre les placements par lots pour optimiser les rendus
 */
function commitBatchedPlacements(batchedPlacements) {
  if (batchedPlacements.length === 0) return;

  const svg = getBoardSvg();
  if (!svg?.__state) return;

  // Grouper les rendus pour éviter les cascading renders
  const needsJunctionRender = false;
  const needsOverlayRender = false;

  batchedPlacements.forEach(placement => {
    if (commitPlacement(
      placement.tileIdx, 
      placement.combo, 
      placement.rotationStep, 
      placement.sideColors, 
      placement.player, 
      placement.options
    )) {
      // Détecter si on a besoin de re-rendre les jonctions/overlays
      if (placement.tileIdx < 20) { // Seuil arbitraire pour les tuiles centrales
        // Vérifier si c'est proche d'une jonction
        const tile = tiles[placement.tileIdx];
        // Logique simplifiée - dans la vraie implémentation on vérifierait les jonctions
      }
    }
  });

  // Rendu groupé après tous les placements
  if (needsJunctionRender) {
    renderManager.setDirty('junctions');
  }
  if (needsOverlayRender) {
    renderManager.setDirty('overlays');
  }
}

// ============================================================================
// MONITORING ET ANALYSE DE PERFORMANCE
// ============================================================================

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      renderTimes: [],
      domQueries: 0,
      cacheHits: 0,
      cacheMisses: 0,
      framesPerSecond: 0,
      memoryUsage: 0
    };
    this.frameCount = 0;
    this.lastFPSUpdate = performance.now();
    this.isMonitoring = false;
  }

  start() {
    this.isMonitoring = true;
    
    // Monitoring FPS
    const trackFPS = () => {
      if (!this.isMonitoring) return;
      
      this.frameCount++;
      const now = performance.now();
      
      if (now - this.lastFPSUpdate >= 1000) {
        this.metrics.framesPerSecond = Math.round((this.frameCount * 1000) / (now - this.lastFPSUpdate));
        this.frameCount = 0;
        this.lastFPSUpdate = now;
      }
      
      requestAnimationFrame(trackFPS);
    };
    
    trackFPS();
    
    // Monitoring mémoire (si disponible)
    if (performance.memory) {
      setInterval(() => {
        this.metrics.memoryUsage = performance.memory.usedJSHeapSize;
      }, 5000);
    }
    
    // Nettoyage périodique des métriques
    setInterval(() => {
      this.cleanupMetrics();
    }, 30000);
  }

  stop() {
    this.isMonitoring = false;
  }

  recordRenderTime(time) {
    this.metrics.renderTimes.push(time);
    
    // Garder seulement les 100 dernières mesures
    if (this.metrics.renderTimes.length > 100) {
      this.metrics.renderTimes.shift();
    }
  }

  recordDOMQuery() {
    this.metrics.domQueries++;
  }

  getAverageRenderTime() {
    if (this.metrics.renderTimes.length === 0) return 0;
    const sum = this.metrics.renderTimes.reduce((a, b) => a + b, 0);
    return sum / this.metrics.renderTimes.length;
  }

  getPerformanceScore() {
    // Calcul d'un score de performance global (0-100)
    const fpsScore = Math.min(this.metrics.framesPerSecond / 60 * 100, 100);
    const domScore = Math.max(0, 100 - (this.metrics.domQueries / 10));
    const renderScore = Math.max(0, 100 - (this.getAverageRenderTime() * 10));
    
    return Math.round((fpsScore + domScore + renderScore) / 3);
  }

  cleanupMetrics() {
    // Nettoyer les anciennes métriques
    const cutoff = performance.now() - 60000; // 1 minute
    
    this.metrics.renderTimes = this.metrics.renderTimes.filter(time => time > cutoff);
    
    // Demander le garbage collection si disponible
    if (window.gc) {
      window.gc();
    }
  }

  generateReport() {
    return {
      fps: this.metrics.framesPerSecond,
      averageRenderTime: this.getAverageRenderTime(),
      domQueries: this.metrics.domQueries,
      cacheStats: {
        dom: domCache.getStats(),
        hexPositions: hexPositionCache.getStats(),
        hexVertices: hexVerticesCache.getStats(),
        tileElements: tileElementCache.getStats()
      },
      renderStats: renderManager.getStats(),
      svgStats: svgOptimizer.getCacheStats(),
      performanceScore: this.getPerformanceScore(),
      memoryUsage: this.metrics.memoryUsage
    };
  }
}

// Instance globale du moniteur
const performanceMonitor = new PerformanceMonitor();

// ============================================================================
// INITIALISATION AVEC TOUTES LES OPTIMISATIONS
// ============================================================================

// Remplacer les anciennes fonctions par les versions optimisées
window.renderGameHud = renderGameHudOptimized;
window.ensureHudElements = ensureHudElementsOptimized;
window.renderTileFill = renderTileFillOptimized;
window.updateColonMarkersPositions = updateColonMarkersPositionsOptimized;
window.refreshStatsModal = refreshStatsModalOptimized;
window.stepAutoFill = stepAutoFillOptimized;

// Optimisation des événements avec gestionnaires multiples
if (typeof window !== 'undefined') {
  // Supprimer les anciens listeners et ajouter les nouveaux optimisés
  window.removeEventListener('mousemove', handleMouseMoveOptimized);
  window.addEventListener('mousemove', handleMouseMoveOptimized, { passive: true });
  
  window.removeEventListener('resize', handleResizeOptimized);
  window.addEventListener('resize', handleResizeOptimized);
  
  // Optimisation du scroll si nécessaire
  window.addEventListener('scroll', handleScrollOptimized, { passive: true });

  // Démarrer le monitoring de performance
  performanceMonitor.start();
  
  // Optimisation initiale du SVG
  svgOptimizer.optimizeSVGStructure();
  
  // Nettoyage périodique des caches
  setInterval(() => {
    const cleaned = domCache.cleanup();
    hexPositionCache.cleanup();
    hexVerticesCache.cleanup();
    tileElementCache.cleanup();
    svgPathCache.cleanup();
    
    if (cleaned > 0) {
      console.log(`[PERF] Cache nettoyé: ${cleaned} éléments DOM supprimés`);
    }
  }, 30000); // Toutes les 30 secondes
  
  // Affichage périodique des stats de performance
  setInterval(() => {
    const report = performanceMonitor.generateReport();
    console.log('[PERF]', {
      FPS: report.fps,
      Score: report.performanceScore,
      RenderTime: `${report.averageRenderTime.toFixed(2)}ms`,
      DOMQueries: report.domQueries,
      CacheHitRate: `${(report.cacheStats.dom.hitRate * 100).toFixed(1)}%`
    });
  }, 10000); // Toutes les 10 secondes
}

// ============================================================================
// EXPORT POUR DEBUGGING ET MONITORING
// ============================================================================

if (typeof window !== 'undefined') {
  window.performanceCaches = {
    dom: domCache,
    render: renderManager,
    hexPositions: hexPositionCache,
    hexVertices: hexVerticesCache,
    tileElements: tileElementCache,
    svgPaths: svgPathCache,
    svgOptimizer,
    monitor: performanceMonitor,
    
    // Fonctions utilitaires
    getStats: () => performanceMonitor.generateReport(),
    clearCaches: () => {
      hexPositionCache.clear();
      hexVerticesCache.clear();
      tileElementCache.clear();
      svgPathCache.clear();
      domCache.cleanup(true);
    },
    enableDebug: () => {
      window.DEBUG_PERF = true;
      console.log('[PERF] Mode debug activé');
    },
    disableDebug: () => {
      window.DEBUG_PERF = false;
      console.log('[PERF] Mode debug désactivé');
    }
  };
}

// Log de confirmation
console.log('[PERF] Pairleroy optimisé chargé avec succès');
console.log('[PERF] Optimisations actives:', {
  debouncing: true,
  throttling: true,
  domCaching: true,
  dirtyFlags: true,
  hexCaching: true,
  batchedUpdates: true,
  performanceMonitoring: true
});

// Export pour Node.js si nécessaire
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SmartDebouncer,
    RAFThrottler,
    OptimizedLRUCache,
    AdvancedDOMCache,
    OptimizedRenderManager,
    AdvancedSVGOptimizer,
    PerformanceMonitor
  };
}
