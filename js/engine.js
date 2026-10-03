// Logique pure du jeu (sans DOM) : économie du clicker, tirages, collection et score.
import { RARITIES, RARITY_ORDER, SERIES, SERIES_BY_ID, SOCKS, SOCK_BY_ID, UPGRADES } from './data.js';

export const SAVE_VERSION = 1;
export const SIDES = ['L', 'R'];
export const SIDE_LABEL = { L: 'gauche', R: 'droite' };

const PAIR_MULTIPLIER = 0.02;    // +2 % de production par paire complète
const SERIES_MULTIPLIER = 0.25;  // +25 % par série complète
const OFFLINE_MAX_SECONDS = 8 * 3600;
const OFFLINE_RATE = 0.5;
const PACK_SIZE = 10;
const PACK_DISCOUNT = 0.9;
const SURPRISE_TWIN = 0.04;      // la chaussette arrive avec sa jumelle
const SURPRISE_COIN = 0.03;      // une pièce oubliée dans la chaussette

export function createState(now = Date.now()) {
  return {
    version: SAVE_VERSION,
    name: '',
    fils: 0,
    totalFils: 0,
    clicks: 0,
    draws: 0,
    upgrades: Object.fromEntries(UPGRADES.map((u) => [u.id, 0])),
    owned: {},              // { [sockId]: { L: nombre, R: nombre } }
    completedSeries: [],
    lastSeen: now,
  };
}

export function loadState(raw, now = Date.now()) {
  const state = createState(now);
  if (!raw || typeof raw !== 'object') return state;
  Object.assign(state, raw);
  state.upgrades = { ...createState(now).upgrades, ...(raw.upgrades || {}) };
  state.owned = Object.fromEntries(
    Object.entries(raw.owned || {}).filter(([id]) => SOCK_BY_ID[id]),
  );
  state.completedSeries = (raw.completedSeries || []).filter((id) => SERIES_BY_ID[id]);
  return state;
}

// --- Saisons ---------------------------------------------------------------

export function isSeriesActive(serie, date = new Date()) {
  return !serie.months || serie.months.includes(date.getMonth() + 1);
}

export function availableSocks(date = new Date()) {
  return SOCKS.filter((sock) => isSeriesActive(SERIES_BY_ID[sock.series], date));
}

// --- Économie ---------------------------------------------------------------

export function upgradeCost(state, id) {
  const upgrade = UPGRADES.find((u) => u.id === id);
  return Math.ceil(upgrade.base * Math.pow(upgrade.growth, state.upgrades[id] || 0));
}

export function canBuyUpgrade(state, id) {
  const upgrade = UPGRADES.find((u) => u.id === id);
  if (upgrade.max !== undefined && state.upgrades[id] >= upgrade.max) return false;
  return state.fils >= upgradeCost(state, id);
}

export function buyUpgrade(state, id) {
  if (!canBuyUpgrade(state, id)) return false;
  state.fils -= upgradeCost(state, id);
  state.upgrades[id] += 1;
  return true;
}

export function countPairs(state) {
  return Object.values(state.owned).filter((o) => o.L > 0 && o.R > 0).length;
}

export function multiplier(state) {
  return 1 + PAIR_MULTIPLIER * countPairs(state) + SERIES_MULTIPLIER * state.completedSeries.length;
}

export function clickValue(state) {
  return (1 + state.upgrades.click) * multiplier(state);
}

export function autoRate(state) {
  const u = state.upgrades;
  return (u.machine * 1 + u.dryer * 10 + u.factory * 80) * multiplier(state);
}

function earn(state, amount) {
  state.fils += amount;
  state.totalFils += amount;
}

export function click(state) {
  const value = clickValue(state);
  state.clicks += 1;
  earn(state, value);
  return value;
}

export function tick(state, seconds) {
  const gained = autoRate(state) * seconds;
  earn(state, gained);
  return gained;
}

export function applyOfflineGains(state, now = Date.now()) {
  const elapsed = Math.min(Math.max(0, (now - state.lastSeen) / 1000), OFFLINE_MAX_SECONDS);
  state.lastSeen = now;
  const gained = autoRate(state) * elapsed * OFFLINE_RATE;
  earn(state, gained);
  return { seconds: elapsed, gained };
}

// --- Tirages ----------------------------------------------------------------

export function drawCost(state) {
  return Math.round(25 * Math.pow(1.02, Math.min(state.draws, 200)));
}

export function packCost(state) {
  return Math.round(drawCost(state) * PACK_SIZE * PACK_DISCOUNT);
}

export function rarityWeights(state) {
  const luck = state.upgrades.luck || 0;
  return RARITY_ORDER.map((r, i) => RARITIES[r].weight * (1 + 0.08 * luck * i));
}

export function rollRarity(state, rng = Math.random, minIndex = 0) {
  const weights = rarityWeights(state).map((w, i) => (i < minIndex ? 0 : w));
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i];
    if (roll < 0) return RARITY_ORDER[i];
  }
  return RARITY_ORDER[weights.length - 1];
}

function pick(list, rng) {
  return list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
}

function addSock(state, sockId, side) {
  const entry = state.owned[sockId] || (state.owned[sockId] = { L: 0, R: 0 });
  entry[side] += 1;
  return entry;
}

function rollOne(state, rng, date, minRarity = 0) {
  const pool = availableSocks(date);
  let rarity = rollRarity(state, rng, minRarity);
  let candidates = pool.filter((sock) => sock.rarity === rarity);
  // Si aucune chaussette de cette rareté n'est tirable, on descend d'un cran.
  while (candidates.length === 0) {
    rarity = RARITY_ORDER[RARITY_ORDER.indexOf(rarity) - 1];
    candidates = pool.filter((sock) => sock.rarity === rarity);
  }
  const sock = pick(candidates, rng);
  const side = rng() < 0.5 ? 'L' : 'R';
  const hadPair = isPair(state, sock.id);
  const isNew = !(state.owned[sock.id]?.[side] > 0);

  const result = { sock, side, isNew, surprise: null, bonusFils: 0, pairCompleted: false, seriesCompleted: [] };
  addSock(state, sock.id, side);

  const surpriseRoll = rng();
  if (surpriseRoll < SURPRISE_TWIN) {
    const other = side === 'L' ? 'R' : 'L';
    result.twinWasNew = !(state.owned[sock.id][other] > 0);
    addSock(state, sock.id, other);
    result.surprise = 'twin';
  } else if (surpriseRoll < SURPRISE_TWIN + SURPRISE_COIN) {
    result.surprise = 'coin';
    result.bonusFils = drawCost(state) * 3;
    earn(state, result.bonusFils);
  }

  result.pairCompleted = !hadPair && isPair(state, sock.id);
  result.seriesCompleted = claimCompletedSeries(state);
  for (const id of result.seriesCompleted) result.bonusFils += SERIES_BY_ID[id].reward;
  return result;
}

export function draw(state, rng = Math.random, date = new Date()) {
  const cost = drawCost(state);
  if (state.fils < cost) return null;
  state.fils -= cost;
  state.draws += 1;
  return [rollOne(state, rng, date)];
}

// Un pack de 10 coûte 10 % de moins et garantit au moins une Rare.
export function drawPack(state, rng = Math.random, date = new Date()) {
  const cost = packCost(state);
  if (state.fils < cost) return null;
  state.fils -= cost;
  const results = [];
  for (let i = 0; i < PACK_SIZE; i++) {
    const hasRare = results.some((r) => RARITY_ORDER.indexOf(r.sock.rarity) >= 2);
    const minRarity = i === PACK_SIZE - 1 && !hasRare ? 2 : 0;
    results.push(rollOne(state, rng, date, minRarity));
  }
  state.draws += PACK_SIZE;
  return results;
}

// --- Collection ---------------------------------------------------------------

export function isPair(state, sockId) {
  const o = state.owned[sockId];
  return !!o && o.L > 0 && o.R > 0;
}

export function isSeriesComplete(state, serie) {
  return serie.socks.every((sock) => isPair(state, sock.id));
}

export function seriesProgress(state, serie) {
  const total = serie.socks.length * 2;
  const owned = serie.socks.reduce((n, sock) => n + SIDES.filter((side) => state.owned[sock.id]?.[side] > 0).length, 0);
  return { owned, total };
}

function claimCompletedSeries(state) {
  const claimed = [];
  for (const serie of SERIES) {
    if (!state.completedSeries.includes(serie.id) && isSeriesComplete(state, serie)) {
      state.completedSeries.push(serie.id);
      earn(state, serie.reward);
      claimed.push(serie.id);
    }
  }
  return claimed;
}

export function duplicateValue(state) {
  let value = 0;
  for (const [id, o] of Object.entries(state.owned)) {
    const extra = Math.max(0, o.L - 1) + Math.max(0, o.R - 1);
    value += extra * RARITIES[SOCK_BY_ID[id].rarity].recycle;
  }
  return value;
}

// Recycle les doublons (on garde un exemplaire de chaque côté).
export function recycleDuplicates(state) {
  const value = duplicateValue(state);
  for (const o of Object.values(state.owned)) {
    o.L = Math.min(o.L, 1);
    o.R = Math.min(o.R, 1);
  }
  earn(state, value);
  return value;
}

export function collectionScore(state) {
  let score = 0;
  for (const [id, o] of Object.entries(state.owned)) {
    const points = RARITIES[SOCK_BY_ID[id].rarity].points;
    if (o.L > 0) score += points;
    if (o.R > 0) score += points;
    if (o.L > 0 && o.R > 0) score += points * 2; // gros bonus de paire
  }
  for (const id of state.completedSeries) score += SERIES_BY_ID[id].months ? 300 : 200;
  return score;
}

export function completion(state) {
  const total = SOCKS.length * 2;
  const owned = SOCKS.reduce((n, sock) => n + SIDES.filter((side) => state.owned[sock.id]?.[side] > 0).length, 0);
  return owned / total;
}

// La pièce la plus rare : rareté max, puis paire complète, puis série limitée.
export function rarestSock(state) {
  let best = null;
  let bestKey = -1;
  for (const [id, o] of Object.entries(state.owned)) {
    if (!(o.L > 0 || o.R > 0)) continue;
    const sock = SOCK_BY_ID[id];
    const key = RARITY_ORDER.indexOf(sock.rarity) * 4
      + (isPair(state, id) ? 2 : 0)
      + (SERIES_BY_ID[sock.series].months ? 1 : 0);
    if (key > bestKey) {
      bestKey = key;
      best = { sock, pair: isPair(state, id), side: o.L > 0 ? 'L' : 'R' };
    }
  }
  return best;
}

// --- Profil partageable ---------------------------------------------------------

export function profileSummary(state) {
  const rarest = rarestSock(state);
  return {
    n: state.name || 'Collectionneur anonyme',
    s: collectionScore(state),
    c: Math.round(completion(state) * 1000) / 10,
    p: countPairs(state),
    k: state.completedSeries.length,
    d: state.draws,
    r: rarest ? rarest.sock.id : null,
    rp: rarest ? rarest.pair : false,
  };
}

export function encodeProfile(summary) {
  const bytes = new TextEncoder().encode(JSON.stringify(summary));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeProfile(code) {
  try {
    const bin = atob(code.replace(/-/g, '+').replace(/_/g, '/'));
    const json = new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
    const data = JSON.parse(json);
    if (typeof data !== 'object' || data === null) return null;
    return {
      n: String(data.n || '').slice(0, 24) || 'Collectionneur anonyme',
      s: Number(data.s) || 0,
      c: Math.min(100, Math.max(0, Number(data.c) || 0)),
      p: Number(data.p) || 0,
      k: Number(data.k) || 0,
      d: Number(data.d) || 0,
      r: SOCK_BY_ID[data.r] ? data.r : null,
      rp: !!data.rp,
    };
  } catch {
    return null;
  }
}

export function formatNumber(n) {
  if (n < 1000) return n < 10 && n % 1 ? n.toFixed(1) : Math.floor(n).toString();
  const units = ['k', 'M', 'G', 'T', 'P'];
  let i = -1;
  while (n >= 1000 && i < units.length - 1) { n /= 1000; i++; }
  return `${n.toFixed(n < 10 ? 2 : n < 100 ? 1 : 0)} ${units[i]}`;
}
