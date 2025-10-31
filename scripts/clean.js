#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

try {
  fs.rmSync(distDir, { recursive: true, force: true });
  console.log('[clean] dist/ removed');
} catch (error) {
  console.error('[clean] failed to remove dist/:', error.message);
  process.exit(1);
}
