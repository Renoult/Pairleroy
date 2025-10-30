module.exports = {
  multipass: true,
  js2svg: {
    pretty: false,
    indent: 2,
  },
  plugins: [
    // Optimisations essentielles
    {
      name: 'preset-default',
      params: {
        overrides: {
          // Préserver les viewBox pour la responsivité
          removeViewBox: false,
          // Garder les dimensions pour la compatibilité
          removeDimensions: false,
          // Préserver les titres et descriptions pour l'accessibilité
          removeTitle: false,
          removeDesc: false,
          // Optimiser les styles mais garder les essentielles
          inlineStyles: {
            onlyMatchedOnce: true,
          },
          // Optimiser les paths mais garder les formes complexes
          cleanupNumericValues: {
            floatPrecision: 3,
          },
          // Optimiser les couleurs
          convertColors: {
            names2hex: true,
            rgb2hex: true,
          },
          // Optimiser les transformations
          convertTransform: true,
        },
      },
    },
    
    // Plugins spécifiques aux SVG heraldiques
    
    // Optimiser les masks et clip-paths (essentiels pour l'art héraldique)
    {
      name: 'removeUselessDefs',
      params: {
        cleanupIDs: true,
      },
    },
    
    // Optimiser les groupes vides
    {
      name: 'removeEmptyContainers',
      params: {
        removeEmptyText: true,
        removeEmptyAttrs: true,
        removeEmptyContainers: true,
      },
    },
    
    // Optimiser les attributs
    {
      name: 'removeAttrs',
      params: {
        attrs: [
          'xml:space', // Attribut redondant
          'data-*', // Attributs de données non nécessaires
          // Garder les attributs importants pour l'héraldique
          'fill-opacity', // Important pour les superpositions
          'stroke-opacity', // Important pour les contours
          'mask', // Essentiel pour les éléments masqués
          'clip-path', // Essentiel pour les clips
        ],
        keepUnreferenced: false,
      },
    },
    
    // Optimiser les IDs non utilisés
    {
      name: 'removeUnknownsAndDefaults',
      params: {
        keepDataAttrs: false,
        keepAriaAttrs: true, // Garder l'accessibilité
        keepriya: true,
      },
    },
    
    // Optimiser les transformations
    {
      name: 'convertPathData',
      params: {
        floatPrecision: 3,
        straightCurves: false, // Garder les courbes complexes
      },
    },
    
    // Réorganiser les éléments
    {
      name: 'sortAttrs',
      params: {
        order: ['id', 'class', 'style', 'transform', 'fill', 'stroke', 'width', 'height', 'viewBox'],
      },
    },
    
    // Optimiser les éléments XML
    {
      name: 'removeXMLProcInst',
      params: {},
    },
    
    // Optimiser les commentaires
    {
      name: 'removeComments',
      params: {},
    },
    
    // Optimiser les attributs de style
    {
      name: 'inlineStyles',
      params: {
        onlyMatchedOnce: true,
        removeMatchedSelectors: false,
      },
    },
    
    // Optimiser les classes CSS non utilisées
    {
      name: 'removeUselessDefs',
      params: {
        elemPrefix: '^$', // Ne pas supprimer les IDs utilisés
        prefixIds: false,
      },
    },
    
    // Optimiser les valeurs numériques
    {
      name: 'cleanupNumericValues',
      params: {
        floatPrecision: 3,
        leadingZero: true,
        zeroDecimalRemovesZero: true,
      },
    },
    
    // Optimiser les couleurs
    {
      name: 'convertColors',
      params: {
        currentColor: false, // Garder currentColor si utilisé
        names2hex: true,
        rgb2hex: true,
      },
    },
    
    // Optimiser les tailles de fichiers
    {
      name: 'removeScripts',
      params: {},
    },
    
    // Optimiser pour les animations (si présentes)
    {
      name: 'removeUnknownsAndDefaults',
      params: {
        keepUnknowns: true, // Garder les éléments d'animation potentiels
      },
    },
  ],
};