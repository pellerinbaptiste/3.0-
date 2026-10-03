import { RARITIES, RARITY_ORDER, SERIES, SERIES_BY_ID, SOCK_BY_ID, UPGRADES, monthName } from './data.js';
import * as G from './engine.js';
import { sockSVG, emptySockSVG } from './sock-svg.js';
import { initDive } from './dive-ui.js';

const SAVE_KEY = 'tiroir-a-chaussettes-v1';
const $ = (sel) => document.querySelector(sel);
const fmt = G.formatNumber;
const esc = (str) => String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// --- Sauvegarde ----------------------------------------------------------------

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return G.loadState(raw ? JSON.parse(raw) : null);
  } catch {
    return G.createState();
  }
}

function save() {
  state.lastSeen = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch { /* stockage indisponible */ }
}

let state = load();

// --- Utilitaires d'affichage -----------------------------------------------------

function toast(message, ms = 2600) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  $('#toasts').append(el);
  setTimeout(() => el.remove(), ms);
}

function showModal(html) {
  $('#modal-body').innerHTML = html;
  $('#modal').showModal();
}

const rc = (rarity) => `--rc: var(--c-${rarity})`;

// --- Barre du haut ---------------------------------------------------------------

function renderStats() {
  $('#stat-fils').textContent = fmt(state.fils);
  $('#stat-rate').textContent = fmt(G.autoRate(state));
  $('#stat-mult').textContent = `×${G.multiplier(state).toFixed(2)}`;
  $('#stat-score').textContent = fmt(G.collectionScore(state));
  $('#click-value').textContent = `(+${fmt(G.clickValue(state))} par clic)`;
  $('#cost-one').textContent = `${fmt(G.drawCost(state))} fils`;
  $('#cost-pack').textContent = `${fmt(G.packCost(state))} fils`;
  $('#draw-one').disabled = state.fils < G.drawCost(state);
  $('#draw-pack').disabled = state.fils < G.packCost(state);
  for (const btn of document.querySelectorAll('[data-upgrade]')) {
    btn.disabled = !G.canBuyUpgrade(state, btn.dataset.upgrade);
  }
}

function renderSeasonBanner() {
  const active = SERIES.filter((serie) => serie.months && G.isSeriesActive(serie));
  const banner = $('#season-banner');
  banner.hidden = active.length === 0;
  banner.textContent = active.map((serie) => `🎉 Collection limitée en cours : ${serie.name} !`).join(' ');
}

// --- Lavoir (clicker) --------------------------------------------------------------

function renderUpgrades() {
  $('#upgrades').innerHTML = UPGRADES.map((u) => {
    const level = state.upgrades[u.id];
    const maxed = u.max !== undefined && level >= u.max;
    return `<button class="btn upgrade" data-upgrade="${u.id}">
      <span class="u-emoji">${u.emoji}</span>
      <span class="u-text"><span class="u-name">${u.name} <span class="u-level">niv. ${level}${u.max ? `/${u.max}` : ''}</span></span>
      <span class="u-desc">${u.desc}</span></span>
      <span class="u-cost">${maxed ? 'MAX' : `${fmt(G.upgradeCost(state, u.id))} 🧵`}</span>
    </button>`;
  }).join('');
  renderStats();
}

$('#upgrades').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-upgrade]');
  if (btn && G.buyUpgrade(state, btn.dataset.upgrade)) {
    renderUpgrades();
    save();
  }
});

$('#basket').addEventListener('click', (e) => {
  const value = G.click(state);
  const zone = $('.clicker-zone');
  const rect = zone.getBoundingClientRect();
  const float = document.createElement('span');
  float.className = 'float';
  float.textContent = `+${fmt(value)}`;
  const x = e.clientX ? e.clientX - rect.left : rect.width / 2;
  const y = e.clientY ? e.clientY - rect.top : rect.height / 3;
  float.style.left = `${x - 10}px`;
  float.style.top = `${y - 20}px`;
  zone.append(float);
  setTimeout(() => float.remove(), 900);
  renderStats();
});

// --- Tirage ----------------------------------------------------------------------

function renderOdds() {
  const weights = G.rarityWeights(state);
  const total = weights.reduce((a, b) => a + b, 0);
  $('#odds-list').innerHTML = RARITY_ORDER.map((r, i) =>
    `<li><span style="color: var(--c-${r}); font-weight: 700">${RARITIES[r].label}</span> : ${(weights[i] / total * 100).toFixed(2)} %</li>`,
  ).join('') + '<li>Surprise : 4 % de recevoir la paire complète, 3 % de trouver une pièce oubliée</li>';
}

function cardHTML(result, small) {
  const { sock, side } = result;
  const badges = [];
  if (result.isNew) badges.push('<span class="badge">Nouveau</span>');
  if (result.pairCompleted) badges.push('<span class="badge pair">Paire !</span>');
  if (result.surprise === 'twin') badges.push('<span class="badge surprise">+ sa jumelle</span>');
  if (result.surprise === 'coin') badges.push(`<span class="badge surprise">+${fmt(result.bonusFils)} 🪙</span>`);
  const pic = result.surprise === 'twin'
    ? sockSVG(sock, 'L', { size: small ? 38 : 52 }) + sockSVG(sock, 'R', { size: small ? 38 : 52 })
    : sockSVG(sock, side, { size: small ? 56 : 80 });
  return `<div class="card ${sock.rarity} ${small ? 'small' : ''}" style="${rc(sock.rarity)}">
    <div class="badges">${badges.join('')}</div>
    <div>${pic}</div>
    <div class="c-name">${sock.name}</div>
    <div class="c-rarity">${RARITIES[sock.rarity].label}</div>
    <div class="c-side">${result.surprise === 'twin' ? 'gauche + droite' : G.SIDE_LABEL[side]} · ${SERIES_BY_ID[sock.series].name}</div>
  </div>`;
}

function showResults(results) {
  if (!results) return;
  const small = results.length > 1;
  // Dans un pack, les cartes sont révélées de la plus commune à la plus rare, pour le suspense.
  const sorted = small
    ? [...results].sort((a, b) => RARITY_ORDER.indexOf(a.sock.rarity) - RARITY_ORDER.indexOf(b.sock.rarity))
    : results;
  const screen = $('#reveal');
  screen.innerHTML = '';
  sorted.forEach((result, i) => {
    setTimeout(() => screen.insertAdjacentHTML('beforeend', cardHTML(result, small)), small ? i * 140 : 0);
  });

  const best = sorted[sorted.length - 1];
  if (RARITY_ORDER.indexOf(best.sock.rarity) >= 3) {
    setTimeout(() => toast(`${best.sock.rarity === 'legendaire' ? '🌟 LÉGENDAIRE' : '💜 Épique'} : ${best.sock.name} !`), small ? sorted.length * 140 : 300);
  }
  celebrate(results);
  renderStats();
  renderOdds();
  save();
}

// Paires légendaires et séries complètes, que la chaussette vienne d'un tirage ou d'une plongée.
function celebrate(results) {
  for (const result of results) {
    if (result.pairCompleted && RARITY_ORDER.indexOf(result.sock.rarity) === 4) {
      toast(`👑 Paire légendaire complète : ${result.sock.name} ! Une rareté absolue.`, 5000);
    }
    for (const id of result.seriesCompleted) {
      const serie = SERIES_BY_ID[id];
      showModal(`<h2>🏆 Série complète !</h2><p>Tu as complété <strong>${serie.name}</strong>.</p>
        <p>+${fmt(serie.reward)} fils et +25 % de production pour toujours.</p>`);
    }
  }
}

$('#draw-one').addEventListener('click', () => showResults(G.draw(state)));
$('#draw-pack').addEventListener('click', () => showResults(G.drawPack(state)));

// --- Tiroir (collection) -------------------------------------------------------------

function renderDrawer() {
  const pct = (G.completion(state) * 100).toFixed(1);
  const dupes = G.duplicateValue(state);
  $('#drawer-summary').textContent = `${pct} % complété · ${G.countPairs(state)} paires · ${state.completedSeries.length}/${SERIES.length} séries`;
  $('#recycle').disabled = dupes === 0;
  $('#recycle').textContent = dupes ? `♻️ Recycler les doublons (+${fmt(dupes)} fils)` : '♻️ Aucun doublon';

  $('#drawer').innerHTML = SERIES.map((serie) => {
    const { owned, total } = G.seriesProgress(state, serie);
    const done = state.completedSeries.includes(serie.id);
    const active = G.isSeriesActive(serie);
    let tag = '';
    if (done) tag = '<span class="tag done">✔ Complète</span>';
    else if (serie.months && active) tag = '<span class="tag on">⏳ Disponible maintenant</span>';
    else if (serie.months) tag = `<span class="tag">🔒 Revient en ${serie.months.map(monthName).join(' / ')}</span>`;

    const slots = serie.socks.map((sock) => {
      const o = state.owned[sock.id] || { L: 0, R: 0 };
      const has = o.L > 0 || o.R > 0;
      const pair = o.L > 0 && o.R > 0;
      const side = (s) => {
        if (!(o[s] > 0)) return `<span class="sock-wrap">${emptySockSVG(s, { size: 46 })}</span>`;
        const count = o[s] > 1 ? `<span class="count">×${o[s]}</span>` : '';
        return `<span class="sock-wrap">${sockSVG(sock, s, { size: 46 })}${count}</span>`;
      };
      return `<div class="slot ${has ? 'has' : ''} ${pair ? 'pair' : ''}" style="${rc(sock.rarity)}">
        <div class="pair-row">${side('L')}${side('R')}</div>
        <div class="s-name">${has ? sock.name : '???'}</div>
        <div class="s-rarity">${RARITIES[sock.rarity].label}</div>
      </div>`;
    }).join('');

    return `<article class="series ${done ? 'complete' : ''} ${serie.months && !active ? 'locked' : ''}">
      <div class="series-head"><h3>${serie.name}</h3>${tag}</div>
      <p class="series-desc">${serie.desc} Récompense : ${fmt(serie.reward)} fils. ${owned}/${total} chaussettes.</p>
      <div class="progress"><div style="width:${owned / total * 100}%"></div></div>
      <div class="slots">${slots}</div>
    </article>`;
  }).join('');
}

$('#recycle').addEventListener('click', () => {
  const value = G.recycleDuplicates(state);
  if (value) toast(`♻️ Doublons recyclés : +${fmt(value)} fils`);
  renderDrawer();
  renderStats();
  save();
});

// --- Profil -----------------------------------------------------------------------

function profileHTML(p) {
  const rarest = p.r ? SOCK_BY_ID[p.r] : null;
  const rarestBlock = rarest
    ? `<div class="p-rarest">${p.rp ? sockSVG(rarest, 'L', { size: 44 }) : ''}${sockSVG(rarest, 'R', { size: p.rp ? 44 : 64 })}
        <strong>${rarest.name}</strong><small>${RARITIES[rarest.rarity].label}${p.rp ? ' · paire' : ''}</small></div>`
    : '<div class="p-rarest">🧦<small>Aucune chaussette</small></div>';
  return `<div class="profile">
    ${rarestBlock}
    <div>
      <p class="p-name">${esc(p.n)}</p>
      <div class="p-grid">
        <div>Score<strong>${fmt(p.s)}</strong></div>
        <div>Complétion<strong>${p.c} %</strong></div>
        <div>Paires<strong>${p.p}</strong></div>
        <div>Séries<strong>${p.k}</strong></div>
        <div>Record plongée<strong>${p.m} m</strong></div>
        <div>Tirages<strong>${p.d}</strong></div>
      </div>
    </div>
  </div>`;
}

function renderProfile() {
  $('#name-input').value = state.name;
  $('#profile-card').innerHTML = profileHTML(G.profileSummary(state));
}

$('#name-input').addEventListener('input', (e) => {
  state.name = e.target.value.slice(0, 24);
  $('#profile-card').innerHTML = profileHTML(G.profileSummary(state));
  save();
});

$('#share').addEventListener('click', async () => {
  const summary = G.profileSummary(state);
  const url = `${location.origin}${location.pathname}#profil=${G.encodeProfile(summary)}`;
  const rarest = summary.r ? SOCK_BY_ID[summary.r].name : 'aucune';
  const text = `🧦 Mon tiroir à chaussettes : ${fmt(summary.s)} points, ${summary.c} % complété, pièce la plus rare : ${rarest}, plongée record à ${summary.m} m. Tu fais mieux ?`;
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Mon tiroir à chaussettes', text, url });
    } else {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      toast('📋 Lien de profil copié !');
    }
  } catch {
    showModal(`<p>Copie ce lien pour partager ton profil :</p><input style="width:100%" readonly value="${esc(url)}">`);
  }
});

$('#reset').addEventListener('click', () => {
  if (!confirm('Effacer définitivement ta partie ?')) return;
  state = G.createState();
  save();
  renderAll();
});

function openSharedProfile() {
  const match = location.hash.match(/^#profil=([\w-]+)$/);
  if (!match) return;
  const profile = G.decodeProfile(match[1]);
  if (!profile) return;
  showModal(`<h2>Le tiroir de ${esc(profile.n)}</h2>${profileHTML(profile)}
    <p>Compare avec ton propre score dans l'onglet Profil !</p>`);
  history.replaceState(null, '', location.pathname);
}

// --- Onglets et boucle -------------------------------------------------------------

const diveUI = initDive({
  getState: () => state,
  save,
  renderStats,
  toast,
  celebrate,
  cardHTML,
});

const TAB_RENDER = {
  lavoir: renderUpgrades, tirage: renderOdds, plongee: () => diveUI.show(), tiroir: renderDrawer, profil: renderProfile,
};

function selectTab(name) {
  if (name !== 'plongee') diveUI.leave();
  for (const btn of document.querySelectorAll('[data-tab]')) {
    btn.setAttribute('aria-selected', String(btn.dataset.tab === name));
  }
  for (const panel of document.querySelectorAll('.panel')) {
    panel.hidden = panel.id !== `tab-${name}`;
  }
  TAB_RENDER[name]();
}

document.querySelector('.tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-tab]');
  if (btn) selectTab(btn.dataset.tab);
});

function renderAll() {
  renderSeasonBanner();
  renderUpgrades();
  renderOdds();
  renderDrawer();
  renderProfile();
  diveUI.show();
}

let last = performance.now();
setInterval(() => {
  const now = performance.now();
  G.tick(state, (now - last) / 1000);
  last = now;
  renderStats();
  if (!diveUI.active()) diveUI.tick();
}, 100);
setInterval(save, 5000);
window.addEventListener('beforeunload', save);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });

const offline = G.applyOfflineGains(state);
renderAll();
if (offline.gained >= 1) {
  toast(`🧺 Pendant ton absence, les machines ont produit ${fmt(offline.gained)} fils.`, 4000);
}
openSharedProfile();
