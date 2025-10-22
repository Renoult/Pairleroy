#!/usr/bin/env node
/**
 * Simple build script: concatène les fichiers JS/CSS de src/ dans app.js et styles.css.
 * Permet de garder une structure modulaire tout en produisant des fichiers plats.
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

const jsOrder = [
  'src/js/core.js',
  'src/js/palette.js',
  'src/js/render.js',
  'src/js/main.js',
];

const cssOrder = [
  'src/styles/base.css',
  'src/styles/controls.css',
  'src/styles/layout.css',
  'src/styles/overlays.css',
];

function concatFiles(order, destination) {
  const content = order
    .map((relPath) => {
      const abs = path.join(root, relPath);
      if (!fs.existsSync(abs)) throw new Error(`Fichier manquant: ${relPath}`);
      return `// ----- ${relPath} -----\n${fs.readFileSync(abs, 'utf8').trim()}\n`;
    })
    .join('\n');
  fs.writeFileSync(path.join(root, destination), content, 'utf8');
}

function concatCSS(order, destination) {
  const content = order
    .map((relPath) => {
      const abs = path.join(root, relPath);
      if (!fs.existsSync(abs)) throw new Error(`Fichier manquant: ${relPath}`);
      return `/* ----- ${relPath} ----- */\n${fs.readFileSync(abs, 'utf8').trim()}\n`;
    })
    .join('\n\n');
  fs.writeFileSync(path.join(root, destination), content, 'utf8');
}

try {
  concatFiles(jsOrder, 'app.js');
  concatCSS(cssOrder, 'styles.css');
  console.log('Build terminé : app.js et styles.css mis à jour.');
} catch (err) {
  console.error('[build] erreur:', err.message);
  process.exit(1);
}
