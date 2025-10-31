// Fichier: src/js/market.js
// Description: Définitions de base pour les bâtiments et contrats du marché central.

const MARKET_SLOT_COUNT = 16;

const MARKET_CARD_TYPES = Object.freeze({
  BUILDING: 'building',
  CONTRACT: 'contract',
});

const RESOURCE_TYPES = Object.freeze({
  WOOD: 'wood',
  BREAD: 'bread',
  FABRIC: 'fabric',
  LABOR: 'labor',
});

const MARKET_CARD_DEFINITIONS = [
  {
    id: 'building-lumber-yard',
    type: MARKET_CARD_TYPES.BUILDING,
    name: 'Scierie Royale',
    icon: 'building-lumber-yard',
    cost: { [RESOURCE_TYPES.WOOD]: 2, points: 4 },
    reward: { points: 3, crowns: 1 },
    tags: ['production', 'wood'],
    description: 'Réduit de 1 le coût en bois des futurs bâtiments.',
  },
  {
    id: 'building-bakery',
    type: MARKET_CARD_TYPES.BUILDING,
    name: 'Boulangerie du Château',
    icon: 'building-bakery',
    cost: { [RESOURCE_TYPES.BREAD]: 3, [RESOURCE_TYPES.LABOR]: 1 },
    reward: { points: 5 },
    tags: ['production', 'bread'],
    description: 'À chaque fin de tour, gagnez 1 pain si vous contrôlez un aménagement adjacent.',
  },
  {
    id: 'building-weaver',
    type: MARKET_CARD_TYPES.BUILDING,
    name: 'Atelier de Tissage',
    icon: 'building-weaver',
    cost: { [RESOURCE_TYPES.FABRIC]: 2, [RESOURCE_TYPES.LABOR]: 2 },
    reward: { points: 6, crowns: 1 },
    tags: ['fabric', 'craft'],
    description: 'Accorde +2 points par contrat textile à la fin de la partie.',
  },
  {
    id: 'building-garrison',
    type: MARKET_CARD_TYPES.BUILDING,
    name: 'Garnison Frontalière',
    icon: 'building-garrison',
    cost: { [RESOURCE_TYPES.WOOD]: 1, [RESOURCE_TYPES.BREAD]: 1, points: 6 },
    reward: { points: 8 },
    tags: ['military'],
    description: 'Permet un déploiement gratuit d’un colon à portée 2 dès l’achat.',
  },
  {
    id: 'contract-harvest',
    type: MARKET_CARD_TYPES.CONTRACT,
    name: 'Charte des Récoltes',
    icon: 'contract-harvest',
    cost: { [RESOURCE_TYPES.WOOD]: 1, [RESOURCE_TYPES.BREAD]: 1 },
    reward: { points: 6 },
    tags: ['set'],
    description: 'Score +2 points supplémentaires si vous contrôlez 3 tuiles vertes.',
  },
  {
    id: 'contract-armory',
    type: MARKET_CARD_TYPES.CONTRACT,
    name: 'Contrat de l’Arsenal',
    icon: 'contract-armory',
    cost: { [RESOURCE_TYPES.FABRIC]: 1, [RESOURCE_TYPES.LABOR]: 2 },
    reward: { points: 7, crowns: 1 },
    tags: ['military', 'fabric'],
    description: 'Débloque l’achat de châteaux à 15 points au lieu de 20.',
  },
  {
    id: 'contract-guild',
    type: MARKET_CARD_TYPES.CONTRACT,
    name: 'Concession de Guilde',
    icon: 'contract-guild',
    cost: { [RESOURCE_TYPES.BREAD]: 2, [RESOURCE_TYPES.FABRIC]: 1 },
    reward: { points: 5, influence: 1 },
    tags: ['guild'],
    description: 'Étend votre zone d’influence de 1 autour de votre château.',
  },
  {
    id: 'contract-trade-road',
    type: MARKET_CARD_TYPES.CONTRACT,
    name: 'Route Marchande',
    icon: 'contract-trade-road',
    cost: { [RESOURCE_TYPES.WOOD]: 1, [RESOURCE_TYPES.FABRIC]: 1, points: 3 },
    reward: { points: 4, crowns: 1 },
    tags: ['trade'],
    description: 'À la fin de la partie, +3 points si vous contrôlez la plus longue chaîne orthogonale.',
  },
  {
    id: 'building-observatory',
    type: MARKET_CARD_TYPES.BUILDING,
    name: 'Observatoire Royal',
    icon: 'building-observatory',
    cost: { [RESOURCE_TYPES.WOOD]: 1, [RESOURCE_TYPES.FABRIC]: 1, points: 5 },
    reward: { points: 7, crowns: 1 },
    tags: ['science'],
    description: 'Révèle deux tuiles du sachet supplémentaire à chaque préparation de tour.',
  },
  {
    id: 'building-harbor',
    type: MARKET_CARD_TYPES.BUILDING,
    name: 'Port Fluvial',
    icon: 'building-harbor',
    cost: { [RESOURCE_TYPES.WOOD]: 2, [RESOURCE_TYPES.BREAD]: 1, points: 3 },
    reward: { points: 6, influence: 1 },
    tags: ['trade', 'water'],
    description: 'Autorise un échange bois ↔ tissu par tour sans coût additionnel.',
  },
  {
    id: 'building-guildhall',
    type: MARKET_CARD_TYPES.BUILDING,
    name: 'Hôtel de Guilde',
    icon: 'building-guildhall',
    cost: { [RESOURCE_TYPES.FABRIC]: 2, [RESOURCE_TYPES.LABOR]: 1, points: 4 },
    reward: { points: 7, crowns: 1 },
    tags: ['guild'],
    description: 'Chaque contrat accompli rapporte 1 point supplémentaire.',
  },
  {
    id: 'building-granary',
    type: MARKET_CARD_TYPES.BUILDING,
    name: 'Grand Grenier',
    icon: 'building-granary',
    cost: { [RESOURCE_TYPES.BREAD]: 2, [RESOURCE_TYPES.WOOD]: 1 },
    reward: { points: 4, stock: { [RESOURCE_TYPES.BREAD]: 2 } },
    tags: ['storage'],
    description: 'Augmente votre réserve maximale de pain de 2 unités.',
  },
  {
    id: 'contract-expedition',
    type: MARKET_CARD_TYPES.CONTRACT,
    name: 'Expédition Lointaine',
    icon: 'contract-expedition',
    cost: { [RESOURCE_TYPES.WOOD]: 1, [RESOURCE_TYPES.BREAD]: 1, [RESOURCE_TYPES.LABOR]: 1 },
    reward: { points: 8 },
    tags: ['exploration'],
    description: 'Octroie un déplacement gratuit de colon après achat.',
  },
  {
    id: 'contract-cathedral',
    type: MARKET_CARD_TYPES.CONTRACT,
    name: 'Chantier de Cathédrale',
    icon: 'contract-cathedral',
    cost: { [RESOURCE_TYPES.WOOD]: 2, [RESOURCE_TYPES.FABRIC]: 2, points: 4 },
    reward: { points: 10 },
    tags: ['prestige'],
    description: 'Ajoute 1 couronne si vous possédez au moins deux bâtiments religieux.',
  },
  {
    id: 'contract-tradepost',
    type: MARKET_CARD_TYPES.CONTRACT,
    name: 'Comptoir Érigé',
    icon: 'contract-tradepost',
    cost: { [RESOURCE_TYPES.FABRIC]: 1, points: 3 },
    reward: { points: 5, crowns: 1 },
    tags: ['trade'],
    description: 'Réduit de 1 le coût en tissu de vos prochains contrats.',
  },
  {
    id: 'contract-artisans',
    type: MARKET_CARD_TYPES.CONTRACT,
    name: 'Charte des Artisans',
    icon: 'contract-artisans',
    cost: { [RESOURCE_TYPES.LABOR]: 3 },
    reward: { points: 6 },
    tags: ['guild'],
    description: 'Permet de convertir 1 main-d’œuvre en 1 pain à chaque tour.',
  },
];

function getMarketCardDefinition(cardId) {
  return MARKET_CARD_DEFINITIONS.find((card) => card.id === cardId) ?? null;
}

function createInitialMarketDeck(definitions = MARKET_CARD_DEFINITIONS) {
  return definitions.map((card) => ({ ...card }));
}

function createEmptyMarketSlots() {
  return Array.from({ length: MARKET_SLOT_COUNT }, () => null);
}

function createInitialMarketState() {
  return {
    deck: createInitialMarketDeck(),
    drawPile: [],
    discardPile: [],
    slots: createEmptyMarketSlots(),
    revealedThisTurn: new Set(),
  };
}

function seedMarketSlotsFromDeck(state) {
  if (!state || !Array.isArray(state.deck) || !Array.isArray(state.slots)) return;
  for (let slotIdx = 0; slotIdx < state.slots.length; slotIdx++) {
    const definition = state.deck[slotIdx] ?? null;
    if (!definition) {
      state.slots[slotIdx] = null;
      continue;
    }
    state.slots[slotIdx] = {
      id: definition.id,
      status: 'available',
    };
  }
}
