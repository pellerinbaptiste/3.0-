import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SERIES, SERIES_BY_ID, SOCKS, RARITY_ORDER } from '../js/data.js';
import * as G from '../js/engine.js';

// Générateur pseudo-aléatoire déterministe pour des tests reproductibles.
function seeded(seed = 42) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

const OCTOBER = new Date(2026, 9, 15);
const MARCH = new Date(2026, 2, 15);

test('les identifiants de chaussettes sont uniques', () => {
  assert.equal(new Set(SOCKS.map((s) => s.id)).size, SOCKS.length);
});

test('chaque série permanente a au moins une chaussette par rareté jusqu\'à épique', () => {
  const permanent = SOCKS.filter((s) => !SERIES_BY_ID[s.series].months);
  for (const r of RARITY_ORDER) assert.ok(permanent.some((s) => s.rarity === r), r);
});

test('cliquer rapporte des fils et les améliorations augmentent le gain', () => {
  const state = G.createState();
  assert.equal(G.click(state), 1);
  state.fils = 1000;
  assert.ok(G.buyUpgrade(state, 'click'));
  assert.equal(G.click(state), 2);
  assert.ok(G.buyUpgrade(state, 'machine'));
  assert.equal(G.tick(state, 10), 10);
});

test('on ne peut pas acheter sans assez de fils, ni dépasser le maximum', () => {
  const state = G.createState();
  assert.equal(G.buyUpgrade(state, 'click'), false);
  state.fils = 1e12;
  for (let i = 0; i < 20; i++) G.buyUpgrade(state, 'luck');
  assert.equal(state.upgrades.luck, 10);
});

test('un tirage coûte des fils et ajoute une chaussette', () => {
  const state = G.createState();
  assert.equal(G.draw(state, seeded()), null);
  state.fils = 100;
  const [result] = G.draw(state, seeded(), MARCH);
  assert.equal(state.draws, 1);
  assert.ok(state.owned[result.sock.id][result.side] >= 1);
  assert.equal(result.isNew, true);
});

test('les séries saisonnières ne sont tirables que pendant leur saison', () => {
  const state = G.createState();
  state.fils = 1e9;
  const rng = seeded(7);
  for (let i = 0; i < 300; i++) {
    for (const r of G.draw(state, rng, MARCH)) {
      assert.equal(SERIES_BY_ID[r.sock.series].months, undefined);
    }
  }
  assert.ok(G.availableSocks(OCTOBER).some((s) => s.series === 'halloween'));
  assert.ok(!G.availableSocks(MARCH).some((s) => s.series === 'halloween'));
});

test('un pack de 10 garantit au moins une Rare', () => {
  for (let seed = 1; seed < 50; seed++) {
    const state = G.createState();
    state.fils = 1e9;
    const results = G.drawPack(state, seeded(seed), MARCH);
    assert.equal(results.length, 10);
    assert.ok(results.some((r) => RARITY_ORDER.indexOf(r.sock.rarity) >= 2));
  }
});

test('la chance augmente la probabilité des raretés', () => {
  const state = G.createState();
  const share = () => { const w = G.rarityWeights(state); return w[4] / w.reduce((a, b) => a + b); };
  const before = share();
  state.upgrades.luck = 10;
  assert.ok(share() > before * 2.5);
});

test('former une paire donne un bonus de score et de multiplicateur', () => {
  const state = G.createState();
  state.owned.phenix = { L: 1, R: 0 };
  const single = G.collectionScore(state);
  state.owned.phenix.R = 1;
  assert.equal(G.collectionScore(state), single * 4); // 100 + 100 + 200
  assert.ok(G.multiplier(state) > 1);
  assert.equal(G.rarestSock(state).sock.id, 'phenix');
  assert.equal(G.rarestSock(state).pair, true);
});

test('compléter une série la récompense une seule fois', () => {
  const state = G.createState();
  const serie = SERIES_BY_ID.classiques;
  for (const sock of serie.socks) state.owned[sock.id] = { L: 1, R: 1 };
  state.owned[serie.socks[0].id].R = 0;
  state.fils = 1e6;
  // On force le tirage de la chaussette manquante côté droit.
  const pool = G.availableSocks(MARCH).filter((s) => s.rarity === 'commune');
  const idx = pool.findIndex((s) => s.id === serie.socks[0].id);
  const values = [0, (idx + 0.5) / pool.length, 0.9, 0.5];
  const rng = () => values.shift() ?? 0.5;
  const [result] = G.draw(state, rng, MARCH);
  assert.equal(result.sock.id, serie.socks[0].id);
  assert.deepEqual(result.seriesCompleted, ['classiques']);
  assert.deepEqual(state.completedSeries, ['classiques']);
  assert.equal(G.draw(state, seeded(), MARCH)[0].seriesCompleted.length, 0);
});

test('recycler les doublons garde un exemplaire de chaque côté', () => {
  const state = G.createState();
  state.owned.chat = { L: 3, R: 1 };
  state.owned.licorne = { L: 0, R: 2 };
  assert.equal(G.duplicateValue(state), 2 * 5 + 150);
  assert.equal(G.recycleDuplicates(state), 160);
  assert.deepEqual(state.owned.chat, { L: 1, R: 1 });
  assert.deepEqual(state.owned.licorne, { L: 0, R: 1 });
  assert.equal(state.fils, 160);
});

test('la complétion compte chaque côté', () => {
  const state = G.createState();
  assert.equal(G.completion(state), 0);
  for (const sock of SOCKS) state.owned[sock.id] = { L: 1, R: 1 };
  assert.equal(G.completion(state), 1);
});

test('le profil se partage et se relit, même avec des accents', () => {
  const state = G.createState();
  state.name = 'Zoé <b>chaussette</b>';
  state.owned.vampire = { L: 1, R: 1 };
  const summary = G.profileSummary(state);
  const decoded = G.decodeProfile(G.encodeProfile(summary));
  assert.deepEqual(decoded, summary);
  assert.equal(G.decodeProfile('pas-du-json'), null);
});

test('les gains hors ligne sont plafonnés', () => {
  const state = G.createState(0);
  state.upgrades.machine = 1;
  const { gained } = G.applyOfflineGains(state, 100 * 3600 * 1000);
  assert.equal(gained, 8 * 3600 * 0.5);
});

test('une sauvegarde ancienne ou corrompue se recharge proprement', () => {
  const state = G.loadState({ fils: 12, owned: { chat: { L: 1, R: 0 }, inconnue: { L: 1, R: 1 } }, upgrades: { click: 2 } });
  assert.equal(state.fils, 12);
  assert.equal(state.upgrades.click, 2);
  assert.equal(state.upgrades.factory, 0);
  assert.equal(state.owned.inconnue, undefined);
  assert.equal(G.loadState('nimporte').fils, 0);
});
