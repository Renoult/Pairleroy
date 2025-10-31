#!/usr/bin/env node
/**
 * Build script: concatenates the JS/CSS sources and optionally minifies them.
 * Options:
 *   --dev (default)  : readable output without minification
 *   --prod           : minified output
 *   --analyze        : report bundle stats without rewriting files
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { performance } from 'perf_hooks';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

const isProd = process.argv.includes('--prod');
const isAnalyze = process.argv.includes('--analyze');
const isDev = !isProd && !isAnalyze;

const buildVersion = '1.2.0';
const timestamp = new Date().toISOString();

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

function prepareDistDir() {
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
    return;
  }

  for (const fileName of ['app.js', 'styles.css']) {
    const target = path.join(distDir, fileName);
    if (fs.existsSync(target)) {
      fs.unlinkSync(target);
    }
  }
}

function readSources(fileList) {
  return fileList.map((relPath) => {
    const absPath = path.join(rootDir, relPath);
    if (!fs.existsSync(absPath)) {
      throw new Error(`Missing source file: ${relPath}`);
    }
    return {
      relPath,
      content: fs.readFileSync(absPath, 'utf8'),
    };
  });
}

function minifyJS(content) {
  let output = content.replace(/\/\*[\s\S]*?\*\//g, '');
  output = output.replace(/[ \t]+\n/g, '\n');
  output = output.replace(/\n{3,}/g, '\n\n');
  return output.trim();
}

function minifyCSS(content) {
  let output = content.replace(/\/\*[\s\S]*?\*\//g, '');
  output = output.replace(/\s+/g, ' ');
  output = output.replace(/\s*([{}:;,>~+()])\s*/g, '$1');
  output = output.replace(/\s*{\s*/g, '{');
  output = output.replace(/\s*}\s*/g, '}');
  output = output.replace(/;\}/g, '}');
  return output.trim();
}

function concatJS() {
  const sources = readSources(jsOrder);
  const decorated = sources
    .map(({ relPath, content }) => `// ----- ${relPath} -----\n${content.trim()}\n`)
    .join('\n');

  const originalSize = Buffer.byteLength(decorated, 'utf8');
  const finalContent = isProd ? minifyJS(decorated) : decorated;
  const finalSize = Buffer.byteLength(finalContent, 'utf8');

  if (!isAnalyze) {
    fs.writeFileSync(path.join(distDir, 'app.js'), finalContent, 'utf8');
  }

  return { name: 'app.js', originalSize, finalSize };
}

function concatCSS() {
  const sources = readSources(cssOrder);
  const decorated = sources
    .map(({ relPath, content }) => `/* ----- ${relPath} ----- */\n${content.trim()}\n`)
    .join('\n\n');

  const originalSize = Buffer.byteLength(decorated, 'utf8');
  const finalContent = isProd ? minifyCSS(decorated) : decorated;
  const finalSize = Buffer.byteLength(finalContent, 'utf8');

  if (!isAnalyze) {
    fs.writeFileSync(path.join(distDir, 'styles.css'), finalContent, 'utf8');
  }

  return { name: 'styles.css', originalSize, finalSize };
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(2)} KB`;
}

function logHeader(modeLabel) {
  console.log('');
  console.log('===============================================');
  console.log(` Pairleroy build (${modeLabel}) - v${buildVersion}`);
  console.log(` Timestamp: ${timestamp}`);
  console.log('===============================================');
}

function logResults(results, buildTimeMs) {
  console.log('');
  console.log('File                 Original      Output        Delta');
  console.log('-------------------------------------------------------');

  let totalOriginal = 0;
  let totalFinal = 0;

  for (const { name, originalSize, finalSize } of results) {
    totalOriginal += originalSize;
    totalFinal += finalSize;

    const delta = originalSize === 0
      ? 0
      : ((1 - finalSize / originalSize) * 100);

    console.log(
      `${name.padEnd(20)} ${formatSize(originalSize).padEnd(12)} ${formatSize(finalSize).padEnd(12)} ${delta.toFixed(1).padStart(6)}%`,
    );
  }

  const totalDelta = totalOriginal === 0
    ? 0
    : ((1 - totalFinal / totalOriginal) * 100);

  console.log('-------------------------------------------------------');
  console.log(
    `${'TOTAL'.padEnd(20)} ${formatSize(totalOriginal).padEnd(12)} ${formatSize(totalFinal).padEnd(12)} ${totalDelta.toFixed(1).padStart(6)}%`,
  );
  console.log(`Build time: ${buildTimeMs.toFixed(2)} ms`);
  console.log('');
}

function main() {
  const mode = isProd ? 'production' : isAnalyze ? 'analysis' : 'development';

  try {
    const start = performance.now();

    if (!isAnalyze) {
      prepareDistDir();
    }

    logHeader(mode);
    const jsResult = concatJS();
    const cssResult = concatCSS();

    const elapsed = performance.now() - start;
    logResults([jsResult, cssResult], elapsed);

    if (!isAnalyze) {
      console.log(`Build completed (${mode})`);
    }
  } catch (error) {
    console.error('[build] error:', error.message);
    process.exit(1);
  }
}

main();
