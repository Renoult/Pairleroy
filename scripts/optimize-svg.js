#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Configuration
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CRESTS_DIR = path.join(__dirname, '..', 'crests');
const BACKUP_DIR = path.join(CRESTS_DIR, 'backup');
const REPORT_FILE = path.join(__dirname, '..', 'svg-optimization-report.md');

// Résoudre le chemin de svgo
const possibleSvgoPaths = [
  path.join(__dirname, '..', 'node_modules', 'svgo'),
  path.join(__dirname, '..', 'lib', 'node_modules', 'svgo'),
];

let svgoPath = null;
for (const testPath of possibleSvgoPaths) {
  if (fs.existsSync(testPath)) {
    svgoPath = testPath;
    break;
  }
}

if (!svgoPath) {
  console.error('❌ SVGO non trouvé. Veuillez installer svgo avec : npm install svgo');
  process.exit(1);
}

// Importer svgo
const { optimize } = await import(path.join('file://', svgoPath, 'lib', 'svgo-node.js'));

// Couleurs pour la console
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
};

/**
 * Formate la taille en bytes vers une unité lisible
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Calcule le pourcentage de réduction
 */
function calculateReduction(original, optimized) {
  if (original === 0) return 0;
  return ((original - optimized) / original * 100).toFixed(2);
}

/**
 * Optimise un seul fichier SVG
 */
function optimizeSVG(filePath) {
  const originalName = path.basename(filePath);
  const originalSize = fs.statSync(filePath).size;
  const originalContent = fs.readFileSync(filePath, 'utf8');

  try {
    const result = optimize(originalContent, {
      path: filePath,
      multipass: true,
      js2svg: { pretty: false, indent: 2 },
      plugins: [
        'preset-default',
        'removeUselessDefs',
        'removeEmptyContainers',
        'removeAttrs',
        'removeUnknownsAndDefaults',
        'convertPathData',
        'sortAttrs',
        'removeXMLProcInst',
        'removeComments',
        'inlineStyles',
        'cleanupNumericValues',
        'convertColors',
        'removeScriptElement'
      ]
    });

    const optimizedContent = result.data;
    const optimizedSize = Buffer.byteLength(optimizedContent, 'utf8');
    const reduction = calculateReduction(originalSize, optimizedSize);

    return {
      success: true,
      originalName,
      originalSize,
      optimizedSize,
      reduction: parseFloat(reduction),
      optimizedContent,
      errors: result.error ? [result.error] : [],
    };
  } catch (error) {
    return {
      success: false,
      originalName,
      originalSize,
      optimizedSize: originalSize,
      reduction: 0,
      optimizedContent: null,
      errors: [error.message],
    };
  }
}

/**
 * Sauvegarde le fichier optimisé
 */
function saveOptimizedFile(filePath, optimizedContent) {
  const backupPath = path.join(BACKUP_DIR, path.basename(filePath));
  const optimizedPath = path.join(CRESTS_DIR, path.basename(filePath));

  // Créer le dossier backup s'il n'existe pas
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  // Sauvegarder l'original dans backup
  fs.copyFileSync(filePath, backupPath);

  // Sauvegarder la version optimisée
  fs.writeFileSync(optimizedPath, optimizedContent, 'utf8');
}

/**
 * Génère le rapport markdown
 */
function generateReport(results) {
  const now = new Date().toLocaleString('fr-FR');
  
  let report = `# Rapport d'Optimisation SVG - Pairleroy

**Date :** ${now}

## Résumé

${results.length} fichier(s) SVG traité(s).

`;

  // Tableau des résultats
  report += `| Fichier | Taille Originale | Taille Optimisée | Réduction | Statut |\n`;
  report += `|---------|------------------|------------------|-----------|--------|\n`;

  let totalOriginal = 0;
  let totalOptimized = 0;
  let totalSuccess = 0;

  results.forEach(result => {
    totalOriginal += result.originalSize;
    totalOptimized += result.optimizedSize;
    if (result.success) totalSuccess++;

    const status = result.success ? 
      `✓ Optimisé` : 
      `✗ Erreur`;
    
    const reductionText = result.success ? 
      `${result.reduction}%` : 
      `0%`;

    report += `| ${result.originalName} | ${formatBytes(result.originalSize)} | ${formatBytes(result.optimizedSize)} | ${reductionText} | ${status} |\n`;

    // Ajouter les erreurs si présentes
    if (result.errors.length > 0) {
      report += `| **Erreurs :** | \n`;
      result.errors.forEach(error => {
        report += `| > ${error} | \n`;
      });
    }
  });

  // Résumé global
  const totalReduction = calculateReduction(totalOriginal, totalOptimized);
  const successRate = ((totalSuccess / results.length) * 100).toFixed(1);

  report += `\n## Résumé Global\n\n`;
  report += `- **Total des fichiers :** ${results.length}\n`;
  report += `- **Succès :** ${totalSuccess} (${successRate}%)\n`;
  report += `- **Taille totale originale :** ${formatBytes(totalOriginal)}\n`;
  report += `- **Taille totale optimisée :** ${formatBytes(totalOptimized)}\n`;
  report += `- **Réduction globale :** ${totalReduction}%\n`;
  report += `- **Espace économisé :** ${formatBytes(totalOriginal - totalOptimized)}\n\n`;

  // Recommandations
  report += `## Recommandations\n\n`;
  if (totalReduction > 15) {
    report += `✅ **Excellente optimisation !** Les SVG ont été optimisés avec succès.\n\n`;
  } else if (totalReduction > 5) {
    report += `ℹ️ **Optimisation modérée.** Les SVG étaient déjà relativement bien optimisés.\n\n`;
  } else {
    report += `⚠️ **Faible optimisation.** Ces SVG étaient déjà très optimisés ou contiennent beaucoup d'éléments complexes.\n\n`;
  }

  report += `### Actions suggérées :\n\n`;
  report += `- Vérifiez que tous les SVG optimisés s'affichent correctement\n`;
  report += `- Les fichiers originaux sont sauvegardés dans \`crests/backup/\`\n`;
  report += `- Pour revenir en arrière : copiez depuis backup vers crests/\n`;
  report += `- Pour automatiser : ajouter \`npm run optimize:svg\` au pipeline CI/CD\n\n`;

  // Configuration SVGO utilisée
  report += `## Configuration\n\n`;
  report += `- **SVGO version :** 3.0.5\n`;
  report += `- **Configuration :** \`svgo.config.js\`\n`;
  report += `- **Dossier source :** \`crests/\`\n`;
  report += `- **Sauvegarde :** \`crests/backup/\`\n\n`;

  // Table des matières pour les erreurs
  const hasErrors = results.some(r => !r.success);
  if (hasErrors) {
    report += `## Détails des Erreurs\n\n`;
    results.forEach(result => {
      if (!result.success) {
        report += `### ${result.originalName}\n\n`;
        result.errors.forEach(error => {
          report += `- ${error}\n`;
        });
        report += `\n`;
      }
    });
  }

  return report;
}

/**
 * Affiche le rapport en console
 */
function displayConsoleReport(results) {
  console.log('\n' + '='.repeat(80));
  console.log(`${colors.bright}${colors.cyan}🎨 OPTIMISATION SVG - PAIRLEROY${colors.reset}`);
  console.log('='.repeat(80) + '\n');

  // En-tête du tableau
  console.log(
    `${colors.bright}Fichier${colors.reset}`.padEnd(25) +
    `${colors.bright}Original${colors.reset}`.padEnd(15) +
    `${colors.bright}Optimisé${colors.reset}`.padEnd(15) +
    `${colors.bright}Réduction${colors.reset}`.padEnd(12) +
    `${colors.bright}Statut${colors.reset}`
  );
  console.log('-'.repeat(80));

  let totalOriginal = 0;
  let totalOptimized = 0;
  let totalSuccess = 0;

  results.forEach(result => {
    totalOriginal += result.originalSize;
    totalOptimized += result.optimizedSize;
    if (result.success) totalSuccess++;

    const name = result.originalName.substring(0, 24);
    const originalText = formatBytes(result.originalSize);
    const optimizedText = formatBytes(result.optimizedSize);
    const reductionText = result.success ? `${result.reduction}%` : '0%';
    const status = result.success ? 
      `${colors.green}✓${colors.reset}` : 
      `${colors.red}✗${colors.reset}`;

    console.log(
      name.padEnd(25) +
      originalText.padEnd(15) +
      optimizedText.padEnd(15) +
      reductionText.padEnd(12) +
      status
    );

    // Afficher les erreurs
    if (result.errors.length > 0) {
      console.log(`  ${colors.red}Erreurs :${colors.reset}`);
      result.errors.forEach(error => {
        console.log(`  - ${error}`);
      });
    }
  });

  // Résumé final
  const totalReduction = calculateReduction(totalOriginal, totalOptimized);
  const successRate = ((totalSuccess / results.length) * 100).toFixed(1);
  const saved = totalOriginal - totalOptimized;

  console.log('\n' + '='.repeat(80));
  console.log(`${colors.bright}RÉSUMÉ GLOBAL${colors.reset}`);
  console.log('='.repeat(80));
  console.log(`Fichiers traités : ${results.length}`);
  console.log(`Succès : ${colors.green}${totalSuccess}${colors.reset} (${successRate}%)`);
  console.log(`Taille totale : ${formatBytes(totalOriginal)} → ${formatBytes(totalOptimized)}`);
  console.log(`Réduction : ${colors.green}${totalReduction}%${colors.reset} (${formatBytes(saved)} économisés)`);
  
  if (saved > 0) {
    console.log(`\n${colors.green}✅ Optimisation réussie !${colors.reset}`);
  } else {
    console.log(`\n${colors.yellow}⚠️ Aucune amélioration détectée${colors.reset}`);
  }

  console.log(`\n📄 Rapport détaillé sauvegardé dans : ${REPORT_FILE}`);
  console.log(`💾 Fichiers originaux sauvegardés dans : ${BACKUP_DIR}\n`);
}

/**
 * Fonction principale
 */
try {
  console.log(`${colors.cyan}🔍 Recherche des fichiers SVG dans ${CRESTS_DIR}...${colors.reset}`);

  // Vérifier que le dossier crests existe
  if (!fs.existsSync(CRESTS_DIR)) {
    throw new Error(`Le dossier ${CRESTS_DIR} n'existe pas`);
  }

  // Lire tous les fichiers SVG
  const files = fs.readdirSync(CRESTS_DIR)
    .filter(file => file.endsWith('.svg'))
    .filter(file => !file.startsWith('backup')) // Ignorer les backups
    .map(file => path.join(CRESTS_DIR, file));

  if (files.length === 0) {
    throw new Error('Aucun fichier SVG trouvé dans le dossier crests/');
  }

  console.log(`${colors.cyan}📁 ${files.length} fichier(s) SVG trouvé(s)${colors.reset}\n`);

  // Optimiser chaque fichier
  const results = files.map(filePath => optimizeSVG(filePath));

  // Sauvegarder les fichiers optimisés
  results.forEach(result => {
    if (result.success && result.optimizedContent) {
      const originalPath = path.join(CRESTS_DIR, result.originalName);
      saveOptimizedFile(originalPath, result.optimizedContent);
    }
  });

  // Générer le rapport
  const report = generateReport(results);
  fs.writeFileSync(REPORT_FILE, report, 'utf8');

  // Afficher le rapport en console
  displayConsoleReport(results);

} catch (error) {
  console.error(`${colors.red}❌ Erreur : ${error.message}${colors.reset}`);
  process.exit(1);
}