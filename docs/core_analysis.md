# Analyse du module core.js - Projet Pairleroy

## Vue d'ensemble

Le fichier `src/js/core.js` contient les fonctions logiques essentielles du projet Pairleroy, incluant :
- Les mathématiques hexagonales
- Le générateur RNG (Random Number Generator)
- La logique de quotas et d'assignation de couleurs
- Les helpers pour la grille et les combinaisons

## 1. Fonctions de Math Hexagonale

### 1.1 Fonctions d'conversion et positionnement
- **`axialToPixel(q, r, size)`** : Convertit les coordonnées axiales en coordonnées pixel
  - ✅ Code propre et efficace
  - ✅ Utilise les formules mathématiques correctes
  - ⚠️ Pas de validation des paramètres

- **`hexVerticesAt(cx, cy, size)`** : Calcule les 6 sommets d'un hexagone
  - ✅ Code simple et lisible
  - ✅ Utilise un angle de départ correct (-30°)
  - ⚠️ Calcule les angles à chaque appel (optimisation possible)

- **`hexVertexPositions(q, r, size)`** : Combine axialToPixel et hexVerticesAt
  - ✅ Composition logique des fonctions
  - ⚠️ Double calcul de position (redondant avec axialToPixel)

### 1.2 Fonctions de chemins SVG
- **`pointAlongFrom(p, q, dist)`** : Calcule un point sur un segment
  - ✅ Protection contre division par zéro
  - ✅ Utilisation de Math.hypot pour la distance
  - ⚠️ Limitation arbitraire à 0.5

- **`roundedHexPathAt(cx, cy, size, rf)`** : Génère le path SVG d'un hexagone arrondi
  - ✅ Algorithme complexe mais bien structuré
  - ⚠️ Boucle élégante mais difficile à maintenir
  - ⚠️ Utilisation de Set pour les indices arrondis (inefficace)

### 1.3 Helpers de grille
- **`generateAxialGrid(radius)`** : Génère la grille hexagonale
  - ✅ Algorithme correct pour les grilles hexagonales
  - ✅ Calcul des bornes efficace
  - ✅ Calcul automatique de la coordonnée s = -q-r

- **`buildNeighborData(tiles)`** : Construit la carte des voisins
  - ✅ Utilisation appropriée de Map pour les performances
  - ✅ Calcul des indices de voisins efficace
  - ✅ Retourne une structure bien organisée

- **`computeJunctionMap(tiles, size)`** : Calcule les jonctions entre hexagones
  - ⚠️ Complexité élevée (O(n²) potentielle)
  - ⚠️ Nombreuses opérations de rounding et de clé
  - ⚠️ Deux Map successives (optimisation possible)

## 2. Générateur RNG (Random Number Generator)

### 2.1 xorshift32(seed)
- ✅ Algorithme RNG robuste et rapide
- ✅ Utilisation correcte des opérations bitwise
- ✅ Retourne une fonction anonyme pour génération séquentielle
- ✅ Normalisation appropriée avec 0x100000000

### 2.2 cryptoSeed()
- ✅ Utilise Web Crypto API quand disponible
- ✅ Fallback gracieux vers Math.random()
- ✅ Assure la cohérence des types (>>> 0)
- ⚠️ Math.random() a une graine prévisible (problème de sécurité)

**Recommandation** : Utiliser une seed plus robuste même en fallback.

## 3. Logique de Quotas

### 3.1 quotasFromPercents(total, percents)
- ✅ Algorithme de répartition mathématiquement correct
- ✅ Gestion des remainders avec tri décroissant
- ✅ Validation des pourcentages (somme > 0)
- ⚠️ Pas de validation pour des valeurs négatives

### 3.2 assignColorsToTiles(types, colorCounts, rng)
- ✅ Algorithme de backtracking avec limite (maxBacktracks)
- ✅ Optimisation avec tri par complexité décroissante
- ✅ Gestion robuste des cas d'échec
- ⚠️ Algorithme complexe, difficile à débugger
- ⚠️ Limite arbitraire de 5000 backtracks

### 3.3 quotasHamiltonCap(total, weights, caps)
- ✅ Gestion des caps efficace
- ✅ Répartition des remainders ordonnée
- ⚠️ Nom peu descriptif ("HamiltonCap" sans explication)

### 3.4 assignTileCombos(types, colorUnitTargets, rng)
- ✅ Logique sophistiquée pour la répartition des types
- ✅ Gestion des contraintes entre types 1, 2 et 3
- ⚠️ Code très complexe avec de nombreuses variables
- ⚠️ Gestion d'erreurs pourrait être plus précise

## 4. Problèmes Identifiés

### 4.1 Duplications de Code
- **`rotateSideColors`** et **`seededShuffle`** : 
  - Logique similaire de rotation/shuffle
  - Pas de duplication directe mais même paradigme
  
- **`hexVertexPositions`** et **`axialToPixel`** :
  - Double calcul de position pixel
  - Efficiency pourraient être améliorée

### 4.2 Fonctions Redondantes
- **`hexVerticesAt`** appelée par **`roundedHexPathAt`**
- **`pointAlongFrom`** utilisée uniquement dans **`roundedHexPathAt`**
- **`NEIGHBOR_DIRS`** pourrait être générée dynamiquement

### 4.3 Problèmes de Performance
- **`computeJunctionMap`** : Double Map usage, complexité élevée
- **`roundedHexPathAt`** : Calcul répétitif des sommets
- **`buildNeighborData`** : Création répétitive de clés string
- **`chooseKDistinctColors`** : Pool recalculé à chaque itération

### 4.4 Problèmes de Maintenabilité
- **`assignTileCombos`** : Fonction de 82 lignes, trop complexe
- Variables courtes et peu descriptives (m1_c, B2_c, etc.)
- Logique de backtracking difficile à suivre
- Mélange de responsabilités (quotas + assignation)

## 5. Style de Code et Cohérence

### 5.1 Points Positifs
- ✅ Nommage cohérent des fonctions (camelCase)
- ✅ Constantes en majuscules (UPPER_CASE)
- ✅ JSDoc dans le header général
- ✅ Fonctions courtes (< 30 lignes pour la plupart)
- ✅ Utilisation appropriée des arrow functions
- ✅ Gestion des erreurs avec try/catch

### 5.2 Améliorations Possibles
- ❌ Pas de documentation individuelle des fonctions
- ❌ Variables cryptiques (U, B, T, k, etc.)
- ❌ Constantes magiques sans explication (0.26, 5000)
- ❌ Mélange de commentaires français/anglais
- ❌ Pas de validation systématique des paramètres

### 5.3 Incohérences Stylistiques
- Commentaires parfois en français, parfois en anglais
- Espacement irrégulier dans certaines fonctions
- Nommage des variables parfois abrégé arbitrairement

## 6. Recommandations d'Amélioration

### 6.1 Refactoring Prioritaire
1. **Diviser `assignTileCombos`** en fonctions plus petites
2. **Optimiser `computeJunctionMap`** pour réduire la complexité
3. **Unifier la gestion des erreurs** dans le RNG
4. **Ajouter de la validation** des paramètres d'entrée

### 6.2 Optimisations de Performance
1. **Cache des calculs** répétitifs (hexVerticesAt)
2. **Pré-allouer les structures** de données
3. **Réduire les allocations** temporaires
4. **Optimiser les Map** avec des clés plus simples

### 6.3 Améliorations de Code Quality
1. **Ajouter JSDoc** pour chaque fonction
2. **Standardiser le language** des commentaires
3. **Renommer les variables** cryptiques
4. **Extraire les constantes** magiques

### 6.4 Tests et Robustesse
1. **Ajouter des tests unitaires** pour les fonctions critiques
2. **Validation systématique** des entrées
3. **Gestion d'erreurs plus précise**
4. **Documentation des algorithmes** complexes

## 7. Score d'Évaluation

| Critère | Note | Commentaire |
|---------|------|-------------|
| Fonctionnalité | 8/10 | Code fonctionnel et algorithms corrects |
| Performance | 6/10 | Quelques optimisations possibles |
| Maintenabilité | 5/10 | Code complexe, peu documenté |
| Lisibilité | 7/10 | Style cohérent mais manques de documentation |
| Robustesse | 6/10 | Gestion d'erreurs présente mais incomplète |

**Score Global : 6.4/10**

Le module core.js contient une implémentation sophistiquée et fonctionnelle des mécaniques de jeu, mais bénéficierait d'un refactoring pour améliorer sa maintenabilité et ses performances.