/**
 * Performance Benchmarking pour Pairleroy
 * Mesure les temps d'exécution avant/après optimisations
 */

class PerformanceBenchmark {
  constructor() {
    this.results = {};
    this.startTime = 0;
  }

  startTest(name) {
    this.startTime = performance.now();
    console.log(`[PERF] Démarrage test: ${name}`);
  }

  endTest(name) {
    const endTime = performance.now();
    const duration = endTime - this.startTime;
    
    if (!this.results[name]) {
      this.results[name] = [];
    }
    
    this.results[name].push(duration);
    console.log(`[PERF] ${name}: ${duration.toFixed(2)}ms`);
    return duration;
  }

  getAverage(name) {
    const results = this.results[name];
    if (!results || results.length === 0) return 0;
    
    const sum = results.reduce((a, b) => a + b, 0);
    return sum / results.length;
  }

  getMin(name) {
    const results = this.results[name];
    if (!results || results.length === 0) return 0;
    return Math.min(...results);
  }

  getMax(name) {
    const results = this.results[name];
    if (!results || results.length === 0) return 0;
    return Math.max(...results);
  }

  generateReport() {
    console.log('\n=== RAPPORT DE PERFORMANCE ===');
    for (const [name, values] of Object.entries(this.results)) {
      const avg = this.getAverage(name);
      const min = this.getMin(name);
      const max = this.getMax(name);
      const runs = values.length;
      
      console.log(`${name}:`);
      console.log(`  Moyenne: ${avg.toFixed(2)}ms`);
      console.log(`  Min: ${min.toFixed(2)}ms`);
      console.log(`  Max: ${max.toFixed(2)}ms`);
      console.log(`  Runs: ${runs}`);
      console.log('');
    }
  }

  reset() {
    this.results = {};
  }
}

// Fonction pour simuler un benchmark complet
function runFullBenchmark() {
  const benchmark = new PerformanceBenchmark();
  
  console.log('Démarrage du benchmark complet...\n');
  
  // Test 1: Génération de grille
  benchmark.startTest('generation_grille');
  // Simulation: génération d'une grille hexagonale
  const tiles = generateAxialGrid(6);
  const neighbors = buildNeighborData(tiles);
  benchmark.endTest('generation_grille');
  
  // Test 2: Placement de 100 tuiles
  benchmark.startTest('placement_100_tuiles');
  const colors = ['#e57373', '#64b5f6', '#81c784', '#ffd54f'];
  for (let i = 0; i < 100; i++) {
    // Simulation d'un placement
    const combo = {
      type: Math.floor(Math.random() * 3) + 1,
      colors: [0, 1, 2],
      units: [3]
    };
    const rotation = 0;
  }
  benchmark.endTest('placement_100_tuiles');
  
  // Test 3: Mise à jour HUD
  benchmark.startTest('hud_update');
  // Simulation: mise à jour du scoreboard
  const scoreboard = document.getElementById('scoreboard');
  if (scoreboard) {
    scoreboard.innerHTML = '';
    for (let i = 0; i < 6; i++) {
      const card = document.createElement('button');
      card.className = 'scorecard';
      card.textContent = `Joueur ${i + 1}`;
      scoreboard.appendChild(card);
    }
  }
  benchmark.endTest('hud_update');
  
  // Test 4: Auto-remplissage (1000 itérations)
  benchmark.startTest('auto_remplissage_1000');
  for (let i = 0; i < 1000; i++) {
    // Simulation d'une tentative de placement auto
    Math.random();
    Math.random();
  }
  benchmark.endTest('auto_remplissage_1000');
  
  // Test 5: Rendu SVG (rendu des tuiles)
  benchmark.startTest('render_svg_tiles');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const size = 30;
  for (let i = 0; i < tiles.length; i++) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M 0 0 L ${size} 0 L ${size} ${size} Z`);
    g.appendChild(path);
    svg.appendChild(g);
  }
  benchmark.endTest('render_svg_tiles');
  
  // Test 6: Query DOM
  benchmark.startTest('dom_queries');
  document.querySelector('#board-container');
  document.querySelector('#palette-items');
  document.querySelector('#scoreboard');
  document.querySelector('#turn-indicator');
  document.querySelectorAll('.tile');
  benchmark.endTest('dom_queries');
  
  benchmark.generateReport();
  
  return benchmark;
}

// Exposer globalement
if (typeof window !== 'undefined') {
  window.PerformanceBenchmark = PerformanceBenchmark;
  window.runFullBenchmark = runFullBenchmark;
}

module.exports = {
  PerformanceBenchmark,
  runFullBenchmark
};
