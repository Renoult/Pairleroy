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
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', `M ${center.x} ${center.y} L ${a.x} ${a.y} L ${b.x} ${b.y} Z`);
    const fillColor = fillColors[ORIENTED_INDEX_FOR_TRIANGLE[i]];
    p.setAttribute('fill', fillColor);
    tris.push(p);
    svgSmall.appendChild(p);
  }
  const outline = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  outline.setAttribute('d', roundedHexPathAt(cx, cy, outlineRadius));
  outline.setAttribute('class', 'outline');
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
