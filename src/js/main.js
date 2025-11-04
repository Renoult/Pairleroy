// Fichier: src/js/main.js
// Description: Orchestration de l'application (lecture config, generation de la grille, interactions UI).


const tiles = generateAxialGrid(RADIUS);
const { neighbors: tileNeighbors } = buildNeighborData(tiles);
const tileAngles = tiles.map(tileAngle);
const tileDistances = tiles.map(tileDistance);
const ringsByDistance = [];
for (let idx = 0; idx < tiles.length; idx++) {
  const dist = tileDistances[idx];
  if (!ringsByDistance[dist]) ringsByDistance[dist] = [];
  ringsByDistance[dist].push(idx);
}
ringsByDistance.forEach((ring) => {
  if (ring) ring.sort((a, b) => tileAngles[a] - tileAngles[b]);
});

const PLAYER_IDS = [1, 2, 3, 4, 5, 6];
const PLAYER_COUNT = PLAYER_IDS.length;
const PLAYER_CRESTS = {
  1: 'crests/belier.svg',
  2: 'crests/cerf.svg',
  3: 'crests/faucon.svg',
  4: 'crests/salamandre.svg',
  5: 'crests/taureau.svg',
  6: 'crests/tortue.svg',
};

const PLAYER_COLON_COLORS = [
  '#d46a6a',
  '#4d82c3',
  '#5abf83',
  '#c785d9',
  '#e0ad4b',
  '#6cc2be',
];

const DEFAULT_COLOR_HEX = ['#e57373', '#64b5f6', '#81c784', '#ffd54f'];
const DEFAULT_COLOR_LABELS = ['Main-d\u2019\u0153uvre', 'Tissu', 'Pain', 'Bois'];
const AMENAGEMENT_RESOURCE_TYPES = [
  RESOURCE_TYPES.LABOR,
  RESOURCE_TYPES.FABRIC,
  RESOURCE_TYPES.BREAD,
  RESOURCE_TYPES.WOOD,
];
const AMENAGEMENT_RESOURCE_LABELS = DEFAULT_COLOR_LABELS.slice();
const POINTS_PER_CROWN = 16;

// Système de synchronisation entre onglets
const TAB_SYNC_CHANNEL_NAME = 'pairleroy_game_sync';
const tabChannel = new BroadcastChannel(TAB_SYNC_CHANNEL_NAME);

let currentTabId = generateTabId();
let lastSyncTime = 0;
let isSyncing = false;

// Générer un ID unique pour cet onglet
function generateTabId() {
  return 'tab_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// État complet du jeu pour synchronisation
function getGameState() {
  const svg = document.querySelector('#board-container svg');
  const state = svg?.__state || {};
  
  const gameState = {
    tabId: currentTabId,
    timestamp: Date.now(),
    data: {
      placements: placements.slice(),
      placedCount: placedCount,
      turnState: { ...turnState },
      playerScores: playerScores.slice(),
      selectedPalette: selectedPalette,
      hoveredTileIdx: hoveredTileIdx,
      selectedColonPlayer: selectedColonPlayer,
      svgState: {
        overlayByJunction: state.overlayByJunction ? Array.from(state.overlayByJunction.entries()) : [],
        castleByJunction: state.castleByJunction ? Array.from(state.castleByJunction.entries()) : [],
        outpostByJunction: state.outpostByJunction ? Array.from(state.outpostByJunction.entries()) : [],
        colors: state.colors,
        typesPct: state.typesPct,
        colorPct: state.colorPct
      }
    }
  };
  
  console.log('[SYNCHRONISATION] Génération état - Placements:', placements.length, 'Count:', placedCount);
  return gameState;
}

// Appliquer l'état reçu à l'onglet actuel
function applyGameState(syncState) {
  if (!syncState || !syncState.data || syncState.tabId === currentTabId) return;
  
  isSyncing = true;
  
  try {
    // Synchroniser les placements
    placements = syncState.data.placements.slice();
    placedCount = syncState.data.placedCount;
    
    // Synchroniser l'état du tour
    Object.assign(turnState, syncState.data.turnState);
    
    // Synchroniser les scores
    playerScores = syncState.data.playerScores.slice();
    
    // Synchroniser la sélection de palette
    selectedPalette = syncState.data.selectedPalette;
    setSelectedPalette(selectedPalette);
    
    // Synchroniser la tuile survolée
    hoveredTileIdx = syncState.data.hoveredTileIdx;
    svg.__state.hoveredTile = hoveredTileIdx;
    
    // Synchroniser le joueur colon sélectionné
    selectedColonPlayer = syncState.data.selectedColonPlayer;
    
    // Synchroniser l'état SVG
    const svgState = syncState.data.svgState;
    if (svg.__state) {
      if (svgState.overlayByJunction.length > 0) {
        svg.__state.overlayByJunction = new Map(svgState.overlayByJunction);
      }
      if (svgState.castleByJunction.length > 0) {
        svg.__state.castleByJunction = new Map(svgState.castleByJunction);
      }
      if (svgState.outpostByJunction.length > 0) {
        svg.__state.outpostByJunction = new Map(svgState.outpostByJunction);
      }
      
      // Synchroniser les configurations
      if (svgState.colors) svg.__state.colors = svgState.colors;
      if (svgState.typesPct) svg.__state.typesPct = svgState.typesPct;
      if (svgState.colorPct) svg.__state.colorPct = svgState.colorPct;
    }
    
    // Rendre à nouveau l'affichage
    renderAll();
    
    lastSyncTime = syncState.timestamp;
    
  } catch (error) {
    console.error('Erreur lors de la synchronisation:', error);
  } finally {
    isSyncing = false;
  }
}

// Envoyer l'état aux autres onglets
function broadcastGameState() {
  if (isSyncing) return;
  
  const state = getGameState();
  console.log('[SYNCHRONISATION] Envoi état:', state.tabId, 'Timestamp:', state.timestamp);
  tabChannel.postMessage({
    type: 'gameState',
    data: state
  });
}

// Écouter les messages de synchronisation
tabChannel.addEventListener('message', (event) => {
  const message = event.data;
  console.log('[SYNCHRONISATION] Message reçu:', message);
  
  if (message.type === 'gameState') {
    const incomingState = message.data;
    console.log('[SYNCHRONISATION] État reçu de:', incomingState.tabId, 'Timestamp:', incomingState.timestamp, 'vs local:', lastSyncTime);
    
    // Synchroniser seulement si les données sont plus récentes
    if (incomingState.timestamp > lastSyncTime) {
      console.log('[SYNCHRONISATION] Application de l\'état synchronisé');
      applyGameState(incomingState);
    } else {
      console.log('[SYNCHRONISATION] Ignorer - état trop ancien');
    }
  }
});

// Fonction pour rendre tous les éléments de l'interface
function renderAll() {
  const svg = document.querySelector('#board-container svg');
  if (!svg) return;
  
  // Réactualiser le plateau
  renderGrid();
  
  // Réactualiser les statistiques si visibles
  if (statsModalVisible) {
    refreshStatsModal();
  }
  
  // Réactualiser l'interface utilisateur
  renderPaletteUI(paletteCombos);
  renderPlacementPreview(hoveredTileIdx);
}

const RESOURCE_LABELS = {
  [RESOURCE_TYPES.WOOD]: 'Bois',
  [RESOURCE_TYPES.BREAD]: 'Pain',
  [RESOURCE_TYPES.FABRIC]: 'Tissu',
  [RESOURCE_TYPES.LABOR]: 'Main-d\u2019\u0153uvre',
};

const RESOURCE_ORDER = [
  RESOURCE_TYPES.WOOD,
  RESOURCE_TYPES.BREAD,
  RESOURCE_TYPES.FABRIC,
  RESOURCE_TYPES.LABOR,
];

const MARKET_TYPE_LABELS = {
  [MARKET_CARD_TYPES.BUILDING]: 'Plan urbain',
  [MARKET_CARD_TYPES.CONTRACT]: 'Accord',
};

const MARKET_RESOURCE_TOKEN_CLASS_MAP = {
  [RESOURCE_TYPES.WOOD]: 'wood',
  [RESOURCE_TYPES.BREAD]: 'bread',
  [RESOURCE_TYPES.FABRIC]: 'fabric',
  [RESOURCE_TYPES.LABOR]: 'labor',
};

const MARKET_SPECIAL_TOKEN_CLASS_MAP = {
  points: 'points',
  crowns: 'crowns',
  influence: 'influence',
};

let activeColors = DEFAULT_COLOR_HEX.slice();
if (typeof window !== 'undefined') {
  window.__pairleroyActiveColors = activeColors.slice();
}

const DEFAULT_CENTER_TILE_INDEX = (() => {
  const idx = tiles.findIndex((t) => t.q === 0 && t.r === 0 && t.s === 0);
  return idx >= 0 ? idx : 0;
})();

const DEFAULT_GAME_SETTINGS = Object.freeze({
  tilePlacementsPerTurn: 1,
  colonStepsPerTurn: 2,
  neighborPoints: [0, 1, 1, 2, 2, 4, 4],
  castleCost: 5,
  outpostCost: 3,
  amenagementCost: 0,
  influenceRadius: 1,
  requireCastleAdjacencyForCastles: true,
});

const gameSettings = {
  tilePlacementsPerTurn: DEFAULT_GAME_SETTINGS.tilePlacementsPerTurn,
  colonStepsPerTurn: DEFAULT_GAME_SETTINGS.colonStepsPerTurn,
  neighborPoints: DEFAULT_GAME_SETTINGS.neighborPoints.slice(),
  castleCost: DEFAULT_GAME_SETTINGS.castleCost,
  outpostCost: DEFAULT_GAME_SETTINGS.outpostCost,
  amenagementCost: DEFAULT_GAME_SETTINGS.amenagementCost,
  influenceRadius: DEFAULT_GAME_SETTINGS.influenceRadius,
  requireCastleAdjacencyForCastles: DEFAULT_GAME_SETTINGS.requireCastleAdjacencyForCastles,
};

if (typeof window !== 'undefined') {
  window.__pairleroySettings = gameSettings;
}

let colonPositions = Array.from({ length: PLAYER_COUNT }, () => DEFAULT_CENTER_TILE_INDEX);
let colonMoveRemaining = Array.from({ length: PLAYER_COUNT }, () => gameSettings.colonStepsPerTurn);
let colonPlacementUsed = Array.from({ length: PLAYER_COUNT }, () => false);
let selectedColonPlayer = null;
let colonMarkers = new Map();

function createEmptyResourceStock() {
  return {
    [RESOURCE_TYPES.WOOD]: 0,
    [RESOURCE_TYPES.BREAD]: 0,
    [RESOURCE_TYPES.FABRIC]: 0,
    [RESOURCE_TYPES.LABOR]: 0,
  };
}

function isPointWithinRect(rect, x, y) {
  if (!rect || typeof x !== 'number' || typeof y !== 'number') return false;
  return x >= rect.left && x <= rect.right
    && y >= rect.top && y <= rect.bottom;
}

function isPointWithinRectWithPadding(rect, x, y, padding = 0) {
  if (!rect || typeof x !== 'number' || typeof y !== 'number') return false;
  const safePadding = Math.max(0, Number(padding) || 0);
  return x >= rect.left - safePadding && x <= rect.right + safePadding
    && y >= rect.top - safePadding && y <= rect.bottom + safePadding;
}

function createEmptyPlayerResource() {
  return {
    tileColors: new Map(),
    amenagements: new Set(),
    amenagementColors: new Map(),
    stock: createEmptyResourceStock(),
    buildings: new Set(),
    contracts: new Set(),
    crowns: 0,
  };
}

let playerScores = Array.from({ length: PLAYER_COUNT }, () => 0);
let playerResources = Array.from({ length: PLAYER_COUNT }, () => createEmptyPlayerResource());

const turnState = {
  activePlayer: PLAYER_IDS[0],
  tilesPlacedByPlayer: Array.from({ length: PLAYER_COUNT }, () => 0),
  turnNumber: 1,
};

let marketState = createInitialMarketState();
let hoveredMarketSlot = null;
let lockedMarketSlot = null;
const influenceMap = new Map();

const hudElements = {
  scoreboard: null,
  collapsedScoreboard: null,
  turnIndicator: null,
  endTurnButton: null,
  collapsedEndTurnButton: null,
};

const marketDetailElements = {
  container: null,
  type: null,
  slot: null,
  name: null,
  cost: null,
  reward: null,
  description: null,
};

const personalBoardElements = {
  container: null,
  crest: null,
  playerLabel: null,
  subtitle: null,
  pointsValue: null,
  crownsValue: null,
  amenagementCount: null,
  amenagementList: null,
  amenagementEmpty: null,
  buildingsCount: null,
  buildingsList: null,
  buildingsEmpty: null,
  contractsCount: null,
  contractsList: null,
  contractsEmpty: null,
};

const MARKET_EXIT_GRACE_PX = 56;

let marketDetailsCollapsed = false;
let marketDetailsVisible = false;
let marketDetailsSuppressed = false;
let marketPointerInside = false;
let marketRegionMonitorBound = false;
let marketRectSnapshot = null;
let lastPointerPosition = null;
let palettePointerInside = false;

function getMarketBounds() {
  const svg = getBoardSvg();
  const layer = svg?.__state?.marketLayer ?? svg?.querySelector('#square-market');
  if (!layer || typeof layer.getBoundingClientRect !== 'function') return null;
  const rect = layer.getBoundingClientRect();
  return {
    left: rect.left,
    right: rect.right,
    top: rect.top,
    bottom: rect.bottom,
    centerX: rect.left + rect.width / 2,
  };
}

function applyMarketDetailsVisibility() {
  const elements = ensureMarketDetailElements();
  const container = elements.container;
  if (!container) return;
  const shouldShow = marketDetailsVisible && !marketDetailsCollapsed && !marketDetailsSuppressed;
  container.classList.toggle('market-details--hidden', !shouldShow);
  container.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
}

function setMarketDetailVisibility(visible) {
  marketDetailsVisible = Boolean(visible);
  applyMarketDetailsVisibility();
}

function setMarketDetailsSuppressed(suppressed) {
  const nextState = Boolean(suppressed);
  if (marketDetailsSuppressed === nextState) return;
  marketDetailsSuppressed = nextState;
  applyMarketDetailsVisibility();
}

let topbarCollapsed = false;
let personalBoardCollapsed = false;
let topbarElements = null;
let collapsedHudOffset = { top: 64, left: null, right: 16 };
const COLLAPSED_HUD_STORAGE_KEY = 'pairleroyCollapsedHudPosition';
let collapsedHudDragState = null;

function loadCollapsedHudPosition() {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const raw = window.localStorage.getItem(COLLAPSED_HUD_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return;
    if (Number.isFinite(parsed.top)) collapsedHudOffset.top = parsed.top;
    if (Number.isFinite(parsed.left)) {
      collapsedHudOffset.left = parsed.left;
      collapsedHudOffset.right = null;
    } else if (Number.isFinite(parsed.right)) {
      collapsedHudOffset.right = parsed.right;
      collapsedHudOffset.left = null;
    }
  } catch (error) {
    console.warn('Impossible de charger la position du HUD compact', error);
  }
}

function saveCollapsedHudPosition() {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const payload = {
      top: Number.isFinite(collapsedHudOffset.top) ? collapsedHudOffset.top : 64,
    };
    if (Number.isFinite(collapsedHudOffset.left)) {
      payload.left = collapsedHudOffset.left;
    } else if (Number.isFinite(collapsedHudOffset.right)) {
      payload.right = collapsedHudOffset.right;
    }
    window.localStorage.setItem(COLLAPSED_HUD_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn("Impossible d'enregistrer la position du HUD compact", error);
  }
}

function clampCollapsedHudPosition(collapsedHud, proposedTop, proposedLeft) {
  if (!collapsedHud) {
    return { top: Math.round(proposedTop || 64), left: Math.round(proposedLeft || 16) };
  }
  const rect = collapsedHud.getBoundingClientRect();
  const width = rect.width || collapsedHud.offsetWidth || 0;
  const height = rect.height || collapsedHud.offsetHeight || 0;
  const viewportWidth = window.innerWidth || document.documentElement?.clientWidth || width;
  const viewportHeight = window.innerHeight || document.documentElement?.clientHeight || height;
  const margin = 8;
  const minLeft = margin;
  const minTop = margin;
  const maxLeft = Math.max(minLeft, viewportWidth - width - margin);
  const maxTop = Math.max(minTop, viewportHeight - height - margin);
  const desiredTop = Number.isFinite(proposedTop) ? proposedTop : rect.top;
  const desiredLeft = Number.isFinite(proposedLeft) ? proposedLeft : rect.left;
  return {
    top: Math.round(Math.min(Math.max(minTop, desiredTop), maxTop)),
    left: Math.round(Math.min(Math.max(minLeft, desiredLeft), maxLeft)),
  };
}

function applyCollapsedHudPosition({ skipEnsure = false } = {}) {
  if (typeof document === 'undefined') return;
  const collapsedHud = document.getElementById('collapsed-hud');
  if (!collapsedHud) return;
  const topValue = Number.isFinite(collapsedHudOffset.top) ? Math.round(collapsedHudOffset.top) : 64;
  collapsedHud.style.setProperty('--collapsed-hud-top', `${topValue}px`);
  if (Number.isFinite(collapsedHudOffset.left)) {
    collapsedHud.style.setProperty('--collapsed-hud-left', `${Math.round(collapsedHudOffset.left)}px`);
    collapsedHud.style.setProperty('--collapsed-hud-right', 'auto');
  } else if (Number.isFinite(collapsedHudOffset.right)) {
    collapsedHud.style.removeProperty('--collapsed-hud-left');
    collapsedHud.style.setProperty('--collapsed-hud-right', `${Math.round(collapsedHudOffset.right)}px`);
  } else {
    collapsedHud.style.removeProperty('--collapsed-hud-left');
    collapsedHud.style.removeProperty('--collapsed-hud-right');
  }
  if (!skipEnsure && document.body?.classList.contains('topbar-collapsed')) {
    requestAnimationFrame(() => ensureCollapsedHudWithinViewport(collapsedHud));
  }
}

function ensureCollapsedHudWithinViewport(collapsedHud) {
  if (typeof window === 'undefined' || !collapsedHud) return;
  const rect = collapsedHud.getBoundingClientRect();
  if (!rect || rect.width === 0 || rect.height === 0) return;
  const { top, left } = clampCollapsedHudPosition(collapsedHud, rect.top, rect.left);
  const topChanged = !Number.isFinite(collapsedHudOffset.top) || Math.round(collapsedHudOffset.top) !== top;
  const leftChanged = !Number.isFinite(collapsedHudOffset.left) || Math.round(collapsedHudOffset.left) !== left;
  if (!topChanged && !leftChanged) return;
  collapsedHudOffset.top = top;
  collapsedHudOffset.left = left;
  collapsedHudOffset.right = null;
  applyCollapsedHudPosition({ skipEnsure: true });
  saveCollapsedHudPosition();
}

function handleCollapsedHudResize() {
  if (typeof document === 'undefined') return;
  const collapsedHud = document.getElementById('collapsed-hud');
  if (!collapsedHud) return;
  applyCollapsedHudPosition({ skipEnsure: true });
  if (!document.body?.classList.contains('topbar-collapsed')) return;
  if (collapsedHud.offsetWidth === 0 || collapsedHud.offsetHeight === 0) return;
  ensureCollapsedHudWithinViewport(collapsedHud);
}

function initCollapsedHudInteractions() {
  if (typeof document === 'undefined') return;
  const collapsedHud = document.getElementById('collapsed-hud');
  if (!collapsedHud || collapsedHud.__pairleroyDragBound) return;
  collapsedHud.__pairleroyDragBound = true;
  collapsedHud.addEventListener('pointerdown', onCollapsedHudPointerDown);
  collapsedHud.addEventListener('pointermove', onCollapsedHudPointerMove);
  collapsedHud.addEventListener('pointerup', onCollapsedHudPointerUp);
  collapsedHud.addEventListener('pointercancel', onCollapsedHudPointerCancel);
  collapsedHud.addEventListener('lostpointercapture', onCollapsedHudPointerLost);
  applyCollapsedHudPosition({ skipEnsure: true });
}

function onCollapsedHudPointerDown(event) {
  if (!event || event.button !== 0) return;
  const collapsedHud = event.currentTarget;
  if (!collapsedHud || !document.body?.classList.contains('topbar-collapsed')) return;
  const rect = collapsedHud.getBoundingClientRect();
  collapsedHudDragState = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    originTop: Number.isFinite(collapsedHudOffset.top) ? collapsedHudOffset.top : rect.top,
    originLeft: Number.isFinite(collapsedHudOffset.left) ? collapsedHudOffset.left : rect.left,
    minDistance: 4,
    dragging: false,
  };
}

function onCollapsedHudPointerMove(event) {
  if (!collapsedHudDragState || event.pointerId !== collapsedHudDragState.pointerId) return;
  const collapsedHud = event.currentTarget;
  if (!collapsedHud) return;
  const dx = event.clientX - collapsedHudDragState.startX;
  const dy = event.clientY - collapsedHudDragState.startY;
  if (!collapsedHudDragState.dragging) {
    if (Math.abs(dx) + Math.abs(dy) < collapsedHudDragState.minDistance) return;
    collapsedHudDragState.dragging = true;
    try {
      collapsedHud.setPointerCapture(event.pointerId);
    } catch (_) {}
    collapsedHud.classList.add('collapsed-hud--dragging');
  }
  const proposedTop = collapsedHudDragState.originTop + dy;
  const proposedLeft = collapsedHudDragState.originLeft + dx;
  const { top, left } = clampCollapsedHudPosition(collapsedHud, proposedTop, proposedLeft);
  collapsedHudOffset.top = top;
  collapsedHudOffset.left = left;
  collapsedHudOffset.right = null;
  applyCollapsedHudPosition({ skipEnsure: true });
  event.preventDefault();
}

function onCollapsedHudPointerUp(event) {
  if (!collapsedHudDragState || event.pointerId !== collapsedHudDragState.pointerId) return;
  const wasDragging = collapsedHudDragState.dragging;
  finishCollapsedHudDrag({ cancel: false });
  if (wasDragging) event.preventDefault();
}

function onCollapsedHudPointerCancel(event) {
  if (!collapsedHudDragState || event.pointerId !== collapsedHudDragState.pointerId) return;
  finishCollapsedHudDrag({ cancel: true });
}

function onCollapsedHudPointerLost() {
  finishCollapsedHudDrag({ cancel: true });
}

function finishCollapsedHudDrag({ cancel = false } = {}) {
  if (!collapsedHudDragState) return false;
  const collapsedHud = document.getElementById('collapsed-hud');
  const { pointerId, dragging } = collapsedHudDragState;
  if (collapsedHud && pointerId != null) {
    try {
      if (collapsedHud.hasPointerCapture?.(pointerId)) {
        collapsedHud.releasePointerCapture(pointerId);
      }
    } catch (_) {}
    collapsedHud.classList.remove('collapsed-hud--dragging');
  }
  collapsedHudDragState = null;
  if (!cancel && dragging) {
    saveCollapsedHudPosition();
    return true;
  }
  return dragging;
}

if (typeof window !== 'undefined') {
  loadCollapsedHudPosition();
  window.addEventListener('resize', handleCollapsedHudResize, { passive: true });
}

function ensureTopbarControls() {
  if (topbarElements) return topbarElements;
  topbarElements = {
    header: document.getElementById('app-topbar'),
    toggle: document.getElementById('toggle-topbar'),
    personalBoardToggle: document.getElementById('toggle-personal-board'),
    stats: document.getElementById('open-stats'),
    settings: document.getElementById('open-settings'),
    group: document.getElementById('topbar-volet'),
  };
  return topbarElements;
}

function updateTopbarQuickActions() {
  const elements = ensureTopbarControls();
  if (elements.stats) {
    elements.stats.setAttribute('aria-pressed', statsModalVisible ? 'true' : 'false');
  }
  if (elements.settings) {
    elements.settings.setAttribute('aria-pressed', settingsPanelVisible ? 'true' : 'false');
  }
}

function setTopbarCollapsed(collapsed) {
  topbarCollapsed = Boolean(collapsed);
  const elements = ensureTopbarControls();
  const { header, toggle } = elements;
  if (header) header.classList.toggle('topbar--collapsed', topbarCollapsed);
  if (document.body) document.body.classList.toggle('topbar-collapsed', topbarCollapsed);
  if (toggle) {
    toggle.setAttribute('aria-expanded', String(!topbarCollapsed));
    toggle.setAttribute('aria-label', topbarCollapsed
      ? 'Deplier la barre superieure'
      : 'Replier la barre superieure');
    toggle.textContent = topbarCollapsed ? 'TB+' : 'TB-';
  }
  applyCollapsedHudPosition();
  const collapsedHud = document.getElementById('collapsed-hud');
  if (collapsedHud) collapsedHud.setAttribute('aria-hidden', topbarCollapsed ? 'false' : 'true');
  renderGameHud();
}

function setPersonalBoardCollapsed(collapsed) {
  personalBoardCollapsed = Boolean(collapsed);
  const elements = ensureTopbarControls();
  const toggle = elements.personalBoardToggle;
  const personalBoard = ensurePersonalBoardElements().container || document.getElementById('personal-board');
  if (personalBoard) {
    personalBoard.hidden = personalBoardCollapsed;
    personalBoard.classList.toggle('personal-board--collapsed', personalBoardCollapsed);
    personalBoard.setAttribute('aria-hidden', personalBoardCollapsed ? 'true' : 'false');
  }
  if (document.body) {
    document.body.classList.toggle('personal-board-collapsed', personalBoardCollapsed);
  }
  if (toggle) {
    toggle.setAttribute('aria-expanded', String(!personalBoardCollapsed));
    toggle.setAttribute('aria-label', personalBoardCollapsed
      ? 'Deplier le plateau personnel'
      : 'Replier le plateau personnel');
    toggle.textContent = personalBoardCollapsed ? 'PB+' : 'PB-';
  }
  renderPersonalBoard();
}

function togglePersonalBoardCollapsed() {
  setPersonalBoardCollapsed(!personalBoardCollapsed);
}

function setMarketDetailsCollapsed(collapsed) {
  const nextState = Boolean(collapsed);
  if (marketDetailsCollapsed === nextState) return;
  const prevRect = getMarketBounds();
  marketDetailsCollapsed = nextState;
  if (typeof document !== 'undefined') {
    document.body?.classList.toggle('market-details-collapsed', marketDetailsCollapsed);
  }
  if (marketDetailsCollapsed) {
    resetHoveredMarketSlot(true);
    marketRectSnapshot = null;
    marketPointerInside = false;
  }
  applyMarketDetailsVisibility();
  if (!marketDetailsCollapsed) {
    if (prevRect) marketRectSnapshot = prevRect;
    requestAnimationFrame(() => {
      if (lastPointerPosition) {
        updatePointerState(lastPointerPosition.x, lastPointerPosition.y);
      }
    });
  }
}

function updatePointerState(clientX, clientY) {
  if (palettePointerInside) return;
  if (marketDetailsSuppressed) setMarketDetailsSuppressed(false);
  if (typeof clientX !== 'number' || typeof clientY !== 'number') return;
  lastPointerPosition = { x: clientX, y: clientY };
  const rect = getMarketBounds();
  if (!rect) return;
  const insideCurrent = isPointWithinRect(rect, clientX, clientY);
  let inside = insideCurrent;
  if (!inside && marketRectSnapshot) {
    inside = isPointWithinRectWithPadding(marketRectSnapshot, clientX, clientY, MARKET_EXIT_GRACE_PX);
  }
  if (inside) {
    if (insideCurrent) marketRectSnapshot = rect;
    if (!marketPointerInside) marketPointerInside = true;
  } else {
    marketPointerInside = false;
    if (!marketDetailsCollapsed && hoveredMarketSlot == null) {
      setMarketDetailsCollapsed(true);
    }
  }
}

function toggleTopbarCollapsed() {
  setTopbarCollapsed(!topbarCollapsed);
}

function initTopbarControls() {
  const elements = ensureTopbarControls();
  const { toggle, personalBoardToggle, stats, settings } = elements;
  if (toggle && !toggle.__pairleroyBound) {
    toggle.__pairleroyBound = true;
    toggle.addEventListener('click', toggleTopbarCollapsed);
  }
  if (personalBoardToggle && !personalBoardToggle.__pairleroyBound) {
    personalBoardToggle.__pairleroyBound = true;
    personalBoardToggle.addEventListener('click', togglePersonalBoardCollapsed);
  }
  if (stats && !stats.__pairleroyBound) {
    stats.__pairleroyBound = true;
    stats.addEventListener('click', () => {
      if (statsModalVisible) hideStatsModal();
      else showStatsModal();
    });
  }
  if (settings && !settings.__pairleroyBound) {
    settings.__pairleroyBound = true;
    settings.addEventListener('click', () => {
      if (settingsPanelVisible) hideSettingsPanel();
      else showSettingsPanel();
    });
  }
  setTopbarCollapsed(topbarCollapsed);
  updateTopbarQuickActions();
}

const amenagementColorByKey = new Map();

function isValidPlayer(player) {
  return Number.isInteger(player) && player >= 1 && player <= PLAYER_COUNT;
}

function playerIndex(player) {
  return isValidPlayer(player) ? player - 1 : -1;
}

function resetTurnCounters() {
  if (!Array.isArray(turnState.tilesPlacedByPlayer)) {
    turnState.tilesPlacedByPlayer = Array.from({ length: PLAYER_COUNT }, () => 0);
  } else {
    turnState.tilesPlacedByPlayer.fill(0);
  }
  colonMoveRemaining = Array.from({ length: PLAYER_COUNT }, () => gameSettings.colonStepsPerTurn);
  colonPlacementUsed = Array.from({ length: PLAYER_COUNT }, () => false);
  selectedColonPlayer = null;
  updateColonMarkersPositions();
  influenceMap.clear();
}

function snapshotGameSettings() {
  return {
    tilePlacementsPerTurn: gameSettings.tilePlacementsPerTurn,
    colonStepsPerTurn: gameSettings.colonStepsPerTurn,
    neighborPoints: Array.isArray(gameSettings.neighborPoints)
      ? gameSettings.neighborPoints.slice()
      : DEFAULT_GAME_SETTINGS.neighborPoints.slice(),
    castleCost: gameSettings.castleCost,
    outpostCost: gameSettings.outpostCost,
    amenagementCost: gameSettings.amenagementCost,
    influenceRadius: gameSettings.influenceRadius,
    requireCastleAdjacencyForCastles: gameSettings.requireCastleAdjacencyForCastles,
  };
}

function normalizeIntegerSetting(value, fallback, { min = 0, max = Number.POSITIVE_INFINITY } = {}) {
  const base = Number(value);
  const safeFallback = Number.isFinite(fallback) ? fallback : 0;
  if (!Number.isFinite(base)) {
    return Math.min(max, Math.max(min, Math.round(safeFallback)));
  }
  const rounded = Math.round(base);
  return Math.min(max, Math.max(min, rounded));
}

function applyGameSettingsDiff(previous) {
  if (gameSettings.tilePlacementsPerTurn !== previous.tilePlacementsPerTurn) {
    const limit = Math.max(0, gameSettings.tilePlacementsPerTurn);
    if (!Array.isArray(turnState.tilesPlacedByPlayer)) {
      turnState.tilesPlacedByPlayer = Array.from({ length: PLAYER_COUNT }, () => 0);
    }
    turnState.tilesPlacedByPlayer = turnState.tilesPlacedByPlayer.map((value) => {
      const current = Number.isFinite(value) ? value : 0;
      return Math.min(limit, Math.max(0, current));
    });
  }

  const colonLimit = Math.max(0, gameSettings.colonStepsPerTurn);
  if (gameSettings.colonStepsPerTurn !== previous.colonStepsPerTurn) {
    colonMoveRemaining = Array.from({ length: PLAYER_COUNT }, () => colonLimit);
  } else {
    colonMoveRemaining = Array.from({ length: PLAYER_COUNT }, (_, idx) =>
      Math.min(colonLimit, Math.max(0, colonMoveRemaining[idx] ?? colonLimit)),
    );
  }
  updateColonMarkersPositions();

  if (gameSettings.influenceRadius !== previous.influenceRadius) {
    influenceMap.clear();
  }

  const svg = getBoardSvg();
  if (gameSettings.requireCastleAdjacencyForCastles !== previous.requireCastleAdjacencyForCastles) {
    svg?.__state?.renderJunctionOverlays?.();
  }
  svg?.__state?.renderInfluenceZones?.();
  renderGameHud();
}

function updateGameSettings(changes = {}) {
  const previous = snapshotGameSettings();
  let changed = false;

  if (Object.prototype.hasOwnProperty.call(changes, 'tilePlacementsPerTurn')) {
    const next = normalizeIntegerSetting(
      changes.tilePlacementsPerTurn,
      previous.tilePlacementsPerTurn,
      { min: 0, max: 6 },
    );
    if (next !== gameSettings.tilePlacementsPerTurn) {
      gameSettings.tilePlacementsPerTurn = next;
      changed = true;
    }
  }

  if (Object.prototype.hasOwnProperty.call(changes, 'colonStepsPerTurn')) {
    const next = normalizeIntegerSetting(
      changes.colonStepsPerTurn,
      previous.colonStepsPerTurn,
      { min: 0, max: 8 },
    );
    if (next !== gameSettings.colonStepsPerTurn) {
      gameSettings.colonStepsPerTurn = next;
      changed = true;
    }
  }

  if (Object.prototype.hasOwnProperty.call(changes, 'castleCost')) {
    const next = normalizeIntegerSetting(
      changes.castleCost,
      previous.castleCost,
      { min: 0, max: 50 },
    );
    if (next !== gameSettings.castleCost) {
      gameSettings.castleCost = next;
      changed = true;
    }
  }

  if (Object.prototype.hasOwnProperty.call(changes, 'outpostCost')) {
    const next = normalizeIntegerSetting(
      changes.outpostCost,
      previous.outpostCost,
      { min: 0, max: 50 },
    );
    if (next !== gameSettings.outpostCost) {
      gameSettings.outpostCost = next;
      changed = true;
    }
  }

  if (Object.prototype.hasOwnProperty.call(changes, 'amenagementCost')) {
    const next = normalizeIntegerSetting(
      changes.amenagementCost,
      previous.amenagementCost,
      { min: 0, max: 50 },
    );
    if (next !== gameSettings.amenagementCost) {
      gameSettings.amenagementCost = next;
      changed = true;
    }
  }

  if (Object.prototype.hasOwnProperty.call(changes, 'influenceRadius')) {
    const next = normalizeIntegerSetting(
      changes.influenceRadius,
      previous.influenceRadius,
      { min: 0, max: 6 },
    );
    if (next !== gameSettings.influenceRadius) {
      gameSettings.influenceRadius = next;
      changed = true;
    }
  }

  if (Object.prototype.hasOwnProperty.call(changes, 'requireCastleAdjacencyForCastles')) {
    const next = Boolean(changes.requireCastleAdjacencyForCastles);
    if (next !== gameSettings.requireCastleAdjacencyForCastles) {
      gameSettings.requireCastleAdjacencyForCastles = next;
      changed = true;
    }
  }

  if (changes.neighborPoint && Number.isInteger(changes.neighborPoint.index)) {
    const desiredLen = DEFAULT_GAME_SETTINGS.neighborPoints.length;
    const idx = Math.min(desiredLen - 1, Math.max(0, changes.neighborPoint.index));
    const table = Array.isArray(gameSettings.neighborPoints)
      ? gameSettings.neighborPoints.slice()
      : DEFAULT_GAME_SETTINGS.neighborPoints.slice();
    const nextValue = normalizeIntegerSetting(
      changes.neighborPoint.value,
      table[idx],
      { min: 0, max: 20 },
    );
    if (nextValue !== table[idx]) {
      table[idx] = nextValue;
      gameSettings.neighborPoints = table;
      changed = true;
    }
  }

  if (changed) {
    applyGameSettingsDiff(previous);
    if (typeof window !== 'undefined') {
      window.__pairleroySettings = gameSettings;
    }
  }
  return changed;
}

const SETTINGS_KEYS = new Set(['m', 'o', 'd']);
const settingsPressedKeys = new Set();
let settingsComboLatched = false;
let settingsPanelVisible = false;
let settingsPanelElements = null;

function createNumberSettingControl(container, { label, setting, min, max, step = 1, dataset = {} }) {
  const wrapper = document.createElement('label');
  wrapper.className = 'settings-panel__control';
  const text = document.createElement('span');
  text.className = 'settings-panel__label';
  text.textContent = label;
  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'settings-panel__input';
  if (Number.isFinite(min)) input.min = String(min);
  if (Number.isFinite(max)) input.max = String(max);
  if (Number.isFinite(step)) input.step = String(step);
  input.dataset.setting = setting;
  Object.entries(dataset).forEach(([key, value]) => {
    input.dataset[key] = String(value);
  });
  input.addEventListener('change', handleGameSettingInput);
  input.addEventListener('input', handleGameSettingInput);
  wrapper.appendChild(text);
  wrapper.appendChild(input);
  container.appendChild(wrapper);
  return input;
}

function createToggleSettingControl(container, { label, setting, dataset = {} }) {
  const wrapper = document.createElement('label');
  wrapper.className = 'settings-panel__control settings-panel__control--toggle';
  const text = document.createElement('span');
  text.className = 'settings-panel__label';
  text.textContent = label;
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.className = 'settings-panel__input settings-panel__input--checkbox';
  input.dataset.setting = setting;
  input.dataset.type = 'boolean';
  Object.entries(dataset).forEach(([key, value]) => {
    input.dataset[key] = String(value);
  });
  input.addEventListener('change', handleGameSettingInput);
  wrapper.appendChild(text);
  wrapper.appendChild(input);
  container.appendChild(wrapper);
  return input;
}

function ensureSettingsPanel() {
  if (settingsPanelElements) return settingsPanelElements;

  const panel = document.createElement('div');
  panel.className = 'settings-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Param\u00e8tres de partie');
  panel.tabIndex = -1;

  const header = document.createElement('div');
  header.className = 'settings-panel__header';
  const title = document.createElement('span');
  title.className = 'settings-panel__title';
  title.textContent = 'R\u00e8gles dynamiques';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'settings-panel__close';
  closeBtn.setAttribute('aria-label', 'Fermer');
  closeBtn.textContent = '\u00d7';
  header.appendChild(title);
  header.appendChild(closeBtn);

  const body = document.createElement('div');
  body.className = 'settings-panel__body';

  panel.appendChild(header);
  panel.appendChild(body);
  document.body.appendChild(panel);

  const sections = [];
  const createSection = (sectionTitle) => {
    const section = document.createElement('section');
    section.className = 'settings-panel__section';
    if (sectionTitle) {
      const heading = document.createElement('div');
      heading.className = 'settings-panel__section-title';
      heading.textContent = sectionTitle;
      section.appendChild(heading);
    }
    const grid = document.createElement('div');
    grid.className = 'settings-panel__grid';
    section.appendChild(grid);
    body.appendChild(section);
    sections.push({ section, grid });
    return grid;
  };

  const turnGrid = createSection('Tours');
  const influenceGrid = createSection('Influence');
  const costGrid = createSection('Co\u00fbts');
  const restrictionsGrid = createSection('Restrictions');
  const neighborGrid = createSection('Points par voisins');

  const inputs = {
    tilePlacements: createNumberSettingControl(turnGrid, {
      label: 'Placements par tour',
      setting: 'tilePlacementsPerTurn',
      min: 0,
      max: 6,
    }),
    colonSteps: createNumberSettingControl(turnGrid, {
      label: 'Pas du colon par tour',
      setting: 'colonStepsPerTurn',
      min: 0,
      max: 8,
    }),
    influenceRadius: createNumberSettingControl(influenceGrid, {
      label: 'Distance d\u2019influence',
      setting: 'influenceRadius',
      min: 0,
      max: 6,
    }),
    castleCost: createNumberSettingControl(costGrid, {
      label: 'Co\u00fbt d\u2019un ch\u00e2teau',
      setting: 'castleCost',
      min: 0,
      max: 50,
    }),
    outpostCost: createNumberSettingControl(costGrid, {
      label: 'Co\u00fbt d\u2019un avant-poste',
      setting: 'outpostCost',
      min: 0,
      max: 50,
    }),
    amenagementCost: createNumberSettingControl(costGrid, {
      label: 'Co\u00fbt d\u2019un am\u00e9nagement',
      setting: 'amenagementCost',
      min: 0,
      max: 50,
    }),
    requireCastleAdjacencyForCastles: createToggleSettingControl(restrictionsGrid, {
      label: 'Ch\u00e2teau adjacent au colon',
      setting: 'requireCastleAdjacencyForCastles',
    }),
  };

  const neighborInputs = [];
  const neighborLabels = ['0', '1', '2', '3', '4', '5', '6+'];
  neighborLabels.forEach((label, index) => {
    const input = createNumberSettingControl(neighborGrid, {
      label: `Voisins ${label}`,
      setting: 'neighborPoint',
      min: 0,
      max: 20,
      dataset: { index },
    });
    neighborInputs.push(input);
  });

  closeBtn.addEventListener('click', () => hideSettingsPanel());
  panel.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      hideSettingsPanel();
      event.stopPropagation();
    }
  });

  settingsPanelElements = {
    panel,
    body,
    inputs,
    neighborInputs,
  };
  return settingsPanelElements;
}

function syncSettingsPanelInputs() {
  if (!settingsPanelVisible && !settingsPanelElements) return;
  const elements = ensureSettingsPanel();
  const table = Array.isArray(gameSettings.neighborPoints)
    ? gameSettings.neighborPoints
    : DEFAULT_GAME_SETTINGS.neighborPoints;
  if (elements.inputs.tilePlacements) {
    elements.inputs.tilePlacements.value = String(gameSettings.tilePlacementsPerTurn);
  }
  if (elements.inputs.colonSteps) {
    elements.inputs.colonSteps.value = String(gameSettings.colonStepsPerTurn);
  }
  if (elements.inputs.influenceRadius) {
    elements.inputs.influenceRadius.value = String(gameSettings.influenceRadius);
  }
  if (elements.inputs.castleCost) {
    elements.inputs.castleCost.value = String(gameSettings.castleCost);
  }
  if (elements.inputs.outpostCost) {
    elements.inputs.outpostCost.value = String(gameSettings.outpostCost);
  }
  if (elements.inputs.amenagementCost) {
    elements.inputs.amenagementCost.value = String(gameSettings.amenagementCost);
  }
  if (elements.inputs.requireCastleAdjacencyForCastles) {
    elements.inputs.requireCastleAdjacencyForCastles.checked = Boolean(gameSettings.requireCastleAdjacencyForCastles);
  }
  elements.neighborInputs.forEach((input, idx) => {
    if (input) {
      input.value = String(table[Math.min(table.length - 1, idx)] ?? 0);
    }
  });
}

function showSettingsPanel() {
  const elements = ensureSettingsPanel();
  settingsPanelVisible = true;
  elements.panel.classList.add('settings-panel--visible');
  syncSettingsPanelInputs();
  elements.panel.focus({ preventScroll: true });
  updateTopbarQuickActions();
}

function hideSettingsPanel() {
  if (!settingsPanelVisible) return;
  const elements = ensureSettingsPanel();
  elements.panel.classList.remove('settings-panel--visible');
  settingsPanelVisible = false;
  settingsPressedKeys.clear();
  settingsComboLatched = false;
  updateTopbarQuickActions();
}

function toggleSettingsPanel() {
  if (settingsPanelVisible) hideSettingsPanel();
  else showSettingsPanel();
}

function handleGameSettingInput(event) {
  const target = event.currentTarget;
  if (!(target instanceof HTMLInputElement)) return;
  const setting = target.dataset.setting;
  if (!setting) return;
  if (setting === 'neighborPoint') {
    const index = Number(target.dataset.index);
    const value = Number(target.value);
    updateGameSettings({ neighborPoint: { index, value } });
  } else if (target.dataset.type === 'boolean' || target.type === 'checkbox') {
    updateGameSettings({ [setting]: target.checked });
  } else {
    const value = Number(target.value);
    updateGameSettings({ [setting]: value });
  }
  syncSettingsPanelInputs();
}

function handleSettingsKeyDown(event) {
  const key = event.key?.toLowerCase();
  if (!key) return false;
  if (key === 'escape') {
    if (settingsPanelVisible) {
      hideSettingsPanel();
      return true;
    }
    return false;
  }
  if (!SETTINGS_KEYS.has(key)) return false;
  const active = document.activeElement;
  if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) {
    return false;
  }
  settingsPressedKeys.add(key);
  if (settingsPressedKeys.size === SETTINGS_KEYS.size && !settingsComboLatched) {
    toggleSettingsPanel();
    settingsComboLatched = true;
    return true;
  }
  return false;
}

function handleSettingsKeyUp(event) {
  const key = event.key?.toLowerCase();
  if (!key) return;
  if (SETTINGS_KEYS.has(key)) {
    settingsPressedKeys.delete(key);
    if (settingsPressedKeys.size === 0) settingsComboLatched = false;
  } else {
    settingsPressedKeys.clear();
    settingsComboLatched = false;
  }
}

function bindEndTurnButton(button) {
  if (!button || button.__pairleroyBound) return;
  button.__pairleroyBound = true;
  button.addEventListener('click', () => endCurrentTurn({ reason: 'manual' }));
}

function ensureHudElements() {
  if (!hudElements.scoreboard) hudElements.scoreboard = document.getElementById('scoreboard');
  if (!hudElements.collapsedScoreboard) {
    hudElements.collapsedScoreboard = document.getElementById('collapsed-scoreboard');
  }
  if (!hudElements.turnIndicator) hudElements.turnIndicator = document.getElementById('turn-indicator');
  if (!hudElements.endTurnButton) hudElements.endTurnButton = document.getElementById('end-turn');
  if (!hudElements.collapsedEndTurnButton) {
    hudElements.collapsedEndTurnButton = document.getElementById('collapsed-end-turn');
  }
  bindEndTurnButton(hudElements.endTurnButton);
  bindEndTurnButton(hudElements.collapsedEndTurnButton);
}

function crownsFromScore(score) {
  if (!Number.isFinite(score)) return 0;
  if (score <= 0) return 0;
  return Math.floor(score / POINTS_PER_CROWN);
}

function awardPoints(player, delta, source = 'generic') {
  if (!isValidPlayer(player) || !Number.isFinite(delta) || delta === 0) return;
  const idx = playerIndex(player);
  if (idx === -1) return;
  const previousScore = playerScores[idx] || 0;
  const nextScore = previousScore + delta;
  playerScores[idx] = nextScore;
  const prevCrownsFromScore = crownsFromScore(previousScore);
  const nextCrownsFromScore = crownsFromScore(nextScore);
  const crownDelta = nextCrownsFromScore - prevCrownsFromScore;
  if (crownDelta !== 0) adjustPlayerCrowns(player, crownDelta);
  debugLog('awardPoints', {
    player,
    delta,
    source,
    next: playerScores[idx],
    crownDelta,
  });
  renderGameHud();
}

function getPlayerScore(player) {
  const idx = playerIndex(player);
  return idx !== -1 ? playerScores[idx] || 0 : 0;
}

function spendPoints(player, cost, reason = 'spend') {
  if (!isValidPlayer(player) || !Number.isFinite(cost) || cost <= 0) return false;
  const current = getPlayerScore(player);
  if (current < cost) {
    debugLog('insufficient-points', { player, cost, current, reason });
    return false;
  }
  awardPoints(player, -cost, reason);
  return true;
}

function adjustResourceColorTally(player, colorIdx, delta) {
  if (!isValidPlayer(player) || !Number.isInteger(colorIdx)) return;
  const idx = playerIndex(player);
  const record = playerResources[idx];
  if (!record) return;
  const map = record.amenagementColors;
  const next = (map.get(colorIdx) || 0) + delta;
  if (next > 0) map.set(colorIdx, next);
  else map.delete(colorIdx);
}

function adjustPlayerTileResources(player, combo, delta) {
  if (!isValidPlayer(player) || !combo) return;
  const idx = playerIndex(player);
  const record = playerResources[idx];
  if (!record) return;
  const colors = Array.isArray(combo.colors) ? combo.colors : [];
  const units = Array.isArray(combo.units) ? combo.units : [];
  for (let i = 0; i < colors.length; i++) {
    const colorIdx = colors[i];
    const amount = (units[i] ?? 1) * delta;
    const current = record.tileColors.get(colorIdx) || 0;
    const next = current + amount;
    if (next > 0) record.tileColors.set(colorIdx, next);
    else record.tileColors.delete(colorIdx);
  }
}

function ensureMarketDetailElements() {
  if (!marketDetailElements.container) {
    marketDetailElements.container = document.getElementById('market-details');
    marketDetailElements.type = document.getElementById('market-details-type');
    marketDetailElements.slot = document.getElementById('market-details-slot');
    marketDetailElements.name = document.getElementById('market-details-name');
    marketDetailElements.cost = document.getElementById('market-details-cost');
    marketDetailElements.reward = document.getElementById('market-details-reward');
    marketDetailElements.description = document.getElementById('market-details-description');
  }
  return marketDetailElements;
}

function ensurePersonalBoardElements() {
  if (personalBoardElements.container || typeof document === 'undefined') return personalBoardElements;
  const container = document.getElementById('personal-board');
  if (!container) return personalBoardElements;

  container.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'personal-board__header';

  const identity = document.createElement('div');
  identity.className = 'personal-board__identity';

  const crest = document.createElement('img');
  crest.className = 'personal-board__crest';
  crest.alt = '';
  crest.decoding = 'async';

  const title = document.createElement('div');
  title.className = 'personal-board__title';

  const playerLabel = document.createElement('div');
  playerLabel.className = 'personal-board__player';
  playerLabel.textContent = 'Joueur 1';

  const subtitle = document.createElement('div');
  subtitle.className = 'personal-board__subtitle';
  subtitle.textContent = 'Tour 1';

  title.appendChild(playerLabel);
  title.appendChild(subtitle);
  identity.appendChild(crest);
  identity.appendChild(title);

  const totals = document.createElement('div');
  totals.className = 'personal-board__totals';

  const pointsTotal = document.createElement('div');
  pointsTotal.className = 'personal-board__total personal-board__total--points';
  const pointsLabel = document.createElement('div');
  pointsLabel.className = 'personal-board__total-label';
  pointsLabel.textContent = 'Points';
  const pointsValue = document.createElement('div');
  pointsValue.className = 'personal-board__total-value';
  pointsValue.textContent = '0';
  pointsTotal.appendChild(pointsLabel);
  pointsTotal.appendChild(pointsValue);

  const crownsTotal = document.createElement('div');
  crownsTotal.className = 'personal-board__total personal-board__total--crowns';
  const crownsLabel = document.createElement('div');
  crownsLabel.className = 'personal-board__total-label';
  crownsLabel.textContent = 'Couronnes';
  const crownsValue = document.createElement('div');
  crownsValue.className = 'personal-board__total-value';
  crownsValue.textContent = '0';
  crownsTotal.appendChild(crownsLabel);
  crownsTotal.appendChild(crownsValue);

  totals.appendChild(pointsTotal);
  totals.appendChild(crownsTotal);

  header.appendChild(identity);
  header.appendChild(totals);
  container.appendChild(header);

  const amenagementSection = document.createElement('section');
  amenagementSection.className = 'personal-board__section personal-board__section--amenagements';

  const amenagementTitle = document.createElement('div');
  amenagementTitle.className = 'personal-board__section-title';
  amenagementTitle.textContent = 'Amenagements';

  const amenagementCount = document.createElement('div');
  amenagementCount.className = 'personal-board__section-count';
  amenagementCount.textContent = 'Aucun amenagement controle';

  const amenagementList = document.createElement('ul');
  amenagementList.className = 'personal-board__amenagement-list';

  const amenagementEmpty = document.createElement('div');
  amenagementEmpty.className = 'personal-board__empty';
  amenagementEmpty.textContent = 'Aucun amenagement controle.';

  amenagementSection.appendChild(amenagementTitle);
  amenagementSection.appendChild(amenagementCount);
  amenagementSection.appendChild(amenagementList);
  amenagementSection.appendChild(amenagementEmpty);
  container.appendChild(amenagementSection);

  const contractsSection = document.createElement('section');
  contractsSection.className = 'personal-board__section personal-board__section--contracts';

  const contractsTitle = document.createElement('div');
  contractsTitle.className = 'personal-board__section-title';
  contractsTitle.textContent = 'Contrats';

  const contractsCount = document.createElement('div');
  contractsCount.className = 'personal-board__section-count';
  contractsCount.textContent = 'Aucun contrat conclu';

  const contractsList = document.createElement('ul');
  contractsList.className = 'personal-board__contracts-list';

  const contractsEmpty = document.createElement('div');
  contractsEmpty.className = 'personal-board__empty';
  contractsEmpty.textContent = 'Aucun contrat conclu.';

  contractsSection.appendChild(contractsTitle);
  contractsSection.appendChild(contractsCount);
  contractsSection.appendChild(contractsList);
  contractsSection.appendChild(contractsEmpty);

  const buildingsSection = document.createElement('section');
  buildingsSection.className = 'personal-board__section personal-board__section--buildings';

  const buildingsTitle = document.createElement('div');
  buildingsTitle.className = 'personal-board__section-title';
  buildingsTitle.textContent = 'Batiments';

  const buildingsCount = document.createElement('div');
  buildingsCount.className = 'personal-board__section-count';
  buildingsCount.textContent = 'Aucun batiment construit';

  const buildingsList = document.createElement('ul');
  buildingsList.className = 'personal-board__buildings-list';

  const buildingsEmpty = document.createElement('div');
  buildingsEmpty.className = 'personal-board__empty';
  buildingsEmpty.textContent = 'Aucun batiment construit.';

  buildingsSection.appendChild(buildingsTitle);
  buildingsSection.appendChild(buildingsCount);
  buildingsSection.appendChild(buildingsList);
  buildingsSection.appendChild(buildingsEmpty);
  container.appendChild(contractsSection);
  container.appendChild(buildingsSection);

  personalBoardElements.container = container;
  personalBoardElements.crest = crest;
  personalBoardElements.playerLabel = playerLabel;
  personalBoardElements.subtitle = subtitle;
  personalBoardElements.pointsValue = pointsValue;
  personalBoardElements.crownsValue = crownsValue;
  personalBoardElements.amenagementCount = amenagementCount;
  personalBoardElements.amenagementList = amenagementList;
  personalBoardElements.amenagementEmpty = amenagementEmpty;
  personalBoardElements.buildingsCount = buildingsCount;
  personalBoardElements.buildingsList = buildingsList;
  personalBoardElements.buildingsEmpty = buildingsEmpty;
  personalBoardElements.contractsCount = contractsCount;
  personalBoardElements.contractsList = contractsList;
  personalBoardElements.contractsEmpty = contractsEmpty;

  amenagementEmpty.hidden = true;
  buildingsEmpty.hidden = true;
  contractsEmpty.hidden = true;

  return personalBoardElements;
}

function renderPersonalBoard() {
  const elements = ensurePersonalBoardElements();
  const container = elements.container;
  if (!container) return;

  const activePlayer = turnState.activePlayer ?? PLAYER_IDS[0];
  const idx = playerIndex(activePlayer);
  const record = idx !== -1 ? playerResources[idx] : null;

  container.dataset.player = String(activePlayer);

  if (elements.playerLabel) elements.playerLabel.textContent = `Joueur ${activePlayer}`;
  if (elements.subtitle) elements.subtitle.textContent = `Tour ${turnState.turnNumber}`;

  if (elements.crest) {
    const crestUrl = PLAYER_CRESTS[activePlayer] || '';
    if (crestUrl) {
      elements.crest.src = crestUrl;
      elements.crest.alt = `Blason joueur ${activePlayer}`;
      elements.crest.hidden = false;
    } else {
      elements.crest.removeAttribute('src');
      elements.crest.alt = '';
      elements.crest.hidden = true;
    }
  }

  if (elements.pointsValue) elements.pointsValue.textContent = String(getPlayerScore(activePlayer));

  const crowns = record?.crowns ?? 0;
  if (elements.crownsValue) elements.crownsValue.textContent = String(crowns);

  const amenagementTotal = record?.amenagements?.size ?? 0;
  if (elements.amenagementCount) {
    if (amenagementTotal > 0) {
      const suffix = amenagementTotal > 1 ? 's' : '';
      elements.amenagementCount.textContent = `${amenagementTotal} amenagement${suffix} controles`;
    } else {
      elements.amenagementCount.textContent = 'Aucun amenagement controle';
    }
  }

  const amenagementList = elements.amenagementList;
  if (amenagementList) {
    amenagementList.innerHTML = '';
    const entries = [];
    if (record?.amenagementColors instanceof Map) {
      for (const [colorIdx, amount] of record.amenagementColors.entries()) {
        const numericIdx = Number(colorIdx);
        const count = Number(amount);
        if (!Number.isFinite(count) || count <= 0) continue;
        entries.push({ colorIdx: numericIdx, count });
      }
    }
    entries.sort((a, b) => a.colorIdx - b.colorIdx);
    if (entries.length > 0) {
      entries.forEach(({ colorIdx, count }) => {
        const item = document.createElement('li');
        item.className = 'personal-board__amenagement-item';
        const chip = document.createElement('span');
        chip.className = 'personal-board__color-chip';
        const colorHex = activeColors[colorIdx] || DEFAULT_COLOR_HEX[colorIdx % DEFAULT_COLOR_HEX.length] || '#cccccc';
        chip.style.backgroundColor = colorHex;
        chip.style.setProperty('--chip-color', colorHex);
        chip.title = colorHex;
        const name = document.createElement('span');
        name.className = 'personal-board__amenagement-name';
        name.textContent = colorLabelForIndex(colorIdx);
        const countNode = document.createElement('span');
        countNode.className = 'personal-board__amenagement-count';
        countNode.textContent = String(count);
        item.appendChild(chip);
        item.appendChild(name);
        item.appendChild(countNode);
        amenagementList.appendChild(item);
      });
      if (elements.amenagementEmpty) elements.amenagementEmpty.hidden = true;
    } else if (elements.amenagementEmpty) {
      elements.amenagementEmpty.textContent = amenagementTotal > 0
        ? 'Amenagements sans couleur reference.'
        : 'Aucun amenagement controle.';
      elements.amenagementEmpty.hidden = false;
    }
  }

  const buildings = record?.buildings ? Array.from(record.buildings) : [];
  const buildingTotal = buildings.length;
  if (elements.buildingsCount) {
    if (buildingTotal > 0) {
      const suffix = buildingTotal > 1 ? 's' : '';
      const verb = buildingTotal > 1 ? 'construits' : 'construit';
      elements.buildingsCount.textContent = `${buildingTotal} batiment${suffix} ${verb}`;
    } else {
      elements.buildingsCount.textContent = 'Aucun batiment construit';
    }
  }

  const buildingsList = elements.buildingsList;
  if (buildingsList) {
    buildingsList.innerHTML = '';
    if (buildingTotal > 0) {
      buildings.forEach((cardId) => {
        const def = getMarketCardDefinition(cardId);
        const item = document.createElement('li');
        item.className = 'personal-board__building-item';
        const name = document.createElement('span');
        name.className = 'personal-board__building-name';
        name.textContent = def?.name || cardId;
        item.appendChild(name);
        const metaText = summarizeMarketReward(def?.reward);
        if (metaText) {
          const meta = document.createElement('span');
          meta.className = 'personal-board__building-meta';
          meta.textContent = metaText;
          item.appendChild(meta);
        }
        buildingsList.appendChild(item);
      });
      if (elements.buildingsEmpty) elements.buildingsEmpty.hidden = true;
    } else if (elements.buildingsEmpty) {
      elements.buildingsEmpty.textContent = 'Aucun batiment construit.';
      elements.buildingsEmpty.hidden = false;
    }
  }

  const contracts = record?.contracts ? Array.from(record.contracts) : [];
  const contractsTotal = contracts.length;
  if (elements.contractsCount) {
    if (contractsTotal > 0) {
      const suffix = contractsTotal > 1 ? 's' : '';
      const adjective = contractsTotal > 1 ? 'conclus' : 'conclu';
      elements.contractsCount.textContent = `${contractsTotal} contrat${suffix} ${adjective}`;
    } else {
      elements.contractsCount.textContent = 'Aucun contrat conclu';
    }
  }

  const amenagementStock = record ? computeAmenagementResourceStock(record) : null;

  const contractsList = elements.contractsList;
  if (contractsList) {
    contractsList.innerHTML = '';
    if (contractsTotal > 0) {
      const sortedContracts = contracts.slice().sort((a, b) => {
        const defA = getMarketCardDefinition(a);
        const defB = getMarketCardDefinition(b);
        const nameA = defA?.name || a;
        const nameB = defB?.name || b;
        return nameA.localeCompare(nameB, 'fr');
      });
      sortedContracts.forEach((cardId) => {
        const def = getMarketCardDefinition(cardId);
        const item = document.createElement('li');
        item.className = 'personal-board__contract-item';
        const name = document.createElement('span');
        name.className = 'personal-board__contract-name';
        name.textContent = def?.name || cardId;
        item.appendChild(name);
        const rewardText = summarizeMarketReward(def?.reward);
        const details = rewardText || def?.description || '';
        if (details) {
          const meta = document.createElement('span');
          meta.className = 'personal-board__contract-meta';
          meta.textContent = details;
          item.appendChild(meta);
        }
        const costBreakdown = createContractCostBreakdown(def?.cost, amenagementStock);
        if (costBreakdown) item.appendChild(costBreakdown);
        const buildStatus = evaluateContractBuildAvailability(activePlayer, record, def, amenagementStock);
        const actions = document.createElement('div');
        actions.className = 'personal-board__contract-actions';
        const buildBtn = document.createElement('button');
        buildBtn.type = 'button';
        buildBtn.className = 'personal-board__contract-build';
        buildBtn.textContent = 'Construire';
        buildBtn.disabled = !buildStatus.canBuild;
        buildBtn.title = buildStatus.canBuild
          ? 'Construire ce bâtiment'
          : buildStatus.reason || 'Conditions non remplies';
        if (buildStatus.canBuild) {
          buildBtn.addEventListener('click', () => attemptBuildFromContract(cardId));
        }
        actions.appendChild(buildBtn);
        item.appendChild(actions);
        contractsList.appendChild(item);
      });
      if (elements.contractsEmpty) elements.contractsEmpty.hidden = true;
    } else if (elements.contractsEmpty) {
      elements.contractsEmpty.textContent = 'Aucun contrat conclu.';
      elements.contractsEmpty.hidden = false;
    }
  }
}

function adjustPlayerResourceStock(player, resourceType, delta) {
  if (!isValidPlayer(player) || !resourceType || !Number.isFinite(delta) || delta === 0) return;
  const idx = playerIndex(player);
  const record = playerResources[idx];
  if (!record || !record.stock || !(resourceType in record.stock)) return;
  const current = record.stock[resourceType] || 0;
  const next = current + delta;
  record.stock[resourceType] = next >= 0 ? next : 0;
}

function adjustPlayerCrowns(player, delta) {
  if (!isValidPlayer(player) || !Number.isFinite(delta) || delta === 0) return;
  const idx = playerIndex(player);
  const record = playerResources[idx];
  if (!record) return;
  const current = record.crowns || 0;
  const next = current + delta;
  record.crowns = next >= 0 ? next : 0;
}

function colonColorForIndex(idx) {
  return PLAYER_COLON_COLORS[idx % PLAYER_COLON_COLORS.length];
}

function colorWithAlpha(hex, alpha = 0.2) {
  if (typeof hex !== 'string') return `rgba(0,0,0,${alpha})`;
  const value = hex.startsWith('#') ? hex.slice(1) : hex;
  if (value.length !== 6) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  if (![r, g, b].every((n) => Number.isFinite(n))) return `rgba(0,0,0,${alpha})`;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getBoardSvg() {
  return document.querySelector('#board-container svg');
}

function hexDistanceBetween(idxA, idxB) {
  if (idxA === idxB) return 0;
  const tileA = tiles[idxA];
  const tileB = tiles[idxB];
  if (!tileA || !tileB) return Infinity;
  const dq = tileA.q - tileB.q;
  const dr = tileA.r - tileB.r;
  const ds = tileA.s - tileB.s;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(ds)) / 2;
}

function hexDistanceBetweenCached(idxA, idxB) {
  const a = Math.min(idxA, idxB);
  const b = Math.max(idxA, idxB);
  const key = `${a},${b}`;
  const cached = influenceMap.get(key);
  if (cached !== undefined) return cached;
  const dist = hexDistanceBetween(a, b);
  influenceMap.set(key, dist);
  return dist;
}

function handleColonMarkerClick(event) {
  event.stopPropagation();
  const marker = event.currentTarget;
  const player = Number(marker.dataset.player);
  if (!isValidPlayer(player)) return;
  if (player !== turnState.activePlayer) {
    setActivePlayer(player);
  }
  const idx = playerIndex(player);
  if (idx === -1) return;

  const svg = getBoardSvg();
  const svgState = svg?.__state ?? null;
  if (svgState?.selectedPalette >= 0) {
    svgState.setSelectedPalette?.(-1);
  }

  if (colonMoveRemaining[idx] <= 0) {
    selectedColonPlayer = null;
    updateColonMarkersPositions();
    return;
  }

  selectedColonPlayer = selectedColonPlayer === player ? null : player;
  updateColonMarkersPositions();
}

function renderColonMarkers() {
  const svg = getBoardSvg();
  const layer = svg?.__colonsLayer ?? null;
  if (!layer || !svg?.__state) return;
  layer.innerHTML = '';
  colonMarkers = new Map();
  const { size } = svg.__state;
  const radius = size * 0.3;
  PLAYER_IDS.forEach((player) => {
    const idx = playerIndex(player);
    if (idx === -1) return;
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'colon-marker');
    g.dataset.player = String(player);
    g.style.pointerEvents = 'auto';
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('class', 'colon-marker-circle');
    circle.setAttribute('r', radius.toFixed(3));
    circle.setAttribute('fill', colonColorForIndex(idx));
    circle.setAttribute('stroke', '#ffffff');
    circle.setAttribute('stroke-width', (size * 0.06).toFixed(3));
    g.appendChild(circle);
    g.addEventListener('click', handleColonMarkerClick);
    layer.appendChild(g);
    colonMarkers.set(player, g);
  });
  updateColonMarkersPositions();
}

function updateColonMarkersPositions() {
  const svg = getBoardSvg();
  if (!svg?.__state) return;
  const { size } = svg.__state;
  const offsets = new Map();
  const occupancy = new Map();
  colonPositions.forEach((tileIdx, idx) => {
    if (!Number.isInteger(tileIdx)) return;
    const player = PLAYER_IDS[idx];
    const arr = occupancy.get(tileIdx) ?? [];
    arr.push(player);
    occupancy.set(tileIdx, arr);
  });
  occupancy.forEach((playersOnTile) => {
    playersOnTile.sort((a, b) => a - b);
    const count = playersOnTile.length;
    const radius = count === 1 ? 0 : size * 0.45;
    const angleOffset = count === 1 ? 0 : -Math.PI / 2;
    playersOnTile.forEach((player, index) => {
      const angle = count === 1
        ? 0
        : angleOffset + (2 * Math.PI * index) / count;
      offsets.set(player, {
        dx: radius * Math.cos(angle),
        dy: radius * Math.sin(angle),
      });
    });
  });
  colonMarkers.forEach((marker, player) => {
    const idx = playerIndex(player);
    if (idx === -1) {
      marker.style.display = 'none';
      return;
    }
    const tileIdx = colonPositions[idx];
    const tile = tiles[tileIdx];
    if (!tile) {
      marker.style.display = 'none';
      return;
    }
    const { x, y } = axialToPixel(tile.q, tile.r, size);
    const offset = offsets.get(player) ?? { dx: 0, dy: 0 };
    marker.setAttribute('transform', `translate(${(x + offset.dx).toFixed(3)} ${(y + offset.dy).toFixed(3)})`);
    marker.style.display = 'block';
    marker.classList.toggle('colon-marker--active', player === turnState.activePlayer);
    marker.classList.toggle('colon-marker--selected', player === selectedColonPlayer);
    const remaining = colonMoveRemaining[idx] ?? 0;
    marker.classList.toggle('colon-marker--exhausted', remaining <= 0);
  });
}

function clearColonSelection() {
  selectedColonPlayer = null;
  updateColonMarkersPositions();
}

function attemptColonMoveTo(tileIdx) {
  if (!isValidPlayer(selectedColonPlayer)) return false;
  const player = selectedColonPlayer;
  if (player !== turnState.activePlayer) {
    clearColonSelection();
    return true;
  }
  const pIdx = playerIndex(player);
  if (pIdx === -1) {
    clearColonSelection();
    return true;
  }
  if (colonMoveRemaining[pIdx] <= 0) {
    clearColonSelection();
    return true;
  }
  const currentIdx = colonPositions[pIdx];
  const distance = hexDistanceBetween(currentIdx, tileIdx);
  if (
    !Number.isFinite(distance)
    || distance > gameSettings.colonStepsPerTurn
    || distance > colonMoveRemaining[pIdx]
  ) {
    return true;
  }
  if (distance === 0) {
    clearColonSelection();
    return true;
  }
  colonPositions[pIdx] = tileIdx;
  colonMoveRemaining[pIdx] = Math.max(0, colonMoveRemaining[pIdx] - distance);
  clearColonSelection();
  updateColonMarkersPositions();
  renderGameHud();
  return true;
}

let scorecardIconSeq = 0;

function buildScorecardShapeElement(player, svgNS) {
  switch (player) {
    case 1: {
      const circle = document.createElementNS(svgNS, 'circle');
      circle.setAttribute('cx', '24');
      circle.setAttribute('cy', '24');
      circle.setAttribute('r', '20');
      return circle;
    }
    case 2: {
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', 'M18 6h12v12h12v12H30v12H18V30H6V18h12z');
      return path;
    }
    case 3: {
      const polygon = document.createElementNS(svgNS, 'polygon');
      polygon.setAttribute('points', '24,6 42,39 6,39');
      return polygon;
    }
    case 4: {
      const rect = document.createElementNS(svgNS, 'rect');
      rect.setAttribute('x', '10');
      rect.setAttribute('y', '10');
      rect.setAttribute('width', '28');
      rect.setAttribute('height', '28');
      rect.setAttribute('rx', '4');
      return rect;
    }
    case 5: {
      const polygon = document.createElementNS(svgNS, 'polygon');
      polygon.setAttribute('points', '24,6 41,18 35,38 13,38 7,18');
      return polygon;
    }
    case 6: {
      const polygon = document.createElementNS(svgNS, 'polygon');
      polygon.setAttribute('points', '24,5 39,13 39,31 24,39 9,31 9,13');
      return polygon;
    }
    default:
      return null;
  }
}

function createScorecardIcon(player) {
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', '0 0 48 48');
  svg.setAttribute('class', 'scorecard-svg');
  const defs = document.createElementNS(svgNS, 'defs');
  const shapeId = `scorecard-shape-${player}-${++scorecardIconSeq}`;
  const clipId = `${shapeId}-clip`;
  const shapeEl = buildScorecardShapeElement(player, svgNS);
  if (!shapeEl) return svg;
  shapeEl.setAttribute('id', shapeId);
  defs.appendChild(shapeEl);
  const clip = document.createElementNS(svgNS, 'clipPath');
  clip.setAttribute('id', clipId);
  const clipUse = document.createElementNS(svgNS, 'use');
  clipUse.setAttribute('href', `#${shapeId}`);
  clipUse.setAttributeNS('http://www.w3.org/1999/xlink', 'href', `#${shapeId}`);
  clip.appendChild(clipUse);
  defs.appendChild(clip);
  svg.appendChild(defs);
  const base = document.createElementNS(svgNS, 'use');
  base.setAttribute('href', `#${shapeId}`);
  base.setAttributeNS('http://www.w3.org/1999/xlink', 'href', `#${shapeId}`);
  base.setAttribute('class', 'scorecard-shape');
  svg.appendChild(base);
  const crestHref = PLAYER_CRESTS[player];
  if (crestHref) {
    const image = document.createElementNS(svgNS, 'image');
    image.setAttribute('href', crestHref);
    image.setAttributeNS('http://www.w3.org/1999/xlink', 'href', crestHref);
    image.setAttribute('x', '10');
    image.setAttribute('y', '10');
    image.setAttribute('width', '28');
    image.setAttribute('height', '28');
    image.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    image.setAttribute('clip-path', `url(#${clipId})`);
    image.setAttribute('class', 'scorecard-crest');
    svg.appendChild(image);
  }
  return svg;
}

function parseHexColor(value) {
  if (typeof value !== 'string') return null;
  const hex = value.trim().replace(/^#/, '');
  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    if ([r, g, b].some(Number.isNaN)) return null;
    return { r, g, b };
  }
  if (hex.length === 6) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    if ([r, g, b].some(Number.isNaN)) return null;
    return { r, g, b };
  }
  return null;
}

function blendWithWhite(rgb, factor = 0.65) {
  if (!rgb) return '#ded6c8';
  const clamp = (value) => Math.max(0, Math.min(255, Math.round(value)));
  const mix = (component) => clamp(component * (1 - factor) + 255 * factor);
  const r = mix(rgb.r);
  const g = mix(rgb.g);
  const b = mix(rgb.b);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function idealTextColor(rgb) {
  if (!rgb) return '#2b2418';
  const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
  return luminance > 0.6 ? '#2b2418' : '#ffffff';
}

function colorLabelForIndex(idx) {
  const fallback = AMENAGEMENT_RESOURCE_LABELS[idx] || DEFAULT_COLOR_LABELS[idx] || `C${idx + 1}`;
  const percentInput = document.getElementById(`pct-c${idx + 1}`);
  if (!percentInput) return fallback;
  const parent = percentInput.parentElement;
  const label = parent?.getAttribute('title')?.trim();
  if (!label || /^couleur\s*\d*/i.test(label)) {
    parent?.setAttribute?.('title', fallback);
    return fallback;
  }
  return label;
}

let cachedColorValues = ['', '', '', ''];
let cachedParsedColors = [null, null, null, null];

function updateColorPercentageStyles() {
  let colorsChanged = false;
  
  for (let idx = 1; idx <= 4; idx++) {
    const percentInput = document.getElementById(`pct-c${idx}`);
    if (!percentInput) continue;
    
    const cacheIdx = idx - 1;
    const currentValue = activeColors[cacheIdx] || DEFAULT_COLOR_HEX[cacheIdx];
    
    let rgb;
    if (cachedColorValues[cacheIdx] === currentValue) {
      rgb = cachedParsedColors[cacheIdx];
    } else {
      rgb = parseHexColor(currentValue);
      cachedColorValues[cacheIdx] = currentValue;
      cachedParsedColors[cacheIdx] = rgb;
      colorsChanged = true;
    }
    
    if (!rgb) {
      percentInput.style.backgroundColor = '';
      percentInput.style.borderColor = '';
      percentInput.style.color = '';
      continue;
    }
    percentInput.style.backgroundColor = blendWithWhite(rgb, 0.55);
    percentInput.style.borderColor = currentValue;
    percentInput.style.color = idealTextColor(rgb);
  }
  
  if (colorsChanged) {
    renderGameHud();
  }
}

function sanitizeHexColor(value, fallback) {
  const hex = (value ?? '').toString().trim();
  if (/^#?[0-9a-fA-F]{6}$/.test(hex)) {
    return hex.startsWith('#') ? hex : `#${hex}`;
  }
  return fallback;
}

function setActiveColors(list) {
  const next = DEFAULT_COLOR_HEX.map((fallback, idx) =>
    sanitizeHexColor(Array.isArray(list) ? list[idx] : null, fallback),
  );
  const changed = next.some((color, idx) => color !== activeColors[idx]);
  activeColors = next;
  if (typeof window !== 'undefined') {
    window.__pairleroyActiveColors = next.slice();
  }
  if (changed) {
    cachedColorValues = ['', '', '', ''];
    cachedParsedColors = [null, null, null, null];
    updateColorPercentageStyles();
  }
}

function registerAmenagementForPlayer(player, key, colorIdx) {
  if (!isValidPlayer(player) || typeof key !== 'string') return;
  const idx = playerIndex(player);
  const record = playerResources[idx];
  if (!record) return;
  if (!record.amenagements.has(key)) {
    record.amenagements.add(key);
    if (Number.isInteger(colorIdx) && colorIdx >= 0) adjustResourceColorTally(player, colorIdx, 1);
  }
  amenagementColorByKey.set(key, colorIdx);
  renderGameHud();
}

function unregisterAmenagementForPlayer(player, key, colorIdx = null) {
  if (!isValidPlayer(player) || typeof key !== 'string') return;
  const idx = playerIndex(player);
  const record = playerResources[idx];
  if (!record) return;
  if (record.amenagements.delete(key)) {
    const storedColor = amenagementColorByKey.get(key);
    const targetColor = Number.isInteger(colorIdx) ? colorIdx : storedColor;
    if (Number.isInteger(targetColor) && targetColor >= 0) adjustResourceColorTally(player, targetColor, -1);
  }
  amenagementColorByKey.delete(key);
  renderGameHud();
}

function amenagementCostValue() {
  const value = Number.isFinite(gameSettings.amenagementCost)
    ? gameSettings.amenagementCost
    : DEFAULT_GAME_SETTINGS.amenagementCost;
  return Math.max(0, value);
}

function chargeAmenagementPlacement(player) {
  const cost = amenagementCostValue();
  if (cost <= 0) return true;
  return spendPoints(player, cost, 'amenagement');
}

function registerBuildingForPlayer(player, cardId, { applyReward = true } = {}) {
  if (!isValidPlayer(player) || !cardId) return;
  const idx = playerIndex(player);
  const record = playerResources[idx];
  if (!record) return;
  record.buildings.add(cardId);
  if (applyReward) {
    const def = getMarketCardDefinition(cardId);
    if (def?.reward) applyMarketReward(player, record, def.reward, 'build:' + cardId);
  }
  renderGameHud();
}

function registerContractForPlayer(player, cardId) {
  if (!isValidPlayer(player) || !cardId) return;
  const idx = playerIndex(player);
  const record = playerResources[idx];
  if (!record) return;
  record.contracts.add(cardId);
  renderGameHud();
}

function resetGameDataForNewBoard() {
  playerScores = Array.from({ length: PLAYER_COUNT }, () => 0);
  playerResources = Array.from({ length: PLAYER_COUNT }, () => createEmptyPlayerResource());
  marketState = createInitialMarketState();
  seedMarketSlotsFromDeck(marketState);
  hoveredMarketSlot = null;
  influenceMap.clear();
  resetTurnCounters();
  turnState.turnNumber = 1;
  turnState.activePlayer = PLAYER_IDS[0];
  amenagementColorByKey.clear();
  const svg = getBoardSvg();
  const castleMap = svg?.__state?.castleByJunction ?? null;
  const outpostMap = svg?.__state?.outpostByJunction ?? null;
  if (castleMap) {
    castleMap.clear();
    svg?.__state?.renderCastleOverlays?.();
  }
  if (outpostMap) {
    outpostMap.clear();
    svg?.__state?.renderOutpostOverlays?.();
  }
  svg?.__state?.renderInfluenceZones?.();
  colonPositions = Array.from({ length: PLAYER_COUNT }, () => DEFAULT_CENTER_TILE_INDEX);
  colonMoveRemaining = Array.from({ length: PLAYER_COUNT }, () => gameSettings.colonStepsPerTurn);
  colonPlacementUsed = Array.from({ length: PLAYER_COUNT }, () => false);
  selectedColonPlayer = null;
  updateColonMarkersPositions();
  renderGameHud();
  updateMarketDetailPanel(null);
}

function setActivePlayer(player, { advanceTurn = false } = {}) {
  if (!isValidPlayer(player)) return;
  if (turnState.activePlayer === player && !advanceTurn) {
    renderGameHud();
    return;
  }
  turnState.activePlayer = player;
  selectedColonPlayer = null;
  updateColonMarkersPositions();
  renderGameHud();
}

function endCurrentTurn({ reason = 'auto' } = {}) {
  const currentIdx = playerIndex(turnState.activePlayer);
  if (currentIdx === -1) return;
  turnState.tilesPlacedByPlayer[currentIdx] = 0;
  const nextIdx = (currentIdx + 1) % PLAYER_COUNT;
  if (nextIdx === 0) turnState.turnNumber += 1;
  turnState.activePlayer = PLAYER_IDS[nextIdx];
  colonMoveRemaining[currentIdx] = gameSettings.colonStepsPerTurn;
  colonPlacementUsed[currentIdx] = false;
  colonMoveRemaining[nextIdx] = gameSettings.colonStepsPerTurn;
  colonPlacementUsed[nextIdx] = false;
  selectedColonPlayer = null;
  updateColonMarkersPositions();
  renderGameHud();
  debugLog('endCurrentTurn', { reason, activePlayer: turnState.activePlayer, turn: turnState.turnNumber });
}

function renderScoreboard(target) {
  if (!target) return;
  target.innerHTML = '';
  PLAYER_IDS.forEach((player) => {
    const idx = playerIndex(player);
    const scoreValue = playerScores[idx] || 0;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'scorecard';
    card.dataset.player = String(player);
    const isActive = player === turnState.activePlayer;
    const labelText = `Joueur ${player} - ${scoreValue} points${isActive ? ' (actif)' : ''}`;
    card.title = labelText;
    card.setAttribute('aria-label', labelText);
    card.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    card.classList.toggle('scorecard--active', isActive);
    card.addEventListener('click', () => {
      if (player !== turnState.activePlayer) setActivePlayer(player);
    });

    const crestSvg = createScorecardIcon(player);
    card.appendChild(crestSvg);

    const scoreNode = document.createElement('span');
    scoreNode.className = 'scorecard-score';
    scoreNode.textContent = String(scoreValue);
    card.appendChild(scoreNode);

    target.appendChild(card);
  });
}

function renderGameHud() {
  ensureHudElements();
  const { scoreboard, collapsedScoreboard, turnIndicator } = hudElements;
  renderScoreboard(scoreboard);
  renderScoreboard(collapsedScoreboard);
  renderPersonalBoard();
  if (turnIndicator) {
    turnIndicator.textContent = `Tour ${turnState.turnNumber} - Joueur ${turnState.activePlayer}`;
  }
  const svg = document.querySelector('#board-container svg');
  if (svg?.__state?.updateSquareIndicator) {
    const activePlayer = turnState.activePlayer;
    const activeIdx = playerIndex(activePlayer);
    const scoreValue = activeIdx !== -1 ? playerScores[activeIdx] || 0 : 0;
    svg.__state.updateSquareIndicator(activePlayer, scoreValue);
    svg.__state.updateSquarePlayers?.();
  }
  updateColonMarkersPositions();
  if (svg?.__state?.renderCastleOverlays) svg.__state.renderCastleOverlays();
  renderMarketDisplay();
}

function renderMarketDisplay() {
  const svg = getBoardSvg();
  const state = svg?.__state ?? null;
  const cardsLayer = state?.marketCardsLayer ?? null;
  const cells = state?.marketCells ?? null;
  if (!cardsLayer || !Array.isArray(cells)) return;
  ensureMarketRegionMonitor();
  const marketLayer = state?.marketLayer ?? null;
  if (marketLayer && !marketLayer.__pairleroyHoverBound) {
    marketLayer.__pairleroyHoverBound = true;
    marketLayer.addEventListener('pointerenter', (event) => {
      marketPointerInside = true;
      marketRectSnapshot = getMarketBounds();
      if (event && typeof event.clientX === 'number' && typeof event.clientY === 'number') {
        updatePointerState(event.clientX, event.clientY);
      }
    });
    marketLayer.addEventListener('pointerleave', (event) => {
      marketPointerInside = false;
      if (event && typeof event.clientX === 'number' && typeof event.clientY === 'number') {
        updatePointerState(event.clientX, event.clientY);
      } else if (!marketDetailsCollapsed && hoveredMarketSlot == null) {
        setMarketDetailsCollapsed(true);
      }
    });
  }
  if (cardsLayer && !cardsLayer.__pairleroyHoverBound) {
    cardsLayer.__pairleroyHoverBound = true;
  }
  ensureMarketDetailElements();
  cardsLayer.innerHTML = '';
  const costYOffset = -0.12;
  const rewardYOffset = 0.22;
  const summaryLineGap = 0.22;
  const svgNS = 'http://www.w3.org/2000/svg';

  cells.forEach((cell, idx) => {
    const slotElement = cell?.slotElement ?? null;
    const slotState = marketState?.slots?.[idx] ?? null;
    const def = slotState ? getMarketCardDefinition(slotState.id) : null;
    const hasCard = Boolean(def);
    const group = document.createElementNS(svgNS, 'g');
    group.setAttribute('class', 'market-card');
    if (hoveredMarketSlot === idx) group.classList.add('market-card--active');
    if (!hasCard) group.classList.add('market-card--empty');
    group.dataset.slot = String(idx);
    group.setAttribute('transform', `translate(${cell.centerX.toFixed(3)} ${cell.centerY.toFixed(3)})`);
    group.setAttribute('tabindex', hasCard ? '0' : '-1');

    const costLines = hasCard
      ? [formatMarketCostSummary(def.cost)]
      : ['Libre'];

    const cost = createMultilineSvgText({
      svgNS,
      className: 'market-card__cost',
      lines: costLines,
      startOffset: costYOffset,
      lineGap: summaryLineGap,
      cellSize: cell.size,
    });
    group.appendChild(cost);

    const rewardLines = hasCard ? [formatMarketRewardSummary(def.reward)] : [];
    if (rewardLines.length) {
      const reward = createMultilineSvgText({
        svgNS,
        className: 'market-card__reward',
        lines: rewardLines,
        startOffset: rewardYOffset,
        lineGap: summaryLineGap,
        cellSize: cell.size,
      });
      group.appendChild(reward);
    }

    if (slotElement) {
      slotElement.__pairleroyCardGroup = group;
      if (!slotElement.__pairleroyBound) {
        slotElement.__pairleroyBound = true;
        const activateSlot = (event, { lockSelection = false } = {}) => {
          if (event) {
            if (event.type === 'keydown') {
              const key = event.key;
              if (key !== 'Enter' && key !== ' ') return;
              event.preventDefault();
            } else {
              if (typeof event.button === 'number' && event.button !== 0) return;
              event.preventDefault?.();
            }
            event.stopPropagation?.();
          }
          const slotIdx = Number(slotElement.dataset.slot ?? idx);
          const targetGroup = slotElement.__pairleroyCardGroup;
          if (!Number.isInteger(slotIdx) || slotIdx < 0 || !targetGroup) return;
          if (lockSelection && lockedMarketSlot === slotIdx && !marketDetailsCollapsed) {
            lockedMarketSlot = null;
            setMarketDetailsCollapsed(true);
            return;
          }
          setHoveredMarketSlot(slotIdx, targetGroup, { viaPointer: true, lockSelection });
        };
        slotElement.__pairleroyActivateSlot = activateSlot;
        slotElement.addEventListener('click', (event) => activateSlot(event, { lockSelection: true }));
        slotElement.addEventListener('pointerup', (event) => {
          if (event?.pointerType && event.pointerType !== 'mouse') {
            activateSlot(event, { lockSelection: true });
          }
        });
        slotElement.addEventListener('pointerleave', () => {
          if (lockedMarketSlot === idx) return;
          if (hoveredMarketSlot === idx) resetHoveredMarketSlot();
        });
        slotElement.addEventListener('dblclick', (event) => {
          event?.preventDefault?.();
          event?.stopPropagation?.();
          const slotIdx = Number(slotElement.dataset.slot ?? idx);
          const targetGroup = slotElement.__pairleroyCardGroup;
          if (!Number.isInteger(slotIdx) || slotIdx < 0 || !targetGroup) return;
          setHoveredMarketSlot(slotIdx, targetGroup, { viaPointer: true, lockSelection: true });
          handleMarketCardPurchase({
            currentTarget: targetGroup,
            preventDefault: () => {},
            stopPropagation: () => {},
          });
        });
      }
    }

    if (hasCard) {
      const leaveCard = () => {
        if (lockedMarketSlot === idx) return;
        if (hoveredMarketSlot === idx) resetHoveredMarketSlot();
        else group.classList.remove('market-card--active');
      };
      const lockCard = (event) => {
        if (event) {
          if (event.type === 'keydown') {
            const key = event.key;
            if (key !== 'Enter' && key !== ' ') return;
            event.preventDefault();
          } else {
            if (typeof event.button === 'number' && event.button !== 0) return;
            event.preventDefault?.();
          }
          event.stopPropagation?.();
        }
        const slotIdx = Number(group.dataset.slot ?? idx);
        if (!Number.isInteger(slotIdx) || slotIdx < 0) return;
        if (lockedMarketSlot === slotIdx && !marketDetailsCollapsed) {
          lockedMarketSlot = null;
          setMarketDetailsCollapsed(true);
          return;
        }
        setHoveredMarketSlot(slotIdx, group, { viaPointer: true, lockSelection: true });
      };
      group.addEventListener('focus', () => {
        if (lockedMarketSlot != null && lockedMarketSlot !== idx) return;
        setHoveredMarketSlot(idx, group, { viaPointer: true });
      });
      group.addEventListener('pointerleave', leaveCard);
      group.addEventListener('mouseleave', leaveCard);
      group.addEventListener('blur', leaveCard);
      group.addEventListener('click', lockCard);
      group.addEventListener('keydown', lockCard);
      group.addEventListener('pointerup', (event) => {
        if (event?.pointerType && event.pointerType !== 'mouse') lockCard(event);
      });
      group.addEventListener('dblclick', handleMarketCardPurchase);
    } else {
      group.addEventListener('pointerleave', () => {
        if (hoveredMarketSlot === idx && lockedMarketSlot == null) resetHoveredMarketSlot();
        else group.classList.remove('market-card--active');
      });
    }

    cardsLayer.appendChild(group);
  });
  if (!Number.isInteger(hoveredMarketSlot)) updateMarketDetailPanel(null);
}


function createMultilineSvgText({ svgNS, className, lines, startOffset, lineGap, cellSize }) {
  const textEl = document.createElementNS(svgNS, 'text');
  textEl.setAttribute('class', className);
  textEl.setAttribute('text-anchor', 'middle');
  textEl.setAttribute('dominant-baseline', 'central');
  const normalizeLine = (line) => {
    if (Array.isArray(line)) {
      return line.map((token) => (typeof token === 'object' && token !== null ? token : { text: token }));
    }
    return [{ text: line }];
  };
  const lineHasContent = (line) => {
    if (Array.isArray(line)) {
      return line.some((token) => {
        const value = typeof token === 'object' && token !== null ? token.text : token;
        return String(value ?? '').trim().length > 0;
      });
    }
    return String(line ?? '').trim().length > 0;
  };
  const effectiveLines = Array.isArray(lines)
    ? lines.filter((line) => lineHasContent(line)).map((line) => normalizeLine(line))
    : [];
  if (effectiveLines.length === 0) effectiveLines.push(normalizeLine(''));
  const lineDy = cellSize * lineGap;
  const baseY = cellSize * startOffset;
  let isFirstLine = true;
  effectiveLines.forEach((lineTokens) => {
    lineTokens.forEach((token, tokenIdx) => {
      const span = document.createElementNS(svgNS, 'tspan');
      const isFirstTokenInLine = tokenIdx === 0;
      if (isFirstTokenInLine) {
        span.setAttribute('x', '0');
        if (isFirstLine) {
          span.setAttribute('y', baseY.toFixed(3));
          isFirstLine = false;
        } else {
          span.setAttribute('dy', lineDy.toFixed(3));
        }
      }
      const tokenText = typeof token === 'object' && token !== null ? token.text : token;
      span.textContent = tokenText ?? '';
      const tokenClass =
        typeof token === 'object' && token !== null
          ? token.className || token.class || null
          : null;
      if (tokenClass) span.setAttribute('class', tokenClass);
      textEl.appendChild(span);
    });
  });
  return textEl;
}

function createMarketCardToken(kind, value, { signed = false } = {}) {
  if (!Number.isFinite(value)) return null;
  const baseClass = 'market-card__token';
  const classKey = MARKET_RESOURCE_TOKEN_CLASS_MAP[kind] || MARKET_SPECIAL_TOKEN_CLASS_MAP[kind] || '';
  const className = classKey ? `${baseClass} market-card__token--${classKey}` : baseClass;
  const display = signed && value > 0 ? `+${value}` : String(value);
  return { text: display, className };
}

function applyMarketTokenSpacing(tokens) {
  return tokens.map((token, idx) => {
    const suffix = idx < tokens.length - 1 ? ' ' : '';
    if (typeof token === 'object' && token !== null) {
      return { ...token, text: `${token.text}${suffix}` };
    }
    return `${token}${suffix}`;
  });
}

function formatMarketCostSummary(cost) {
  if (!cost || typeof cost !== 'object') return '--';
  const tokens = [];
  RESOURCE_ORDER.forEach((resource) => {
    const amount = cost[resource];
    if (Number.isFinite(amount) && amount > 0) {
      const token = createMarketCardToken(resource, amount);
      if (token) tokens.push(token);
    }
  });
  if (Number.isFinite(cost.points) && cost.points > 0) {
    const token = createMarketCardToken('points', cost.points);
    if (token) tokens.push(token);
  }
  if (Number.isFinite(cost.crowns) && cost.crowns > 0) {
    const token = createMarketCardToken('crowns', cost.crowns);
    if (token) tokens.push(token);
  }
  return tokens.length ? applyMarketTokenSpacing(tokens) : '--';
}

function formatMarketRewardSummary(reward) {
  if (!reward || typeof reward !== 'object') return '--';
  const tokens = [];
  if (Number.isFinite(reward.points) && reward.points !== 0) {
    const token = createMarketCardToken('points', reward.points, { signed: true });
    if (token) tokens.push(token);
  }
  if (Number.isFinite(reward.crowns) && reward.crowns !== 0) {
    const token = createMarketCardToken('crowns', reward.crowns, { signed: true });
    if (token) tokens.push(token);
  }
  if (Number.isFinite(reward.influence) && reward.influence !== 0) {
    const token = createMarketCardToken('influence', reward.influence, { signed: true });
    if (token) tokens.push(token);
  }
  if (reward.stock && typeof reward.stock === 'object') {
    RESOURCE_ORDER.forEach((resource) => {
      const amount = reward.stock[resource];
      if (Number.isFinite(amount) && amount !== 0) {
        const token = createMarketCardToken(resource, amount, { signed: true });
        if (token) tokens.push(token);
      }
    });
  }
  return tokens.length ? applyMarketTokenSpacing(tokens) : '--';
}

function createContractCostBreakdown(cost, stock) {
  if (!cost || typeof cost !== 'object') return null;
  const rows = [];
  RESOURCE_ORDER.forEach((resource) => {
    const required = Number(cost[resource]);
    if (!Number.isFinite(required) || required <= 0) return;
    const current = Number(stock?.[resource] ?? 0);
    const label = RESOURCE_LABELS[resource] || resource;
    rows.push({ label, current, required });
  });
  if (rows.length === 0) return null;
  const wrapper = document.createElement('div');
  wrapper.className = 'personal-board__contract-costs';
  rows.forEach(({ label, current, required }) => {
    const line = document.createElement('span');
    line.className = 'personal-board__contract-cost';
    if (current >= required) {
      line.classList.add('personal-board__contract-cost--ok');
    } else {
      line.classList.add('personal-board__contract-cost--missing');
    }
    line.textContent = `${label} ${current}/${required}`;
    wrapper.appendChild(line);
  });
  return wrapper;
}

function applyMarketReward(player, record, reward, source = 'reward') {
  if (!reward || typeof reward !== 'object') return;
  if (Number.isFinite(reward.points) && reward.points !== 0) {
    awardPoints(player, reward.points, source);
  }
  if (Number.isFinite(reward.crowns) && reward.crowns !== 0) {
    adjustPlayerCrowns(player, reward.crowns);
  }
  if (reward.stock && typeof reward.stock === 'object') {
    RESOURCE_ORDER.forEach((resource) => {
      const amount = reward.stock[resource];
      if (Number.isFinite(amount) && amount !== 0) {
        adjustPlayerResourceStock(player, resource, amount);
      }
    });
  }
}

function computeAmenagementResourceStock(record) {
  const stock = {
    [RESOURCE_TYPES.WOOD]: 0,
    [RESOURCE_TYPES.BREAD]: 0,
    [RESOURCE_TYPES.FABRIC]: 0,
    [RESOURCE_TYPES.LABOR]: 0,
  };
  if (!record || !(record.amenagementColors instanceof Map)) return stock;
  record.amenagementColors.forEach((amount, colorIdx) => {
    const resourceType = AMENAGEMENT_RESOURCE_TYPES[colorIdx];
    if (!resourceType) return;
    const numeric = Number(amount);
    if (!Number.isFinite(numeric) || numeric <= 0) return;
    stock[resourceType] = (stock[resourceType] || 0) + numeric;
  });
  return stock;
}

function hasEnoughAmenagementResources(cost, stock) {
  if (!cost || typeof cost !== 'object') return true;
  for (const resource of RESOURCE_ORDER) {
    const required = Number(cost[resource]);
    if (!Number.isFinite(required) || required <= 0) continue;
    if ((stock?.[resource] ?? 0) < required) return false;
  }
  return true;
}

function evaluateContractBuildAvailability(player, record, def, providedStock = null) {
  const cost = def?.cost;
  if (!cost) return { canBuild: true, reason: '' };
  const stock = providedStock ?? computeAmenagementResourceStock(record);
  if (!hasEnoughAmenagementResources(cost, stock)) {
    return { canBuild: false, reason: 'Ressources insuffisantes' };
  }
  const pointsRequired = Number(cost.points);
  if (Number.isFinite(pointsRequired) && pointsRequired > 0 && pointsRequired > getPlayerScore(player)) {
    return { canBuild: false, reason: 'Points insuffisants' };
  }
  const crownsRequired = Number(cost.crowns);
  if (Number.isFinite(crownsRequired) && crownsRequired > 0 && crownsRequired > Number(record?.crowns ?? 0)) {
    return { canBuild: false, reason: 'Couronnes insuffisantes' };
  }
  return { canBuild: true, reason: '' };
}

function attemptBuildFromContract(cardId) {
  const player = turnState.activePlayer ?? PLAYER_IDS[0];
  const idx = playerIndex(player);
  if (idx === -1) return;
  const record = playerResources[idx];
  if (!record || !record.contracts || !record.contracts.has(cardId)) return;
  const def = getMarketCardDefinition(cardId);
  if (!def) return;
  const stock = computeAmenagementResourceStock(record);
  const status = evaluateContractBuildAvailability(player, record, def, stock);
  if (!status.canBuild) {
    debugLog('contract-build-blocked', { player, card: cardId, reason: status.reason });
    return;
  }
  const cost = def.cost || {};
  const pointsRequired = Number(cost.points);
  const crownsRequired = Number(cost.crowns);
  if (Number.isFinite(pointsRequired) && pointsRequired > 0 && pointsRequired > getPlayerScore(player)) {
    return;
  }
  if (Number.isFinite(crownsRequired) && crownsRequired > 0 && crownsRequired > Number(record?.crowns ?? 0)) {
    return;
  }
  record.contracts.delete(cardId);
  if (Number.isFinite(pointsRequired) && pointsRequired > 0) {
    if (!spendPoints(player, pointsRequired, `contract-build:${cardId}`)) {
      record.contracts.add(cardId);
      return;
    }
  }
  if (Number.isFinite(crownsRequired) && crownsRequired > 0) {
    adjustPlayerCrowns(player, -crownsRequired);
  }
  registerBuildingForPlayer(player, cardId);
  debugLog('contract-build', { player, card: cardId });
}

function computeMarketDistance(slotIdx, player = turnState.activePlayer) {
  if (!Number.isInteger(slotIdx) || slotIdx < 0) return null;
  if (!isValidPlayer(player)) return null;
  const svg = getBoardSvg();
  const state = svg?.__state ?? null;
  const marketCells = Array.isArray(state?.marketCells) ? state.marketCells : null;
  const track = Array.isArray(state?.squareTrack) ? state.squareTrack : null;
  if (!marketCells || !track || track.length === 0) return null;
  const cell = marketCells[slotIdx] ?? null;
  if (!cell) return null;
  const playerIdx = playerIndex(player);
  if (playerIdx === -1) return null;
  const score = playerScores[playerIdx] || 0;
  const normalized = ((score % track.length) + track.length) % track.length;
  const trackCell = track[normalized] ?? null;
  if (!trackCell) return null;
  const rowA = Number(trackCell.row ?? 0);
  const colA = Number(trackCell.col ?? 0);
  const rowB = Number(cell.row ?? 0);
  const colB = Number(cell.col ?? 0);
  const distance = Math.abs(rowA - rowB) + Math.abs(colA - colB);
  return Number.isFinite(distance) ? distance : null;
}

function handleMarketCardPurchase(event) {
  const target = event.currentTarget;
  const slotIdx = Number(target?.dataset?.slot ?? -1);
  if (!Number.isInteger(slotIdx) || slotIdx < 0) return;
  const slotState = marketState?.slots?.[slotIdx] ?? null;
  if (!slotState) return;
  const def = getMarketCardDefinition(slotState.id);
  if (!def) return;
  const player = turnState.activePlayer;
  if (!isValidPlayer(player)) return;
  const playerIdx = playerIndex(player);
  if (playerIdx === -1) return;
  const record = playerResources[playerIdx];
  if (!record) return;
  if (record.contracts.has(def.id) || record.buildings.has(def.id)) {
    debugLog('market-already-acquired', { player, card: def.id });
    return;
  }
  const distance = computeMarketDistance(slotIdx, player);
  const cost = Number.isFinite(distance) && distance > 0 ? distance : 0;
  if (cost > 0 && !spendPoints(player, cost, 'market-plan')) {
    debugLog('market-insufficient-pv', { player, card: def.id, cost, distance });
    return;
  }
  marketState.slots[slotIdx] = null;
  if (Array.isArray(marketState.discardPile)) marketState.discardPile.push(def.id);
  refillMarketSlot(marketState, slotIdx);
  hoveredMarketSlot = null;
  lockedMarketSlot = null;
  registerContractForPlayer(player, def.id);
  updateMarketDetailPanel(null);
  debugLog('market-claimed', { player, card: def.id, cost, distance });
}

function setHoveredMarketSlot(slotIdx, element = null, options = {}) {
  if (slotIdx != null && (!Number.isInteger(slotIdx) || slotIdx < 0)) return;
  const {
    viaPointer = false,
    lockSelection = false,
    allowWhenLocked = false,
  } = options;
  if (!viaPointer) return;
  if (
    lockedMarketSlot != null
    && slotIdx != null
    && slotIdx !== lockedMarketSlot
    && !lockSelection
    && !allowWhenLocked
  ) {
    return;
  }
  const detailElements = ensureMarketDetailElements();
  marketDetailsVisible = true;
  marketDetailsSuppressed = false;
  if (typeof document !== 'undefined') {
    document.body?.classList.remove('market-details-collapsed');
  }
  if (detailElements?.container) {
    detailElements.container.hidden = false;
    detailElements.container.classList.remove('market-details--hidden');
    detailElements.container.setAttribute('aria-hidden', 'false');
    detailElements.container.removeAttribute('hidden');
    detailElements.container.style.removeProperty('display');
  }
  setMarketDetailVisibility(true);
  if (marketDetailsCollapsed) setMarketDetailsCollapsed(false);
  else applyMarketDetailsVisibility();
  marketPointerInside = true;
  marketRectSnapshot = getMarketBounds();
  hoveredMarketSlot = slotIdx;
  if (lockSelection) lockedMarketSlot = slotIdx;
  const slotState = marketState?.slots?.[slotIdx] ?? null;
  const def = slotState ? getMarketCardDefinition(slotState.id) : null;
  applyMarketCardActiveClass(element);
  if (def) {
    updateMarketDetailPanel(slotIdx);
  } else {
    showMarketDetailsPlaceholder();
  }
}

function resetHoveredMarketSlot(force = false) {
  if (!force) {
    if (hoveredMarketSlot == null) return;
    if (lockedMarketSlot != null) return;
  }
  hoveredMarketSlot = null;
  if (force) lockedMarketSlot = null;
  applyMarketCardActiveClass(null);
  updateMarketDetailPanel(null);
}

function applyMarketCardActiveClass(element) {
  const svg = getBoardSvg();
  const layer = svg?.__state?.marketCardsLayer ?? null;
  if (!layer) return;
  layer.querySelectorAll('.market-card--active').forEach((node) => node.classList.remove('market-card--active'));
  if (element) element.classList.add('market-card--active');
}

function showMarketDetailsPlaceholder() {
  const elements = ensureMarketDetailElements();
  if (!elements.container) return;
  applyMarketCardActiveClass(null);
  setMarketDetailVisibility(true);
  elements.type.textContent = 'Marche';
  elements.slot.textContent = '';
  elements.name.textContent = 'Selectionnez une carte';
  elements.cost.textContent = '--';
  elements.reward.textContent = '--';
  elements.description.textContent = 'Cliquez sur une carte du marche pour afficher les details et double-cliquez pour l\'acquerir.';
  
  // Cacher la section d'édition
  hideMarketEditSection();
}

function updateMarketDetailPanel(slotIdx) {
  const elements = ensureMarketDetailElements();
  if (!elements.container) return;
  if (!Number.isInteger(slotIdx) || slotIdx < 0) {
    showMarketDetailsPlaceholder();
    return;
  }
  const slotState = marketState?.slots?.[slotIdx] ?? null;
  const def = slotState ? getMarketCardDefinition(slotState.id) : null;
  if (!def) {
    showMarketDetailsPlaceholder();
    return;
  }
  setMarketDetailVisibility(true);
  elements.type.textContent = MARKET_TYPE_LABELS[def.type] || 'Plan urbain';
  const distance = computeMarketDistance(slotIdx, turnState.activePlayer);
  const distanceLabel = Number.isFinite(distance) ? ` - Distance ${distance}` : '';
  elements.slot.textContent = 'Case ' + String(slotIdx + 1).padStart(2, '0') + distanceLabel;
  elements.name.textContent = def.name || 'Carte inconnue';
  elements.cost.textContent = summarizeMarketCost(def.cost) || '--';
  elements.reward.textContent = summarizeMarketReward(def.reward) || '--';
  elements.description.textContent = def.description || '--';
  
  // Afficher la section d'édition pour les bâtiments
  showMarketEditSection(slotIdx, def);
}

function showMarketEditSection(slotIdx, def) {
  const editSection = document.getElementById('market-edit-section');
  if (!editSection || !def) return;
  
  // Remplir les champs de base
  document.getElementById('edit-name').value = def.name || '';
  document.getElementById('edit-titre').value = def.description || '';
  
  // Remplir les champs de coût individuels
  const cost = def.cost || {};
  document.getElementById('edit-cost-wood').value = cost.wood || 0;
  document.getElementById('edit-cost-bread').value = cost.bread || 0;
  document.getElementById('edit-cost-fabric').value = cost.fabric || 0;
  document.getElementById('edit-cost-labor').value = cost.labor || 0;
  document.getElementById('edit-cost-points').value = cost.points || 0;
  document.getElementById('edit-cost-crowns').value = cost.crowns || 0;
  
  // Remplir les champs de récompense individuels
  const reward = def.reward || {};
  document.getElementById('edit-reward-wood').value = reward.stock?.wood || 0;
  document.getElementById('edit-reward-bread').value = reward.stock?.bread || 0;
  document.getElementById('edit-reward-fabric').value = reward.stock?.fabric || 0;
  document.getElementById('edit-reward-labor').value = reward.stock?.labor || 0;
  document.getElementById('edit-reward-points').value = reward.points || 0;
  document.getElementById('edit-reward-crowns').value = reward.crowns || 0;
  
  // Afficher la section d'édition
  editSection.style.display = 'block';
}

function hideMarketEditSection() {
  const editSection = document.getElementById('market-edit-section');
  if (editSection) {
    editSection.style.display = 'none';
  }
}

function getCostValue(cost) {
  if (!cost) return 0;
  // Extraire le coût principal (premier élément non nul)
  const firstResource = Object.keys(cost)[0];
  return cost[firstResource] || 0;
}

function getRewardValue(reward) {
  if (!reward) return 0;
  // Extraire la récompense principale (premier élément non nul)
  const firstKey = Object.keys(reward)[0];
  return reward[firstKey] || 0;
}

function applyMarketEdits(slotIdx) {
  const elements = ensureMarketDetailElements();
  const slotState = marketState?.slots?.[slotIdx];
  const def = slotState ? getMarketCardDefinition(slotState.id) : null;
  
  if (!def) return;
  
  // Récupérer les nouvelles valeurs de base
  const newName = document.getElementById('edit-name').value;
  const newDescription = document.getElementById('edit-titre').value;
  
  // Construire le nouvel objet de coût
  const newCost = {
    wood: Number(document.getElementById('edit-cost-wood').value) || 0,
    bread: Number(document.getElementById('edit-cost-bread').value) || 0,
    fabric: Number(document.getElementById('edit-cost-fabric').value) || 0,
    labor: Number(document.getElementById('edit-cost-labor').value) || 0,
    points: Number(document.getElementById('edit-cost-points').value) || 0,
    crowns: Number(document.getElementById('edit-cost-crowns').value) || 0
  };
  
  // Construire le nouvel objet de récompense
  const newReward = {
    points: Number(document.getElementById('edit-reward-points').value) || 0,
    crowns: Number(document.getElementById('edit-reward-crowns').value) || 0,
    stock: {
      wood: Number(document.getElementById('edit-reward-wood').value) || 0,
      bread: Number(document.getElementById('edit-reward-bread').value) || 0,
      fabric: Number(document.getElementById('edit-reward-fabric').value) || 0,
      labor: Number(document.getElementById('edit-reward-labor').value) || 0
    }
  };
  
  // Appliquer les modifications
  let changed = false;
  
  if (newName !== def.name) {
    def.name = newName;
    elements.name.textContent = newName;
    changed = true;
  }
  
  if (newDescription !== def.description) {
    def.description = newDescription;
    elements.description.textContent = newDescription;
    changed = true;
  }
  
  // Vérifier si le coût a changé
  const costChanged = Object.keys(newCost).some(key => (def.cost?.[key] || 0) !== newCost[key]);
  if (costChanged) {
    def.cost = newCost;
    elements.cost.textContent = summarizeMarketCost(def.cost) || '--';
    changed = true;
  }
  
  // Vérifier si la récompense a changé
  const rewardChanged = (def.reward?.points || 0) !== newReward.points || 
                        (def.reward?.crowns || 0) !== newReward.crowns ||
                        Object.keys(newReward.stock).some(key => (def.reward?.stock?.[key] || 0) !== newReward.stock[key]);
  if (rewardChanged) {
    def.reward = newReward;
    elements.reward.textContent = summarizeMarketReward(def.reward) || '--';
    changed = true;
  }
  
  // Rafraîchir l'affichage de la carte du marché
  if (changed) {
    renderMarketCards();
  }
  
  // Cacher la section d'édition
  hideMarketEditSection();
}

function summarizeMarketCost(cost) {
  if (!cost) return '';
  const parts = [];
  RESOURCE_ORDER.forEach((resource) => {
    const amount = cost[resource];
    if (Number.isFinite(amount) && amount > 0) {
      parts.push(`${amount} ${RESOURCE_LABELS[resource] || resource}`);
    }
  });
  if (Number.isFinite(cost.points) && cost.points > 0) parts.push(`${cost.points} PV`);
  if (Number.isFinite(cost.crowns) && cost.crowns > 0) parts.push(`${cost.crowns} Couronnes`);
  return parts.join(', ');
}

function summarizeMarketReward(reward) {
  if (!reward || typeof reward !== 'object') return '';
  const parts = [];
  if (Number.isFinite(reward.points) && reward.points !== 0) {
    parts.push(`${reward.points > 0 ? '+' : ''}${reward.points} PV`);
  }
  if (Number.isFinite(reward.crowns) && reward.crowns !== 0) {
    parts.push(`${reward.crowns > 0 ? '+' : ''}${reward.crowns} Couronnes`);
  }
  if (Number.isFinite(reward.influence) && reward.influence !== 0) {
    parts.push(`${reward.influence > 0 ? '+' : ''}${reward.influence} Influence`);
  }
  if (reward.stock && typeof reward.stock === 'object') {
    RESOURCE_ORDER.forEach((resource) => {
      const amount = reward.stock[resource];
      if (Number.isFinite(amount) && amount !== 0) {
        const label = RESOURCE_LABELS[resource] || resource;
        parts.push(`${amount > 0 ? '+' : ''}${amount} ${label}`);
      }
    });
  }
  return parts.join(', ');
}



let gridSideColors = [];
let placements = [];
let emptyTiles = new Set();
let placedCount = 0;
let autoState = { done: false, pendingPalette: null };
let panSuppressClick = false;
let boardInitialized = false;

// Variables de palette et d'interaction
let paletteCombos = [];
let selectedPalette = -1;
let hoveredTileIdx = null;

// Fonction setSelectedPalette accessible globalement
function setSelectedPalette(idx) {
  selectedPalette = idx;
  updateClearButtonState();
  renderPlacementPreview(hoveredTileIdx);
}

function syncArray(target, source) {
  if (!Array.isArray(target) || !Array.isArray(source)) return;
  target.splice(0, target.length, ...source);
}

function readConfig() {
  const mono = Number(document.getElementById('pct-mono').value) || 0;
  const bi = Number(document.getElementById('pct-bi').value) || 0;
  const tri = Number(document.getElementById('pct-tri').value) || 0;
  const c1 = Number(document.getElementById('pct-c1').value) || 0;
  const c2 = Number(document.getElementById('pct-c2').value) || 0;
  const c3 = Number(document.getElementById('pct-c3').value) || 0;
  const c4 = Number(document.getElementById('pct-c4').value) || 0;
  const colors = activeColors.slice();
  return { typesPct: [mono, bi, tri], colorPct: [c1, c2, c3, c4], colors };
}

function assert100(array, label) {
  const sum = array.reduce((a, b) => a + b, 0);
  if (Math.round(sum) !== 100) throw new Error(`${label} doit totaliser 100 (actuellement ${sum})`);
}

function layoutSize(container) {
  const W = container.clientWidth;
  const H = container.clientHeight;
  const hexWidthFactor = Math.sqrt(3) * (2 * RADIUS + 1);
  const hexHeightFactor = 1.5 * (2 * RADIUS) + 2;
  const squareWidthFactor = SQUARE_CELL_FACTOR * (SQUARE_GRID_COLS + (SQUARE_GRID_COLS - 1) * SQUARE_GAP_FACTOR);
  const squareHeightFactor = SQUARE_CELL_FACTOR * (SQUARE_GRID_ROWS + (SQUARE_GRID_ROWS - 1) * SQUARE_GAP_FACTOR);
  const totalWidthFactor = hexWidthFactor + SQUARE_MARGIN_FACTOR + squareWidthFactor;
  const totalHeightFactor = Math.max(hexHeightFactor, squareHeightFactor);
  const sizeByW = W / totalWidthFactor;
  const sizeByH = H / totalHeightFactor;
  const base = Math.min(sizeByW, sizeByH);
  const sizeRaw = Math.floor(base) - 2;
  const size = Math.max(12, Number.isFinite(sizeRaw) ? sizeRaw : 12);
  const hexWidth = hexWidthFactor * size;
  const hexHeight = hexHeightFactor * size;
  const squareWidth = squareWidthFactor * size;
  const squareHeight = squareHeightFactor * size;
  const width = hexWidth + size * SQUARE_MARGIN_FACTOR + squareWidth;
  const height = Math.max(hexHeight, squareHeight);
  return { width, height, size };
}

function currentPlayer() {
  return turnState.activePlayer;
}

function serializeConfigToURL(cfg) {
  const u = new URL(window.location.href);
  const p = [...cfg.typesPct, ...cfg.colorPct].join(',');
  u.searchParams.set('pct', p);
  const col = cfg.colors.join(',');
  u.searchParams.set('col', col);
  history.replaceState(null, '', u.toString());
}

function parseConfigFromURL() {
  const u = new URL(window.location.href);
  const pctStr = u.searchParams.get('pct');
  const colStr = u.searchParams.get('col');
  if (pctStr) {
    const nums = pctStr.split(',').map(Number);
    if (nums.length === 7) {
      const [mono, bi, tri, c1, c2, c3, c4] = nums;
      document.getElementById('pct-mono').value = String(mono);
      document.getElementById('pct-bi').value = String(bi);
      document.getElementById('pct-tri').value = String(tri);
      document.getElementById('pct-c1').value = String(c1);
      document.getElementById('pct-c2').value = String(c2);
      document.getElementById('pct-c3').value = String(c3);
      document.getElementById('pct-c4').value = String(c4);
    }
  }
  if (colStr) {
    const cols = colStr.split(',');
    if (cols.length === 4) setActiveColors(cols);
  }
  updateColorPercentageStyles();
}

function isJunctionReady(entry) {
  if (!entry) return false;
  const contributing = new Set();
  if (Array.isArray(entry.entries)) {
    for (const info of entry.entries) {
      if (placements[info.tileIdx]) contributing.add(info.tileIdx);
    }
  }
  if (contributing.size >= 3) return true;
  if (Array.isArray(entry.tiles)) {
    let count = 0;
    for (const idx of entry.tiles) if (placements[idx]) count++;
    if (count >= 3) return true;
  }
  return false;
}

function generateAndRender() {
  const boardContainer = document.getElementById('board-container');
  const surface = document.getElementById('board-surface') || boardContainer;
  if (!surface) return;

  const cfg = readConfig();
  assert100(cfg.typesPct, 'Types de tuiles');
  assert100(cfg.colorPct, 'R\u00e9partition des couleurs');
  const colors = cfg.colors.slice();
  const typesPct = cfg.typesPct.slice();
  const colorPct = cfg.colorPct.slice();
  window.__pairleroyActiveColors = colors;
  debugLog('generateAndRender start', { typesPct, colorPct, colors });
  updateColorPercentageStyles();
  renderGameHud();

  if (boardInitialized) {
    const svg = surface.querySelector('svg');
    const state = svg?.__state ?? null;
    if (!state) {
      boardInitialized = false;
      return generateAndRender();
    }
    syncArray(state.colors, colors);
    syncArray(state.typesPct, typesPct);
    syncArray(state.colorPct, colorPct);
    state.regenPalette?.();
    if (Array.isArray(placements)) {
      placements.forEach((placement, idx) => {
        if (!placement) {
          gridSideColors[idx] = null;
          return;
        }
        const mapped = mapSideColorIndices(placement.sideColors, state.colors);
        gridSideColors[idx] = mapped;
        placement.colors = mapped.slice();
        renderTileFill(idx, placement.sideColors, svg, state.tiles, state.size, state.colors);
      });
    }
    state.renderJunctionOverlays?.();
    state.renderCastleOverlays?.();
    state.renderOutpostOverlays?.();
    updateClearButtonState();
    updateColonMarkersPositions();
    serializeConfigToURL(cfg);
    refreshStatsModal();
    return svg;
  }

  surface.innerHTML = '';
  const rng = xorshift32(cryptoSeed());

  const { width, height, size } = layoutSize(surface);
  const svg = buildSVG({ width, height, size, tiles, combos: null, colors });
  surface.appendChild(svg);
  resetGameDataForNewBoard();

  const junctionMap = computeJunctionMap(tiles, size);
  const overlayByJunction = new Map();
  const castleByJunction = new Map();
  const outpostByJunction = new Map();
  const squareGridMeta = svg.__squareGrid ?? null;
  const squareCells = Array.isArray(squareGridMeta?.cells) ? squareGridMeta.cells : [];
  const squareTrack = (Array.isArray(squareGridMeta?.track) && squareGridMeta.track.length > 0)
    ? squareGridMeta.track
    : squareCells;
  const squareIndicator = squareGridMeta?.indicator ?? null;
  const squareIndicatorCrest = squareGridMeta?.crest ?? null;
  const squarePlayersLayer = squareGridMeta?.playersLayer ?? null;
  const squareMarketLayer = squareGridMeta?.marketLayer ?? null;
  const squareMarketCardsLayer = squareGridMeta?.marketCardsLayer ?? null;
  const influenceLayer = svg.__influenceLayer ?? null;
  const squareCellSize = squareGridMeta?.cellSize ?? (squareTrack[0]?.size ?? size * SQUARE_CELL_FACTOR);
  const squarePlayerMarkers = squarePlayersLayer ? new Map() : null;
  const squareMarketCells = Array.isArray(squareGridMeta?.marketCells) ? squareGridMeta.marketCells : [];
  if (squarePlayersLayer && squarePlayerMarkers) {
    squarePlayersLayer.innerHTML = '';
    PLAYER_IDS.forEach((player, idx) => {
      const marker = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      marker.setAttribute('class', 'square-player-marker');
      marker.dataset.player = String(player);
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('r', (squareCellSize * 0.18).toFixed(3));
      circle.setAttribute('cx', '0');
      circle.setAttribute('cy', '0');
      circle.setAttribute('fill', colonColorForIndex(idx));
      circle.setAttribute('stroke', '#ffffff');
      circle.setAttribute('stroke-width', (squareCellSize * 0.05).toFixed(3));
      marker.appendChild(circle);
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('class', 'square-player-marker-label');
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('dominant-baseline', 'central');
      label.setAttribute('font-size', (squareCellSize * 0.18).toFixed(3));
      label.textContent = String(player);
      marker.appendChild(label);
      marker.style.display = 'none';
      squarePlayersLayer.appendChild(marker);
      squarePlayerMarkers.set(player, marker);
    });
  }

  function updateSquareIndicator(player, score = 0) {
    if (!squareIndicator || squareTrack.length === 0) {
      if (squareIndicator) squareIndicator.style.display = 'none';
      if (squareIndicatorCrest) {
        squareIndicatorCrest.removeAttribute('href');
        squareIndicatorCrest.removeAttributeNS('http://www.w3.org/1999/xlink', 'href');
      }
      return;
    }
    if (!isValidPlayer(player)) {
      squareIndicator.style.display = 'none';
      if (squareIndicatorCrest) {
        squareIndicatorCrest.removeAttribute('href');
        squareIndicatorCrest.removeAttributeNS('http://www.w3.org/1999/xlink', 'href');
      }
      return;
    }
    const trackLength = squareTrack.length;
    if (trackLength === 0) {
      squareIndicator.style.display = 'none';
      return;
    }
    const normalized = ((score % trackLength) + trackLength) % trackLength;
    const target = squareTrack[normalized];
    if (!target) {
      squareIndicator.style.display = 'none';
      return;
    }
    squareIndicator.setAttribute('transform', `translate(${target.centerX.toFixed(3)} ${target.centerY.toFixed(3)})`);
    squareIndicator.style.display = 'block';
    if (squareIndicatorCrest) {
      const crestHref = PLAYER_CRESTS[player] || '';
      if (crestHref) {
        squareIndicatorCrest.setAttribute('href', crestHref);
        squareIndicatorCrest.setAttributeNS('http://www.w3.org/1999/xlink', 'href', crestHref);
      } else {
        squareIndicatorCrest.removeAttribute('href');
        squareIndicatorCrest.removeAttributeNS('http://www.w3.org/1999/xlink', 'href');
      }
    }
  }

  function updateSquarePlayers() {
    if (!squarePlayersLayer || !squarePlayerMarkers || squareTrack.length === 0) return;
    squarePlayerMarkers.forEach((marker) => {
      marker.style.display = 'none';
      marker.classList.remove('square-player-marker--active');
    });
    const occupancy = new Map();
    PLAYER_IDS.forEach((player) => {
      const idx = playerIndex(player);
      if (idx === -1) return;
      const marker = squarePlayerMarkers.get(player);
      if (!marker) return;
      const trackLength = squareTrack.length;
      if (trackLength === 0) {
        marker.style.display = 'none';
        return;
      }
      const score = playerScores[idx] || 0;
      const normalized = ((score % trackLength) + trackLength) % trackLength;
      const cell = squareTrack[normalized];
      if (!cell) {
        marker.style.display = 'none';
        return;
      }
      const entry = occupancy.get(normalized) ?? { players: [], cell };
      entry.players.push(player);
      occupancy.set(normalized, entry);
    });
    occupancy.forEach(({ players, cell }) => {
      players.sort((a, b) => a - b);
      const count = players.length;
      const radius = count === 1 ? 0 : squareCellSize * 0.32;
      const angleOffset = count === 1 ? 0 : -Math.PI / 2;
      players.forEach((player, index) => {
        const marker = squarePlayerMarkers.get(player);
        if (!marker) return;
        const angle = count === 1 ? 0 : angleOffset + (2 * Math.PI * index) / count;
        const dx = radius * Math.cos(angle);
        const dy = radius * Math.sin(angle);
        marker.setAttribute('transform', `translate(${(cell.centerX + dx).toFixed(3)} ${(cell.centerY + dy).toFixed(3)})`);
        marker.style.display = 'block';
        marker.classList.toggle('square-player-marker--active', player === turnState.activePlayer);
      });
    });
  }

  function dominantColorForJunction(entry) {
    if (!entry) return null;
    const counts = new Map();
    const tilesAround = Array.isArray(entry.tiles) ? entry.tiles : [];
    tilesAround.forEach((tileIdx) => {
      const placement = placements[tileIdx];
      const combo = placement?.combo;
      if (!combo || !Array.isArray(combo.colors) || combo.colors.length === 0) return;
      const primary = combo.colors[0];
      counts.set(primary, (counts.get(primary) || 0) + 1);
    });
    let best = null;
    let bestCount = 0;
    counts.forEach((count, colorIdx) => {
      if (count > bestCount) {
        best = colorIdx;
        bestCount = count;
      }
    });
    return best;
  }

  function dominantPlayerForJunction(entry) {
    if (!entry) return null;
    const counts = new Map();
    const tilesAround = Array.isArray(entry.tiles) ? entry.tiles : [];
    tilesAround.forEach((tileIdx) => {
      const placement = placements[tileIdx];
      const owner = placement?.player;
      if (!isValidPlayer(owner)) return;
      counts.set(owner, (counts.get(owner) || 0) + 1);
    });
    let leader = null;
    let leaderCount = 0;
    let tie = false;
    counts.forEach((count, player) => {
      if (count > leaderCount) {
        leader = player;
        leaderCount = count;
        tie = false;
      } else if (count === leaderCount) {
        tie = true;
      }
    });
    if (tie || leaderCount <= 0) return null;
    return leader;
  }

  const INFLUENCE_DISTANCE_EPSILON = 1e-6;

  function influenceTypePriority(type) {
    if (type === 'castle') return 0;
    if (type === 'outpost') return 1;
    return 2;
  }

  function nearestInfluenceForEntry(player, targetEntry) {
    if (!isValidPlayer(player) || !targetEntry) return null;
    let best = null;
    const consider = (sourceEntry, type) => {
      if (!sourceEntry) return;
      const dist = distanceBetweenJunctionEntries(sourceEntry, targetEntry);
      if (!Number.isFinite(dist)) return;
      if (
        !best
        || dist < best.distance - INFLUENCE_DISTANCE_EPSILON
        || (Math.abs(dist - best.distance) <= INFLUENCE_DISTANCE_EPSILON
          && influenceTypePriority(type) < influenceTypePriority(best.type))
      ) {
        best = { distance: dist, type };
      }
    };
    const castleKey = findCastleKeyForPlayer(player);
    if (castleKey) {
      const castleEntry = junctionMap.get(castleKey);
      consider(castleEntry, 'castle');
    }
    outpostByJunction.forEach((owner, outpostKey) => {
      if (owner !== player) return;
      const outpostEntry = junctionMap.get(outpostKey);
      consider(outpostEntry, 'outpost');
    });
    return best;
  }

  function inferAmenagementOwner(entry, placingPlayer = null) {
    if (!entry) return null;
    const influenceDetails = [];
    PLAYER_IDS.forEach((player) => {
      if (!playerHasInfluenceForEntry(player, entry)) return;
      const nearest = nearestInfluenceForEntry(player, entry);
      if (!nearest) return;
      influenceDetails.push({ player, distance: nearest.distance, type: nearest.type });
    });
    const dominant = dominantPlayerForJunction(entry);
    if (influenceDetails.length === 0) return dominant;
    const sorted = influenceDetails.slice().sort((a, b) => {
      const distA = Number.isFinite(a.distance) ? a.distance : Number.POSITIVE_INFINITY;
      const distB = Number.isFinite(b.distance) ? b.distance : Number.POSITIVE_INFINITY;
      if (Math.abs(distA - distB) > INFLUENCE_DISTANCE_EPSILON) return distA - distB;
      const rankDiff = influenceTypePriority(a.type) - influenceTypePriority(b.type);
      if (rankDiff !== 0) return rankDiff;
      return a.player - b.player;
    });
    const best = sorted[0];
    if (!best) return dominant;
    const bestDistance = best.distance;
    const bestRank = influenceTypePriority(best.type);
    const bestPlayers = sorted
      .filter((detail) => (
        Math.abs(detail.distance - bestDistance) <= INFLUENCE_DISTANCE_EPSILON
        && influenceTypePriority(detail.type) === bestRank
      ))
      .map((detail) => detail.player);
    if (bestPlayers.length === 1) return bestPlayers[0];
    const pickNextCandidate = (startPlayer, pool) => {
      if (!Array.isArray(pool) || pool.length === 0) return null;
      let idx = isValidPlayer(startPlayer) ? playerIndex(startPlayer) : -1;
      if (idx === -1) idx = 0;
      for (let offset = 1; offset <= PLAYER_COUNT; offset++) {
        const candidate = PLAYER_IDS[(idx + offset) % PLAYER_COUNT];
        if (pool.includes(candidate)) return candidate;
      }
      return null;
    };
    const next = pickNextCandidate(placingPlayer, bestPlayers);
    if (isValidPlayer(next)) return next;
    bestPlayers.sort((a, b) => a - b);
    return bestPlayers[0];
  }

  function evaluateAmenagementsAround(tileIdx, options = {}) {
    const allowCreation = options.allowCreation !== false;
    const placingPlayer = options.placingPlayer ?? null;
    if (!Number.isInteger(tileIdx)) return;
    let changed = false;
    for (const [key, entry] of junctionMap.entries()) {
      if (!entry || !Array.isArray(entry.tiles) || !entry.tiles.includes(tileIdx)) continue;
      if (!isJunctionReady(entry)) continue;
      const owner = inferAmenagementOwner(entry, placingPlayer);
      if (!isValidPlayer(owner)) continue;
      if (!playerHasInfluenceForEntry(owner, entry)) continue;
      const currentOwner = overlayByJunction.get(key) ?? null;
      if (currentOwner == null && !allowCreation) continue;
      if (currentOwner === owner) continue;
      const colorIdx = dominantColorForJunction(entry);
      if (currentOwner == null) {
        if (!chargeAmenagementPlacement(owner)) {
          debugLog('amenagement-cost-unpaid', { key, player: owner });
          continue;
        }
      } else if (isValidPlayer(currentOwner) && currentOwner !== owner) {
        const previousColor = amenagementColorByKey.get(key);
        unregisterAmenagementForPlayer(currentOwner, key, previousColor);
      }
      overlayByJunction.set(key, owner);
      registerAmenagementForPlayer(owner, key, colorIdx);
      changed = true;
    }
    if (changed) renderJunctionOverlays();
  }

  function assignAmenagementOwner(key, player) {
    if (!junctionMap.has(key) || !isValidPlayer(player)) return;
    const entry = junctionMap.get(key);
  if (!playerHasInfluenceForEntry(player, entry)) return;
  const previousOwner = overlayByJunction.get(key) ?? null;
  if (previousOwner === player) return;
  const previousColor = amenagementColorByKey.get(key);
  const colorIdx = dominantColorForJunction(entry);
  if (!chargeAmenagementPlacement(player)) {
    debugLog('amenagement-cost-unpaid', { key, player });
    return;
  }
  if (isValidPlayer(previousOwner) && previousOwner !== player) {
    unregisterAmenagementForPlayer(previousOwner, key, previousColor);
  }
  overlayByJunction.set(key, player);
  registerAmenagementForPlayer(player, key, colorIdx);
    renderJunctionOverlays();
  }

  function removeAmenagementOwner(key) {
    const previousOwner = overlayByJunction.get(key);
    if (previousOwner == null) {
      overlayByJunction.delete(key);
      amenagementColorByKey.delete(key);
      return;
    }
    const colorIdx = amenagementColorByKey.get(key);
    overlayByJunction.delete(key);
    unregisterAmenagementForPlayer(previousOwner, key, colorIdx);
    renderJunctionOverlays();
  }

  function findCastleKeyForPlayer(player) {
    for (const [castleKey, owner] of castleByJunction.entries()) {
      if (owner === player) return castleKey;
    }
    return null;
  }

  function getOutpostKeysForPlayer(player) {
    const keys = [];
    outpostByJunction.forEach((owner, outpostKey) => {
      if (owner === player) keys.push(outpostKey);
    });
    return keys;
  }

  function getInfluenceEntriesForPlayer(player) {
    const entries = [];
    const castleKey = findCastleKeyForPlayer(player);
    if (castleKey) {
      const entry = junctionMap.get(castleKey);
      if (entry) entries.push(entry);
    }
    outpostByJunction.forEach((owner, outpostKey) => {
      if (owner !== player) return;
      const entry = junctionMap.get(outpostKey);
      if (entry) entries.push(entry);
    });
    return entries;
  }

  function playerHasInfluenceForEntry(player, targetEntry, maxDistance = gameSettings.influenceRadius) {
    if (!isValidPlayer(player) || !targetEntry) return false;
    const sources = getInfluenceEntriesForPlayer(player);
    if (!Array.isArray(sources) || sources.length === 0) return false;
    const limit = Math.max(
      0,
      Number.isFinite(maxDistance)
        ? maxDistance
        : (Number.isFinite(gameSettings.influenceRadius)
          ? gameSettings.influenceRadius
          : DEFAULT_GAME_SETTINGS.influenceRadius),
    );
    for (let i = 0; i < sources.length; i++) {
      if (distanceBetweenJunctionEntries(sources[i], targetEntry) <= limit) return true;
    }
    return false;
  }

  function cleanupAmenagementsForPlayer(player) {
    if (!isValidPlayer(player)) return;
    const toRemove = [];
    overlayByJunction.forEach((owner, key) => {
      if (owner !== player) return;
      const entry = junctionMap.get(key);
      if (!entry || !playerHasInfluenceForEntry(player, entry)) {
        const colorIdx = amenagementColorByKey.get(key);
        toRemove.push({ key, colorIdx });
      }
    });
    toRemove.forEach(({ key, colorIdx }) => {
      unregisterAmenagementForPlayer(player, key, colorIdx);
      overlayByJunction.delete(key);
    });
  }

  function distanceBetweenJunctionEntries(entryA, entryB) {
    if (!entryA || !entryB) return Infinity;
    const tilesA = Array.isArray(entryA.tiles) ? entryA.tiles : [];
    const tilesB = Array.isArray(entryB.tiles) ? entryB.tiles : [];
    let best = Infinity;
    for (let i = 0; i < tilesA.length; i++) {
      for (let j = 0; j < tilesB.length; j++) {
        const dist = hexDistanceBetweenCached(tilesA[i], tilesB[j]);
        if (Number.isFinite(dist) && dist < best) best = dist;
      }
    }
    return best;
  }

  function isOutpostPlacementValid(player, targetEntry) {
    if (!targetEntry) return false;
    return playerHasInfluenceForEntry(player, targetEntry);
  }

  function isCastlePlacementValid(player, targetEntry) {
    if (!targetEntry) return false;
    if (!gameSettings.requireCastleAdjacencyForCastles) return true;
    const idx = playerIndex(player);
    if (idx === -1) return false;
    const colonTileIdx = colonPositions[idx];
    if (!Number.isInteger(colonTileIdx)) return false;
    const tilesAround = Array.isArray(targetEntry.tiles) ? targetEntry.tiles : [];
    if (tilesAround.length === 0) return false;
    return tilesAround.some((tileIdx) => tileIdx === colonTileIdx);
  }

  function toggleCastleAtJunction(key, player) {
    if (!junctionMap.has(key) || !isValidPlayer(player)) return;
    const entry = junctionMap.get(key);
    if (!isJunctionReady(entry)) return;
    const idx = playerIndex(player);
    if (idx === -1) return;

    const currentCastleOwner = castleByJunction.get(key) ?? null;
    if (currentCastleOwner != null) {
      if (currentCastleOwner !== player) return;
      castleByJunction.delete(key);
      cleanupAmenagementsForPlayer(player);
      renderJunctionOverlays();
      refreshStatsModal();
      return;
    }

    const currentOutpostOwner = outpostByJunction.get(key) ?? null;
    if (currentOutpostOwner != null) {
      if (currentOutpostOwner !== player) return;
      outpostByJunction.delete(key);
      cleanupAmenagementsForPlayer(player);
      renderJunctionOverlays();
      refreshStatsModal();
      return;
    }

    const existingCastleKey = findCastleKeyForPlayer(player);

    if (!existingCastleKey) {
      if (!isCastlePlacementValid(player, entry)) {
        debugLog('castle-adjacency-blocked', { key, player });
        return;
      }
      const castleCost = Math.max(
        0,
        Number.isFinite(gameSettings.castleCost) ? gameSettings.castleCost : DEFAULT_GAME_SETTINGS.castleCost,
      );
      if (castleCost > 0 && !spendPoints(player, castleCost, 'castle')) return;
      castleByJunction.set(key, player);
      const tilesAround = Array.isArray(entry.tiles) ? entry.tiles : [];
      tilesAround.forEach((idxTile) => evaluateAmenagementsAround(idxTile, { allowCreation: false }));
      renderJunctionOverlays();
      refreshStatsModal();
      return;
    }

    if (!isOutpostPlacementValid(player, entry)) {
      debugLog('outpost-placement-invalid', { key, player });
      return;
    }
    const outpostCost = Math.max(
      0,
      Number.isFinite(gameSettings.outpostCost) ? gameSettings.outpostCost : DEFAULT_GAME_SETTINGS.outpostCost,
    );
    if (outpostCost > 0 && !spendPoints(player, outpostCost, 'outpost')) return;
    outpostByJunction.set(key, player);
    const tilesAround = Array.isArray(entry.tiles) ? entry.tiles : [];
    tilesAround.forEach((idxTile) => evaluateAmenagementsAround(idxTile, { allowCreation: false }));
    renderJunctionOverlays();
    refreshStatsModal();
  }

  function renderCastleOverlays() {
    const layer = svg.__castleLayer ?? svg.querySelector('#junction-castles');
    if (!layer) return;
    layer.innerHTML = '';
    const sizeFactor = size * 0.85;
    const crestOffset = -(sizeFactor / 2);
    for (const [key, player] of castleByJunction.entries()) {
      const entry = junctionMap.get(key);
      if (!entry || !isJunctionReady(entry) || !isValidPlayer(player)) {
        castleByJunction.delete(key);
        continue;
      }
      const crestHref = PLAYER_CRESTS[player] || '';
      if (!crestHref) {
        castleByJunction.delete(key);
        continue;
      }
      const marker = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      marker.setAttribute('class', 'castle-marker');
      marker.dataset.key = key;
      marker.dataset.player = String(player);
      marker.setAttribute('transform', `translate(${entry.x.toFixed(3)} ${entry.y.toFixed(3)})`);
      const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
      image.setAttribute('href', crestHref);
      image.setAttributeNS('http://www.w3.org/1999/xlink', 'href', crestHref);
      image.setAttribute('width', sizeFactor.toFixed(3));
      image.setAttribute('height', sizeFactor.toFixed(3));
      image.setAttribute('x', crestOffset.toFixed(3));
      image.setAttribute('y', crestOffset.toFixed(3));
      image.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      marker.appendChild(image);
      marker.addEventListener('dblclick', (event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleCastleAtJunction(key, currentPlayer());
      });
      marker.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        castleByJunction.delete(key);
      cleanupAmenagementsForPlayer(player);
      renderJunctionOverlays();
        refreshStatsModal();
      });
      marker.classList.toggle('castle-marker--active', player === turnState.activePlayer);
      layer.appendChild(marker);
    }
    renderInfluenceZones();
  }

  function renderOutpostOverlays() {
    const layer = svg.__outpostLayer ?? svg.querySelector('#junction-outposts');
    if (!layer) return;
    layer.innerHTML = '';
    const radius = size * 0.32;
    for (const [key, player] of outpostByJunction.entries()) {
      const entry = junctionMap.get(key);
      if (!entry || !isJunctionReady(entry) || !isValidPlayer(player)) {
        outpostByJunction.delete(key);
        continue;
      }
      const pIdx = playerIndex(player);
      if (pIdx === -1) {
        outpostByJunction.delete(key);
        continue;
      }
      const marker = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      marker.setAttribute('class', 'outpost-marker');
      marker.dataset.key = key;
      marker.dataset.player = String(player);
      marker.setAttribute('transform', `translate(${entry.x.toFixed(3)} ${entry.y.toFixed(3)})`);
      const body = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      body.setAttribute('r', radius.toFixed(3));
      body.setAttribute('cx', '0');
      body.setAttribute('cy', '0');
      body.setAttribute('fill', colonColorForIndex(pIdx));
      body.setAttribute('stroke', '#ffffff');
      body.setAttribute('stroke-width', (size * 0.06).toFixed(3));
      marker.appendChild(body);
      const core = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      core.setAttribute('r', (radius * 0.45).toFixed(3));
      core.setAttribute('cx', '0');
      core.setAttribute('cy', '0');
      core.setAttribute('fill', '#2d2a26');
      marker.appendChild(core);
      marker.addEventListener('dblclick', (event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleCastleAtJunction(key, currentPlayer());
      });
      marker.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        outpostByJunction.delete(key);
      cleanupAmenagementsForPlayer(player);
      renderJunctionOverlays();
        refreshStatsModal();
      });
      layer.appendChild(marker);
    }
    renderInfluenceZones();
  }

  function renderInfluenceZones() {
    const layer = svg.__influenceLayer ?? svg.querySelector('#influence-zones');
    if (!layer) return;
    layer.innerHTML = '';
    const radiusSetting = Number.isFinite(gameSettings.influenceRadius)
      ? gameSettings.influenceRadius
      : DEFAULT_GAME_SETTINGS.influenceRadius;
    const radiusLimit = Math.max(0, radiusSetting);
    const influencedTilesByPlayer = new Map();
    const seeds = [];
    castleByJunction.forEach((player, key) => {
      const entry = junctionMap.get(key);
      if (entry && isValidPlayer(player)) seeds.push({ player, entry });
    });
    outpostByJunction.forEach((player, key) => {
      const entry = junctionMap.get(key);
      if (entry && isValidPlayer(player)) seeds.push({ player, entry });
    });
    if (seeds.length === 0) return;
    seeds.forEach(({ player, entry }) => {
      const idx = playerIndex(player);
      if (idx === -1) return;
      const tilesAround = Array.isArray(entry.tiles) ? entry.tiles : [];
      if (tilesAround.length === 0) return;
      if (!influencedTilesByPlayer.has(player)) influencedTilesByPlayer.set(player, new Set());
      const tileSet = influencedTilesByPlayer.get(player);
      for (let tileIdx = 0; tileIdx < tiles.length; tileIdx++) {
        const tile = tiles[tileIdx];
        if (!tile) continue;
        let best = Infinity;
        for (let t = 0; t < tilesAround.length; t++) {
          const baseTileIdx = tilesAround[t];
          const dist = hexDistanceBetweenCached(tileIdx, baseTileIdx);
          if (Number.isFinite(dist) && dist < best) best = dist;
          if (best <= radiusLimit) break;
        }
        if (best <= radiusLimit) tileSet.add(tileIdx);
      }
    });

    influencedTilesByPlayer.forEach((tileSet, player) => {
      const idx = playerIndex(player);
      if (idx === -1 || !tileSet || tileSet.size === 0) return;
      const outlineRadius = Math.max(size - 0.35, size * 0.72);
      const boundaryMap = new Map();
      const quantize = (value) => Math.round(value * 1000) / 1000;
      const canonicalEdgeKey = (a, b) => {
        const ax = quantize(a.x);
        const ay = quantize(a.y);
        const bx = quantize(b.x);
        const by = quantize(b.y);
        return ax < bx || (ax === bx && ay <= by)
          ? `${ax},${ay}|${bx},${by}`
          : `${bx},${by}|${ax},${ay}`;
      };
      tileSet.forEach((tileIdx) => {
        const tile = tiles[tileIdx];
        if (!tile) return;
        const center = axialToPixel(tile.q, tile.r, size);
        const verts = hexVerticesAt(center.x, center.y, outlineRadius);
        for (let i = 0; i < 6; i++) {
          const neighborIdx = Array.isArray(tileNeighbors[tileIdx]) ? tileNeighbors[tileIdx][i] : -1;
          if (neighborIdx !== -1 && tileSet.has(neighborIdx)) continue;
          const start = {
            x: quantize(verts[i].x),
            y: quantize(verts[i].y),
          };
          const end = {
            x: quantize(verts[(i + 1) % 6].x),
            y: quantize(verts[(i + 1) % 6].y),
          };
          const key = canonicalEdgeKey(start, end);
          if (boundaryMap.has(key)) boundaryMap.delete(key);
          else boundaryMap.set(key, { start, end });
        }
      });
      if (boundaryMap.size === 0) return;
      const segments = Array.from(boundaryMap.values());
      const EPSILON = 1e-2;
      const pointsEqual = (a, b) => Math.abs(a.x - b.x) <= EPSILON && Math.abs(a.y - b.y) <= EPSILON;

      const loops = [];
      const used = new Set();
      const findNextSegment = (current) => {
        for (let i = 0; i < segments.length; i++) {
          if (used.has(i)) continue;
          const seg = segments[i];
          if (pointsEqual(seg.start, current)) {
            used.add(i);
            return { start: seg.start, end: seg.end };
          }
          if (pointsEqual(seg.end, current)) {
            used.add(i);
            return { start: seg.end, end: seg.start };
          }
        }
        return null;
      };

      for (let i = 0; i < segments.length; i++) {
        if (used.has(i)) continue;
        used.add(i);
        const seg = segments[i];
        const loop = [seg.start, seg.end];
        let cursor = seg.end;
        let guard = 0;
        while (!pointsEqual(cursor, loop[0]) && guard < segments.length * 2) {
          const next = findNextSegment(cursor);
          if (!next) break;
          loop.push(next.end);
          cursor = next.end;
          guard += 1;
        }
        if (pointsEqual(cursor, loop[0])) {
          loops.push(loop);
        }
      }

      const svgNS = 'http://www.w3.org/2000/svg';
      const baseColor = colonColorForIndex(idx);

      loops.forEach((loop) => {
        if (!Array.isArray(loop) || loop.length < 3) return;
        const simplified = [];
        loop.forEach((point) => {
          if (simplified.length === 0 || !pointsEqual(simplified[simplified.length - 1], point)) {
            simplified.push({ x: point.x, y: point.y });
          }
        });
        if (simplified.length >= 2 && pointsEqual(simplified[0], simplified[simplified.length - 1])) {
          simplified.pop();
        }
        if (simplified.length < 3) return;
        let pathData = '';
        simplified.forEach((point, index) => {
          const cmd = index === 0 ? 'M' : 'L';
          pathData += `${cmd} ${point.x.toFixed(3)} ${point.y.toFixed(3)} `;
        });
        pathData += 'Z';
        const trimmed = pathData.trim();
        const fillPath = document.createElementNS(svgNS, 'path');
        fillPath.setAttribute('class', 'influence-fill');
        fillPath.setAttribute('d', trimmed);
        fillPath.setAttribute('fill', colorWithAlpha(baseColor, 0.18));
        layer.appendChild(fillPath);

        const shadowPath = document.createElementNS(svgNS, 'path');
        shadowPath.setAttribute('class', 'influence-outline-shadow');
        shadowPath.setAttribute('d', trimmed);
        shadowPath.setAttribute('fill', 'none');
        shadowPath.setAttribute('stroke', colorWithAlpha('#000000', 0.3));
        shadowPath.setAttribute('stroke-width', (size * 0.24).toFixed(3));
        shadowPath.setAttribute('stroke-linejoin', 'round');
        shadowPath.setAttribute('stroke-linecap', 'round');
        layer.appendChild(shadowPath);

        const outlinePath = document.createElementNS(svgNS, 'path');
        outlinePath.setAttribute('class', 'influence-outline');
        outlinePath.setAttribute('d', trimmed);
        outlinePath.setAttribute('fill', 'none');
        outlinePath.setAttribute('stroke', colorWithAlpha(baseColor, 0.7));
        outlinePath.setAttribute('stroke-width', (size * 0.16).toFixed(3));
        outlinePath.setAttribute('stroke-linejoin', 'round');
        outlinePath.setAttribute('stroke-linecap', 'round');
        layer.appendChild(outlinePath);
      });
    });
  }

  gridSideColors = new Array(tiles.length).fill(null);
  placements = new Array(tiles.length).fill(null);
  emptyTiles = new Set(tiles.map((_, idx) => idx));
  placedCount = 0;
  autoState = { done: false, pendingPalette: null };
  panSuppressClick = false;
  updateClearButtonState();

  let zoom = 1;
  let panX = 0;
  let panY = 0;
  let panPointerId = null;
  let panCaptured = false;
  let panStart = null;
  let panStartOffset = null;
  let panMoved = false;
  let panWasActive = false;

  const viewport = svg.querySelector('#viewport');
  const previewLayer = svg.querySelector('#preview');

  function updateViewportTransform() {
    if (!viewport) return;
    viewport.setAttribute('transform', `translate(${panX} ${panY}) scale(${zoom})`);
  }
  updateViewportTransform();

  function renderJunctionCircles() {
    const r = size * ROUNDED_ARC_RATIO * 0.92;
    const g = svg.querySelector('#junctions');
    g.innerHTML = '';
    for (const [key, entry] of junctionMap.entries()) {
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', entry.x);
      c.setAttribute('cy', entry.y);
      c.setAttribute('r', r);
      c.setAttribute('class', 'junction');
      c.setAttribute('data-key', key);
      const ready = isJunctionReady(entry);
      if (overlayByJunction.has(key)) {
        c.style.opacity = '0';
        c.style.pointerEvents = 'none';
      } else {
        c.style.opacity = ready ? '1' : '0.2';
        c.style.pointerEvents = ready ? 'auto' : 'none';
        if (ready) {
          c.addEventListener('click', (event) => {
            event.preventDefault();
            assignAmenagementOwner(key, currentPlayer());
          });
          c.addEventListener('dblclick', (event) => {
            event.preventDefault();
            event.stopPropagation();
            toggleCastleAtJunction(key, currentPlayer());
          });
          c.addEventListener('contextmenu', (event) => {
            event.preventDefault();
            removeAmenagementOwner(key);
          });
        }
      }
      g.appendChild(c);
    }
  }

  function renderJunctionOverlays() {
    const g = svg.querySelector('#junction-overlays');
    g.innerHTML = '';
    const r = size * 0.38;
    for (const [key, player] of overlayByJunction.entries()) {
      const entry = junctionMap.get(key);
      if (!entry || !isJunctionReady(entry)) {
        if (isValidPlayer(player)) {
          const colorIdx = amenagementColorByKey.get(key);
          unregisterAmenagementForPlayer(player, key, colorIdx);
        }
        overlayByJunction.delete(key);
        continue;
      }
      const ng = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      PLAYER_SHAPES[player].draw(ng, entry.x, entry.y, r);
      ng.setAttribute('data-key', key);
      ng.style.cursor = 'pointer';
      ng.addEventListener('click', (event) => {
        event.preventDefault();
        if (!isJunctionReady(entry)) return;
        assignAmenagementOwner(key, currentPlayer());
      });
      ng.addEventListener('dblclick', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!isJunctionReady(entry)) return;
        toggleCastleAtJunction(key, currentPlayer());
      });
      ng.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        removeAmenagementOwner(key);
      });
      g.appendChild(ng);
    }
    renderOutpostOverlays();
    renderCastleOverlays();
    renderJunctionCircles();
    refreshStatsModal();
  }
  renderJunctionOverlays();

  let paletteCombos = [];
  let selectedPalette = -1;
  let hoveredTileIdx = null;

  const paletteEl = document.getElementById('palette-items');

  function updateClearButtonState() {
    const btn = document.getElementById('clear');
    if (!btn) return;
    btn.classList.toggle('danger', placedCount > 0);
  }

  function setSelectedPalette(idx) {
    selectedPalette = idx;
    if (idx >= 0) clearColonSelection();
    if (paletteEl) {
      const options = paletteEl.querySelectorAll('.palette-option input');
      options.forEach((input) => {
        input.checked = (Number(input.value) === idx);
      });
    }
    if (hoveredTileIdx != null && idx >= 0) renderPlacementPreview(hoveredTileIdx);
    else renderPlacementPreview(null);
  }

  function renderPaletteUI(combos) {
    if (!paletteEl) return;
    paletteEl.innerHTML = '';
    combos.forEach((combo, idx) => {
      combo.rotationStep = normalizeRotationStep(combo, combo.rotationStep);

      const optionDiv = document.createElement('div');
      optionDiv.className = 'palette-option';

      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'palette-tile';
      input.id = `palette-tile-${idx}`;
      input.value = String(idx);
      if (selectedPalette === idx) {
        input.checked = true;
      }

      const label = document.createElement('label');
      label.htmlFor = `palette-tile-${idx}`;
      label.className = 'palette-label';

      const shape = document.createElement('div');
      shape.className = 'palette-shape';
      shape.appendChild(renderComboSVG(combo, 72, colors));

      label.appendChild(shape);

      optionDiv.appendChild(input);
      optionDiv.appendChild(label);

      label.addEventListener('click', (e) => {
        // We handle click on the label to allow deselecting
        e.preventDefault();
        if (selectedPalette === idx) {
          setSelectedPalette(-1);
        } else {
          setSelectedPalette(idx);
        }
      });

      paletteEl.appendChild(optionDiv);
    });
    refreshStatsModal();
  }

  function regenPalette() {
    paletteCombos = createPalette(typesPct, colorPct, rng);
    renderPaletteUI(paletteCombos);
    setSelectedPalette(-1);
    refreshStatsModal();
    return paletteCombos;
  }

  function canPlace(tileIdx, sideColors) {
    if (gridSideColors[tileIdx]) return false;
    const candidateColors = mapSideColorIndices(sideColors, colors);
    let hasNeighbor = false;
    const neighborIndices = tileNeighbors[tileIdx];
    for (let dir = 0; dir < 6; dir++) {
      const neighborIdx = neighborIndices[dir];
      if (neighborIdx === -1) continue;
      const neighborColorsRaw = gridSideColors[neighborIdx];
      if (!neighborColorsRaw) continue;
      let neighborColors;
      if (typeof neighborColorsRaw[0] === 'string') {
        neighborColors = neighborColorsRaw;
      } else {
        neighborColors = mapSideColorIndices(neighborColorsRaw, colors);
        gridSideColors[neighborIdx] = neighborColors;
      }
      hasNeighbor = true;
      const oppositeDir = (dir + 3) % 6;
      if (neighborColors[oppositeDir] !== candidateColors[dir]) return false;
  }
  return hasNeighbor || placedCount === 0;
}

function neighborPlacementCount(tileIdx) {
  const neighbors = tileNeighbors[tileIdx] || [];
  let count = 0;
  for (let i = 0; i < neighbors.length; i++) {
    const neighborIdx = neighbors[i];
    if (neighborIdx >= 0 && placements[neighborIdx]) count++;
  }
  return count;
}

function pointsForNeighborCount(count) {
  if (!Number.isFinite(count) || count <= 0) {
    return 0;
  }
  const table = Array.isArray(gameSettings.neighborPoints) && gameSettings.neighborPoints.length
    ? gameSettings.neighborPoints
    : DEFAULT_GAME_SETTINGS.neighborPoints;
  const idx = Math.min(table.length - 1, Math.max(0, Math.floor(count)));
  const value = table[idx];
  return Number.isFinite(value) ? value : 0;
}

function commitPlacement(tileIdx, combo, rotationStep, sideColors, player, options = {}) {
  const sideColorValues = mapSideColorIndices(sideColors, colors);
  gridSideColors[tileIdx] = sideColorValues;
  placements[tileIdx] = {
    player: isValidPlayer(player) ? player : null,
    combo,
    rotationStep,
    sideColors: sideColors.slice(),
    colors: sideColorValues.slice(),
  };
  emptyTiles.delete(tileIdx);
  placedCount++;

  renderTileFill(tileIdx, sideColors, svg, tiles, size, colors);
  updateClearButtonState();
  const trackResources = options.trackResources !== false;
  const idx = isValidPlayer(player) ? playerIndex(player) : -1;
  const isColonPlacement = trackResources && idx !== -1 && colonPositions[idx] === tileIdx;
  const colonBonusAvailable = isColonPlacement && !colonPlacementUsed[idx];
  if (trackResources && idx !== -1) {
    adjustPlayerTileResources(player, combo, 1);
    if (colonBonusAvailable) {
      colonPlacementUsed[idx] = true;
    } else {
      const current = turnState.tilesPlacedByPlayer[idx] ?? 0;
      turnState.tilesPlacedByPlayer[idx] = current + 1;
      const neighborCount = neighborPlacementCount(tileIdx);
      const points = pointsForNeighborCount(neighborCount);
      if (points > 0) awardPoints(player, points, `neighbor:${neighborCount}`);
    }
    renderGameHud();
  }
  evaluateAmenagementsAround(tileIdx, { placingPlayer: player });
  refreshStatsModal();
  return true;
}

  function tryPlaceComboOnTile(tileIdx, combo, player = turnState.activePlayer, options = {}) {
    if (!combo) return false;
    if (gridSideColors[tileIdx]) return false;
    const rotation = normalizeRotationStep(combo, combo.rotationStep);
    const oriented = orientedSideColors(combo, rotation);
    if (!canPlace(tileIdx, oriented)) return false;
    if (commitPlacement(tileIdx, combo, rotation, oriented, player, options)) {
      combo.rotationStep = rotation;
      renderJunctionOverlays();
      // Synchroniser avec les autres onglets
      broadcastGameState();
      return true;
    }
    return false;
  }

  function clearGrid() {
    svg.querySelectorAll('#grid .tile .fills').forEach((n) => n.remove());
    gridSideColors = new Array(tiles.length).fill(null);
    placements = new Array(tiles.length).fill(null);
    emptyTiles = new Set(tiles.map((_, idx) => idx));
    placedCount = 0;
    autoState.done = false;
    autoState.pendingPalette = null;
    renderJunctionOverlays();
    renderPlacementPreview(null);
    updateClearButtonState();
    refreshStatsModal();
    resetGameDataForNewBoard();
  }

  function renderPlacementPreview(tileIdx) {
    if (!previewLayer) return;
    previewLayer.innerHTML = '';
    hoveredTileIdx = tileIdx;
    if (tileIdx == null || selectedPalette < 0) return;
    if (panPointerId != null && panMoved) return;
    const combo = paletteCombos[selectedPalette];
    if (!combo) return;
    const rotation = normalizeRotationStep(combo, combo.rotationStep);
    const oriented = orientedSideColors(combo, rotation);
    const can = canPlace(tileIdx, oriented);
    const fillColors = mapSideColorIndices(oriented, colors);
    const tile = tiles[tileIdx];
    const center = axialToPixel(tile.q, tile.r, size);
    const verts = hexVerticesAt(center.x, center.y, size - 0.6);
    for (let i = 0; i < 6; i++) {
      const a = verts[i];
      const b = verts[(i + 1) % 6];
      const p = createTrianglePathElement(center, a, b, { 
        fill: fillColors[ORIENTED_INDEX_FOR_TRIANGLE[i]], 
        'fill-opacity': '0.6' 
      });
      previewLayer.appendChild(p);
    }
    const outline = createHexOutlineElement(center.x, center.y, size);
    outline.setAttribute('fill', 'none');
    outline.setAttribute('stroke', can ? '#2e7d32' : '#c62828');
    outline.setAttribute('stroke-width', '2.2');
    outline.setAttribute('stroke-dasharray', can ? '0' : '6,4');
    previewLayer.appendChild(outline);
  }

  function handleWheel(event) {
    event.preventDefault();
    const factor = event.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.min(6, Math.max(0.8, zoom * factor));
    if (Math.abs(newZoom - zoom) < 1e-4) return;
    const rect = svg.getBoundingClientRect();
    const cursorX = event.clientX - rect.left - rect.width / 2;
    const cursorY = event.clientY - rect.top - rect.height / 2;
    const beforeX = (cursorX - panX) / zoom;
    const beforeY = (cursorY - panY) / zoom;
    zoom = newZoom;
    panX = cursorX - beforeX * zoom;
    panY = cursorY - beforeY * zoom;
    updateViewportTransform();
  }

  function handlePanPointerDown(event) {
    if (event.button !== 0) return;
    panPointerId = event.pointerId;
    panStart = { x: event.clientX, y: event.clientY };
    panStartOffset = { x: panX, y: panY };
    panMoved = false;
    panCaptured = false;
    panWasActive = false;
  }

  function handlePanPointerMove(event) {
    if (panPointerId == null || event.pointerId !== panPointerId) return;
    const dx = event.clientX - panStart.x;
    const dy = event.clientY - panStart.y;
    if (!panMoved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
      panMoved = true;
      panWasActive = true;
      renderPlacementPreview(null);
      try {
        svg.setPointerCapture(event.pointerId);
        panCaptured = true;
      } catch (_) {
        panCaptured = false;
      }
    }
    if (!panMoved) return;
    panX = panStartOffset.x + dx;
    panY = panStartOffset.y + dy;
    updateViewportTransform();
  }

  function handlePanPointerEnd(event) {
    if (panPointerId == null || event.pointerId !== panPointerId) return;
    if (panCaptured) {
      try {
        svg.releasePointerCapture(event.pointerId);
      } catch (_) {}
    }
    panPointerId = null;
    panCaptured = false;
    panStart = null;
    panStartOffset = null;
    panMoved = false;
    if (panWasActive) {
      panSuppressClick = true;
      setTimeout(() => { panSuppressClick = false; panWasActive = false; }, 0);
    }
  }

  const paletteState = { paletteCombos, setSelectedPalette, renderPaletteUI };

  function handleTileContextRemoval(tileIdx) {
    const group = svg.querySelector(`.tile[data-idx="${tileIdx}"]`);
    if (!group) return;
    const fillGroup = group.querySelector('.fills');
    if (fillGroup) fillGroup.remove();
    const placement = placements[tileIdx];
    const owner = placement?.player;
    const hadPlacement = placement != null;
    if (hadPlacement && isValidPlayer(owner)) {
      adjustPlayerTileResources(owner, placement.combo, -1);
      const idx = playerIndex(owner);
      if (idx !== -1) {
        const current = turnState.tilesPlacedByPlayer[idx] ?? 0;
        turnState.tilesPlacedByPlayer[idx] = Math.max(0, current - 1);
      }
      renderGameHud();
    }
    gridSideColors[tileIdx] = null;
    placements[tileIdx] = null;
    emptyTiles.add(tileIdx);
    if (hadPlacement) {
      placedCount = Math.max(0, placedCount - 1);
      autoState.done = false;
    }
    renderPlacementPreview(null);
    renderJunctionOverlays();
    updateClearButtonState();
    refreshStatsModal();
    
    // Synchroniser avec les autres onglets
    broadcastGameState();
  }

  function handleTilePlacement(tileIdx) {
    if (panSuppressClick) return;
    if (selectedPalette < 0) return;
    const player = turnState.activePlayer;
    const pIdx = playerIndex(player);
    if (pIdx !== -1) {
      const isColonTile = colonPositions[pIdx] === tileIdx;
      const colonFreeAvailable = isColonTile && !colonPlacementUsed[pIdx];
      const placedThisTurn = turnState.tilesPlacedByPlayer[pIdx] ?? 0;
      const limit = Math.max(0, Number.isFinite(gameSettings.tilePlacementsPerTurn)
        ? gameSettings.tilePlacementsPerTurn
        : DEFAULT_GAME_SETTINGS.tilePlacementsPerTurn);
      if (!colonFreeAvailable && placedThisTurn >= limit) {
        debugLog('tile-limit-reached', { player, tileIdx, limit });
        renderPlacementPreview(null);
        return;
      }
    }
    const usedIndex = selectedPalette;
    const combo = paletteCombos[usedIndex];
    if (!combo) return;
    if (tryPlaceComboOnTile(tileIdx, combo, player)) {
      const replacement = sampleCombo(typesPct, colorPct, rng);
      const steps = rotationStepsForCombo(replacement);
      replacement.rotationStep = steps[0] ?? 0;
      paletteCombos[usedIndex] = replacement;
      renderPaletteUI(paletteCombos);
      svg.__state.paletteCombos = paletteCombos;
      setSelectedPalette(-1);
      renderPlacementPreview(null);
      clearColonSelection();
      
      // Synchroniser avec les autres onglets
      broadcastGameState();
    } else {
      renderPlacementPreview(tileIdx);
    }
  }

  const svgNS = 'http://www.w3.org/2000/svg';
  function attachTileListeners() {
    svg.querySelectorAll('.tile').forEach((g) => {
      const idx = Number(g.getAttribute('data-idx'));
      const area = g.querySelector('.hit-area');
      if (!area) return;
      area.addEventListener('click', (event) => {
        event.preventDefault();
        if (panSuppressClick) return;
        handleTilePlacement(idx);
      });
      area.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        handleTileContextRemoval(idx);
      });
      area.addEventListener('mouseenter', () => {
        if (selectedPalette >= 0) renderPlacementPreview(idx);
      });
      area.addEventListener('mousemove', () => {
        if (selectedPalette >= 0) renderPlacementPreview(idx);
      });
      area.addEventListener('mouseleave', () => {
        renderPlacementPreview(null);
      });
    });
  }
  attachTileListeners();

  svg.addEventListener('wheel', handleWheel, { passive: false });
  svg.addEventListener('pointerdown', handlePanPointerDown);
  svg.addEventListener('pointermove', handlePanPointerMove);
  svg.addEventListener('pointerup', handlePanPointerEnd);
  svg.addEventListener('pointercancel', handlePanPointerEnd);

  function regenerateAndRenderPalette() {
    regenPalette();
    if (svg.__state) svg.__state.paletteCombos = paletteCombos;
  }

  function attemptPlacementWithPalette(palette) {
    for (let ringIdx = 0; ringIdx < ringsByDistance.length; ringIdx++) {
      const ring = ringsByDistance[ringIdx];
      if (!ring) continue;
      const availableTiles = ring.filter((idx) => emptyTiles.has(idx));
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
            if (commitPlacement(tileIdx, combo, step, oriented, null, { trackResources: false })) {
              combo.rotationStep = step;
              renderJunctionOverlays();
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  function stepAutoFill() {
    if (autoState.done) return 'done';
    if (emptyTiles.size === 0) {
      autoState.done = true;
      return 'done';
    }
    const MAX_ATTEMPTS = 12;
    let palette = autoState.pendingPalette;
    autoState.pendingPalette = null;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      if (!palette || palette.length === 0) {
        palette = regenPalette();
        if (!palette || palette.length === 0) {
          autoState.pendingPalette = null;
          return 'halt';
        }
      }
      if (attemptPlacementWithPalette(palette)) {
        autoState.pendingPalette = regenPalette();
        return 'placed';
      }
      palette = null;
    }
    autoState.pendingPalette = null;
    return 'halt';
  }

  const svgState = {
    overlayByJunction,
    renderJunctionOverlays,
    castleByJunction,
    renderCastleOverlays,
    outpostByJunction,
    renderOutpostOverlays,
    toggleCastleAtJunction,
    junctionMap,
    tiles,
    size,
    colors,
    typesPct,
    colorPct,
    clearGrid,
    regenPalette: regenerateAndRenderPalette,
    tryPlaceComboOnTile,
    stepAutoFill,
    getGridSideColors: () => gridSideColors.slice(),
    get placements() { return placements; },
    get paletteCombos() { return paletteCombos; },
    set paletteCombos(value) {
      paletteCombos = Array.isArray(value) ? value : [];
      renderPaletteUI(paletteCombos);
    },
    get selectedPalette() { return selectedPalette; },
    set selectedPalette(value) { setSelectedPalette(Number(value)); },
    setSelectedPalette,
    renderPalette: renderPaletteUI,
    refreshPreview: () => renderPlacementPreview(hoveredTileIdx),
    get hoveredTile() { return hoveredTileIdx; },
    set hoveredTile(value) {
      hoveredTileIdx = Number.isInteger(value) ? Number(value) : null;
      renderPlacementPreview(hoveredTileIdx);
    },
    autoState,
    squareCells,
    squareTrack,
    squareIndicator,
    squareIndicatorCrest,
    updateSquareIndicator,
    updateSquarePlayers,
    marketCells: squareMarketCells,
    marketLayer: squareMarketLayer,
    marketCardsLayer: squareMarketCardsLayer,
    influenceLayer,
    renderInfluenceZones,
    renderMarketDisplay,
  };
  svg.__state = svgState;

  renderColonMarkers();
  renderMarketDisplay();

  const activePlayerForIndicator = turnState.activePlayer;
  const activeIdxForIndicator = playerIndex(activePlayerForIndicator);
  const initialScore = activeIdxForIndicator !== -1 ? playerScores[activeIdxForIndicator] || 0 : 0;
  updateSquareIndicator(activePlayerForIndicator, initialScore);
  updateSquarePlayers();

  regenerateAndRenderPalette();

  function handleMouseMove(event) {
    if (selectedPalette < 0) return;
    const tile = event.target.closest('.tile');
    if (!tile) {
      renderPlacementPreview(null);
      return;
    }
    const idx = Number(tile.getAttribute('data-idx'));
    renderPlacementPreview(idx);
  }
  svg.addEventListener('mousemove', handleMouseMove);

  function handlePointerUpClick(event) {
    if (event.button !== 0) return;
    if (panSuppressClick) return;
    const tile = event.target.closest('.tile');
    if (!tile) return;
    const idx = Number(tile.getAttribute('data-idx'));
    if (selectedColonPlayer === turnState.activePlayer && selectedPalette < 0 && selectedColonPlayer != null) {
      if (attemptColonMoveTo(idx)) return;
    }
    handleTilePlacement(idx);
  }
  svg.addEventListener('click', handlePointerUpClick);

  boardInitialized = true;
  serializeConfigToURL(cfg);
  refreshStatsModal();
}

const STATS_KEYS = new Set(['s', 't', 'a']);
const statsPressedKeys = new Set();
let statsComboLatched = false;
let statsModalVisible = false;
let statsModalElements = null;
let statsDragState = null;

function ensureStatsModal() {
  if (statsModalElements) return statsModalElements;
  const modal = document.createElement('div');
  modal.className = 'stats-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-label', 'Statistiques');
  modal.tabIndex = -1;
  const header = document.createElement('div');
  header.className = 'stats-modal-header';
  const title = document.createElement('span');
  title.textContent = 'Statistiques';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'stats-modal-close';
  closeBtn.setAttribute('aria-label', 'Fermer');
  closeBtn.textContent = '\u00d7';
  header.appendChild(title);
  header.appendChild(closeBtn);
  const body = document.createElement('div');
  body.className = 'stats-modal-body';
  modal.appendChild(header);
  modal.appendChild(body);
  document.body.appendChild(modal);

  closeBtn.addEventListener('click', () => hideStatsModal());

  header.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    const target = event.target;
    if (target && typeof target.closest === 'function' && target.closest('.stats-modal-close')) return;
    event.preventDefault();
    const rect = modal.getBoundingClientRect();
    statsDragState = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };
    modal.style.left = `${rect.left}px`;
    modal.style.top = `${rect.top}px`;
    modal.style.right = 'auto';
    modal.style.bottom = 'auto';
    try {
      header.setPointerCapture(event.pointerId);
    } catch (_) {}
  });

  const handleDragMove = (event) => {
    if (!statsDragState || event.pointerId !== statsDragState.pointerId) return;
    const x = event.clientX - statsDragState.offsetX;
    const y = event.clientY - statsDragState.offsetY;
    const maxX = window.innerWidth - modal.offsetWidth - 12;
    const maxY = window.innerHeight - modal.offsetHeight - 12;
    modal.style.left = `${Math.min(Math.max(12, x), Math.max(12, maxX))}px`;
    modal.style.top = `${Math.min(Math.max(24, y), Math.max(24, maxY))}px`;
  };

  const releaseDrag = (event) => {
    if (!statsDragState || event.pointerId !== statsDragState.pointerId) return;
    try {
      header.releasePointerCapture(event.pointerId);
    } catch (_) {}
    statsDragState = null;
  };

  header.addEventListener('pointermove', handleDragMove);
  header.addEventListener('pointerup', releaseDrag);
  header.addEventListener('pointercancel', releaseDrag);

  statsModalElements = { modal, body };
  return statsModalElements;
}

function showStatsModal() {
  const { modal } = ensureStatsModal();
  statsModalVisible = true;
  modal.classList.add('visible');
  refreshStatsModal();
  modal.focus({ preventScroll: true });
  updateTopbarQuickActions();
}

function hideStatsModal() {
  if (!statsModalVisible) return;
  const { modal } = ensureStatsModal();
  modal.classList.remove('visible');
  statsModalVisible = false;
  updateTopbarQuickActions();
}

function toggleStatsModal() {
  if (statsModalVisible) hideStatsModal();
  else showStatsModal();
}

function refreshStatsModal() {
  if (!statsModalVisible) return;
  const elements = ensureStatsModal();
  const body = elements.body;
  
  // Vérifier et sécuriser l'accès aux données
  const svg = document.querySelector('#board-container svg');
  const state = svg?.__state || {};
  
  // Statistiques générales
  const placed = placedCount || 0;
  const remaining = Math.max(0, TILE_COUNT - placed);
  const completionPercentage = ((placed / TILE_COUNT) * 100).toFixed(1);
  
  // Statistiques de répartition des combos
  const counts = { 1: 0, 2: 0, 3: 0 };
  const colorCounts = [0, 0, 0, 0]; // Pour 4 couleurs max
  
  if (Array.isArray(placements)) {
    placements.forEach((placement) => {
      if (!placement?.combo) return;
      
      // Compter par type de combo
      const t = placement.combo.type;
      if (t === 1 || t === 2 || t === 3) counts[t] = (counts[t] || 0) + 1;
      
      // Compter par couleur (utiliser les couleurs mappées)
      if (Array.isArray(placement.colors)) {
        placement.colors.forEach(colorIdx => {
          if (colorIdx >= 0 && colorIdx < colorCounts.length) {
            colorCounts[colorIdx]++;
          }
        });
      }
    });
  }
  
  // Calculer le total des combos
  let totalCombos = counts[1] + counts[2] + counts[3];
  
  // Calculer les pourcentages
  const comboPercentages = {
    1: totalCombos > 0 ? ((counts[1] / totalCombos) * 100).toFixed(1) : '0.0',
    2: totalCombos > 0 ? ((counts[2] / totalCombos) * 100).toFixed(1) : '0.0',
    3: totalCombos > 0 ? ((counts[3] / totalCombos) * 100).toFixed(1) : '0.0'
  };
  
  const colorPercentages = colorCounts.map(count => 
    totalCombos > 0 ? ((count / totalCombos) * 100).toFixed(1) : '0.0'
  );
  
  // Statistiques des blasons (overlays et châteaux)
  const crestCounts = [0, 0, 0, 0, 0, 0];
  const overlayMap = state.overlayByJunction || null;
  const castleMap = state.castleByJunction || null;
  
  if (overlayMap && typeof overlayMap.forEach === 'function') {
    for (const player of overlayMap.values()) {
      if (player >= 1 && player <= 6) crestCounts[player - 1]++;
    }
  }
  if (castleMap && typeof castleMap.forEach === 'function') {
    for (const player of castleMap.values()) {
      if (player >= 1 && player <= 6) crestCounts[player - 1]++;
    }
  }

  const crestRows = crestCounts
    .map((value, idx) => `<div>J${idx + 1}</div><div>${value}</div>`)
    .join('');

  // Créer les lignes pour les couleurs avec leurs pourcentages
  const colors = state.colors || ['#FF0000', '#00FF00', '#0000FF', '#FFFF00'];
  const colorRows = colorCounts.map((count, idx) => {
    const colorName = colors[idx] || `Couleur ${idx + 1}`;
    const percentage = colorPercentages[idx];
    return `<div>${colorName}</div><div>${count} (${percentage}%)</div>`;
  }).join('');

  body.innerHTML = `
    <div class="stats-section-title">Général</div>
    <div class="stats-grid">
      <div>Tuiles posées</div><div>${placed}</div>
      <div>Tuiles restantes</div><div>${remaining}</div>
      <div>Avancement</div><div>${completionPercentage}%</div>
      <div>Total combos</div><div>${totalCombos}</div>
    </div>
    <div class="stats-section-title">Répartition des Combos</div>
    <div class="stats-grid">
      <div>Mono (1 couleur)</div><div>${counts[1] ?? 0} (${comboPercentages[1]}%)</div>
      <div>Bi (2 couleurs)</div><div>${counts[2] ?? 0} (${comboPercentages[2]}%)</div>
      <div>Tri (3 couleurs)</div><div>${counts[3] ?? 0} (${comboPercentages[3]}%)</div>
    </div>
    <div class="stats-section-title">Répartition par Couleur</div>
    <div class="stats-grid">
      ${colorRows}
    </div>
    <div class="stats-section-title">Blasons par Joueur</div>
    <div class="stats-grid">
      ${crestRows}
    </div>
  `;
}

function handleStatsKeyDown(event) {
  const key = event.key?.toLowerCase();
  if (!key) return false;
  if (key === 'escape') {
    if (statsModalVisible) {
      hideStatsModal();
      return true;
    }
    return false;
  }
  if (!STATS_KEYS.has(key)) return false;
  const active = document.activeElement;
  if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return false;
  statsPressedKeys.add(key);
  if (statsPressedKeys.size === STATS_KEYS.size && !statsComboLatched) {
    toggleStatsModal();
    statsComboLatched = true;
    return true;
  }
  return false;
}

function handleStatsKeyUp(event) {
  const key = event.key?.toLowerCase();
  if (!key) return;
  if (STATS_KEYS.has(key)) {
    statsPressedKeys.delete(key);
    if (statsPressedKeys.size === 0) statsComboLatched = false;
  } else {
    statsPressedKeys.clear();
    statsComboLatched = false;
  }
}

function bindUI() {
  initTopbarControls();
  initCollapsedHudInteractions();
  ensureMarketDetailElements();
  showMarketDetailsPlaceholder();
  setMarketDetailsCollapsed(true);
  ensurePersonalBoardElements();
  setPersonalBoardCollapsed(personalBoardCollapsed);
  ensureMarketRegionMonitor();
  const generateBtn = document.getElementById('generate');
  const clearBtn = document.getElementById('clear');
  let holdPointerId = null;
  let holdDelayId = null;
  let holdIntervalId = null;
  let keyboardHoldActive = false;

  function stopAutoPlacement() {
    if (holdDelayId != null) {
      clearTimeout(holdDelayId);
      holdDelayId = null;
    }
    if (holdIntervalId != null) {
      clearInterval(holdIntervalId);
      holdIntervalId = null;
    }
    if (holdPointerId != null) {
      try {
        generateBtn.releasePointerCapture(holdPointerId);
      } catch (_) {}
      holdPointerId = null;
    }
    keyboardHoldActive = false;
  }

  function scheduleStepLoop() {
    const svg = document.querySelector('#board-container svg');
    const state = svg?.__state ?? null;
    if (!state?.stepAutoFill) return;
    const run = () => {
      const result = state.stepAutoFill();
      if (result !== 'placed') stopAutoPlacement();
    };
    run();
    holdIntervalId = setInterval(run, 0);
  }

  generateBtn.addEventListener('pointerdown', (event) => {
    if (event.button != null && event.button !== 0) return;
    event.preventDefault();
    stopAutoPlacement();
    holdPointerId = event.pointerId;
    try {
      generateBtn.setPointerCapture(event.pointerId);
    } catch (_) {}
    generateAndRender();
    holdDelayId = setTimeout(() => {
      if (holdPointerId !== event.pointerId) return;
      scheduleStepLoop();
    }, 200);
  });

  const handlePointerEnd = (event) => {
    if (holdPointerId !== event.pointerId) return;
    stopAutoPlacement();
  };
  generateBtn.addEventListener('pointerup', handlePointerEnd);
  generateBtn.addEventListener('pointercancel', handlePointerEnd);
  generateBtn.addEventListener('pointerleave', handlePointerEnd);

  generateBtn.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    if (event.code !== 'Space' && event.code !== 'Enter') return;
    event.preventDefault();
    stopAutoPlacement();
    keyboardHoldActive = true;
    generateAndRender();
    holdDelayId = setTimeout(() => {
      if (!keyboardHoldActive) return;
      scheduleStepLoop();
    }, 200);
  });

  generateBtn.addEventListener('keyup', (event) => {
    if (event.code !== 'Space' && event.code !== 'Enter') return;
    stopAutoPlacement();
  });

  generateBtn.addEventListener('blur', () => {
    if (!keyboardHoldActive) return;
    stopAutoPlacement();
  });

  clearBtn.addEventListener('click', () => {
    stopAutoPlacement();
    const svg = document.querySelector('#board-container svg');
    const state = svg?.__state ?? null;
    if (!state) return;
    state.clearGrid?.();
    state.overlayByJunction?.clear();
    state.renderJunctionOverlays?.();
    state.castleByJunction?.clear?.();
    state.renderCastleOverlays?.();
    state.regenPalette?.();
    state.setSelectedPalette?.(-1);
  });

  const ids = [
    'pct-mono', 'pct-bi', 'pct-tri',
    'pct-c1', 'pct-c2', 'pct-c3', 'pct-c4',
  ];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', generateAndRender);
  }

  document.addEventListener('keydown', (event) => {
    const activeTag = document.activeElement?.tagName;
    const isEditing = activeTag === 'INPUT' || activeTag === 'TEXTAREA';

    if ((event.key === 'r' || event.key === 'R') && !isEditing) {
      const svg = document.querySelector('#board-container svg');
      const state = svg?.__state ?? null;
      if (!state) return;

      const combos = state.paletteCombos ?? [];
      const selected = state.selectedPalette ?? -1;
      if (selected >= 0 && Array.isArray(combos)) {
        const combo = combos[selected];
        if (combo) {
          const steps = rotationStepsForCombo(combo);
          if (steps.length > 1) {
            combo.rotationStep = nextRotationStep(combo, combo.rotationStep);
            state.paletteCombos = combos;
            state.setSelectedPalette?.(selected);
            state.refreshPreview?.();
            event.preventDefault();
          }
        }
      }
      return;
    }

    if (event.key >= '1' && event.key <= '6') {
      const playerId = Number(event.key);
      if (isValidPlayer(playerId)) setActivePlayer(playerId);
    }
  });

  // Event listeners pour l'édition des bâtiments
  const applyBtn = document.getElementById('apply-changes');
  const cancelBtn = document.getElementById('cancel-edit');
  
  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      if (hoveredMarketSlot != null) {
        applyMarketEdits(hoveredMarketSlot);
      }
    });
  }
  
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      hideMarketEditSection();
    });
  }

  document.addEventListener('keydown', handleSettingsKeyDown);
  document.addEventListener('keyup', handleSettingsKeyUp);
  document.addEventListener('keydown', handleStatsKeyDown);
  document.addEventListener('keyup', handleStatsKeyUp);
}

window.addEventListener('DOMContentLoaded', () => {
  parseConfigFromURL();
  bindUI();
  generateAndRender();
});





















function isPointInsideMarketRegion(clientX, clientY) {
  const rect = getMarketBounds();
  if (!rect) return null;
  return isPointWithinRect(rect, clientX, clientY);
}

function ensureMarketRegionMonitor() {
  if (typeof document === 'undefined' || marketRegionMonitorBound) return;
  const paletteRoot = document.getElementById('palette');
  const isEventInsidePalette = (event) => {
    if (!paletteRoot || !event) return false;
    const targetNode = event.target;
    if (targetNode && typeof targetNode.closest === 'function') {
      const closestPalette = targetNode.closest('#palette');
      if (closestPalette) return true;
    }
    if (paletteRoot && targetNode && typeof paletteRoot.contains === 'function') {
      if (paletteRoot === targetNode || paletteRoot.contains(targetNode)) return true;
    }
    if (typeof event.composedPath === 'function') {
      const path = event.composedPath();
      if (Array.isArray(path)) {
        return path.includes(paletteRoot);
      }
    }
    return false;
  };
  const isPointInsidePaletteRect = (x, y) => {
    if (!paletteRoot || typeof x !== 'number' || typeof y !== 'number') return false;
    if (typeof paletteRoot.getBoundingClientRect !== 'function') return false;
    const rect = paletteRoot.getBoundingClientRect();
    if (!rect) return false;
    return isPointWithinRect(rect, x, y);
  };
  const handlePointer = (event) => {
    if (!event || (typeof event.clientX !== 'number') || (typeof event.clientY !== 'number')) return;
    const insidePalette = isEventInsidePalette(event) || isPointInsidePaletteRect(event.clientX, event.clientY);
    if (insidePalette) {
      if (!palettePointerInside) {
        palettePointerInside = true;
        marketPointerInside = false;
        marketRectSnapshot = null;
        resetHoveredMarketSlot(true);
        setMarketDetailsSuppressed(true);
        if (!marketDetailsCollapsed) setMarketDetailsCollapsed(true);
      }
      lastPointerPosition = { x: event.clientX, y: event.clientY };
      return;
    }
    if (palettePointerInside) {
      palettePointerInside = false;
      setMarketDetailsSuppressed(false);
    }
    updatePointerState(event.clientX, event.clientY);
  };
  document.addEventListener('pointermove', handlePointer, true);
  document.addEventListener('pointerdown', handlePointer, true);
  if (paletteRoot && !paletteRoot.__pairleroyMarketMonitor) {
    const handlePaletteEnter = (event) => {
      if (palettePointerInside) return;
      palettePointerInside = true;
      if (event && typeof event.clientX === 'number' && typeof event.clientY === 'number') {
        lastPointerPosition = { x: event.clientX, y: event.clientY };
      }
      // Ne plus supprimer les détails du marché pour les interactions avec la palette
      marketPointerInside = false;
      marketRectSnapshot = null;
      // Garder les détails du marché visibles
    };
    const handlePaletteLeave = (event) => {
      const nextTarget = event?.relatedTarget;
      if (nextTarget && paletteRoot.contains && paletteRoot.contains(nextTarget)) return;
      if (!palettePointerInside) return;
      palettePointerInside = false;
      setMarketDetailsSuppressed(false);
      if (event && typeof event.clientX === 'number' && typeof event.clientY === 'number') {
        updatePointerState(event.clientX, event.clientY);
      }
    };
    paletteRoot.addEventListener('pointerover', handlePaletteEnter);
    paletteRoot.addEventListener('pointerout', handlePaletteLeave);
    paletteRoot.addEventListener('mouseleave', handlePaletteLeave);
    paletteRoot.__pairleroyMarketMonitor = true;
  }
  window.addEventListener('blur', () => {
    marketPointerInside = false;
    marketRectSnapshot = null;
    lastPointerPosition = null;
    palettePointerInside = false;
    setMarketDetailsSuppressed(false);
    resetHoveredMarketSlot(true);
    if (!marketDetailsCollapsed && hoveredMarketSlot == null) {
      setMarketDetailsCollapsed(true);
    }
  });
  marketRegionMonitorBound = true;
  if (!document.__pairleroyMarketHotkeysBound) {
    document.addEventListener('keydown', (event) => {
      if (!event) return;
      const key = event.key || event.code;
      if (!key) return;
      if (key === 'Escape' || key === 'Esc') {
        if (!marketDetailsCollapsed) {
          lockedMarketSlot = null;
          setMarketDetailsCollapsed(true);
          event.preventDefault();
        }
      }
    });
    document.__pairleroyMarketHotkeysBound = true;
  }
}




