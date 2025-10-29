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

const BUILDING_EFFECT_TYPES = [
  { value: 'points', label: 'Points immediats' },
  { value: 'tileLimit', label: 'Tuiles supplementaires par tour' },
  { value: 'tilePoints', label: 'Points par tuile placee' },
  { value: 'amenagementPoints', label: 'Bonus/malus amenagement' },
];

const DEFAULT_BUILDINGS = [
  {
    id: 'watchtower',
    name: 'Tour de garde',
    description: 'Accorde 3 points immediats.',
    cost: { 0: 2 },
    effect: { type: 'points', value: 3 },
  },
  {
    id: 'market',
    name: 'Marche',
    description: 'Accorde 5 points immediats.',
    cost: { 1: 1, 2: 1 },
    effect: { type: 'points', value: 5 },
  },
  {
    id: 'citadel',
    name: 'Citadelle',
    description: 'Augmente la limite de pose de tuile de 1.',
    cost: { 0: 2, 1: 1, 2: 1 },
    effect: { type: 'tileLimit', value: 1 },
  },
];

function normalizeBuildingCost(cost = {}) {
  const normalized = {};
  for (let i = 0; i < 4; i++) {
    const value = Number(cost[i] ?? cost[String(i)] ?? 0) || 0;
    if (value > 0) normalized[i] = value;
  }
  return normalized;
}

function normalizeBuildingEffect(effect, fallbackPoints = 0) {
  if (effect && typeof effect.type === 'string') {
    return {
      type: effect.type,
      value: Number(effect.value) || 0,
      target: effect.target ?? null,
      color: Number.isInteger(effect.color) ? effect.color : null,
    };
  }
  if (Number.isFinite(fallbackPoints) && fallbackPoints !== 0) {
    return { type: 'points', value: Number(fallbackPoints) || 0 };
  }
  return { type: 'points', value: 0 };
}

function normalizeBuilding(def, idx = 0) {
  return {
    id: def.id || `building-${idx + 1}`,
    name: def.name || `Batiment ${idx + 1}`,
    description: def.description || '',
    cost: normalizeBuildingCost(def.cost),
    effect: normalizeBuildingEffect(def.effect, def.points),
  };
}

let buildingDefinitions = DEFAULT_BUILDINGS.map(normalizeBuilding);

function createEmptyPlayerResource() {
  return {
    tileColors: new Map(),
    amenagements: new Set(),
    amenagementColors: new Map(),
    buildings: new Map(),
  };
}

function defaultPlayerModifiers() {
  return {
    tileLimitBonus: 0,
    tilePointBonus: 0,
    amenagementPointModifier: 0,
  };
}

let playerScores = Array.from({ length: PLAYER_COUNT }, () => 0);
let playerResources = Array.from({ length: PLAYER_COUNT }, () => createEmptyPlayerResource());
let playerModifiers = Array.from({ length: PLAYER_COUNT }, () => defaultPlayerModifiers());

const turnState = {
  activePlayer: PLAYER_IDS[0],
  tilesPlacedByPlayer: Array.from({ length: PLAYER_COUNT }, () => 0),
  turnNumber: 1,
};

const hudElements = {
  scoreboard: null,
  turnIndicator: null,
  endTurnButton: null,
  buildingPanel: null,
};

const amenagementColorByKey = new Map();
let castleOwners = [];

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
}

function recomputePlayerModifiersFor(playerIdx) {
  const mods = defaultPlayerModifiers();
  const record = playerResources[playerIdx];
  if (record) {
    record.buildings.forEach((count, buildingId) => {
      const definition = buildingDefinitions.find((b) => b.id === buildingId);
      if (!definition || !definition.effect) return;
      const value = Number(definition.effect.value) || 0;
      switch (definition.effect.type) {
        case 'tileLimit':
          mods.tileLimitBonus += value * count;
          break;
        case 'tilePoints':
          mods.tilePointBonus += value * count;
          break;
        case 'amenagementPoints':
          mods.amenagementPointModifier += value * count;
          break;
        default:
          break;
      }
    });
  }
  playerModifiers[playerIdx] = mods;
}

function recomputeAllPlayerModifiers() {
  for (let idx = 0; idx < PLAYER_COUNT; idx++) recomputePlayerModifiersFor(idx);
}

function ensureHudElements() {
  if (!hudElements.scoreboard) hudElements.scoreboard = document.getElementById('scoreboard');
  if (!hudElements.turnIndicator) hudElements.turnIndicator = document.getElementById('turn-indicator');
  if (!hudElements.endTurnButton) hudElements.endTurnButton = document.getElementById('end-turn');
  if (!hudElements.buildingPanel) hudElements.buildingPanel = document.getElementById('building-panel');
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

function amenagementColorAvailable(playerIdx, colorIdx) {
  const record = playerResources[playerIdx];
  if (!record) return 0;
  return record.amenagementColors.get(colorIdx) || 0;
}

function effectiveBuildingCost(definition, playerIdx) {
  const base = normalizeBuildingCost(definition.cost);
  if (!playerModifiers[playerIdx]) return base;
  const modifier = playerModifiers[playerIdx].amenagementPointModifier || 0;
  if (!modifier) return base;
  const adjusted = {};
  Object.entries(base).forEach(([colorKey, value]) => {
    const next = Math.max(0, value - modifier);
    if (next > 0) adjusted[colorKey] = next;
  });
  return adjusted;
}

function canBuild(playerIdx, building) {
  if (!building) return false;
  const costs = effectiveBuildingCost(building, playerIdx);
  return Object.entries(costs).every(([colorKey, value]) => {
    const required = Number(value) || 0;
    if (required <= 0) return true;
    return amenagementColorAvailable(playerIdx, Number(colorKey)) >= required;
  });
}

function buildBuilding(player, building) {
  if (!isValidPlayer(player) || !building) return false;
  const idx = playerIndex(player);
  const definition = buildingDefinitions.find((b) => b.id === building.id) || building;
  if (!canBuild(idx, definition)) return false;
  Object.entries(effectiveBuildingCost(definition, idx)).forEach(([colorKey, value]) => {
    const required = Number(value) || 0;
    if (required > 0) adjustResourceColorTally(player, Number(colorKey), -required);
  });
  const record = playerResources[idx];
  const current = record.buildings.get(definition.id) || 0;
  record.buildings.set(definition.id, current + 1);
  recomputePlayerModifiersFor(idx);
  if (definition.effect?.type === 'points') {
    const points = Number(definition.effect.value) || 0;
    if (points !== 0) awardPoints(player, points, `building:${definition.id}`);
  }
  renderGameHud();
  refreshStatsModal();
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
  const input = document.getElementById(`color-c${idx + 1}`);
  if (!input) return `C${idx + 1}`;
  const label = input.getAttribute('data-label');
  const trimmed = label ? label.trim() : '';
  return trimmed || `C${idx + 1}`;
}

let cachedColorValues = ['', '', '', ''];
let cachedParsedColors = [null, null, null, null];

function updateColorPercentageStyles() {
  let colorsChanged = false;
  
  for (let idx = 1; idx <= 4; idx++) {
    const colorInput = document.getElementById(`color-c${idx}`);
    const percentInput = document.getElementById(`pct-c${idx}`);
    if (!colorInput || !percentInput) continue;
    
    const currentValue = colorInput.value;
    const cacheIdx = idx - 1;
    
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
    renderBuildingPanel();
  }
}

function generateBuildingId(base = 'building') {
  let counter = 1;
  let id = `${base}-${counter}`;
  while (buildingDefinitions.some((b) => b.id === id)) {
    counter += 1;
    id = `${base}-${counter}`;
  }
  return id;
}

function addNewBuildingDefinition() {
  const id = generateBuildingId();
  buildingDefinitions.push({
    id,
    name: 'Nouveau batiment',
    description: '',
    cost: {},
    effect: { type: 'points', value: 0 },
  });
  recomputeAllPlayerModifiers();
  renderGameHud();
  refreshStatsModal();
}

function removeBuildingDefinition(id) {
  const index = buildingDefinitions.findIndex((b) => b.id === id);
  if (index === -1) return;
  buildingDefinitions.splice(index, 1);
  playerResources.forEach((record, idx) => {
    if (record.buildings.delete(id)) recomputePlayerModifiersFor(idx);
  });
  recomputeAllPlayerModifiers();
  renderGameHud();
  refreshStatsModal();
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

function resetGameDataForNewBoard() {
  playerScores = Array.from({ length: PLAYER_COUNT }, () => 0);
  playerResources = Array.from({ length: PLAYER_COUNT }, () => createEmptyPlayerResource());
  playerModifiers = Array.from({ length: PLAYER_COUNT }, () => defaultPlayerModifiers());
  resetTurnCounters();
  turnState.turnNumber = 1;
  turnState.activePlayer = PLAYER_IDS[0];
  amenagementColorByKey.clear();
  castleOwners = new Array(tiles.length).fill(null);
  renderGameHud();
}

function setActivePlayer(player, { advanceTurn = false } = {}) {
  if (!isValidPlayer(player)) return;
  if (turnState.activePlayer === player && !advanceTurn) {
    renderGameHud();
    return;
  }
  turnState.activePlayer = player;
  renderGameHud();
}

function endCurrentTurn({ reason = 'auto' } = {}) {
  const currentIdx = playerIndex(turnState.activePlayer);
  if (currentIdx === -1) return;
  turnState.tilesPlacedByPlayer[currentIdx] = 0;
  const nextIdx = (currentIdx + 1) % PLAYER_COUNT;
  if (nextIdx === 0) turnState.turnNumber += 1;
  turnState.activePlayer = PLAYER_IDS[nextIdx];
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
      if (isActive) card.classList.add('scorecard--active');
      card.addEventListener('click', () => {
        if (player !== turnState.activePlayer) setActivePlayer(player);
      });

      const iconWrap = document.createElement('span');
      iconWrap.className = 'scorecard-icon';
      iconWrap.appendChild(createScorecardIcon(player));
      card.appendChild(iconWrap);

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

      scoreboard.appendChild(card);
    });
  }
  if (turnIndicator) {
    turnIndicator.textContent = `Tour ${turnState.turnNumber} - Joueur ${turnState.activePlayer}`;
  }
  renderBuildingPanel();
}

function renderBuildingPanel() {
  ensureHudElements();
  const container = hudElements.buildingPanel;
  if (!container) return;
  const activeColors = window.__pairleroyActiveColors ?? [];
  const colorCount = Math.max(4, activeColors.length);
  const player = turnState.activePlayer;
  const playerIdx = playerIndex(player);
  const record = playerResources[playerIdx];
  container.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'building-panel-header';
  header.textContent = 'Bâtiments';
  container.appendChild(header);

  if (!buildingDefinitions.length) {
    const empty = document.createElement('div');
    empty.className = 'building-empty';
    empty.textContent = 'Aucun bâtiment configuré.';
    container.appendChild(empty);
  }

  buildingDefinitions.forEach((building, index) => {
    const card = document.createElement('div');
    card.className = 'building-card';

    const nameRow = document.createElement('div');
    nameRow.className = 'building-name-row';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'building-name-input';
    nameInput.value = building.name;
    nameInput.addEventListener('change', (event) => {
      const value = event.target.value.trim();
      building.name = value || `Batiment ${index + 1}`;
      renderGameHud();
    });
    nameRow.appendChild(nameInput);
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'building-delete';
    deleteBtn.textContent = 'Supprimer';
    deleteBtn.addEventListener('click', () => removeBuildingDefinition(building.id));
    nameRow.appendChild(deleteBtn);
    card.appendChild(nameRow);

    const descInput = document.createElement('textarea');
    descInput.className = 'building-desc-input';
    descInput.rows = 2;
    descInput.value = building.description || '';
    descInput.placeholder = 'Description';
    descInput.addEventListener('change', (event) => {
      building.description = event.target.value;
      renderGameHud();
    });
    card.appendChild(descInput);

    const costSection = document.createElement('div');
    costSection.className = 'building-cost-inputs';
    for (let colorIdx = 0; colorIdx < colorCount; colorIdx++) {
      const wrapper = document.createElement('label');
      wrapper.className = 'building-cost-input';
      const badge = document.createElement('span');
      badge.className = 'building-cost-label';
      badge.textContent = colorLabelForIndex(colorIdx);
      const paletteColor = activeColors[colorIdx] ?? '#bdae92';
      badge.style.borderColor = paletteColor;
      const rgbCost = parseHexColor(paletteColor);
      if (rgbCost) wrapper.style.backgroundColor = blendWithWhite(rgbCost, 0.8);
      wrapper.appendChild(badge);
      const input = document.createElement('input');
      input.type = 'number';
      input.min = '0';
      input.value = String(building.cost[colorIdx] ?? 0);
      input.addEventListener('change', (event) => {
        const value = Math.max(0, Number(event.target.value) || 0);
        if (value > 0) building.cost[colorIdx] = value;
        else delete building.cost[colorIdx];
        renderGameHud();
      });
      wrapper.appendChild(input);
      const available = amenagementColorAvailable(playerIdx, colorIdx);
      if (available < (Number(input.value) || 0)) wrapper.classList.add('insufficient');
      input.setAttribute('title', `Disponible: ${available}`);
      costSection.appendChild(wrapper);
    }
    card.appendChild(costSection);

    const effectRow = document.createElement('div');
    effectRow.className = 'building-effect-row';
    const effectSelect = document.createElement('select');
    effectSelect.className = 'building-effect-select';
    BUILDING_EFFECT_TYPES.forEach((type) => {
      const option = document.createElement('option');
      option.value = type.value;
      option.textContent = type.label;
      effectSelect.appendChild(option);
    });
    effectSelect.value = building.effect?.type || 'points';
    effectSelect.addEventListener('change', (event) => {
      building.effect = {
        type: event.target.value,
        value: Number(building.effect?.value) || 0,
        target: building.effect?.target ?? null,
        color: building.effect?.color ?? null,
      };
      recomputeAllPlayerModifiers();
      renderGameHud();
    });
    effectRow.appendChild(effectSelect);
    const effectValue = document.createElement('input');
    effectValue.type = 'number';
    effectValue.className = 'building-effect-value';
    effectValue.value = String(Number(building.effect?.value) || 0);
    effectValue.addEventListener('change', (event) => {
      if (!building.effect) building.effect = { type: 'points', value: 0 };
      building.effect.value = Number(event.target.value) || 0;
      recomputeAllPlayerModifiers();
      renderGameHud();
    });
    effectRow.appendChild(effectValue);
    card.appendChild(effectRow);

    const footer = document.createElement('div');
    footer.className = 'building-footer';
    const count = record?.buildings.get(building.id) || 0;
    const countLabel = document.createElement('span');
    countLabel.className = 'building-count';
    countLabel.textContent = `Possede : ${count}`;
    footer.appendChild(countLabel);
    const buildBtn = document.createElement('button');
    buildBtn.type = 'button';
    buildBtn.textContent = 'Construire';
    const enabled = canBuild(playerIdx, building);
    buildBtn.disabled = !enabled;
    buildBtn.addEventListener('click', () => buildBuilding(player, building));
    footer.appendChild(buildBtn);
    card.appendChild(footer);

    container.appendChild(card);
  });

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'building-add';
  addBtn.textContent = 'Ajouter un batiment';
  addBtn.addEventListener('click', () => addNewBuildingDefinition());
  container.appendChild(addBtn);

  container.classList.toggle('building-panel--empty', buildingDefinitions.length === 0);
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
  const colors = [
    document.getElementById('color-c1').value,
    document.getElementById('color-c2').value,
    document.getElementById('color-c3').value,
    document.getElementById('color-c4').value,
  ];
  return { typesPct: [mono, bi, tri], colorPct: [c1, c2, c3, c4], colors };
}

function assert100(array, label) {
  const sum = array.reduce((a, b) => a + b, 0);
  if (Math.round(sum) !== 100) throw new Error(`${label} doit totaliser 100 (actuellement ${sum})`);
}

function layoutSize(container) {
  const W = container.clientWidth;
  const H = container.clientHeight;
  const estW = Math.sqrt(3) * (2 * RADIUS + 1);
  const estH = 1.5 * (2 * RADIUS) + 2;
  const sizeByW = W / estW;
  const sizeByH = H / estH;
  const size = Math.floor(Math.min(sizeByW, sizeByH)) - 2;
  const width = Math.sqrt(3) * size * (2 * RADIUS + 1);
  const height = 1.5 * size * (2 * RADIUS) + 2 * size;
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
    if (cols.length === 4) {
      document.getElementById('color-c1').value = cols[0];
      document.getElementById('color-c2').value = cols[1];
      document.getElementById('color-c3').value = cols[2];
      document.getElementById('color-c4').value = cols[3];
    }
  }
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
    updateClearButtonState();
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

  function assignAmenagementOwner(key, player) {
    if (!junctionMap.has(key) || !isValidPlayer(player)) return;
    const entry = junctionMap.get(key);
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
      ng.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        removeAmenagementOwner(key);
      });
      g.appendChild(ng);
    }
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
    if (trackResources && isValidPlayer(player)) {
      adjustPlayerTileResources(player, combo, 1);
      const idx = playerIndex(player);
      if (idx !== -1) {
        const current = turnState.tilesPlacedByPlayer[idx] ?? 0;
        turnState.tilesPlacedByPlayer[idx] = current + 1;
        const tileBonus = playerModifiers[idx]?.tilePointBonus || 0;
        if (tileBonus) awardPoints(player, tileBonus, 'tile-bonus');
      }
      renderGameHud();
    }
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
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', `M ${center.x} ${center.y} L ${a.x} ${a.y} L ${b.x} ${b.y} Z`);
      p.setAttribute('fill', fillColors[ORIENTED_INDEX_FOR_TRIANGLE[i]]);
      p.setAttribute('fill-opacity', '0.6');
      previewLayer.appendChild(p);
    }
    const outline = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    outline.setAttribute('d', roundedHexPathAt(center.x, center.y, size, 0.18));
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
      const placedThisTurn = turnState.tilesPlacedByPlayer[pIdx] ?? 0;
      const limit = 1 + (playerModifiers[pIdx]?.tileLimitBonus || 0);
      if (placedThisTurn >= limit) {
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
    autoState,
  };
  svg.__state = svgState;

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
  const crestCounts = [0, 0, 0, 0, 0, 0];
  if (overlayMap) {
    for (const player of overlayMap.values()) {
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
    state.regenPalette?.();
    state.setSelectedPalette?.(-1);
  });

  const ids = [
    'pct-mono', 'pct-bi', 'pct-tri',
    'pct-c1', 'pct-c2', 'pct-c3', 'pct-c4',
    'color-c1', 'color-c2', 'color-c3', 'color-c4',
  ];
  for (const id of ids) {
    document.getElementById(id).addEventListener('change', generateAndRender);
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
      if (selected >= 0) {
          const combo = combos[selected];
          if (combo) {
            const steps = rotationStepsForCombo(combo);
            if (steps.length > 1) {
              combo.rotationStep = nextRotationStep(combo, combo.rotationStep);
            renderPaletteUI(combos);
            state.paletteCombos = combos;
            state.setSelectedPalette?.(selected);
              event.preventDefault();
            }
          }
        }
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
