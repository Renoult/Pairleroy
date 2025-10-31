// Fichier: src/js/main.js
// Description: Orchestration de l'application (lecture config, génération de la grille, interactions UI).


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
const DEFAULT_COLOR_LABELS = ['Couleur 1', 'Couleur 2', 'Couleur 3', 'Couleur 4'];

const RESOURCE_LABELS = {
  [RESOURCE_TYPES.WOOD]: 'Bois',
  [RESOURCE_TYPES.BREAD]: 'Pain',
  [RESOURCE_TYPES.FABRIC]: 'Tissu',
  [RESOURCE_TYPES.LABOR]: 'Main-d’œuvre',
};

const RESOURCE_ORDER = [
  RESOURCE_TYPES.WOOD,
  RESOURCE_TYPES.BREAD,
  RESOURCE_TYPES.FABRIC,
  RESOURCE_TYPES.LABOR,
];

const MARKET_TYPE_LABELS = {
  [MARKET_CARD_TYPES.BUILDING]: 'Bâtiment',
  [MARKET_CARD_TYPES.CONTRACT]: 'Contrat',
};

let activeColors = DEFAULT_COLOR_HEX.slice();
if (typeof window !== 'undefined') {
  window.__pairleroyActiveColors = activeColors.slice();
}

const DEFAULT_CENTER_TILE_INDEX = (() => {
  const idx = tiles.findIndex((t) => t.q === 0 && t.r === 0 && t.s === 0);
  return idx >= 0 ? idx : 0;
})();

let colonPositions = Array.from({ length: PLAYER_COUNT }, () => DEFAULT_CENTER_TILE_INDEX);
let colonMoveRemaining = Array.from({ length: PLAYER_COUNT }, () => 2);
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
const influenceMap = new Map();

const hudElements = {
  scoreboard: null,
  turnIndicator: null,
  endTurnButton: null,
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
  colonMoveRemaining = Array.from({ length: PLAYER_COUNT }, () => 2);
  colonPlacementUsed = Array.from({ length: PLAYER_COUNT }, () => false);
  selectedColonPlayer = null;
  updateColonMarkersPositions();
  influenceMap.clear();
}

function ensureHudElements() {
  if (!hudElements.scoreboard) hudElements.scoreboard = document.getElementById('scoreboard');
  if (!hudElements.turnIndicator) hudElements.turnIndicator = document.getElementById('turn-indicator');
  if (!hudElements.endTurnButton) hudElements.endTurnButton = document.getElementById('end-turn');
  const { endTurnButton } = hudElements;
  if (endTurnButton && !endTurnButton.__pairleroyBound) {
    endTurnButton.__pairleroyBound = true;
    endTurnButton.addEventListener('click', () => endCurrentTurn({ reason: 'manual' }));
  }
}

function awardPoints(player, delta, source = 'generic') {
  if (!isValidPlayer(player) || !Number.isFinite(delta) || delta === 0) return;
  const idx = playerIndex(player);
  playerScores[idx] = (playerScores[idx] || 0) + delta;
  debugLog('awardPoints', { player, delta, source, next: playerScores[idx] });
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
  if (!Number.isFinite(distance) || distance > 2 || distance > colonMoveRemaining[pIdx]) {
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
  const percentInput = document.getElementById(`pct-c${idx + 1}`);
  const label = percentInput?.parentElement?.getAttribute('title');
  const trimmed = label ? label.trim() : '';
  return trimmed || DEFAULT_COLOR_LABELS[idx] || `C${idx + 1}`;
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

function registerBuildingForPlayer(player, cardId) {
  if (!isValidPlayer(player) || !cardId) return;
  const idx = playerIndex(player);
  const record = playerResources[idx];
  if (!record) return;
  record.buildings.add(cardId);
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
  colonMoveRemaining = Array.from({ length: PLAYER_COUNT }, () => 2);
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
  colonMoveRemaining[currentIdx] = 2;
  colonPlacementUsed[currentIdx] = false;
  colonMoveRemaining[nextIdx] = 2;
  colonPlacementUsed[nextIdx] = false;
  selectedColonPlayer = null;
  updateColonMarkersPositions();
  renderGameHud();
  debugLog('endCurrentTurn', { reason, activePlayer: turnState.activePlayer, turn: turnState.turnNumber });
}

function renderGameHud() {
  ensureHudElements();
  const { scoreboard, turnIndicator } = hudElements;
  if (scoreboard) {
    scoreboard.innerHTML = '';
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

      scoreboard.appendChild(card);
    });
  }
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
  const layer = state?.marketCardsLayer ?? null;
  const cells = state?.marketCells ?? null;
  if (!layer || !Array.isArray(cells)) return;
  ensureMarketDetailElements();
  layer.innerHTML = '';
  const badgeYOffset = -0.24;
  const nameYOffset = 0.09;
  const costYOffset = 0.36;
  const nameLineGap = 0.24;
  const costLineGap = 0.2;
  const svgNS = 'http://www.w3.org/2000/svg';

  cells.forEach((cell, idx) => {
    const slotState = marketState?.slots?.[idx] ?? null;
    const def = slotState ? getMarketCardDefinition(slotState.id) : null;
    const group = document.createElementNS(svgNS, 'g');
    group.setAttribute('class', 'market-card');
    if (hoveredMarketSlot === idx) group.classList.add('market-card--active');
    group.dataset.slot = String(idx);
    group.setAttribute('transform', `translate(${cell.centerX.toFixed(3)} ${cell.centerY.toFixed(3)})`);
    group.setAttribute('tabindex', '0');
    const badge = document.createElementNS(svgNS, 'text');
    badge.setAttribute('class', 'market-card__badge');
    badge.setAttribute('text-anchor', 'middle');
    badge.setAttribute('dominant-baseline', 'central');
    badge.setAttribute('y', (cell.size * badgeYOffset).toFixed(3));
    const badgeText = (() => {
      if (!def) return '?';
      return def.type === MARKET_CARD_TYPES.BUILDING ? 'Bât' : 'Ctr';
    })();
    badge.textContent = badgeText;
    group.appendChild(badge);
    const labelLines = def ? wrapMarketLabel(def.name, { maxChars: 10, maxLines: 1 }) : ['Libre'];
    const label = createMultilineSvgText({
      svgNS,
      className: 'market-card__label',
      lines: labelLines,
      startOffset: nameYOffset,
      lineGap: nameLineGap,
      cellSize: cell.size,
    });
    group.appendChild(label);
    const costLines = def ? formatMarketCostLines(def.cost, { maxLines: 2, maxChars: 12 }) : [''];
    const cost = createMultilineSvgText({
      svgNS,
      className: 'market-card__cost',
      lines: costLines,
      startOffset: costYOffset,
      lineGap: costLineGap,
      cellSize: cell.size,
    });
    group.appendChild(cost);
    group.addEventListener('mouseenter', () => setHoveredMarketSlot(idx, group));
    group.addEventListener('focus', () => setHoveredMarketSlot(idx, group));
    group.addEventListener('mouseleave', () => {
      if (hoveredMarketSlot === idx) resetHoveredMarketSlot();
      else group.classList.remove('market-card--active');
    });
    group.addEventListener('blur', () => {
      if (hoveredMarketSlot === idx) resetHoveredMarketSlot();
      else group.classList.remove('market-card--active');
    });
    group.addEventListener('click', handleMarketCardClick);
    layer.appendChild(group);
  });
  if (!Number.isInteger(hoveredMarketSlot)) updateMarketDetailPanel(null);
}

function createMultilineSvgText({ svgNS, className, lines, startOffset, lineGap, cellSize }) {
  const textEl = document.createElementNS(svgNS, 'text');
  textEl.setAttribute('class', className);
  textEl.setAttribute('text-anchor', 'middle');
  textEl.setAttribute('dominant-baseline', 'central');
  const effectiveLines = Array.isArray(lines)
    ? lines.filter((line) => typeof line === 'string' && line.trim().length)
    : [];
  if (effectiveLines.length === 0) effectiveLines.push('');
  let first = true;
  const lineDy = cellSize * lineGap;
  const baseY = cellSize * startOffset;
  effectiveLines.forEach((line) => {
    const span = document.createElementNS(svgNS, 'tspan');
    span.setAttribute('x', '0');
    if (first) {
      span.setAttribute('y', baseY.toFixed(3));
      first = false;
    } else {
      span.setAttribute('dy', lineDy.toFixed(3));
    }
    span.textContent = line;
    textEl.appendChild(span);
  });
  return textEl;
}

function wrapMarketLabel(text, { maxChars = 12, maxLines = 2 } = {}) {
  if (typeof text !== 'string' || !text.trim()) return [''];
  const words = text.trim().split(/\s+/);
  const lines = [];
  let current = '';
  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word.length > maxChars ? word.slice(0, maxChars) : word;
    }
  });
  if (current) lines.push(current);
  if (lines.length > maxLines) {
    const trimmed = lines.slice(0, maxLines);
    const lastIdx = trimmed.length - 1;
    const last = trimmed[lastIdx];
    const ellipsis = '...';
    trimmed[lastIdx] = last.length >= maxChars
      ? `${last.slice(0, Math.max(0, maxChars - ellipsis.length))}${ellipsis}`
      : `${last}${ellipsis}`;
    return trimmed;
  }
  return lines;
}

function formatMarketCostLines(cost, { maxLines = 2, maxChars = 12 } = {}) {
  if (!cost) return [''];
  const parts = [];
  RESOURCE_ORDER.forEach((resource) => {
    const amount = cost[resource];
    if (Number.isFinite(amount) && amount > 0) {
      parts.push(`${amount} ${RESOURCE_LABELS[resource] || resource}`);
    }
  });
  if (Number.isFinite(cost.points) && cost.points > 0) {
    parts.push(`${cost.points} PV`);
  }
  if (Number.isFinite(cost.crowns) && cost.crowns > 0) {
    parts.push(`${cost.crowns} Cour.`);
  }
  if (parts.length === 0) return [''];
  const trimmed = parts.map((part) => trimMarketLine(part, maxChars));
  if (trimmed.length <= maxLines) return trimmed;
  const limited = trimmed.slice(0, maxLines);
  limited[maxLines - 1] = trimMarketLine(`${limited[maxLines - 1]} ...`, maxChars);
  return limited;
}

function trimMarketLine(text, maxChars) {
  const clean = (text ?? '').toString().trim();
  if (clean.length <= maxChars) return clean;
  return `${clean.slice(0, Math.max(0, maxChars - 3))}...`;
}

function handleMarketCardClick(event) {
  const target = event.currentTarget;
  const slotIdx = Number(target?.dataset?.slot ?? -1);
  const slotState = Number.isInteger(slotIdx) && slotIdx >= 0 ? marketState?.slots?.[slotIdx] ?? null : null;
  debugLog('market-slot-click', { slot: slotIdx, card: slotState });
}

function setHoveredMarketSlot(slotIdx, element = null) {
  if (slotIdx != null && (!Number.isInteger(slotIdx) || slotIdx < 0)) return;
  hoveredMarketSlot = slotIdx;
  applyMarketCardActiveClass(element);
  updateMarketDetailPanel(slotIdx);
}

function resetHoveredMarketSlot() {
  hoveredMarketSlot = null;
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

function updateMarketDetailPanel(slotIdx) {
  const elements = ensureMarketDetailElements();
  if (!elements.container) return;
  if (!Number.isInteger(slotIdx) || slotIdx < 0) {
    elements.type.textContent = 'Marche';
    elements.slot.textContent = '';
    elements.name.textContent = 'Survolez une carte';
    elements.cost.textContent = '--';
    elements.reward.textContent = '--';
    elements.description.textContent = 'Passez la souris sur une carte du marche pour voir son effet.';
    return;
  }
  const slotState = marketState?.slots?.[slotIdx] ?? null;
  const def = slotState ? getMarketCardDefinition(slotState.id) : null;
  if (!def) {
    updateMarketDetailPanel(null);
    return;
  }
  elements.type.textContent = MARKET_TYPE_LABELS[def.type] || 'Marche';
  elements.slot.textContent = 'Case ' + String(slotIdx + 1).padStart(2, '0');
  elements.name.textContent = def.name || 'Carte inconnue';
  elements.cost.textContent = summarizeMarketCost(def.cost) || '--';
  elements.reward.textContent = summarizeMarketReward(def.reward) || '--';
  elements.description.textContent = def.description || '--';
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
  assert100(cfg.colorPct, 'Répartition des couleurs');
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

  function evaluateAmenagementsAround(tileIdx) {
    if (!Number.isInteger(tileIdx)) return;
    let changed = false;
    for (const [key, entry] of junctionMap.entries()) {
      if (!entry || !Array.isArray(entry.tiles) || !entry.tiles.includes(tileIdx)) continue;
      if (!isJunctionReady(entry) || overlayByJunction.has(key)) continue;
      const owner = dominantPlayerForJunction(entry);
      if (!isValidPlayer(owner)) continue;
      if (!playerHasInfluenceForEntry(owner, entry)) continue;
      const colorIdx = dominantColorForJunction(entry);
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

  function playerHasInfluenceForEntry(player, targetEntry, maxDistance = 2) {
    if (!isValidPlayer(player) || !targetEntry) return false;
    const sources = getInfluenceEntriesForPlayer(player);
    if (!Array.isArray(sources) || sources.length === 0) return false;
    for (let i = 0; i < sources.length; i++) {
      if (distanceBetweenJunctionEntries(sources[i], targetEntry) <= maxDistance) return true;
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

    if (!findCastleKeyForPlayer(player)) {
      if (!spendPoints(player, 5, 'castle')) return;
      castleByJunction.set(key, player);
      const tilesAround = Array.isArray(entry.tiles) ? entry.tiles : [];
      tilesAround.forEach((idxTile) => evaluateAmenagementsAround(idxTile));
      renderJunctionOverlays();
      refreshStatsModal();
      return;
    }

    if (!isOutpostPlacementValid(player, entry)) {
      debugLog('outpost-placement-invalid', { key, player });
      return;
    }
    if (!spendPoints(player, 3, 'outpost')) return;
    outpostByJunction.set(key, player);
    const tilesAround = Array.isArray(entry.tiles) ? entry.tiles : [];
    tilesAround.forEach((idxTile) => evaluateAmenagementsAround(idxTile));
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
    const radius = size * 2.9;
    const seeds = [];
    castleByJunction.forEach((player, key) => {
      const entry = junctionMap.get(key);
      if (entry && isValidPlayer(player)) seeds.push({ player, entry });
    });
    outpostByJunction.forEach((player, key) => {
      const entry = junctionMap.get(key);
      if (entry && isValidPlayer(player)) seeds.push({ player, entry });
    });
    seeds.forEach(({ player, entry }) => {
      const idx = playerIndex(player);
      if (idx === -1) return;
      const zone = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      zone.setAttribute('class', 'influence-zone');
      zone.setAttribute('cx', entry.x.toFixed(3));
      zone.setAttribute('cy', entry.y.toFixed(3));
      zone.setAttribute('r', radius.toFixed(3));
      const baseColor = colonColorForIndex(idx);
      zone.setAttribute('fill', colorWithAlpha(baseColor, 0.16));
      zone.setAttribute('stroke', colorWithAlpha(baseColor, 0.45));
      zone.setAttribute('stroke-width', (size * 0.18).toFixed(3));
      layer.appendChild(zone);
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
  if (count <= 0) return 0;
  if (count <= 2) return 1;
  if (count <= 4) return 2;
  return 4;
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
  evaluateAmenagementsAround(tileIdx);
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
    const newZoom = Math.min(3, Math.max(0.4, zoom * factor));
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
      const limit = 1;
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
  closeBtn.textContent = '×';
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
}

function hideStatsModal() {
  if (!statsModalVisible) return;
  const { modal } = ensureStatsModal();
  modal.classList.remove('visible');
  statsModalVisible = false;
}

function toggleStatsModal() {
  if (statsModalVisible) hideStatsModal();
  else showStatsModal();
}

function refreshStatsModal() {
  if (!statsModalVisible) return;
  const elements = ensureStatsModal();
  const body = elements.body;
  const placed = placedCount;
  const remaining = Math.max(0, TILE_COUNT - placed);
  const counts = { 1: 0, 2: 0, 3: 0 };
  placements.forEach((placement) => {
    if (!placement?.combo) return;
    const t = placement.combo.type;
    if (t === 1 || t === 2 || t === 3) counts[t] = (counts[t] || 0) + 1;
  });
  const svg = document.querySelector('#board-container svg');
  const overlayMap = svg?.__state?.overlayByJunction ?? null;
  const castleMap = svg?.__state?.castleByJunction ?? null;
  const crestCounts = [0, 0, 0, 0, 0, 0];
  if (overlayMap) {
    for (const player of overlayMap.values()) {
      if (player >= 1 && player <= 6) crestCounts[player - 1]++;
    }
  }
  if (castleMap) {
    for (const player of castleMap.values()) {
      if (player >= 1 && player <= 6) crestCounts[player - 1]++;
    }
  }

  const crestRows = crestCounts
    .map((value, idx) => `<div>J${idx + 1}</div><div>${value}</div>`)
    .join('');

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
    <div class="stats-section-title">Blasons</div>
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

  document.addEventListener('keydown', handleStatsKeyDown);
  document.addEventListener('keyup', handleStatsKeyUp);
}

window.addEventListener('DOMContentLoaded', () => {
  parseConfigFromURL();
  bindUI();
  generateAndRender();
});





















