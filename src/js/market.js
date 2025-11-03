// Fichier: src/js/market.js
// Description: Definitions de base pour les batiments et contrats du marche central.

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
    description: 'R\u00e9duit de 1 le co\u00fbt en bois des futurs b\u00e2timents.',
  },
  {
    id: 'building-bakery',
    type: MARKET_CARD_TYPES.BUILDING,
    name: 'Boulangerie du Ch\u00e2teau',
    icon: 'building-bakery',
    cost: { [RESOURCE_TYPES.BREAD]: 3, [RESOURCE_TYPES.LABOR]: 1 },
    reward: { points: 5 },
    tags: ['production', 'bread'],
    description: '\u00c0 chaque fin de tour, gagnez 1 pain si vous contr\u00f4lez un am\u00e9nagement adjacent.',
  },
  {
    id: 'building-weaver',
    type: MARKET_CARD_TYPES.BUILDING,
    name: 'Atelier de Tissage',
    icon: 'building-weaver',
    cost: { [RESOURCE_TYPES.FABRIC]: 2, [RESOURCE_TYPES.LABOR]: 2 },
    reward: { points: 6, crowns: 1 },
    tags: ['fabric', 'craft'],
    description: 'Accorde +2 points par contrat textile \u00e0 la fin de la partie.',
  },
  {
    id: 'building-garrison',
    type: MARKET_CARD_TYPES.BUILDING,
    name: 'Garnison Frontali\u00e8re',
    icon: 'building-garrison',
    cost: { [RESOURCE_TYPES.WOOD]: 1, [RESOURCE_TYPES.BREAD]: 1, points: 6 },
    reward: { points: 8 },
    tags: ['military'],
    description: 'Permet un d\u00e9ploiement gratuit d\u2019un colon \u00e0 port\u00e9e 2 d\u00e8s l\u2019achat.',
  },
  {
    id: 'building-harvest-hall',
    type: MARKET_CARD_TYPES.BUILDING,
    name: 'Halle des R\u00e9coltes',
    icon: 'building-harvest-hall',
    cost: { [RESOURCE_TYPES.WOOD]: 1, [RESOURCE_TYPES.BREAD]: 1 },
    reward: { points: 6 },
    tags: ['agriculture', 'storage'],
    description: 'Entrep\u00f4t couvert qui optimise les r\u00e9coltes. Score +2 PV si vous contr\u00f4lez 3 tuiles vertes.',
  },
  {
    id: 'building-arsenal-annex',
    type: MARKET_CARD_TYPES.BUILDING,
    name: 'Annexe de l\u2019Arsenal',
    icon: 'building-arsenal-annex',
    cost: { [RESOURCE_TYPES.FABRIC]: 1, [RESOURCE_TYPES.LABOR]: 2 },
    reward: { points: 7, crowns: 1 },
    tags: ['military', 'fabric'],
    description: 'Atelier m\u00e9tallurgique qui ravitaille les d\u00e9fenses. Permet d\u2019acheter des ch\u00e2teaux \u00e0 15 PV au lieu de 20.',
  },
  {
    id: 'building-guild-house',
    type: MARKET_CARD_TYPES.BUILDING,
    name: 'Maison des Guildes',
    icon: 'building-guild-house',
    cost: { [RESOURCE_TYPES.BREAD]: 2, [RESOURCE_TYPES.FABRIC]: 1 },
    reward: { points: 5, influence: 1 },
    tags: ['guild', 'influence'],
    description: 'Quartier administratif qui coordonne les corporations. \u00c9tend votre zone d\u2019influence de 1 autour du ch\u00e2teau.',
  },
  {
    id: 'building-merchant-relay',
    type: MARKET_CARD_TYPES.BUILDING,
    name: 'Relais Marchand',
    icon: 'building-merchant-relay',
    cost: { [RESOURCE_TYPES.WOOD]: 1, [RESOURCE_TYPES.FABRIC]: 1, points: 3 },
    reward: { points: 4, crowns: 1 },
    tags: ['trade', 'route'],
    description: 'Halte commerciale qui s\u00e9curise les caravanes. Fin de partie : +3 PV si vous d\u00e9tenez la plus longue cha\u00eene orthogonale.',
  },
  {
    id: 'building-observatory',
    type: MARKET_CARD_TYPES.BUILDING,
    name: 'Observatoire Royal',
    icon: 'building-observatory',
    cost: { [RESOURCE_TYPES.WOOD]: 1, [RESOURCE_TYPES.FABRIC]: 1, points: 5 },
    reward: { points: 7, crowns: 1 },
    tags: ['science'],
    description: 'R\u00e9v\u00e8le deux tuiles du sachet suppl\u00e9mentaire \u00e0 chaque pr\u00e9paration de tour.',
  },
  {
    id: 'building-harbor',
    type: MARKET_CARD_TYPES.BUILDING,
    name: 'Port Fluvial',
    icon: 'building-harbor',
    cost: { [RESOURCE_TYPES.WOOD]: 2, [RESOURCE_TYPES.BREAD]: 1, points: 3 },
    reward: { points: 6, influence: 1 },
    tags: ['trade', 'water'],
    description: 'Autorise un \u00e9change bois contre tissu par tour sans co\u00fbt additionnel.',
  },
  {
    id: 'building-guildhall',
    type: MARKET_CARD_TYPES.BUILDING,
    name: 'H\u00f4tel de Guilde',
    icon: 'building-guildhall',
    cost: { [RESOURCE_TYPES.FABRIC]: 2, [RESOURCE_TYPES.LABOR]: 1, points: 4 },
    reward: { points: 7, crowns: 1 },
    tags: ['guild'],
    description: 'Chaque contrat accompli rapporte 1 point suppl\u00e9mentaire.',
  },
  {
    id: 'building-granary',
    type: MARKET_CARD_TYPES.BUILDING,
    name: 'Grand Grenier',
    icon: 'building-granary',
    cost: { [RESOURCE_TYPES.BREAD]: 2, [RESOURCE_TYPES.WOOD]: 1 },
    reward: { points: 4, stock: { [RESOURCE_TYPES.BREAD]: 2 } },
    tags: ['storage'],
    description: 'Augmente votre r\u00e9serve maximale de pain de 2 unit\u00e9s.',
  },
  {
    id: 'building-expedition-hall',
    type: MARKET_CARD_TYPES.BUILDING,
    name: 'Loge des Explorateurs',
    icon: 'building-expedition-hall',
    cost: { [RESOURCE_TYPES.WOOD]: 1, [RESOURCE_TYPES.BREAD]: 1, [RESOURCE_TYPES.LABOR]: 1 },
    reward: { points: 8 },
    tags: ['exploration'],
    description: 'Centre de cartographie qui finance des expes. Octroie un d\u00e9placement gratuit de colon apr\u00e8s achat.',
  },
  {
    id: 'building-cathedral-works',
    type: MARKET_CARD_TYPES.BUILDING,
    name: 'Chantier de Cath\u00e9drale',
    icon: 'building-cathedral-works',
    cost: { [RESOURCE_TYPES.WOOD]: 2, [RESOURCE_TYPES.FABRIC]: 2, points: 4 },
    reward: { points: 10 },
    tags: ['prestige', 'faith'],
    description: 'Grand chantier religieux qui attire les foules. Ajoute 1 couronne si vous poss\u00e9dez au moins deux b\u00e2timents religieux.',
  },
  {
    id: 'building-tradepost',
    type: MARKET_CARD_TYPES.BUILDING,
    name: 'Comptoir Aerige',
    icon: 'building-tradepost',
    cost: { [RESOURCE_TYPES.FABRIC]: 1, points: 3 },
    reward: { points: 5, crowns: 1 },
    tags: ['trade'],
    description: 'Maison des n\u00e9gociants qui traite toute marchandise. R\u00e9duit de 1 le co\u00fbt en tissu de vos futurs projets.',
  },
  {
    id: 'building-artisan-hall',
    type: MARKET_CARD_TYPES.BUILDING,
    name: 'Maison des Artisans',
    icon: 'building-artisan-hall',
    cost: { [RESOURCE_TYPES.LABOR]: 3 },
    reward: { points: 6 },
    tags: ['guild', 'workshop'],
    description: 'Atelier collectif qui valorise chaque savoir faire. Permet de convertir 1 main d\u2019\u0153uvre en 1 pain \u00e0 chaque tour.',
  },
];

function getMarketCardDefinition(cardId) {
  return MARKET_CARD_DEFINITIONS.find((card) => card.id === cardId) ?? null;
}

function createInitialMarketDeck(definitions = MARKET_CARD_DEFINITIONS) {
  return definitions
    .filter((card) => card?.type === MARKET_CARD_TYPES.BUILDING)
    .map((card) => ({ ...card }));
}

function shuffleArray(source) {
  const array = Array.isArray(source) ? source : [];
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = array[i];
    array[i] = array[j];
    array[j] = tmp;
  }
  return array;
}

function createEmptyMarketSlots() {
  return Array.from({ length: MARKET_SLOT_COUNT }, () => null);
}

function createInitialMarketState() {
  const deck = createInitialMarketDeck();
  return {
    deck,
    drawPile: shuffleArray(deck.map((card) => ({ ...card }))),
    discardPile: [],
    slots: createEmptyMarketSlots(),
    revealedThisTurn: new Set(),
  };
}

function replenishMarketDrawPile(state) {
  if (!state || !Array.isArray(state.discardPile) || state.discardPile.length === 0) return;
  const refreshed = state.discardPile
    .map((cardId) => getMarketCardDefinition(cardId))
    .filter((card) => card && card.type === MARKET_CARD_TYPES.BUILDING)
    .map((card) => ({ ...card }));
  shuffleArray(refreshed);
  if (!Array.isArray(state.drawPile)) state.drawPile = [];
  state.drawPile.push(...refreshed);
  state.discardPile = [];
}

function drawMarketCard(state) {
  if (!state) return null;
  if (!Array.isArray(state.drawPile)) state.drawPile = [];
  if (state.drawPile.length === 0) replenishMarketDrawPile(state);
  const next = state.drawPile.shift() ?? null;
  return next ? { ...next } : null;
}

function refillMarketSlot(state, slotIdx) {
  if (!state || !Array.isArray(state.slots)) return;
  if (!Number.isInteger(slotIdx) || slotIdx < 0 || slotIdx >= state.slots.length) return;
  const card = drawMarketCard(state);
  if (card) {
    state.slots[slotIdx] = {
      id: card.id,
      status: 'available',
    };
  } else {
    state.slots[slotIdx] = null;
  }
}

function seedMarketSlotsFromDeck(state) {
  if (!state || !Array.isArray(state.deck) || !Array.isArray(state.slots)) return;
  for (let slotIdx = 0; slotIdx < state.slots.length; slotIdx++) {
    refillMarketSlot(state, slotIdx);
  }
}
