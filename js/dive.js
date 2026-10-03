// Mini-jeu de plongée : logique pure (sans DOM). Les unités sont des mètres et des secondes.
// On descend tout seul, on dirige à gauche et à droite, l'oxygène baisse.
// Plus on va profond, plus les chaussettes sont rares. Remonter garde le butin,
// tomber à court d'oxygène en fait perdre la moitié.
import { addFils, drawCost, pickSock, receiveSock } from './engine.js';

export const WORLD_W = 40;
export const DIVER_R = 1.5;
export const MAX_TANKS = 3;
export const RECHARGE_MS = 15 * 60 * 1000;

const AHEAD = 70;            // distance d'apparition des objets sous le plongeur
const CHUNK = 2;             // les objets apparaissent par tranches de 2 m
const SAFE_DEPTH = 30;       // pas de danger dans les premiers mètres
const BUBBLE_OXYGEN = 3.5;
const HIT_OXYGEN = 0.2;      // un choc retire 20 % de l'oxygène max
const COMBO_TIME = 2.5;

export const ZONES = [
  { depth: 0,   name: 'Lagon du lavoir',               luck: 0,  minRarity: 0, hint: 'Probabilités normales' },
  { depth: 100, name: 'Récif des chaussettes perdues', luck: 3,  minRarity: 0, hint: 'Raretés plus fréquentes' },
  { depth: 250, name: 'Abysses du siphon',             luck: 6,  minRarity: 1, hint: 'Peu commune au minimum' },
  { depth: 450, name: 'Fosse du tambour',              luck: 10, minRarity: 2, hint: 'Rare au minimum' },
  { depth: 700, name: 'Cœur de la machine',            luck: 16, minRarity: 2, hint: 'Les légendaires y dorment' },
];

export function zoneAt(depth) {
  let zone = ZONES[0];
  for (const z of ZONES) if (depth >= z.depth) zone = z;
  return zone;
}

export const maxOxygen = (state) => 30 * (1 + 0.25 * (state.upgrades.tank || 0));
export const swimSpeed = (state) => 16 + 2 * (state.upgrades.magnet || 0);
export const magnetRadius = (state) => 0.35 * (state.upgrades.magnet || 0);
export const pearlValue = (state, depth) => Math.max(2, drawCost(state) * 0.12) * (1 + depth / 250);
export const descentSpeed = (depth) => 5 + Math.min(depth / 40, 15);
export const comboMultiplier = (combo) => 1 + 0.2 * Math.max(0, Math.min(combo, 10) - 1);

// --- Bouteilles d'oxygène (une plongée = une bouteille, elles se rechargent) ---

export function refreshTanks(state, now = Date.now()) {
  const dive = state.dive;
  if (dive.tanks >= MAX_TANKS) {
    dive.lastRecharge = now;
    return;
  }
  const gained = Math.floor(Math.max(0, now - dive.lastRecharge) / RECHARGE_MS);
  if (gained <= 0) return;
  dive.tanks = Math.min(MAX_TANKS, dive.tanks + gained);
  dive.lastRecharge = dive.tanks >= MAX_TANKS ? now : dive.lastRecharge + gained * RECHARGE_MS;
}

export function nextTankIn(state, now = Date.now()) {
  if (state.dive.tanks >= MAX_TANKS) return 0;
  return Math.max(0, RECHARGE_MS - (now - state.dive.lastRecharge));
}

export const tankCost = (state) => drawCost(state) * 4;

export function buyTank(state) {
  const cost = tankCost(state);
  if (state.fils < cost) return false;
  state.fils -= cost;
  state.dive.tanks += 1;
  return true;
}

// --- Déroulement d'une plongée ---

export function startDive(state, rng = Math.random, date = new Date(), now = Date.now()) {
  refreshTanks(state, now);
  if (state.dive.tanks <= 0) return null;
  state.dive.tanks -= 1;
  const oxygen = maxOxygen(state);
  return {
    t: 0, depth: 0, x: WORLD_W / 2, vx: 0,
    oxygen, maxOxygen: oxygen,
    objects: [], spawnCursor: SAFE_DEPTH / 2, nextId: 1,
    loot: { socks: [], fils: 0, pearls: 0, chests: 0 },
    combo: 0, comboTimer: 0, invuln: 0, hits: 0,
    zone: ZONES[0], record: state.dive.record, passedRecord: state.dive.record === 0,
    lowOxygenWarned: false,
    events: [], over: false, reason: null,
    rng, date,
  };
}

function add(dive, obj) {
  obj.id = dive.nextId++;
  obj.phase = dive.rng() * Math.PI * 2;
  obj.baseX = obj.x;
  dive.objects.push(obj);
}

function spawnChunk(state, dive, y) {
  const r = dive.rng;
  const zone = zoneAt(y);
  const rx = () => 2 + r() * (WORLD_W - 4);
  const ry = () => y + r() * CHUNK;

  if (r() < 0.035) add(dive, { kind: 'bubble', x: rx(), y: ry(), r: 1.2 });
  if (r() < 0.10) add(dive, { kind: 'pearl', x: rx(), y: ry(), r: 0.8 });
  if (r() < 0.035 + Math.min(y / 10000, 0.03)) {
    const item = pickSock(state, r, dive.date, { minRarity: zone.minRarity, extraLuck: zone.luck });
    add(dive, { kind: 'sock', x: rx(), y: ry(), r: 1.7, item });
  }
  if (y > 100 && r() < 0.006) {
    const item = pickSock(state, r, dive.date, { minRarity: 3, extraLuck: zone.luck });
    add(dive, { kind: 'chest', x: rx(), y: ry(), r: 1.9, item });
  }
  if (y > SAFE_DEPTH && r() < Math.min(0.04 + y / 5000, 0.18)) {
    const kinds = ['urchin'];
    if (y >= 40) kinds.push('jelly', 'jelly');
    if (y >= 250) kinds.push('eel');
    const kind = kinds[Math.floor(r() * kinds.length)];
    const radius = { urchin: 1.4, jelly: 1.6, eel: 1.8 }[kind];
    add(dive, { kind, x: rx(), y: ry(), r: radius, hazard: true, speed: 0.6 + r() * 0.6 });
  }
}

function end(dive, reason) {
  dive.over = true;
  dive.reason = reason;
}

export function surface(dive) {
  if (!dive.over) end(dive, 'surface');
}

function collect(state, dive, obj) {
  dive.combo += 1;
  dive.comboTimer = COMBO_TIME;
  const mult = comboMultiplier(dive.combo);
  const event = { type: 'pickup', kind: obj.kind, x: obj.x, y: obj.y, combo: dive.combo };
  switch (obj.kind) {
    case 'bubble':
      dive.oxygen = Math.min(dive.maxOxygen, dive.oxygen + BUBBLE_OXYGEN);
      break;
    case 'pearl': {
      const value = pearlValue(state, obj.y) * mult;
      dive.loot.fils += value;
      dive.loot.pearls += 1;
      event.value = value;
      break;
    }
    case 'sock':
      dive.loot.socks.push(obj.item);
      event.item = obj.item;
      break;
    case 'chest': {
      const value = pearlValue(state, obj.y) * 15 * mult;
      dive.loot.socks.push(obj.item);
      dive.loot.fils += value;
      dive.loot.chests += 1;
      event.item = obj.item;
      event.value = value;
      break;
    }
  }
  dive.events.push(event);
}

// input : { dir: -1 | 0 | 1, targetX: nombre ou null }
export function stepDive(state, dive, dt, input = {}) {
  if (dive.over) return;
  dt = Math.min(Math.max(dt, 0), 0.05);
  dive.t += dt;
  dive.depth += descentSpeed(dive.depth) * dt;

  const max = swimSpeed(state);
  if (input.dir) dive.vx = input.dir * max;
  else if (input.targetX !== null && input.targetX !== undefined) {
    dive.vx = Math.max(-max, Math.min(max, (input.targetX - dive.x) * 6));
  } else dive.vx *= Math.pow(0.02, dt);
  dive.x = Math.max(DIVER_R, Math.min(WORLD_W - DIVER_R, dive.x + dive.vx * dt));

  dive.oxygen -= dt * (1 + dive.depth / 1500);
  dive.invuln = Math.max(0, dive.invuln - dt);
  dive.comboTimer -= dt;
  if (dive.comboTimer <= 0) dive.combo = 0;

  const zone = zoneAt(dive.depth);
  if (zone !== dive.zone) {
    dive.zone = zone;
    dive.events.push({ type: 'zone', zone });
  }
  if (!dive.passedRecord && dive.depth > dive.record) {
    dive.passedRecord = true;
    dive.events.push({ type: 'record' });
  }
  if (!dive.lowOxygenWarned && dive.oxygen < dive.maxOxygen * 0.25) {
    dive.lowOxygenWarned = true;
    dive.events.push({ type: 'lowOxygen' });
  }

  while (dive.spawnCursor < dive.depth + AHEAD) {
    spawnChunk(state, dive, dive.spawnCursor);
    dive.spawnCursor += CHUNK;
  }

  const reach = DIVER_R + magnetRadius(state);
  for (const obj of dive.objects) {
    if (obj.kind === 'jelly') {
      obj.x = obj.baseX + Math.sin(dive.t * 1.3 * obj.speed + obj.phase) * 3;
      obj.y += Math.sin(dive.t * 2 + obj.phase) * 0.6 * dt;
    } else if (obj.kind === 'eel') {
      // Les anguilles balaient toute la largeur.
      const half = WORLD_W / 2 + 2;
      obj.x = WORLD_W / 2 + Math.sin(dive.t * obj.speed * 1.4 + obj.phase) * half;
    } else if (obj.kind === 'sock' || obj.kind === 'pearl') {
      obj.x = obj.baseX + Math.sin(dive.t * 0.8 + obj.phase) * 0.8;
    }

    const dist = Math.hypot(obj.x - dive.x, obj.y - dive.depth);
    if (obj.hazard) {
      if (dive.invuln <= 0 && dist < obj.r + DIVER_R * 0.8) {
        dive.oxygen -= dive.maxOxygen * HIT_OXYGEN;
        dive.invuln = 1.2;
        dive.combo = 0;
        dive.hits += 1;
        dive.events.push({ type: 'hit', kind: obj.kind, x: obj.x, y: obj.y });
      }
    } else if (dist < obj.r + reach) {
      obj.dead = true;
      collect(state, dive, obj);
    }
  }
  dive.objects = dive.objects.filter((obj) => !obj.dead && obj.y > dive.depth - 30);

  if (dive.oxygen <= 0) {
    dive.oxygen = 0;
    end(dive, 'oxygen');
  }
}

// Applique le résultat de la plongée à la partie.
export function finishDive(state, dive) {
  let socks = [...dive.loot.socks];
  let fils = dive.loot.fils;
  let lost = [];
  if (dive.reason === 'oxygen') {
    // Panne d'oxygène : on perd la moitié des chaussettes (au hasard) et la moitié des fils.
    for (let i = socks.length - 1; i > 0; i--) {
      const j = Math.floor(dive.rng() * (i + 1));
      [socks[i], socks[j]] = [socks[j], socks[i]];
    }
    const keep = Math.floor(socks.length / 2);
    lost = socks.slice(keep);
    socks = socks.slice(0, keep);
    fils /= 2;
  }
  const depthBonus = dive.reason === 'surface' ? Math.round(dive.depth * drawCost(state) / 40) : 0;
  const results = socks.map(({ sock, side }) => receiveSock(state, sock.id, side));
  const total = fils + depthBonus;
  addFils(state, total);

  const newRecord = dive.depth > state.dive.record;
  state.dive.record = Math.max(state.dive.record, dive.depth);
  state.dive.dives += 1;
  return { reason: dive.reason, depth: dive.depth, zone: dive.zone, results, lost, fils: total, depthBonus, newRecord, hits: dive.hits };
}
