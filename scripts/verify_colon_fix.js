import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appJsPath = path.join(__dirname, '../dist/app.js');

try {
    const content = fs.readFileSync(appJsPath, 'utf8');

    // Check if the isColonPlacement flag is passed
    const passColonFlag = content.includes('isColonPlacement: true');
    const checkColonFlag = content.includes('options.isColonPlacement === true');

    console.log('isColonPlacement flag passed:', passColonFlag);
    console.log('isColonPlacement flag checked:', checkColonFlag);

    if (passColonFlag && checkColonFlag) {
        console.log('✓ Colon placement logic is correctly implemented in build');
    } else {
        console.log('✗ Colon placement logic is MISSING or INCOMPLETE in build');
    }

    // Find the exact context
    const passMatch = content.match(/isColonPlacement: true[\s\S]{0,100}/);
    if (passMatch) {
        console.log('\nFound flag being set:');
        console.log(passMatch[0]);
    }

    const checkMatch = content.match(/options\.isColonPlacement === true[\s\S]{0,100}/);
    if (checkMatch) {
        console.log('\nFound flag being checked:');
        console.log(checkMatch[0]);
    }
} catch (err) {
    console.error('Error:', err.message);
}
