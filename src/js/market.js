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
    id: 'building-harvest-hall',
    type: MARKET_CARD_TYPES.BUILDING,
    name: 'Halle des Recoltes',
    icon: 'building-harvest-hall',
    cost: { [RESOURCE_TYPES.WOOD]: 1, [RESOURCE_TYPES.BREAD]: 1 },
    reward: { points: 6 },
    tags: ['agriculture', 'storage'],
    description: 'Entrepot couvert qui optimise les recoltes. Score +2 PV si vous controlez 3 tuiles vertes.',
  },
  {
    id: 'building-arsenal-annex',
    type: MARKET_CARD_TYPES.BUILDING,
    name: 'Annexe de l Arsenal',
    icon: 'building-arsenal-annex',
    cost: { [RESOURCE_TYPES.FABRIC]: 1, [RESOURCE_TYPES.LABOR]: 2 },
    reward: { points: 7, crowns: 1 },
    tags: ['military', 'fabric'],
    description: 'Atelier metallurgique qui ravitaille les defenses. Permet d acheter des chateaux a 15 PV au lieu de 20.',
  },
  {
    id: 'building-guild-house',
    type: MARKET_CARD_TYPES.BUILDING,
    name: 'Maison des Guildes',
    icon: 'building-guild-house',
    cost: { [RESOURCE_TYPES.BREAD]: 2, [RESOURCE_TYPES.FABRIC]: 1 },
    reward: { points: 5, influence: 1 },
    tags: ['guild', 'influence'],
    description: 'Quartier administratif qui coordonne les corporations. Etend votre zone d influence de 1 autour du chateau.',
  },
  {
    id: 'building-merchant-relay',
    type: MARKET_CARD_TYPES.BUILDING,
    name: 'Relais Marchand',
    icon: 'building-merchant-relay',
    cost: { [RESOURCE_TYPES.WOOD]: 1, [RESOURCE_TYPES.FABRIC]: 1, points: 3 },
    reward: { points: 4, crowns: 1 },
    tags: ['trade', 'route'],
    description: 'Halte commerciale qui securise les caravanes. Fin de partie: +3 PV si vous detenez la plus longue chaine orthogonale.',
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
    id: 'building-expedition-hall',
    type: MARKET_CARD_TYPES.BUILDING,
    name: 'Loge des Explorateurs',
    icon: 'building-expedition-hall',
    cost: { [RESOURCE_TYPES.WOOD]: 1, [RESOURCE_TYPES.BREAD]: 1, [RESOURCE_TYPES.LABOR]: 1 },
    reward: { points: 8 },
    tags: ['exploration'],
    description: 'Centre de cartographie qui finance des expes. Octroie un deplacement gratuit de colon apres achat.',
  },
  {
    id: 'building-cathedral-works',
    type: MARKET_CARD_TYPES.BUILDING,
    name: 'Chantier de Cathedrale',
    icon: 'building-cathedral-works',
    cost: { [RESOURCE_TYPES.WOOD]: 2, [RESOURCE_TYPES.FABRIC]: 2, points: 4 },
    reward: { points: 10 },
    tags: ['prestige', 'faith'],
    description: 'Grand chantier religieux qui attire les foules. Ajoute 1 couronne si vous possedez au moins deux batiments religieux.',
  },
  {
    id: 'building-tradepost',
    type: MARKET_CARD_TYPES.BUILDING,
    name: 'Comptoir Aerige',
    icon: 'building-tradepost',
    cost: { [RESOURCE_TYPES.FABRIC]: 1, points: 3 },
    reward: { points: 5, crowns: 1 },
    tags: ['trade'],
    description: 'Maison des negociants qui traite toute marchandise. Reduit de 1 le cout en tissu de vos futurs projets.',
  },
  {
    id: 'building-artisan-hall',
    type: MARKET_CARD_TYPES.BUILDING,
    name: 'Maison des Artisans',
    icon: 'building-artisan-hall',
    cost: { [RESOURCE_TYPES.LABOR]: 3 },
    reward: { points: 6 },
    tags: ['guild', 'workshop'],
    description: 'Atelier collectif qui valorise chaque savoir faire. Permet de convertir 1 main d oeuvre en 1 pain a chaque tour.',
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
