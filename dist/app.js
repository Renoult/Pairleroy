// ----- src/js/core.js -----
// Fichier: src/js/core.js
// Description: Fonctions purement logiques (maths hexagonaux, quotas, RNG, combos).

const RADIUS = 6;
const TILE_COUNT = 3 * RADIUS * (RADIUS + 1) + 1;
const ROUNDED_ARC_RATIO = 0.26;
const NEIGHBOR_DIRS = [
  { q: -1, r: 1 }, // index 0
  { q: -1, r: 0 }, // index 1
  { q: 0, r: -1 }, // index 2
  { q: 1, r: -1 }, // index 3
  { q: 1, r: 0 },  // index 4
  { q: 0, r: 1 },  // index 5
];
const DEBUG_AUTOFILL = true;

// Layout constants shared between main.js and render.js
const SQUARE_GRID_COLS = 6;
const SQUARE_GRID_ROWS = 6;
const SQUARE_CELL_FACTOR = 2.4;
const SQUARE_GAP_FACTOR = 0.35;
const SQUARE_MARGIN_FACTOR = 6;

function debugLog(...args) {
  if (!DEBUG_AUTOFILL) return;
  console.log('[auto-fill]', ...args);
}

// ---------------- RNG ----------------
function xorshift32(seed) {
  let x = seed >>> 0;
  return function next() {
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17; x >>>= 0;
    x ^= x << 5; x >>>= 0;
    return x / 0x100000000;
  };
}

function cryptoSeed() {
  const arr = new Uint32Array(1);
  if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(arr);
  else arr[0] = Math.floor(Math.random() * 0xffffffff);
  return arr[0] >>> 0;
}

// ---------------- Hex math ----------------
function axialToPixel(q, r, size) {
  const x = size * Math.sqrt(3) * (q + r / 2);
  const y = size * 1.5 * r;
  return { x, y };
}

function hexVerticesAt(cx, cy, size) {
  const verts = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    verts.push({ x: cx + size * Math.cos(angle), y: cy + size * Math.sin(angle) });
  }
  return verts;
}

function hexVertexPositions(q, r, size) {
  const { x: cx, y: cy } = axialToPixel(q, r, size);
  return hexVerticesAt(cx, cy, size);
}

function pointAlongFrom(p, q, dist) {
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const len = Math.hypot(dx, dy) || 1;
  const t = Math.min(0.5, dist / len);
  return { x: p.x + dx * t, y: p.y + dy * t };
}

function roundedHexPathAt(cx, cy, size, rf = ROUNDED_ARC_RATIO) {
  const v = hexVerticesAt(cx, cy, size);
  const round = new Set([0, 2, 4]);
  const r = size * rf;
  let d = `M ${v[1].x.toFixed(3)} ${v[1].y.toFixed(3)}`;
  for (let k = 2; k < 8; k++) {
    const i = k % 6;
    const prev = (i + 5) % 6;
    const next = (i + 1) % 6;
    if (round.has(i)) {
      const p1 = pointAlongFrom(v[i], v[prev], r);
      const p2 = pointAlongFrom(v[i], v[next], r);
      d += ` L ${p1.x.toFixed(3)} ${p1.y.toFixed(3)} A ${r.toFixed(3)} ${r.toFixed(3)} 0 0 0 ${p2.x.toFixed(3)} ${p2.y.toFixed(3)}`;
    } else {
      d += ` L ${v[i].x.toFixed(3)} ${v[i].y.toFixed(3)}`;
    }
  }
  d += ' Z';
  return d;
}

// ---------------- Color combos ----------------
function comboToSideColors(combo) {
  if (combo.type === 1) return Array(6).fill(combo.colors[0]);
  if (combo.type === 2) {
    const [maj, min] = combo.colors;
    return [maj, min, min, maj, maj, maj];
  }
  const [a, b, c] = combo.colors;
  return [a, b, b, c, c, a];
}

function rotateSideColors(colors, steps) {
  const s = steps % 6;
  if (s === 0) return colors.slice();
  return colors.slice(s).concat(colors.slice(0, s));
}

// ---------------- Grid helpers ----------------
function buildNeighborData(tiles) {
  const indexMap = new Map();
  tiles.forEach((t, idx) => indexMap.set(`${t.q},${t.r}`, idx));
  const neighbors = tiles.map((t) => NEIGHBOR_DIRS.map(({ q, r }) => {
    const key = `${t.q + q},${t.r + r}`;
    return indexMap.has(key) ? indexMap.get(key) : -1;
  }));
  return { indexMap, neighbors };
}

function tileDistance(t) {
  return Math.max(Math.abs(t.q), Math.abs(t.r), Math.abs(t.s));
}

function tileAngle(t) {
  const { x, y } = axialToPixel(t.q, t.r, 1);
  return Math.atan2(y, x);
}

function generateAxialGrid(radius = RADIUS) {
  const tiles = [];
  for (let q = -radius; q <= radius; q++) {
    const r1 = Math.max(-radius, -q - radius);
    const r2 = Math.min(radius, -q + radius);
    for (let r = r1; r <= r2; r++) tiles.push({ q, r, s: -q - r });
  }
  return tiles;
}

function computeJunctionMap(tiles, size) {
  const acc = new Map();
  for (let idx = 0; idx < tiles.length; idx++) {
    const t = tiles[idx];
    const verts = hexVertexPositions(t.q, t.r, size);
    for (const vi of [0, 2, 4]) {
      const vx = verts[vi].x;
      const vy = verts[vi].y;
      const key = `${Math.round(vx * 1000)},${Math.round(vy * 1000)}`;
      const prev = acc.get(key);
      if (prev) {
        prev.entries.push({ tileIdx: idx, vertex: vi });
      } else {
        acc.set(key, { x: vx, y: vy, entries: [{ tileIdx: idx, vertex: vi }] });
      }
    }
  }
  const map = new Map();
  for (const [k, v] of acc.entries()) {
    if (v.entries.length >= 3) {
      const uniqueTiles = [];
      for (const entry of v.entries) {
        if (!uniqueTiles.includes(entry.tileIdx)) uniqueTiles.push(entry.tileIdx);
      }
      if (uniqueTiles.length >= 3) {
        map.set(k, { x: v.x, y: v.y, tiles: uniqueTiles.slice(0, 3), entries: v.entries });
      }
    }
  }
  return map;
}

// ---------------- Quotas & assignment ----------------
function quotasFromPercents(total, percents) {
  const sum = percents.reduce((a, b) => a + b, 0);
  if (sum <= 0) throw new Error('Pourcentages invalides');
  const raw = percents.map((p) => (p / sum) * total);
  const base = raw.map((x) => Math.floor(x));
  let rem = total - base.reduce((a, b) => a + b, 0);
  const diffs = raw.map((x, i) => ({ i, frac: x - base[i] })).sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < rem; k++) base[diffs[k].i]++;
  return base;
}

function seededShuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function chooseKDistinctColors(counts, k, rng) {
  const avail = counts.map((c, i) => ({ i, c })).filter((x) => x.c > 0);
  if (avail.length < k) return null;
  const chosen = [];
  const local = counts.slice();
  for (let t = 0; t < k; t++) {
    let total = 0;
    const pool = [];
    for (const { i, c } of avail) {
      if (local[i] > 0 && !chosen.includes(i)) {
        total += local[i];
        pool.push({ i, w: local[i] });
      }
    }
    if (pool.length === 0 || total === 0) return null;
    let r = rng() * total;
    let pick = pool[0].i;
    for (const { i, w } of pool) {
      if ((r -= w) <= 0) {
        pick = i;
        break;
      }
    }
    chosen.push(pick);
    local[pick]--;
  }
  return chosen;
}

function assignColorsToTiles(types, colorCounts, rng, maxBacktracks = 5000) {
  const order = types.map((k, idx) => ({ idx, k })).sort((a, b) => b.k - a.k);
  const result = new Array(types.length).fill(null);
  const counts = colorCounts.slice();
  let backtracks = 0;
  function dfs(pos) {
    if (pos >= order.length) return true;
    const { idx, k } = order[pos];
    const candidates = new Set();
    for (let t = 0; t < 6; t++) {
      const cset = chooseKDistinctColors(counts, k, rng);
      if (!cset) break;
      candidates.add(cset.slice().sort().join(','));
    }
    if (candidates.size === 0) {
      const colorIdx = [0, 1, 2, 3].filter((i) => counts[i] > 0).sort((i, j) => counts[j] - counts[i]);
      if (colorIdx.length >= k) candidates.add(colorIdx.slice(0, k).sort().join(','));
    }
    const list = Array.from(candidates).map((s) => s.split(',').map(Number));
    seededShuffle(list, rng);
    for (const comb of list) {
      let ok = true;
      for (const c of comb) {
        counts[c]--;
        if (counts[c] < 0) ok = false;
      }
      if (ok) {
        result[idx] = comb;
        if (dfs(pos + 1)) return true;
      }
      for (const c of comb) counts[c]++;
    }
    if (++backtracks > maxBacktracks) return false;
    return false;
  }
  const success = dfs(0);
  if (!success) throw new Error("Impossible d'assigner les couleurs avec ces quotas");
  return result;
}

function quotasHamiltonCap(total, weights, caps) {
  const n = weights.length;
  const wsum = weights.reduce((a, b) => a + b, 0) || 1;
  const raw = weights.map((w) => total * (w / wsum));
  const base = new Array(n).fill(0);
  let rem = total;
  for (let i = 0; i < n; i++) {
    base[i] = Math.min(Math.floor(raw[i]), caps[i]);
    rem -= base[i];
  }
  const order = raw.map((v, i) => ({ i, frac: v - Math.floor(v) })).sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < order.length && rem > 0; k++) {
    const i = order[k].i;
    if (base[i] < caps[i]) {
      base[i]++;
      rem--;
    }
  }
  for (let i = 0; i < n && rem > 0; i++) {
    const take = Math.min(caps[i] - base[i], rem);
    base[i] += take;
    rem -= take;
  }
  if (rem !== 0) throw new Error('Répartition impossible (caps)');
  return base;
}


function assignTileCombos(types, colorUnitTargets, rng) {
  // Phase 0: Compter les types de tuiles
  const N = types.length;
  const monoTileCount = types.filter((k) => k === 1).length;
  const biTileCount = types.filter((k) => k === 2).length;
  const triTileCount = types.filter((k) => k === 3).length;
  
  // Variable de travail pour les unités de couleurs restantes
  const colorUnitTargetsRemaining = colorUnitTargets.slice(); // sum = 3N
  
  // Phase 1: Attribuer les monochromatiques (3 unités par tuile)
  // Calcul des limites supérieures basées sur les unités disponibles
  const monoCap = colorUnitTargetsRemaining.map((u) => Math.floor(u / 3));
  // Répartition selon la méthode Hamilton avec contraintes
  const monoComboCount = quotasHamiltonCap(monoTileCount, colorUnitTargetsRemaining, monoCap);
  // Déduire les unités utilisées pour les monochromatiques
  for (let i = 0; i < 4; i++) colorUnitTargetsRemaining[i] -= 3 * monoComboCount[i];
  
  // Phase 2: Attribuer les bicolores majeures (2+1 unités par tuile)
  const biCap = colorUnitTargetsRemaining.map((u) => Math.floor(u / 2));
  const biMajorComboCount = quotasHamiltonCap(biTileCount, colorUnitTargetsRemaining, biCap);
  // Déduire les unités utilisées pour les bicolores majeures
  for (let i = 0; i < 4; i++) colorUnitTargetsRemaining[i] -= 2 * biMajorComboCount[i];
  
  // Phase 3: Répartir les unités restantes entre bicolores mineures et tricolores
  const totalRem = colorUnitTargetsRemaining.reduce((a, b) => a + b, 0);
  // Vérification: unités restantes = B tuiles bi + 3*T tuiles tri
  if (totalRem !== biTileCount + 3 * triTileCount) throw new Error('Incohérence unités restantes');
  
  // Répartir d'abord les bicolores mineures (1+2 unités par tuile)
  const biMinorComboCount = quotasHamiltonCap(biTileCount, colorUnitTargetsRemaining, colorUnitTargetsRemaining);
  // Les unités tricolores sont le reste après les bicolores mineures
  const triComboCount = colorUnitTargetsRemaining.map((v, i) => v - biMinorComboCount[i]);
  
  // Ajustement pour assurer au moins 3 couleurs disponibles pour les tricolores
  if (triTileCount > 0 && triComboCount.filter((v) => v > 0).length < 3) {
    for (let i = 0; i < 4 && triComboCount.filter((v) => v > 0).length < 3; i++) {
      if (triComboCount[i] === 0 && biMinorComboCount[i] > 0) {
        biMinorComboCount[i]--;
        triComboCount[i]++;
      }
    }
  }
  if (triTileCount > 0 && triComboCount.filter((v) => v > 0).length < 3) throw new Error('Tri nécessite au moins 3 couleurs');

  const monos = [];
  for (let c = 0; c < 4; c++) for (let k = 0; k < monoComboCount[c]; k++) monos.push(c);
  const biMaj = [];
  for (let c = 0; c < 4; c++) for (let k = 0; k < biMajorComboCount[c]; k++) biMaj.push(c);
  const biMin = [];
  for (let c = 0; c < 4; c++) for (let k = 0; k < biMinorComboCount[c]; k++) biMin.push(c);
  const triUnits = triComboCount.slice();
  seededShuffle(biMaj, rng);
  seededShuffle(biMin, rng);
  for (let att = 0; att < 50 && biMaj.some((c, i) => c === biMin[i]); att++) seededShuffle(biMin, rng);

  function buildTriTriples(counts) {
    const triples = [];
    for (let t = 0; t < triTileCount; t++) {
      const avail = [0, 1, 2, 3].filter((i) => counts[i] > 0).sort((a, b) => counts[b] - counts[a]);
      if (avail.length < 3) return null;
      const tri = [avail[0], avail[1], avail[2]];
      triples.push(tri);
      counts[tri[0]]--;
      counts[tri[1]]--;
      counts[tri[2]]--;
    }
    return triples;
  }

  const triTriples = buildTriTriples(triUnits);
  if (!triTriples) throw new Error('Répartition tri impossible');

  const combos = new Array(N);
  const idxByType = { 1: [], 2: [], 3: [] };
  types.forEach((k, i) => idxByType[k].push(i));
  seededShuffle(idxByType[1], rng);
  seededShuffle(idxByType[2], rng);
  seededShuffle(idxByType[3], rng);
  let im = 0;
  let ib = 0;
  let it = 0;
  for (const i of idxByType[1]) {
    const c = monos[im++];
    combos[i] = { type: 1, colors: [c], units: [3] };
  }
  for (const i of idxByType[2]) {
    const maj = biMaj[ib];
    const min = biMin[ib];
    ib++;
    const pair = maj === min ? [maj, (maj + 1) % 4] : [maj, min];
    combos[i] = { type: 2, colors: pair, units: [2, 1] };
  }
  for (const i of idxByType[3]) {
    const tri = triTriples[it++];
    combos[i] = { type: 3, colors: tri.slice(), units: [1, 1, 1] };
  }
  return combos;
}

// ----- src/js/palette.js -----
// Fichier: src/js/palette.js
// Description: Fonctions liées à la palette de tuiles (sélection, rotation, rendu miniatures).


function colorFromIndex(colorIdx, colors) {
  if (typeof colorIdx === 'string') {
    const trimmed = colorIdx.trim();
    if (trimmed) return trimmed.toLowerCase();
  }
  const idx = Number.isInteger(colorIdx) ? colorIdx : 0;
  const raw = colors[idx];
  if (typeof raw === 'string' && raw.trim()) return raw.trim().toLowerCase();
  const fallback = colors[0];
  if (typeof fallback === 'string' && fallback.trim()) return fallback.trim().toLowerCase();
  return '#000000';
}

function mapSideColorIndices(sideColorIdx, colors = window.__pairleroyActiveColors) {
  if (!Array.isArray(sideColorIdx)) return [];
  return sideColorIdx.map((idx) => colorFromIndex(idx, colors));
}

function rotationStepsForCombo(combo) {
  if (!combo) return [];
  return combo.type === 1 ? [0] : [0, 1, 2];
}

function normalizeRotationStep(combo, rawStep) {
  const steps = rotationStepsForCombo(combo);
  if (!steps.length) return 0;
  if (steps.includes(rawStep)) return rawStep;
  if (typeof rawStep === 'number' && rawStep % 2 === 0) {
    const half = rawStep / 2;
    if (steps.includes(half)) return half;
  }
  const count = steps.length;
  let idx = Number.isFinite(rawStep) ? Math.round(rawStep) : 0;
  idx = ((idx % count) + count) % count;
  return steps[idx] ?? steps[0];
}

function nextRotationStep(combo, currentStep) {
  const steps = rotationStepsForCombo(combo);
  if (!steps.length) return 0;
  const current = normalizeRotationStep(combo, currentStep);
  const idx = steps.indexOf(current);
  return steps[(idx + 1) % steps.length];
}

function orientedSideColors(combo, step) {
  const base = comboToSideColors(combo);
  if (combo?.type === 1) return base;
  const steps = rotationStepsForCombo(combo);
  const normalized = normalizeRotationStep(combo, step);
  const index = steps.indexOf(normalized);
  const rotation = (index === -1 ? 0 : index) * 2;
  return rotateSideColors(base, rotation);
}

function pickWeighted(weights, random) {
  const positive = [];
  let sum = 0;
  for (let i = 0; i < weights.length; i++) {
    const w = weights[i] > 0 ? weights[i] : 0;
    if (w > 0) {
      positive.push([i, w]);
      sum += w;
    }
  }
  if (!positive.length) return 0;
  let r = random() * sum;
  for (let i = 0; i < positive.length; i++) {
    const [idx, weight] = positive[i];
    r -= weight;
    if (r <= 0) return idx;
  }
  return positive[positive.length - 1][0];
}

function sampleCombo(localTypesPct, localColorPct, random) {
  const tIndex = pickWeighted(localTypesPct, random);
  const type = tIndex + 1;
  function pickColor(exclude = [], allowFallback = true) {
    let weights = localColorPct.map((p, i) => (exclude.includes(i) ? 0 : p));
    if (!weights.some((w) => w > 0)) {
      if (allowFallback) {
        weights = localColorPct.slice();
      } else {
        const pool = localColorPct
          .map((_, idx) => idx)
          .filter((idx) => !exclude.includes(idx));
        if (pool.length === 0) return 0;
        return pool[Math.floor(random() * pool.length)];
      }
    }
    return pickWeighted(weights, random);
  }
  if (type === 1) {
    const c = pickColor();
    return { type: 1, colors: [c], units: [3] };
  }
  if (type === 2) {
    const maj = pickColor();
    const min = pickColor([maj], false);
    return { type: 2, colors: [maj, min], units: [2, 1] };
  }
  const availableDistinct = localColorPct
    .map((p, idx) => (p > 0 ? idx : null))
    .filter((idx) => idx != null);
  let colors;
  if (availableDistinct.length >= 3) {
    colors = [];
    const exclude = [];
    for (let i = 0; i < 3; i++) {
      const idx = pickColor(exclude, false);
      colors.push(idx);
      exclude.push(idx);
    }
  } else {
    colors = [pickColor(), pickColor(), pickColor()];
  }
  return { type: 3, colors, units: [1, 1, 1] };
}

function renderComboSVG(combo, size = 80, colors) {
  const padding = 8;
  const cx = size / 2;
  const cy = size / 2;
  const outlineRadius = (size / 2) - padding;
  const fillRadius = outlineRadius - 1.2;
  const svgSmall = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svgSmall.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svgSmall.setAttribute('width', size);
  svgSmall.setAttribute('height', size);
  svgSmall.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  const verts = hexVerticesAt(cx, cy, fillRadius);
  const center = { x: cx, y: cy };
  const rotation = normalizeRotationStep(combo, combo.rotationStep);
  const oriented = orientedSideColors(combo, rotation);
  const fillColors = mapSideColorIndices(oriented, colors);
  const tris = [];
  for (let i = 0; i < 6; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % 6];
    const fillColor = fillColors[ORIENTED_INDEX_FOR_TRIANGLE[i]];
    const p = createTrianglePathElement(center, a, b, { fill: fillColor });
    tris.push(p);
    svgSmall.appendChild(p);
  }
  const outline = createHexOutlineElement(cx, cy, outlineRadius, { class: 'outline' });
  svgSmall.appendChild(outline);
  return svgSmall;
}

function renderPalette(combos, colors, setSelectedPalette) {
  const paletteEl = document.getElementById('palette-items');
  if (!paletteEl) return;
  paletteEl.innerHTML = '';
  combos.forEach((combo, idx) => {
    combo.rotationStep = normalizeRotationStep(combo, combo.rotationStep);
    const div = document.createElement('div');
    div.className = 'palette-item';
    div.setAttribute('data-idx', String(idx));
    div.appendChild(renderComboSVG(combo, 80, colors));
    div.addEventListener('click', () => setSelectedPalette(idx));
    paletteEl.appendChild(div);
  });
}

function createPalette(typesPct, colorPct, rng) {
  const combos = [];
  for (let i = 0; i < 4; i++) {
    const combo = sampleCombo(typesPct, colorPct, rng);
    const steps = rotationStepsForCombo(combo);
    combo.rotationStep = steps[0] ?? 0;
    combos.push(combo);
  }
  return combos;
}

// ----- src/js/render.js -----
// Fichier: src/js/render.js
// Description: Fonctions DOM/SVG liées à l'affichage de la grille et des palettes.


const PLAYER_SHAPES = {
  1: {
    name: 'rond',
    draw: (g, cx, cy, r) => {
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', cx);
      c.setAttribute('cy', cy);
      c.setAttribute('r', r * 0.75);
      c.setAttribute('class', 'overlay-solid');
      g.appendChild(c);
    },
  },
  2: {
    name: 'croix',
    draw: (g, cx, cy, r) => {
      const t = r * 0.55;
      const L = r * 1.9;
      const mkRect = (x, y, w, h) => {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', x);
        rect.setAttribute('y', y);
        rect.setAttribute('width', w);
        rect.setAttribute('height', h);
        rect.setAttribute('class', 'overlay-solid');
        return rect;
      };
      g.appendChild(mkRect(cx - L / 2, cy - t / 2, L, t));
      g.appendChild(mkRect(cx - t / 2, cy - L / 2, t, L));
    },
  },
  3: {
    name: 'triangle',
    draw: (g, cx, cy, r) => {
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      const pts = [];
      const n = 3;
      const R = r * 1.35;
      const rot = -90;
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n + (rot * Math.PI) / 180;
        pts.push(`${(cx + R * Math.cos(a)).toFixed(2)},${(cy + R * Math.sin(a)).toFixed(2)}`);
      }
      p.setAttribute('points', pts.join(' '));
      p.setAttribute('class', 'overlay-solid');
      g.appendChild(p);
    },
  },
  4: {
    name: 'carré',
    draw: (g, cx, cy, r) => {
      const s = r * 1.55;
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', (cx - s / 2).toFixed(2));
      rect.setAttribute('y', (cy - s / 2).toFixed(2));
      rect.setAttribute('width', s.toFixed(2));
      rect.setAttribute('height', s.toFixed(2));
      rect.setAttribute('class', 'overlay-solid');
      g.appendChild(rect);
    },
  },
  5: {
    name: 'pentagone',
    draw: (g, cx, cy, r) => {
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      const pts = [];
      const n = 5;
      const R = r * 0.95;
      const rot = -90;
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n + (rot * Math.PI) / 180;
        pts.push(`${(cx + R * Math.cos(a)).toFixed(2)},${(cy + R * Math.sin(a)).toFixed(2)}`);
      }
      p.setAttribute('points', pts.join(' '));
      p.setAttribute('class', 'overlay-solid');
      g.appendChild(p);
    },
  },
  6: {
    name: 'hexagone',
    draw: (g, cx, cy, r) => {
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      const pts = [];
      const n = 6;
      const R = r * 0.95;
      const rot = -30;
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n + (rot * Math.PI) / 180;
        pts.push(`${(cx + R * Math.cos(a)).toFixed(2)},${(cy + R * Math.sin(a)).toFixed(2)}`);
      }
      p.setAttribute('points', pts.join(' '));
      p.setAttribute('class', 'overlay-solid');
      g.appendChild(p);
    },
  },
};

function buildSVG({ width, height, size, tiles, combos, colors }) {
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');

  const hexWidth = Math.sqrt(3) * size * (2 * RADIUS + 1);
  const hexHeight = 1.5 * size * (2 * RADIUS) + 2 * size;
  const margin = size * SQUARE_MARGIN_FACTOR;
  const gridCols = SQUARE_GRID_COLS;
  const gridRows = SQUARE_GRID_ROWS;
  const cellSize = size * SQUARE_CELL_FACTOR;
  const gap = cellSize * SQUARE_GAP_FACTOR;
  const squareWidth = gridCols * cellSize + (gridCols - 1) * gap;
  const squareHeight = gridRows * cellSize + (gridRows - 1) * gap;
  const totalWidth = hexWidth + margin + squareWidth;
  const totalHeight = Math.max(hexHeight, squareHeight);
  const hexTranslateX = -totalWidth / 2 + hexWidth / 2;
  const squareTranslateX = totalWidth / 2 - squareWidth / 2;

  svg.setAttribute('viewBox', `${-totalWidth / 2} ${-totalHeight / 2} ${totalWidth} ${totalHeight}`);
  svg.setAttribute('aria-label', 'Grille hexagonale');
  const viewport = document.createElementNS(svgNS, 'g');
  viewport.setAttribute('id', 'viewport');
  const gridG = document.createElementNS(svgNS, 'g');
  gridG.setAttribute('id', 'grid');
  const previewG = document.createElementNS(svgNS, 'g');
  previewG.setAttribute('id', 'preview');
  previewG.style.pointerEvents = 'none';
  const overlaysG = document.createElementNS(svgNS, 'g');
  overlaysG.setAttribute('id', 'overlays');
  const junctionsG = document.createElementNS(svgNS, 'g');
  junctionsG.setAttribute('id', 'junctions');
  const junctionOverlaysG = document.createElementNS(svgNS, 'g');
  junctionOverlaysG.setAttribute('id', 'junction-overlays');
  const castleLayer = document.createElementNS(svgNS, 'g');
  castleLayer.setAttribute('id', 'junction-castles');
  const colonsLayer = document.createElementNS(svgNS, 'g');
  colonsLayer.setAttribute('id', 'colons');
  const hexLayer = document.createElementNS(svgNS, 'g');
  hexLayer.setAttribute('id', 'hex-layer');
  hexLayer.setAttribute('transform', `translate(${hexTranslateX.toFixed(3)} 0)`);

  tiles.forEach((t, idx) => {
    const { x, y } = axialToPixel(t.q, t.r, size);
    const center = { x, y };
    const g = document.createElementNS(svgNS, 'g');
    g.setAttribute('class', 'tile');
    g.setAttribute('data-idx', String(idx));
    g.setAttribute('data-q', String(t.q));
    g.setAttribute('data-r', String(t.r));
    const verts = hexVerticesAt(center.x, center.y, size - 0.6);
    const c = combos ? combos[idx] : null;
    const type = c?.type;

    const defs = svg.querySelector('defs') || (() => {
      const d = document.createElementNS(svgNS, 'defs');
      svg.insertBefore(d, svg.firstChild);
      return d;
    })();
    const clipId = `clip-${idx}`;
    const cp = document.createElementNS(svgNS, 'clipPath');
    cp.setAttribute('id', clipId);
    const roundPath = createHexOutlineElement(center.x, center.y, size - 0.2, { 'data-clip': 'round' });
    cp.appendChild(roundPath);
    defs.appendChild(cp);
    const fillGroup = document.createElementNS(svgNS, 'g');
    fillGroup.setAttribute('clip-path', `url(#${clipId})`);
    fillGroup.setAttribute('class', 'fills');

    const tris = [];
    for (let i = 0; i < 6; i++) {
      const a = verts[i];
      const b = verts[(i + 1) % 6];
      const p = createTrianglePathElement(center, a, b);
      tris.push(p);
    }
    if (type === 1) {
      for (let i = 0; i < 6; i++) {
        tris[i].setAttribute('fill', colors[c.colors[0]]);
        fillGroup.appendChild(tris[i]);
      }
    } else if (type === 2) {
      const major = c.colors[0];
      const minor = c.colors[1];
      for (let i = 0; i < 4; i++) {
        tris[i].setAttribute('fill', colors[major]);
        fillGroup.appendChild(tris[i]);
      }
      for (let i = 4; i < 6; i++) {
        tris[i].setAttribute('fill', colors[minor]);
        fillGroup.appendChild(tris[i]);
      }
    } else if (type === 3) {
      for (let i = 0; i < 2; i++) {
        tris[i].setAttribute('fill', colors[c.colors[0]]);
        fillGroup.appendChild(tris[i]);
      }
      for (let i = 2; i < 4; i++) {
        tris[i].setAttribute('fill', colors[c.colors[1]]);
        fillGroup.appendChild(tris[i]);
      }
      for (let i = 4; i < 6; i++) {
        tris[i].setAttribute('fill', colors[c.colors[2]]);
        fillGroup.appendChild(tris[i]);
      }
    } else {
      tris.length = 0;
    }

    if (fillGroup.childNodes.length) g.appendChild(fillGroup);
    else fillGroup.remove();
    const hitArea = createHexOutlineElement(center.x, center.y, size, { class: 'hit-area' });
    g.appendChild(hitArea);
    const outline = createHexOutlineElement(center.x, center.y, size, { class: 'outline' });
      g.appendChild(outline);
    gridG.appendChild(g);
  });

  const squareGrid = document.createElementNS(svgNS, 'g');
  squareGrid.setAttribute('id', 'square-grid');
  squareGrid.setAttribute('aria-hidden', 'true');
  squareGrid.style.pointerEvents = 'none';
  const squareValueLayer = document.createElementNS(svgNS, 'g');
  squareValueLayer.setAttribute('id', 'square-values');
  squareValueLayer.style.pointerEvents = 'none';
  const squarePlayersLayer = document.createElementNS(svgNS, 'g');
  squarePlayersLayer.setAttribute('id', 'square-players');
  squarePlayersLayer.style.pointerEvents = 'none';
  const squareMarketLayer = document.createElementNS(svgNS, 'g');
  squareMarketLayer.setAttribute('id', 'square-market');

  const baseX = -squareWidth / 2;
  const baseY = -squareHeight / 2;

  const squareCells = [];
  for (let row = 0; row < gridRows; row++) {
    for (let col = 0; col < gridCols; col++) {
      const posX = baseX + col * (cellSize + gap);
      const posY = baseY + row * (cellSize + gap);
      const isBorder = row === 0 || row === gridRows - 1 || col === 0 || col === gridCols - 1;
      const isCorner = isBorder && ((row === 0 || row === gridRows - 1) && (col === 0 || col === gridCols - 1));
      const isMarket = row >= 1 && row <= gridRows - 2 && col >= 1 && col <= gridCols - 2;
      squareCells.push({
        index: row * gridCols + col + 1,
        centerX: posX + cellSize / 2,
        centerY: posY + cellSize / 2,
        row,
        col,
        isBorder,
        isCorner,
        isMarket,
        value: null,
        size: cellSize,
      });
      if (isBorder && !isCorner) {
        const rect = document.createElementNS(svgNS, 'rect');
        rect.setAttribute('x', posX.toFixed(3));
        rect.setAttribute('y', posY.toFixed(3));
        rect.setAttribute('width', cellSize.toFixed(3));
        rect.setAttribute('height', cellSize.toFixed(3));
        rect.setAttribute('rx', (cellSize * 0.22).toFixed(3));
        rect.setAttribute('ry', (cellSize * 0.22).toFixed(3));
        squareGrid.appendChild(rect);
      }
    }
  }

  const getCell = (row, col) => squareCells[row * gridCols + col];
  const squareTrack = [];
  let trackValue = 1;
  const pushTrackCell = (cell) => {
    if (!cell || !cell.isBorder || cell.isCorner) return;
    cell.value = trackValue++;
    squareTrack.push(cell);
  };
  if (gridRows > 0 && gridCols > 0) {
    for (let col = 0; col < gridCols; col++) pushTrackCell(getCell(0, col));
    for (let row = 1; row < gridRows - 1; row++) pushTrackCell(getCell(row, gridCols - 1));
    for (let col = gridCols - 1; col >= 0; col--) pushTrackCell(getCell(gridRows - 1, col));
    for (let row = gridRows - 2; row >= 1; row--) pushTrackCell(getCell(row, 0));
  }
  squareTrack.forEach((cell) => {
    const label = document.createElementNS(svgNS, 'text');
    label.setAttribute('class', 'square-value');
    label.setAttribute('x', cell.centerX.toFixed(3));
    label.setAttribute('y', cell.centerY.toFixed(3));
    label.textContent = String(cell.value);
    squareValueLayer.appendChild(label);
  });

  const marketCells = [];
  const marketRowStart = Math.max(0, Math.floor((gridRows - 4) / 2));
  const marketColStart = Math.max(0, Math.floor((gridCols - 4) / 2));
  const marketSize = Math.min(4, gridRows - marketRowStart, gridCols - marketColStart);
  for (let localRow = 0; localRow < marketSize; localRow++) {
    for (let localCol = 0; localCol < marketSize; localCol++) {
      const row = marketRowStart + localRow;
      const col = marketColStart + localCol;
      const cell = getCell(row, col);
      if (!cell || !cell.isMarket) continue;
      const padding = cellSize * 0.12;
      const slot = document.createElementNS(svgNS, 'rect');
      slot.setAttribute('class', 'market-slot');
      slot.setAttribute('x', (cell.centerX - cellSize / 2 + padding).toFixed(3));
      slot.setAttribute('y', (cell.centerY - cellSize / 2 + padding).toFixed(3));
      slot.setAttribute('width', (cellSize - padding * 2).toFixed(3));
      slot.setAttribute('height', (cellSize - padding * 2).toFixed(3));
      slot.setAttribute('rx', (cellSize * 0.12).toFixed(3));
      slot.setAttribute('ry', (cellSize * 0.12).toFixed(3));
      slot.dataset.slot = String(marketCells.length);
      squareMarketLayer.appendChild(slot);
      marketCells.push({
        index: marketCells.length,
        row,
        col,
        centerX: cell.centerX,
        centerY: cell.centerY,
        size: cellSize - padding * 2,
        slotElement: slot,
      });
    }
  }

  const squareIndicator = document.createElementNS(svgNS, 'g');
  squareIndicator.setAttribute('id', 'square-indicator');
  squareIndicator.style.pointerEvents = 'none';
  const indicatorCircle = document.createElementNS(svgNS, 'circle');
  indicatorCircle.setAttribute('class', 'square-indicator-circle');
  indicatorCircle.setAttribute('r', (cellSize * 0.38).toFixed(3));
  indicatorCircle.setAttribute('cx', '0');
  indicatorCircle.setAttribute('cy', '0');
  squareIndicator.appendChild(indicatorCircle);
  const indicatorCrest = document.createElementNS(svgNS, 'image');
  indicatorCrest.setAttribute('class', 'square-indicator-crest');
  const crestSize = cellSize * 0.76;
  indicatorCrest.setAttribute('x', (-crestSize / 2).toFixed(3));
  indicatorCrest.setAttribute('y', (-crestSize / 2).toFixed(3));
  indicatorCrest.setAttribute('width', crestSize.toFixed(3));
  indicatorCrest.setAttribute('height', crestSize.toFixed(3));
  indicatorCrest.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  squareIndicator.appendChild(indicatorCrest);
  squareIndicator.style.display = 'none';

  const squareLayer = document.createElementNS(svgNS, 'g');
  squareLayer.setAttribute('id', 'square-layer');
  squareLayer.setAttribute('transform', `translate(${squareTranslateX.toFixed(3)} 0)`);
  squareLayer.style.pointerEvents = 'none';

  squareLayer.appendChild(squareGrid);
  squareLayer.appendChild(squareMarketLayer);
  squareLayer.appendChild(squareValueLayer);
  squareLayer.appendChild(squarePlayersLayer);
  squareLayer.appendChild(squareIndicator);

  hexLayer.appendChild(gridG);
  hexLayer.appendChild(overlaysG);
  hexLayer.appendChild(previewG);
  hexLayer.appendChild(colonsLayer);
  hexLayer.appendChild(junctionsG);
  hexLayer.appendChild(junctionOverlaysG);
  hexLayer.appendChild(castleLayer);

  viewport.appendChild(hexLayer);
  viewport.appendChild(squareLayer);
  svg.appendChild(viewport);
  svg.__squareGrid = {
    cells: squareCells,
    track: squareTrack,
    marketCells,
    indicator: squareIndicator,
    crest: indicatorCrest,
    playersLayer: squarePlayersLayer,
    marketLayer: squareMarketLayer,
    cellSize,
  };
  svg.__colonsLayer = colonsLayer;
  svg.__castleLayer = castleLayer;
  return svg;
}

function renderTileFill(tileIdx, sideColors, svg, tiles, size, colors) {
  if (!Array.isArray(sideColors) || sideColors.length !== 6) return;
  const gTile = svg.querySelector(`.tile[data-idx="${tileIdx}"]`);
  if (!gTile) return;
  const old = gTile.querySelector('.fills');
  if (old) old.remove();
  const fillGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  fillGroup.setAttribute('class', 'fills');
  fillGroup.setAttribute('clip-path', `url(#clip-${tileIdx})`);
  const tile = tiles[tileIdx];
  const center = axialToPixel(tile.q, tile.r, size);
  const verts = hexVerticesAt(center.x, center.y, size - 0.6);
  const fillColors = mapSideColorIndices(sideColors, colors);
  for (let i = 0; i < 6; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % 6];
    const fillColor = fillColors[ORIENTED_INDEX_FOR_TRIANGLE[i]];
    const p = createTrianglePathElement(center, a, b, { fill: fillColor });
    fillGroup.appendChild(p);
  }
  gTile.insertBefore(fillGroup, gTile.querySelector('.outline'));
}

function renderOverlays(svg, tiles, size, overlayByIdx) {
  const overlaysG = svg.querySelector('#overlays');
  overlaysG.innerHTML = '';
  const r = size * 0.6;
  for (let idx = 0; idx < tiles.length; idx++) {
    const player = overlayByIdx.get(idx);
    if (!player) continue;
    const { x, y } = axialToPixel(tiles[idx].q, tiles[idx].r, size);
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('data-idx', String(idx));
    PLAYER_SHAPES[player].draw(g, x, y, r);
    overlaysG.appendChild(g);
  }
}

// ----- src/js/utils.js -----
// Fichier: src/js/utils.js
// Description: Fonctions utilitaires pour la création et manipulation d'éléments SVG

const SVG_NS = 'http://www.w3.org/2000/svg';
const ORIENTED_INDEX_FOR_TRIANGLE = [4, 5, 0, 1, 2, 3];


function createSVGElement(tagName) {
  return document.createElementNS(SVG_NS, tagName);
}


function createTrianglePath(center, a, b) {
  return `M ${center.x} ${center.y} L ${a.x} ${a.y} L ${b.x} ${b.y} Z`;
}


function createHexOutlinePath(x, y, radius, cornerRadius = 0.18) {
  // Délègue à la fonction roundedHexPathAt de core.js
  return roundedHexPathAt(x, y, radius, cornerRadius);
}


function createSVGElementWithAttributes(tagName, attributes = {}) {
  const element = createSVGElement(tagName);
  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
  return element;
}


function createTrianglePathElement(center, a, b, attributes = {}) {
  const path = createSVGElement('path');
  path.setAttribute('d', createTrianglePath(center, a, b));
  Object.entries(attributes).forEach(([key, value]) => {
    path.setAttribute(key, value);
  });
  return path;
}


function createHexOutlineElement(x, y, radius, attributes = {}) {
  const path = createSVGElement('path');
  path.setAttribute('d', createHexOutlinePath(x, y, radius));
  Object.entries(attributes).forEach(([key, value]) => {
    path.setAttribute(key, value);
  });
  return path;
}

// ----- src/js/main.js -----
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

const DEFAULT_CENTER_TILE_INDEX = (() => {
  const idx = tiles.findIndex((t) => t.q === 0 && t.r === 0 && t.s === 0);
  return idx >= 0 ? idx : 0;
})();

let colonPositions = Array.from({ length: PLAYER_COUNT }, () => DEFAULT_CENTER_TILE_INDEX);
let colonMoveRemaining = Array.from({ length: PLAYER_COUNT }, () => 2);
let colonPlacementUsed = Array.from({ length: PLAYER_COUNT }, () => false);
let selectedColonPlayer = null;
let colonMarkers = new Map();

function createEmptyPlayerResource() {
  return {
    tileColors: new Map(),
    amenagements: new Set(),
    amenagementColors: new Map(),
  };
}

let playerScores = Array.from({ length: PLAYER_COUNT }, () => 0);
let playerResources = Array.from({ length: PLAYER_COUNT }, () => createEmptyPlayerResource());

const turnState = {
  activePlayer: PLAYER_IDS[0],
  tilesPlacedByPlayer: Array.from({ length: PLAYER_COUNT }, () => 0),
  turnNumber: 1,
};

const hudElements = {
  scoreboard: null,
  turnIndicator: null,
  endTurnButton: null,
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

function colonColorForIndex(idx) {
  return PLAYER_COLON_COLORS[idx % PLAYER_COLON_COLORS.length];
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
    renderGameHud();
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

function resetGameDataForNewBoard() {
  playerScores = Array.from({ length: PLAYER_COUNT }, () => 0);
  playerResources = Array.from({ length: PLAYER_COUNT }, () => createEmptyPlayerResource());
  resetTurnCounters();
  turnState.turnNumber = 1;
  turnState.activePlayer = PLAYER_IDS[0];
  amenagementColorByKey.clear();
  const svg = getBoardSvg();
  const castleMap = svg?.__state?.castleByJunction ?? null;
  if (castleMap) {
    castleMap.clear();
    svg?.__state?.renderCastleOverlays?.();
  }
  colonPositions = Array.from({ length: PLAYER_COUNT }, () => DEFAULT_CENTER_TILE_INDEX);
  colonMoveRemaining = Array.from({ length: PLAYER_COUNT }, () => 2);
  colonPlacementUsed = Array.from({ length: PLAYER_COUNT }, () => false);
  selectedColonPlayer = null;
  updateColonMarkersPositions();
  renderGameHud();
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
    state.renderCastleOverlays?.();
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
  const squareGridMeta = svg.__squareGrid ?? null;
  const squareCells = Array.isArray(squareGridMeta?.cells) ? squareGridMeta.cells : [];
  const squareTrack = (Array.isArray(squareGridMeta?.track) && squareGridMeta.track.length > 0)
    ? squareGridMeta.track
    : squareCells;
  const squareIndicator = squareGridMeta?.indicator ?? null;
  const squareIndicatorCrest = squareGridMeta?.crest ?? null;
  const squarePlayersLayer = squareGridMeta?.playersLayer ?? null;
  const squareMarketLayer = squareGridMeta?.marketLayer ?? null;
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

  function toggleCastleAtJunction(key, player) {
    if (!junctionMap.has(key) || !isValidPlayer(player)) return;
    const entry = junctionMap.get(key);
    if (!isJunctionReady(entry)) return;
    const current = castleByJunction.get(key) ?? null;
    if (current === player) castleByJunction.delete(key);
    else castleByJunction.set(key, player);
    renderCastleOverlays();
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
        renderCastleOverlays();
        refreshStatsModal();
      });
      marker.classList.toggle('castle-marker--active', player === turnState.activePlayer);
      layer.appendChild(marker);
    }
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
   autoState,
    squareCells,
    squareTrack,
    squareIndicator,
    squareIndicatorCrest,
    updateSquareIndicator,
    updateSquarePlayers,
    marketCells: squareMarketCells,
    marketLayer: squareMarketLayer,
  };
  svg.__state = svgState;

  renderColonMarkers();

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