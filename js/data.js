// Catalogue du jeu : raretés, séries de chaussettes et améliorations du lavoir.

export const RARITY_ORDER = ['commune', 'peu_commune', 'rare', 'epique', 'legendaire'];

export const RARITIES = {
  commune:     { label: 'Commune',     weight: 600, points: 1,   recycle: 5,   color: '#9aa5b1' },
  peu_commune: { label: 'Peu commune', weight: 250, points: 3,   recycle: 15,  color: '#43a047' },
  rare:        { label: 'Rare',        weight: 110, points: 10,  recycle: 50,  color: '#1e88e5' },
  epique:      { label: 'Épique',      weight: 35,  points: 30,  recycle: 150, color: '#8e24aa' },
  legendaire:  { label: 'Légendaire',  weight: 5,   points: 100, recycle: 500, color: '#fb8c00' },
};

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet',
  'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export const monthName = (m) => MONTHS[m - 1];

// s(id, nom, rareté, [couleur de base, couleur d'accent], motif, emoji)
const s = (id, name, rarity, colors, pattern, emoji) => ({ id, name, rarity, colors, pattern, emoji });

export const SERIES = [
  {
    id: 'classiques', name: 'Les Classiques', reward: 300,
    desc: 'Les indispensables de tout tiroir qui se respecte.',
    socks: [
      s('blanche-sport', 'Blanche de sport', 'commune', ['#f4f4f4', '#d32f2f'], 'stripes', ''),
      s('noire-bureau', 'Noire de bureau', 'commune', ['#2b2b2b', '#555555'], 'plain', ''),
      s('grise-chinee', 'Grise chinée', 'commune', ['#9e9e9e', '#bdbdbd'], 'dots', ''),
      s('rayee-marine', 'Rayée marine', 'peu_commune', ['#1a237e', '#ffffff'], 'stripes', '⚓'),
      s('ecossaise', 'Losanges écossais', 'peu_commune', ['#2e7d32', '#ffd54f'], 'diamonds', ''),
      s('arc-en-ciel', 'Arc-en-ciel', 'rare', ['#e53935', '#fdd835'], 'rainbow', '🌈'),
      s('fil-or', "Fil d'or", 'epique', ['#c9a227', '#fff3b0'], 'stars', '✨'),
    ],
  },
  {
    id: 'animaux', name: 'La Ménagerie', reward: 600,
    desc: 'Des bestioles plein les orteils.',
    socks: [
      s('chat', 'Chat roupilleur', 'commune', ['#ffcc80', '#6d4c41'], 'dots', '🐱'),
      s('chien', 'Chien fidèle', 'commune', ['#a1887f', '#ffffff'], 'plain', '🐶'),
      s('renard', 'Renard rusé', 'peu_commune', ['#ef6c00', '#ffffff'], 'diamonds', '🦊'),
      s('panda', 'Panda paresseux', 'peu_commune', ['#ffffff', '#212121'], 'dots', '🐼'),
      s('pieuvre', 'Pieuvre à huit pieds', 'rare', ['#7b1fa2', '#f48fb1'], 'dots', '🐙'),
      s('licorne', 'Licorne', 'epique', ['#f8bbd0', '#b39ddb'], 'stars', '🦄'),
      s('phenix', 'Phénix', 'legendaire', ['#d84315', '#ffca28'], 'flames', '🔥'),
    ],
  },
  {
    id: 'presidents', name: 'Chaussettes de Présidents', reward: 1500,
    desc: 'Le protocole exige des chaussettes impeccables.',
    socks: [
      s('cravate', 'Cravate assortie', 'commune', ['#263238', '#b71c1c'], 'stripes', '👔'),
      s('discours', 'Discours fleuve', 'commune', ['#eceff1', '#1565c0'], 'plain', '🎤'),
      s('poignee', 'Poignée de main', 'peu_commune', ['#455a64', '#cfd8dc'], 'diamonds', '🤝'),
      s('tricolore', 'Tricolore', 'peu_commune', ['#0d47a1', '#e53935'], 'tricolor', ''),
      s('bain-foule', 'Bain de foule', 'rare', ['#5d4037', '#ffcc80'], 'dots', '📣'),
      s('sommet', 'Sommet international', 'rare', ['#1b5e20', '#a5d6a7'], 'stars', '🌍'),
      s('palais', 'Palais doré', 'epique', ['#880e4f', '#ffd54f'], 'diamonds', '🏛️'),
      s('investiture', "Écharpe d'investiture", 'legendaire', ['#0d47a1', '#ffd700'], 'tricolor', '🎖️'),
    ],
  },
  {
    id: 'espace', name: 'Odyssée Spatiale', reward: 900,
    desc: 'Un petit pas pour le pied, un grand pas pour la chaussette.',
    socks: [
      s('lune', 'Croissant de lune', 'commune', ['#283593', '#fff59d'], 'dots', '🌙'),
      s('fusee', 'Fusée', 'commune', ['#eceff1', '#e53935'], 'stripes', '🚀'),
      s('saturne', 'Anneaux de Saturne', 'peu_commune', ['#ffb74d', '#795548'], 'stripes', '🪐'),
      s('astronaute', 'Astronaute', 'rare', ['#fafafa', '#1e88e5'], 'plain', '👩‍🚀'),
      s('nebuleuse', 'Nébuleuse', 'epique', ['#4a148c', '#f06292'], 'stars', '🌌'),
      s('trou-noir', 'Trou noir', 'legendaire', ['#000000', '#7c4dff'], 'spiral', '🕳️'),
    ],
  },
  {
    id: 'gourmandes', name: 'Gourmandises', reward: 500,
    desc: 'À ne pas mettre au lave-vaisselle.',
    socks: [
      s('baguette', 'Baguette croustillante', 'commune', ['#ffe0b2', '#a1662f'], 'stripes', '🥖'),
      s('fromage', 'Fromage qui pue', 'commune', ['#fff176', '#f9a825'], 'dots', '🧀'),
      s('croissant', 'Croissant beurré', 'peu_commune', ['#ffcc80', '#e65100'], 'diamonds', '🥐'),
      s('macaron', 'Macaron pastel', 'rare', ['#f8bbd0', '#a5d6a7'], 'stripes', '🍬'),
      s('truffe', 'Truffe noire', 'epique', ['#3e2723', '#d7ccc8'], 'dots', '🍄'),
    ],
  },
  // --- Collections limitées : tirables seulement pendant leur saison ---
  {
    id: 'halloween', name: "Frissons d'Halloween", reward: 1200, months: [10],
    desc: 'Édition limitée. Disponible en octobre.',
    socks: [
      s('citrouille', 'Citrouille', 'commune', ['#ef6c00', '#212121'], 'stripes', '🎃'),
      s('fantome', 'Fantôme', 'peu_commune', ['#eeeeee', '#9e9e9e'], 'dots', '👻'),
      s('chauve-souris', 'Chauve-souris', 'rare', ['#311b92', '#ff9800'], 'stars', '🦇'),
      s('squelette', 'Squelette', 'epique', ['#212121', '#fafafa'], 'stripes', '💀'),
      s('vampire', 'Comte vampire', 'legendaire', ['#4a0000', '#ff1744'], 'diamonds', '🧛'),
    ],
  },
  {
    id: 'hiver', name: "Vacances d'hiver", reward: 1200, months: [12, 1],
    desc: 'Édition limitée. Disponible en décembre et janvier.',
    socks: [
      s('sapin', 'Sapin', 'commune', ['#2e7d32', '#c62828'], 'diamonds', '🎄'),
      s('bonhomme', 'Bonhomme de neige', 'peu_commune', ['#e3f2fd', '#ff7043'], 'dots', '⛄'),
      s('renne', 'Renne au nez rouge', 'rare', ['#6d4c41', '#e53935'], 'stripes', '🦌'),
      s('flocon', 'Flocon de cristal', 'epique', ['#81d4fa', '#ffffff'], 'stars', '❄️'),
      s('traineau', 'Traîneau doré', 'legendaire', ['#b71c1c', '#ffd700'], 'stars', '🛷'),
    ],
  },
  {
    id: 'ete', name: "Vacances d'été", reward: 1000, months: [7, 8],
    desc: 'Édition limitée. Disponible en juillet et août.',
    socks: [
      s('tongs', 'Tongs (si, si)', 'commune', ['#4dd0e1', '#ffeb3b'], 'stripes', '🩴'),
      s('glace', 'Glace à la fraise', 'peu_commune', ['#f8bbd0', '#ffffff'], 'dots', '🍦'),
      s('palmier', 'Palmier', 'rare', ['#00897b', '#ffe082'], 'stripes', '🌴'),
      s('coucher-soleil', 'Coucher de soleil', 'epique', ['#ff7043', '#7e57c2'], 'rainbow', '🌅'),
    ],
  },
  {
    id: 'valentin', name: 'Saint-Valentin', reward: 800, months: [2],
    desc: 'Édition limitée. Disponible en février.',
    socks: [
      s('coeur', 'Cœur tendre', 'commune', ['#f48fb1', '#c2185b'], 'dots', '💗'),
      s('cupidon', 'Flèche de Cupidon', 'rare', ['#ffebee', '#d81b60'], 'stripes', '💘'),
      s('rose', 'Rose éternelle', 'epique', ['#880e4f', '#66bb6a'], 'stars', '🌹'),
    ],
  },
];

export const SOCKS = SERIES.flatMap((serie) => serie.socks.map((sock) => ({ ...sock, series: serie.id })));
export const SOCK_BY_ID = Object.fromEntries(SOCKS.map((sock) => [sock.id, sock]));
export const SERIES_BY_ID = Object.fromEntries(SERIES.map((serie) => [serie.id, serie]));

export const UPGRADES = [
  { id: 'click',   name: 'Doigts agiles',       emoji: '👆', desc: '+1 fil par clic',         base: 15,    growth: 1.5 },
  { id: 'machine', name: 'Machine à laver',     emoji: '🫧', desc: '+1 fil par seconde',      base: 60,    growth: 1.6 },
  { id: 'dryer',   name: 'Sèche-linge',         emoji: '🌀', desc: '+10 fils par seconde',    base: 900,   growth: 1.7 },
  { id: 'factory', name: 'Usine à chaussettes', emoji: '🏭', desc: '+80 fils par seconde',    base: 12000, growth: 1.8 },
  { id: 'tank',    name: 'Grande bouteille',    emoji: '🤿', desc: "+25 % d'oxygène en plongée", base: 300, growth: 2.1, max: 10 },
  { id: 'magnet',  name: 'Aimant à chaussettes', emoji: '🧲', desc: 'En plongée : attrape de plus loin, nage plus vite', base: 500, growth: 2.2, max: 10 },
  { id: 'luck',    name: 'Trèfle du lavoir',    emoji: '🍀', desc: 'Plus de chances de tirer une rareté', base: 400, growth: 2.4, max: 10 },
];
