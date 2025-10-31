# Efficiency Improvements Report - Pairleroy

## Overview
This report identifies several areas in the Pairleroy codebase where performance and efficiency can be improved. The application is a hexagonal grid generator for the Pairleroy game, written in vanilla JavaScript.

## Issues Identified

### 1. Repeated DOM Queries in `ensureHudElements()` (main.js:179-189)
**Severity:** Medium  
**Location:** `src/js/main.js:179-189`

The `ensureHudElements()` function is called frequently (from `renderGameHud()`, `renderBuildingPanel()`, etc.) and performs DOM queries every time even when the elements are already cached.

**Current Code:**
```javascript
function ensureHudElements() {
  if (!hudElements.scoreboard) hudElements.scoreboard = document.getElementById('scoreboard');
  if (!hudElements.turnIndicator) hudElements.turnIndicator = document.getElementById('turn-indicator');
  if (!hudElements.endTurnButton) hudElements.endTurnButton = document.getElementById('end-turn');
  if (!hudElements.buildingPanel) hudElements.buildingPanel = document.getElementById('building-panel');
  // ...
}
```

**Issue:** While the function does cache elements, it still performs the conditional checks on every call. Additionally, the event listener binding logic at the end could be optimized.

**Impact:** Minor performance overhead on frequent UI updates.

---

### 2. Inefficient Array Iteration in `recomputeAllPlayerModifiers()` (main.js:175-177)
**Severity:** Low  
**Location:** `src/js/main.js:175-177`

**Current Code:**
```javascript
function recomputeAllPlayerModifiers() {
  for (let idx = 0; idx < PLAYER_COUNT; idx++) recomputePlayerModifiersFor(idx);
}
```

**Issue:** This function is called whenever building definitions change or buildings are constructed. Each call to `recomputePlayerModifiersFor()` creates a new default modifiers object and iterates through all buildings for that player. This could be optimized to only recompute when necessary.

**Impact:** Low, but could accumulate with frequent building operations.

---

### 3. Redundant Color Parsing in `updateColorPercentageStyles()` (main.js:409-426)
**Severity:** Medium  
**Location:** `src/js/main.js:409-426`

**Current Code:**
```javascript
function updateColorPercentageStyles() {
  for (let idx = 1; idx <= 4; idx++) {
    const colorInput = document.getElementById(`color-c${idx}`);
    const percentInput = document.getElementById(`pct-c${idx}`);
    if (!colorInput || !percentInput) continue;
    const rgb = parseHexColor(colorInput.value);
    // ... styling operations
  }
  renderBuildingPanel();
}
```

**Issue:** This function performs DOM queries and color parsing on every call, even when colors haven't changed. It also triggers a full `renderBuildingPanel()` which is expensive.

**Impact:** Medium - called during initialization and color changes, causing unnecessary re-renders.

---

### 4. Expensive `renderBuildingPanel()` Called Too Frequently (main.js:571-722)
**Severity:** High  
**Location:** `src/js/main.js:571-722`

**Current Code:**
The `renderBuildingPanel()` function completely rebuilds the entire building panel DOM from scratch, including:
- Creating all building cards
- Setting up all event listeners
- Parsing colors and computing styles

**Called from:**
- `renderGameHud()` (line 568)
- `updateColorPercentageStyles()` (line 425)
- Multiple building-related operations (lines 607, 625, 650, 679, 690)

**Issue:** The function performs a full `innerHTML = ''` wipe and rebuild on every call, even for minor changes like updating a single building's name or cost. This is extremely inefficient.

**Impact:** High - causes noticeable lag when interacting with building UI, especially with multiple buildings.

---

### 5. Inefficient Junction Map Computation (core.js:138-168)
**Severity:** Low  
**Location:** `src/js/core.js:138-168`

**Current Code:**
```javascript
function computeJunctionMap(tiles, size) {
  const acc = new Map();
  for (let idx = 0; idx < tiles.length; idx++) {
    const t = tiles[idx];
    const verts = hexVertexPositions(t.q, t.r, size);
    for (const vi of [0, 2, 4]) {
      const vx = verts[vi].x;
      const vy = verts[vi].y;
      const key = `${Math.round(vx * 1000)},${Math.round(vy * 1000)}`;
      // ...
    }
  }
  // ... filtering logic
}
```

**Issue:** The function iterates through all tiles and computes vertex positions, then creates string keys for lookups. The filtering pass at the end also has nested loops checking for unique tiles.

**Impact:** Low - only called once during board initialization, but could be optimized for larger grids.

---

### 6. String Concatenation in Render Functions (render.js & palette.js)
**Severity:** Low  
**Location:** Multiple locations in `src/js/render.js` and `src/js/palette.js`

**Examples:**
- `render.js:152`: `d = 'M ${center.x} ${center.y} L ${a.x} ${a.y} L ${b.x} ${b.y} Z'`
- `render.js:192`: `roundedHexPathAt(center.x, center.y, size, 0.18)`

**Issue:** Path strings are built using template literals with many `.toFixed()` calls. While not a major issue, these could be optimized for large grids.

**Impact:** Very low - only affects initial render performance.

---

### 7. Repeated `querySelector` Calls in Render Functions (render.js:210-233)
**Severity:** Low  
**Location:** `src/js/render.js:210-233`

**Current Code:**
```javascript
function renderTileFill(tileIdx, sideColors, svg, tiles, size, colors) {
  // ...
  const gTile = svg.querySelector(`.tile[data-idx="${tileIdx}"]`);
  if (!gTile) return;
  const old = gTile.querySelector('.fills');
  // ...
}
```

**Issue:** Uses `querySelector` with attribute selectors which is slower than direct element access or ID-based lookups.

**Impact:** Low - called during tile placement but not in tight loops.

---

## Recommended Priority

1. **High Priority:** Fix #4 - Optimize `renderBuildingPanel()` to use incremental updates instead of full rebuilds
2. **Medium Priority:** Fix #3 - Cache parsed colors and avoid redundant `renderBuildingPanel()` calls
3. **Medium Priority:** Fix #1 - Optimize `ensureHudElements()` to avoid repeated checks
4. **Low Priority:** Fix #2, #5, #6, #7 - Minor optimizations for edge cases

## Proposed Fix for Issue #4

The most impactful improvement would be to refactor `renderBuildingPanel()` to:
1. Only rebuild the panel when the building definitions change (add/remove)
2. Use targeted DOM updates for value changes (name, description, cost, effect)
3. Cache DOM references for building cards
4. Debounce rapid successive calls

This would significantly improve UI responsiveness during building interactions.
