import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appJsPath = path.join(__dirname, '../dist/app.js');

try {
    const content = fs.readFileSync(appJsPath, 'utf8');
    const match = content.match(/const MIN_PLAYER_COUNT = (\d+);/);
    if (match) {
        console.log(`Found MIN_PLAYER_COUNT = ${match[1]}`);
    } else {
        console.log('MIN_PLAYER_COUNT not found in dist/app.js');
    }
} catch (err) {
    console.error('Error reading dist/app.js:', err.message);
}
