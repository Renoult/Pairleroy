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

/**
 * Assigne des combinaisons de couleurs aux tuiles selon les quotas Hamilton
 * 
 * Algorithme de répartition en 3 phases :
 * 1. Monochromatiques (3 unités par tuile) - priorité haute
 * 2. Bicolores majeures (2+1 unités par tuile) - priorité moyenne  
 * 3. Répartition des unités restantes entre bicolores mineures et tricolores
 * 
 * @param {number[]} types - Types de tuiles (1=mono, 2=bi, 3=tri)
 * @param {number[]} colorUnitTargets - Quotas d'unités par couleur (somme = 3N)
 * @param {function} rng - Générateur de nombres aléatoires
 * @returns {Array} Combinaisons assignées aux tuiles
 */
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
