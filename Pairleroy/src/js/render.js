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
  svg.setAttribute('viewBox', `${-width / 2} ${-height / 2} ${width} ${height}`);
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
    const roundPath = document.createElementNS(svgNS, 'path');
    roundPath.setAttribute('d', roundedHexPathAt(center.x, center.y, size - 0.2, 0.18));
    cp.appendChild(roundPath);
    defs.appendChild(cp);
    const fillGroup = document.createElementNS(svgNS, 'g');
    fillGroup.setAttribute('clip-path', `url(#${clipId})`);
    fillGroup.setAttribute('class', 'fills');

    const tris = [];
    for (let i = 0; i < 6; i++) {
      const a = verts[i];
      const b = verts[(i + 1) % 6];
      const p = document.createElementNS(svgNS, 'path');
      p.setAttribute('d', `M ${center.x} ${center.y} L ${a.x} ${a.y} L ${b.x} ${b.y} Z`);
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
    const hitArea = document.createElementNS(svgNS, 'path');
    hitArea.setAttribute('class', 'hit-area');
    hitArea.setAttribute('d', roundedHexPathAt(center.x, center.y, size, 0.18));
    g.appendChild(hitArea);
    const outline = document.createElementNS(svgNS, 'path');
    outline.setAttribute('class', 'outline');
    outline.setAttribute('d', roundedHexPathAt(center.x, center.y, size, 0.18));
    g.appendChild(outline);
    gridG.appendChild(g);
  });

  viewport.appendChild(gridG);
  viewport.appendChild(previewG);
  viewport.appendChild(overlaysG);
  viewport.appendChild(junctionsG);
  viewport.appendChild(junctionOverlaysG);
  svg.appendChild(viewport);
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
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', `M ${center.x} ${center.y} L ${a.x} ${a.y} L ${b.x} ${b.y} Z`);
    const fillColor = fillColors[ORIENTED_INDEX_FOR_TRIANGLE[i]];
    p.setAttribute('fill', fillColor);
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
