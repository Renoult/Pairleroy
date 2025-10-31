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
  svg.setAttribute('preserveAspectRatio', 'xMinYMin meet');
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
