# Pairleroy — Générateur de grille hexagonale

Petit outil web permettant de générer et manipuler une grille hexagonale de 127 tuiles pour le jeu Pairleroy. L'application tourne entièrement dans le navigateur et peut être ouverte directement via `index.html`.

## Contenu

- `src/` contient le code organisé en modules :
  - `src/js/core.js` — math hexagonal, RNG, quotas.
  - `src/js/palette.js` — logique de palette (rotations, miniatures).
  - `src/js/render.js` — fonctions DOM/SVG pour dessiner la grille.
  - `src/js/main.js` — orchestration : lecture des réglages, génération, auto-remplissage, événements.
  - `src/styles/` — feuilles de style séparées (`base`, `controls`, `layout`, `overlays`).
- `scripts/build.js` recolle les fichiers `src/` dans `app.js` et `styles.css` pour que `index.html` reste autonome.
- `docs/` accueillera la documentation additionnelle (commentaires, captures, etc.).

## Utilisation

1. Ouvrir `index.html` dans un navigateur moderne.
2. Ajuster les pourcentages mono / bi / tri et la répartition des couleurs.
3. Cliquer sur **Générer** pour créer une nouvelle grille ou maintenir le bouton pour déclencher le remplissage automatique pas à pas.
4. Sélectionner un joueur (1–6) pour les marqueurs de jonction.
5. Cliquer sur une tuile de la palette puis sur la grille pour la placer, clic droit pour effacer.
6. Raccourcis : `R` pivote la tuile sélectionnée, `1…6` change de joueur, clic prolongé sur « Générer » auto-remplit.

## Construire les fichiers plats

Le site final reste constitué de `app.js` et `styles.css` à la racine. Pour les régénérer après modification des sources :

```bash
npm install   # rien à installer, mais garde la commande pour cohérence
npm run build
```

La commande concatène les fichiers dans l'ordre indiqué dans `scripts/build.js`.

## Ligne directrice pour les commentaires

- Les commentaires servent à expliquer le *pourquoi* (algorithmes, contraintes de jeu) plutôt que le *comment*.
- Un court bloc en tête de chaque fichier décrit son rôle.
- Les fonctions complexes reçoivent un commentaire « docstring » indiquant prérequis, valeurs de retour et subtilités.
- Lors d'une modification, vérifier que le commentaire associé reste exact (sinon le mettre à jour ou le supprimer). Une checklist simple figure dans `docs/COMMENTS.md`.

## Roadmap (idées)

1. Export (PNG / JSON) de la grille générée.
2. Mode mobile (layout responsive, gestes tactiles).
3. Tests unitaires de la logique d'auto-remplissage.
4. Historique / annulation des placements manuels.

## Licence

Projet privé / usage interne Pairleroy (à ajuster selon vos besoins).
