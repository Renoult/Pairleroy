# Pairleroy – Generateur de grilles hexagonales

Pairleroy est un outil web autonome qui aide a generer et manipuler une grille de 127 tuiles pour le jeu du meme nom. L'application est 100% front-end et fonctionne directement depuis un navigateur moderne.

## Organisation du depot

- `src/` – code source organise par modules JavaScript (`core`, `palette`, `render`, `utils`, `main`) et feuilles de style (`base`, `controls`, `layout`, `overlays`).
- `dist/` – bundle de production genere par le script de build (`dist/app.js`, `dist/styles.css`). Ces fichiers sont commits pour permettre une utilisation immediate.
- `scripts/` – outils d'automatisation, notamment `scripts/build.js`.
- `tools/` – ressources annexes (benchmark de performance, scenarios de tests manuels).
- `docs/` – documentation fonctionnelle, analyses et rapports (les documents d'optimisation ont ete regroupes dans `docs/optimisation/`).
- `crests/` – SVG des blasons utilises par l'interface.
- `index.html` – point d'entree de l'application; il charge les bundles depuis `dist/`.

## Lancer l'application

### Utilisation rapide
1. Cloner le depot (ou telecharger l'archive).
2. Ouvrir `index.html` dans un navigateur (Chrome, Firefox, Edge, Brave recents).
3. Les assets charges depuis `dist/` permettent une utilisation sans commande supplementaire.

### Developpement
```bash
npm install          # installe les dependances (svgo uniquement pour le moment)
npm run build        # build de developpement, sorties lisibles
npm run build:prod   # build de production minifie dans dist/
npm run build:analyze# calcule les tailles sans re-ecrire les fichiers
npm run clean        # supprime le contenu de dist/
npm run start        # sert le site sur l'interface 172.22.22.90:3000
```

> Remarque : le build script concatene simplement les sources dans l'ordre defini dans `scripts/build.js`. Aucun transpileur n'est requis a ce stade.

Pour exposer l'application a d'autres machines du reseau local, lancez `npm run start` puis utilisez l'IP de la machine hote (par exemple `http://172.22.22.90:3000`). Vous pouvez changer l'interface ou le port via `npm run start -- --listen tcp://ADRESSE:PORT` si necessaire.

## Scripts npm

- `build` : `node ./scripts/build.js`
- `build:dev` : alias de `build`
- `build:prod` : `node ./scripts/build.js --prod`
- `build:analyze` : `node ./scripts/build.js --analyze`
- `clean` : supprime le dossier `dist/`
- `optimize:svg` : `node ./scripts/optimize-svg.js`

## Tests et benchmarks

- `tools/benchmark/performance_benchmark.js` contient un utilitaire basique pour sonder les performances de generation.
- `tools/manual-tests/test_performance.html` sert de scenario manuel pour les validations visuelles.

## Documentation

Les differents rapports d'optimisation, analyses techniques et notes sont accessibles dans `docs/`. Les documents de synthese lies aux optimisations ont ete regroupes dans `docs/optimisation/` pour clarifier la racine du depot.

## Licence

Licence interne Pairleroy. Adapter selon vos besoins avant diffusion publique.
