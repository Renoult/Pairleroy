// Fichier: src/js/utils.js
// Description: Fonctions utilitaires pour la création et manipulation d'éléments SVG

const SVG_NS = 'http://www.w3.org/2000/svg';
const ORIENTED_INDEX_FOR_TRIANGLE = [4, 5, 0, 1, 2, 3];

/**
 * Crée un élément SVG avec le namespace approprié
 * @param {string} tagName - Nom de la balise SVG
 * @returns {Element} Élément SVG créé
 */
function createSVGElement(tagName) {
  return document.createElementNS(SVG_NS, tagName);
}

/**
 * Crée un path pour un triangle formé par le centre et deux points
 * @param {{x: number, y: number}} center - Point central
 * @param {{x: number, y: number}} a - Premier point
 * @param {{x: number, y: number}} b - Deuxième point
 * @returns {string} Path SVG du triangle
 */
function createTrianglePath(center, a, b) {
  return `M ${center.x} ${center.y} L ${a.x} ${a.y} L ${b.x} ${b.y} Z`;
}

/**
 * Crée un path pour un outline hexagonal arrondi
 * @param {number} x - Coordonnée x du centre
 * @param {number} y - Coordonnée y du centre
 * @param {number} radius - Rayon de l'hexagone
 * @param {number} cornerRadius - Rayon d'arrondi (défaut: 0.18)
 * @returns {string} Path SVG de l'hexagone arrondi
 */
function createHexOutlinePath(x, y, radius, cornerRadius = 0.18) {
  // Délègue à la fonction roundedHexPathAt de core.js
  return roundedHexPathAt(x, y, radius, cornerRadius);
}

/**
 * Crée un élément SVG avec des attributs
 * @param {string} tagName - Nom de la balise SVG
 * @param {Object} attributes - Attributs à définir
 * @returns {Element} Élément SVG créé avec attributs
 */
function createSVGElementWithAttributes(tagName, attributes = {}) {
  const element = createSVGElement(tagName);
  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
  return element;
}

/**
 * Crée un path de triangle SVG avec un centre et deux points
 * @param {{x: number, y: number}} center - Point central
 * @param {{x: number, y: number}} a - Premier point
 * @param {{x: number, y: number}} b - Deuxième point
 * @param {Object} attributes - Attributs supplémentaires
 * @returns {Element} Élément path SVG
 */
function createTrianglePathElement(center, a, b, attributes = {}) {
  const path = createSVGElement('path');
  path.setAttribute('d', createTrianglePath(center, a, b));
  Object.entries(attributes).forEach(([key, value]) => {
    path.setAttribute(key, value);
  });
  return path;
}

/**
 * Crée un outline hexagonal SVG
 * @param {number} x - Coordonnée x du centre
 * @param {number} y - Coordonnée y du centre
 * @param {number} radius - Rayon de l'hexagone
 * @param {Object} attributes - Attributs supplémentaires
 * @returns {Element} Élément path SVG
 */
function createHexOutlineElement(x, y, radius, attributes = {}) {
  const path = createSVGElement('path');
  path.setAttribute('d', createHexOutlinePath(x, y, radius));
  Object.entries(attributes).forEach(([key, value]) => {
    path.setAttribute(key, value);
  });
  return path;
}
