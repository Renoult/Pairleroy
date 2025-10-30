#!/usr/bin/env node
/**
 * Build script avancé: concatène et minifie les fichiers JS/CSS.
 * Options:
 *   --dev : build de développement (sans minification)
 *   --prod : build de production (avec minification)
 *   --analyze : affiche des stats détaillées
 */

import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

// Parse des arguments
const isProd = process.argv.includes('--prod');
const isAnalyze = process.argv.includes('--analyze');
const isDev = !isProd && !isAnalyze;

// Timestamps et versioning
const now = new Date();
const timestamp = now.toISOString().replace(/[:.]/g, '-');
const version = '1.1.3';

const jsOrder = [
  'src/js/core.js',
  'src/js/palette.js',
  'src/js/render.js',
  'src/js/utils.js',
  'src/js/main.js',
];

const cssOrder = [
  'src/styles/base.css',
  'src/styles/controls.css',
  'src/styles/layout.css',
  'src/styles/overlays.css',
];

function getFileSize(bytes) {
  return `${(bytes / 1024).toFixed(2)}K`;
}

function minifyJS(content) {
  // Suppression des commentaires de ligne
  let minified = content.replace(/\/\/.*$/gm, '');
  
  // Suppression des commentaires de bloc multilignes
  minified = minified.replace(/\/\*[\s\S]*?\*\//g, '');
  
  // Suppression des espaces en début/fin de ligne
  minified = minified.split('\n').map(line => line.trim()).join('\n');
  
  // Suppression des lignes vides multiples
  minified = minified.replace(/\n\s*\n\s*\n/g, '\n\n');
  
  // Suppression des espaces superflus (sauf dans les chaînes)
  minified = minified.replace(/\s+/g, ' ');
  
  // Suppression des espaces autour des opérateurs
  minified = minified.replace(/\s*([{};,()=+\-*/<>%])\s*/g, '$1');
  
  return minified.trim();
}

function minifyCSS(content) {
  // Suppression des commentaires
  let minified = content.replace(/\/\*[\s\S]*?\*\//g, '');
  
  // Suppression des espaces en début/fin de ligne
  minified = minified.split('\n').map(line => line.trim()).join('\n');
  
  // Suppression des lignes vides multiples
  minified = minified.replace(/\n\s*\n\s*\n/g, '\n\n');
  
  // Suppression des espaces superflus
  minified = minified.replace(/\s+/g, ' ');
  
  // Suppression des espaces autour des двоеточия
  minified = minified.replace(/\s*:\s*/g, ':');
  
  // Suppression des espaces autour des points-virgules
  minified = minified.replace(/\s*;\s*/g, ';');
  
  // Suppression des espaces autour des accolades
  minified = minified.replace(/\s*{\s*/g, '{');
  minified = minified.replace(/\s*}\s*/g, '}');
  
  return minified.trim();
}

function concatFiles(order) {
  const originalContent = order
    .map((relPath) => {
      const abs = path.join(root, relPath);
      if (!fs.existsSync(abs)) throw new Error(`Fichier manquant: ${relPath}`);
      return `// ----- ${relPath} -----\n${fs.readFileSync(abs, 'utf8').trim()}\n`;
    })
    .join('\n');

  let finalContent;
  let originalSize;
  let finalSize;

  if (isProd) {
    originalSize = Buffer.byteLength(originalContent, 'utf8');
    finalContent = minifyJS(originalContent);
    finalSize = Buffer.byteLength(finalContent, 'utf8');
  } else {
    finalContent = originalContent;
    originalSize = finalSize = Buffer.byteLength(originalContent, 'utf8');
  }

  fs.writeFileSync(path.join(root, 'app.js'), finalContent, 'utf8');
  
  return {
    name: 'app.js',
    originalSize,
    finalSize,
    ratio: isProd ? ((1 - finalSize / originalSize) * 100).toFixed(1) : '0'
  };
}

function concatCSS(order) {
  const originalContent = order
    .map((relPath) => {
      const abs = path.join(root, relPath);
      if (!fs.existsSync(abs)) throw new Error(`Fichier manquant: ${relPath}`);
      return `/* ----- ${relPath} ----- */\n${fs.readFileSync(abs, 'utf8').trim()}\n`;
    })
    .join('\n\n');

  let finalContent;
  let originalSize;
  let finalSize;

  if (isProd) {
    originalSize = Buffer.byteLength(originalContent, 'utf8');
    finalContent = minifyCSS(originalContent);
    finalSize = Buffer.byteLength(finalContent, 'utf8');
  } else {
    finalContent = originalContent;
    originalSize = finalSize = Buffer.byteLength(originalContent, 'utf8');
  }

  fs.writeFileSync(path.join(root, 'styles.css'), finalContent, 'utf8');
  
  return {
    name: 'styles.css',
    originalSize,
    finalSize,
    ratio: isProd ? ((1 - finalSize / originalSize) * 100).toFixed(1) : '0'
  };
}

function displayBuildHeader() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`     BUILD ${isProd ? 'PRODUCTION' : isAnalyze ? 'ANALYSE' : 'DÉVELOPPEMENT'} - Pairleroy v${version}`);
  console.log(`     Timestamp: ${timestamp}`);
  console.log('═══════════════════════════════════════════════════════════\n');
}

function displayResults(results, buildTime) {
  console.log('\n┌─────────────────────────────────────────────────────────┐');
  console.log('│                    RÉSULTATS DU BUILD                  │');
  console.log('├─────────────────────────────────────────────────────────┤');
  console.log(`│ ${'Fichier'.padEnd(12)} | ${'Avant'.padEnd(10)} | ${'Après'.padEnd(10)} | ${'Gain'.padEnd(8)} │`);
  console.log('├─────────────────────────────────────────────────────────┤');
  
  results.forEach(result => {
    const name = result.name.padEnd(12);
    const before = getFileSize(result.originalSize).padEnd(10);
    const after = getFileSize(result.finalSize).padEnd(10);
    const gain = isProd ? `${result.ratio}%`.padEnd(8) : '0%'.padEnd(8);
    console.log(`│ ${name} | ${before} | ${after} | ${gain} │`);
  });
  
  const totalOriginal = results.reduce((sum, r) => sum + r.originalSize, 0);
  const totalFinal = results.reduce((sum, r) => sum + r.finalSize, 0);
  const totalRatio = isProd ? ((1 - totalFinal / totalOriginal) * 100).toFixed(1) : '0';
  
  console.log('├─────────────────────────────────────────────────────────┤');
  const totalName = 'TOTAL'.padEnd(12);
  const totalBefore = getFileSize(totalOriginal).padEnd(10);
  const totalAfter = getFileSize(totalFinal).padEnd(10);
  const totalGain = isProd ? `${totalRatio}%`.padEnd(8) : '0%'.padEnd(8);
  console.log(`│ ${totalName} | ${totalBefore} | ${totalAfter} | ${totalGain} │`);
  console.log('├─────────────────────────────────────────────────────────┤');
  console.log(`│ Temps de build: ${buildTime.toFixed(2)}ms                              │`);
  console.log('└─────────────────────────────────────────────────────────┘\n');

  if (isAnalyze) {
    console.log('📊 ANALYSE DÉTAILLÉE:');
    console.log('  • Mode de build:', isProd ? 'Production (minifié)' : 'Développement (non minifié)');
    console.log('  • Fichiers JS traités:', jsOrder.length);
    console.log('  • Fichiers CSS traités:', cssOrder.length);
    console.log('  • Version:', version);
    console.log('  • Timestamp:', timestamp);
    console.log('');
  }

  if (isProd && Number(totalRatio) >= 15) {
    console.log('✅ Excellente optimisation ! Gains significatifs obtenus.');
  } else if (isProd && Number(totalRatio) >= 10) {
    console.log('✅ Bonne optimisation. Des gains intéressants obtenus.');
  } else if (isProd) {
    console.log('⚠️  Optimisation modérée. Potentiel d\'amélioration.');
  }
}

try {
  const startTime = performance.now();
  
  displayBuildHeader();
  
  const jsResult = concatFiles(jsOrder);
  const cssResult = concatCSS(cssOrder);
  
  const buildTime = performance.now() - startTime;
  
  displayResults([jsResult, cssResult], buildTime);
  
  console.log(`Build ${isProd ? 'production' : 'développement'} terminé avec succès !\n`);
  
} catch (err) {
  console.error('[build] erreur:', err.message);
  process.exit(1);
}
