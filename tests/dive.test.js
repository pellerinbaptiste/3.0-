import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RARITY_ORDER } from '../js/data.js';
import * as G from '../js/engine.js';
import * as D from '../js/dive.js';

function seeded(seed = 42) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}
const MARCH = new Date(2026, 2, 15);

// Pilote automatique : file vers l'objet utile le plus proche sous le plongeur.
function autopilot(dive) {
  const target = dive.objects
    .filter((o) => !o.hazard && o.y > dive.depth)
    .sort((a, b) => a.y - b.y)[0];
  return { targetX: target ? target.x : null };
}

function run(state, dive, { surfaceAt = Infinity, pilot = () => ({}) } = {}) {
  while (!dive.over) {
    D.stepDive(state, dive, 1 / 30, pilot(dive));
    if (dive.depth >= surfaceAt) D.surface(dive);
  }
  return D.finishDive(state, dive);
}

test('une plongée consomme une bouteille, qui se recharge avec le temps', () => {
  const state = G.createState(0);
  for (let i = 0; i < 3; i++) assert.ok(D.startDive(state, seeded(), MARCH, 0));
  assert.equal(D.startDive(state, seeded(), MARCH, 0), null);
  assert.equal(D.nextTankIn(state, 0), D.RECHARGE_MS);
  D.refreshTanks(state, D.RECHARGE_MS * 2 + 5);
  assert.equal(state.dive.tanks, 2);
  D.refreshTanks(state, D.RECHARGE_MS * 10);
  assert.equal(state.dive.tanks, 3);
});

test('acheter une bouteille coûte des fils', () => {
  const state = G.createState(0);
  state.dive.tanks = 0;
  assert.equal(D.buyTank(state), false);
  state.fils = D.tankCost(state);
  assert.ok(D.buyTank(state));
  assert.equal(state.dive.tanks, 1);
  assert.equal(state.fils, 0);
});

test('sans rien faire, on finit à court d\'oxygène', () => {
  const state = G.createState(0);
  const dive = D.startDive(state, seeded(3), MARCH, 0);
  const result = run(state, dive);
  assert.equal(result.reason, 'oxygen');
  assert.ok(result.depth > 100, `profondeur ${result.depth}`);
  assert.equal(state.dive.dives, 1);
  assert.ok(result.newRecord);
});

test('remonter garde tout le butin, plus un bonus de profondeur', () => {
  const state = G.createState(0);
  const dive = D.startDive(state, seeded(5), MARCH, 0);
  const result = run(state, dive, { surfaceAt: 120, pilot: autopilot });
  assert.equal(result.reason, 'surface');
  assert.equal(result.lost.length, 0);
  assert.ok(result.depthBonus > 0);
  assert.equal(result.results.length, dive.loot.socks.length);
  assert.ok(result.results.length > 0, 'le pilote auto devrait attraper des chaussettes');
  assert.ok(state.fils >= result.fils - 1e-9);
});

test('la panne d\'oxygène fait perdre la moitié des chaussettes', () => {
  const state = G.createState(0);
  const dive = D.startDive(state, seeded(9), MARCH, 0);
  while (!dive.over) D.stepDive(state, dive, 1 / 30, autopilot(dive));
  const caught = dive.loot.socks.length;
  const fils = dive.loot.fils;
  const result = D.finishDive(state, dive);
  assert.equal(result.results.length, Math.floor(caught / 2));
  assert.equal(result.lost.length, caught - Math.floor(caught / 2));
  assert.equal(result.fils, fils / 2);
});

test('les profondeurs donnent des chaussettes plus rares', () => {
  const state = G.createState(0);
  const dive = D.startDive(state, seeded(11), MARCH, 0);
  dive.maxOxygen = dive.oxygen = 1e6; // plongée sans fin pour le test
  dive.invuln = 1e9;
  while (dive.depth < 700 && !dive.over) D.stepDive(state, dive, 1 / 30, {});
  const deep = dive.objects.filter((o) => o.kind === 'sock' && o.y > 560);
  assert.ok(deep.length > 0);
  for (const o of deep) assert.ok(RARITY_ORDER.indexOf(o.item.sock.rarity) >= 2, o.item.sock.rarity);
});

test('un choc retire de l\'oxygène puis rend invulnérable un instant', () => {
  const state = G.createState(0);
  const dive = D.startDive(state, seeded(1), MARCH, 0);
  dive.depth = 100;
  dive.spawnCursor = 1000; // pas d'autres objets
  dive.objects.push({ kind: 'urchin', hazard: true, x: dive.x, y: 100, r: 1.4, baseX: dive.x, phase: 0, speed: 1 });
  const before = dive.oxygen;
  D.stepDive(state, dive, 0.01, {});
  assert.ok(dive.oxygen < before - dive.maxOxygen * 0.19);
  const after = dive.oxygen;
  D.stepDive(state, dive, 0.01, {});
  assert.ok(dive.oxygen > after - 0.1);
  assert.equal(dive.hits, 1);
});

test('le combo multiplie la valeur des perles', () => {
  assert.equal(D.comboMultiplier(1), 1);
  assert.ok(D.comboMultiplier(5) > 1.7);
  assert.equal(D.comboMultiplier(50), D.comboMultiplier(10));
});
