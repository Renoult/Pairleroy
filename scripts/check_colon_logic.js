import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appJsPath = path.join(__dirname, '../dist/app.js');

try {
    const content = fs.readFileSync(appJsPath, 'utf8');

    // Check for the colon placement logic
    const colonLogicMatch = content.match(/colonBonusAvailable[\s\S]{0,200}ne rapporte PAS de points/);

    if (colonLogicMatch) {
        console.log('✓ Found colon placement logic with NO points comment');
        console.log('Match:', colonLogicMatch[0].substring(0, 150) + '...');
    } else {
        console.log('✗ Colon placement logic NOT found or incorrect');

        // Try to find any colonBonusAvailable logic
        const anyColonMatch = content.match(/colonBonusAvailable[\s\S]{0,300}/);
        if (anyColonMatch) {
            console.log('Found colonBonusAvailable block:', anyColonMatch[0]);
        }
    }
} catch (err) {
    console.error('Error reading dist/app.js:', err.message);
}
