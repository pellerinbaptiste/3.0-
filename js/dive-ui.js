// Interface du mini-jeu de plongée : écran d'accueil, rendu canvas, commandes et bilan.
import { RARITIES, RARITY_ORDER, SOCK_BY_ID } from './data.js';
import * as D from './dive.js';
import { formatNumber as fmt, rarestSock } from './engine.js';
import { sockSVG } from './sock-svg.js';

const $ = (sel) => document.querySelector(sel);

// Couleur de l'eau selon la profondeur.
const WATER = [[0, '#5ec8f2'], [100, '#1479b8'], [250, '#0b3d7a'], [450, '#120f45'], [700, '#05010f'], [1200, '#000000']];

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}

function waterAt(depth) {
  const d = Math.max(0, depth);
  for (let i = 1; i < WATER.length; i++) {
    if (d <= WATER[i][0]) {
      const [d0, c0] = WATER[i - 1];
      const [d1, c1] = WATER[i];
      const t = (d - d0) / (d1 - d0);
      const a = hexToRgb(c0);
      const b = hexToRgb(c1);
      return `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * t)).join(',')})`;
    }
  }
  return WATER[WATER.length - 1][1];
}

const sockImages = new Map();
function sockImage(sock, side) {
  const key = `${sock.id}-${side}`;
  if (!sockImages.has(key)) {
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sockSVG(sock, side, { size: 118 }))}`;
    sockImages.set(key, img);
  }
  return sockImages.get(key);
}

const formatTime = (ms) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export function initDive({ getState, save, renderStats, toast, celebrate, cardHTML }) {
  const lobby = $('#dive-lobby');
  const stage = $('#dive-stage');
  const resultBox = $('#dive-result');
  const canvas = $('#dive-canvas');
  const ctx = canvas.getContext('2d');

  let dive = null;
  let raf = 0;
  let lastFrame = 0;
  let scale = 10;
  let viewW = 400;
  let viewH = 640;
  let shake = 0;
  let zoneBanner = null;
  const input = { dir: 0, targetX: null };
  const keys = new Set();
  const floaters = [];
  const trail = [];

  // --- Écran d'accueil ---

  function renderLobby() {
    const state = getState();
    D.refreshTanks(state);
    const record = state.dive.record;
    const tanks = state.dive.tanks;
    const zones = D.ZONES.map((zone) => {
      const known = record >= zone.depth;
      return `<li class="${known ? '' : 'unknown'}"><strong>${zone.depth} m</strong> ${known ? zone.name : '???'}<small>${zone.hint}</small></li>`;
    }).join('');
    lobby.innerHTML = `
      <div class="dive-intro">
        <h2>🤿 Plongée au fond du lavoir</h2>
        <p>Toutes les chaussettes perdues finissent ici. Plus tu descends, plus elles sont rares…
        mais ton oxygène baisse. <strong>Remonte à temps</strong> pour garder ton butin :
        en panne d'oxygène, tu en perds la moitié.</p>
        <div class="tanks">
          <span class="tank-icons">${'🫧'.repeat(Math.min(tanks, 9))}${'<span class="tank-empty">🫧</span>'.repeat(Math.max(0, D.MAX_TANKS - tanks))}</span>
          <span id="tank-timer" class="tank-timer"></span>
        </div>
        <div class="dive-buttons">
          <button id="dive-start" class="btn primary big" ${tanks > 0 ? '' : 'disabled'}>Plonger !</button>
          <button id="dive-buy" class="btn">+1 bouteille<br><small>${fmt(D.tankCost(state))} fils</small></button>
        </div>
        <p class="dive-record">Record : <strong>${Math.floor(record)} m</strong> · ${state.dive.dives} plongées</p>
        <ul class="zones">${zones}</ul>
        <p class="hint">Commandes : glisse le doigt ou la souris, ou utilise les flèches ← →. Attrape les 🫧 pour l'oxygène,
        évite oursins, méduses et anguilles. Enchaîne les prises pour un combo.</p>
      </div>`;
    $('#dive-start').addEventListener('click', start);
    $('#dive-buy').addEventListener('click', () => {
      if (D.buyTank(getState())) {
        save();
        renderStats();
        renderLobby();
      } else toast('Pas assez de fils pour une bouteille.');
    });
    updateTimer();
  }

  function updateTimer() {
    const el = $('#tank-timer');
    if (!el) return;
    const state = getState();
    const wait = D.nextTankIn(state);
    el.textContent = state.dive.tanks >= D.MAX_TANKS ? 'Bouteilles pleines' : `Prochaine bouteille dans ${formatTime(wait)}`;
    const startBtn = $('#dive-start');
    if (startBtn) startBtn.disabled = state.dive.tanks <= 0;
    const buyBtn = $('#dive-buy');
    if (buyBtn) buyBtn.disabled = state.fils < D.tankCost(state);
  }

  function showLobby() {
    stage.hidden = true;
    resultBox.hidden = true;
    lobby.hidden = false;
    renderLobby();
  }

  // --- Plongée ---

  function resize() {
    const wrap = stage.getBoundingClientRect();
    viewW = Math.min(wrap.width || 360, 520);
    viewH = Math.min(Math.max(window.innerHeight - 190, 380), viewW * 1.7);
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = `${viewW}px`;
    canvas.style.height = `${viewH}px`;
    canvas.width = Math.round(viewW * dpr);
    canvas.height = Math.round(viewH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    scale = viewW / D.WORLD_W;
  }

  function start() {
    const state = getState();
    dive = D.startDive(state);
    if (!dive) return;
    save();
    lobby.hidden = true;
    resultBox.hidden = true;
    stage.hidden = false;
    floaters.length = 0;
    trail.length = 0;
    input.targetX = null;
    zoneBanner = { text: D.ZONES[0].name, t: 2.5 };
    resize();
    lastFrame = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
  }

  function frame(now) {
    if (!dive) return;
    const dt = Math.min((now - lastFrame) / 1000, 0.05);
    lastFrame = now;
    const state = getState();
    input.dir = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0);
    D.stepDive(state, dive, dt, input);
    handleEvents();
    updateEffects(dt);
    draw();
    if (dive.over) {
      finish();
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  const diverScreenY = () => viewH * 0.3;
  const toScreen = (x, y) => [x * scale, diverScreenY() + (y - dive.depth) * scale];

  function floater(text, x, y, color = '#fff', size = 16) {
    floaters.push({ text, x, y, color, size, t: 1.2 });
  }

  function handleEvents() {
    for (const e of dive.events) {
      if (e.type === 'pickup') {
        if (e.kind === 'bubble') floater('+O₂', e.x, e.y, '#b3f0ff');
        if (e.kind === 'pearl') floater(`+${fmt(e.value)}${e.combo > 1 ? ` ×${D.comboMultiplier(e.combo).toFixed(1)}` : ''}`, e.x, e.y, '#ffe082');
        if (e.kind === 'sock' || e.kind === 'chest') {
          const { sock } = e.item;
          const rank = RARITY_ORDER.indexOf(sock.rarity);
          floater(`${e.kind === 'chest' ? '🎁 ' : ''}${sock.name}`, e.x, e.y, RARITIES[sock.rarity].color, rank >= 3 ? 20 : 16);
          if (rank >= 3) shake = 0.3;
          if (navigator.vibrate) navigator.vibrate(rank >= 3 ? [30, 40, 60] : 15);
        }
      } else if (e.type === 'hit') {
        shake = 0.4;
        floater('Aïe ! −O₂', e.x, e.y, '#ff5252', 18);
        if (navigator.vibrate) navigator.vibrate(120);
      } else if (e.type === 'zone') {
        zoneBanner = { text: e.zone.name, sub: e.zone.hint, t: 3 };
      } else if (e.type === 'record') {
        zoneBanner = { text: 'Nouveau record !', sub: `Plus bas que ${Math.floor(dive.record)} m`, t: 2.5 };
      } else if (e.type === 'lowOxygen') {
        floater('Oxygène faible !', dive.x, dive.depth - 4, '#ff5252', 20);
      }
    }
    dive.events.length = 0;
  }

  function updateEffects(dt) {
    shake = Math.max(0, shake - dt);
    for (const f of floaters) { f.t -= dt; f.y -= dt * 4; }
    for (let i = floaters.length - 1; i >= 0; i--) if (floaters[i].t <= 0) floaters.splice(i, 1);
    if (Math.random() < dt * 8) trail.push({ x: dive.x + (Math.random() - 0.5), y: dive.depth - 1, r: 0.2 + Math.random() * 0.35, t: 1.5 });
    for (const b of trail) { b.t -= dt; b.y -= dt * 5; b.x += Math.sin(b.t * 6) * dt; }
    for (let i = trail.length - 1; i >= 0; i--) if (trail[i].t <= 0) trail.splice(i, 1);
    if (zoneBanner) {
      zoneBanner.t -= dt;
      if (zoneBanner.t <= 0) zoneBanner = null;
    }
  }

  // --- Dessin ---

  function drawBackground() {
    const top = dive.depth - diverScreenY() / scale;
    const bottom = top + viewH / scale;
    const grad = ctx.createLinearGradient(0, 0, 0, viewH);
    grad.addColorStop(0, waterAt(top));
    grad.addColorStop(1, waterAt(bottom));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, viewW, viewH);

    // Rayons de lumière près de la surface.
    if (dive.depth < 160) {
      ctx.save();
      ctx.globalAlpha = 0.12 * (1 - dive.depth / 160);
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 5; i++) {
        const x = ((i * 97 + dive.t * 6) % (viewW + 120)) - 60;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + 40, 0);
        ctx.lineTo(x - 30, viewH);
        ctx.lineTo(x - 90, viewH);
        ctx.fill();
      }
      ctx.restore();
    }

    // Surface de l'eau.
    const [, surfaceY] = toScreen(0, 0);
    if (surfaceY > -20) {
      ctx.fillStyle = '#bfe9ff';
      ctx.fillRect(0, 0, viewW, Math.max(0, surfaceY));
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let x = 0; x <= viewW; x += 8) ctx.lineTo(x, surfaceY + Math.sin(x / 18 + dive.t * 3) * 3);
      ctx.stroke();
    }

    // Neige marine (parallaxe).
    ctx.fillStyle = dive.depth > 250 ? 'rgba(160, 220, 255, .55)' : 'rgba(255, 255, 255, .35)';
    for (let i = 0; i < 45; i++) {
      const x = (i * 97.31) % viewW;
      const y = ((((i * 53.7) - dive.depth * scale * 0.5) % viewH) + viewH) % viewH;
      ctx.fillRect(x, y, 2, 2);
    }

    // Repère du record.
    if (dive.record > 0) {
      const [, ry] = toScreen(0, dive.record);
      if (ry > -10 && ry < viewH + 10) {
        ctx.save();
        ctx.setLineDash([8, 6]);
        ctx.strokeStyle = '#ffd54f';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, ry);
        ctx.lineTo(viewW, ry);
        ctx.stroke();
        ctx.fillStyle = '#ffd54f';
        ctx.font = '700 12px system-ui, sans-serif';
        ctx.fillText(`🏁 Record ${Math.floor(dive.record)} m`, 8, ry - 6);
        ctx.restore();
      }
    }
  }

  function drawObject(obj) {
    const [sx, sy] = toScreen(obj.x, obj.y);
    if (sy < -60 || sy > viewH + 60) return;
    const r = obj.r * scale;
    ctx.save();
    ctx.translate(sx, sy);
    switch (obj.kind) {
      case 'bubble': {
        ctx.strokeStyle = 'rgba(220, 250, 255, .95)';
        ctx.fillStyle = 'rgba(180, 240, 255, .25)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(-r * 0.35, -r * 0.35, r * 0.22, 0, Math.PI * 2); ctx.fill();
        ctx.font = `700 ${Math.round(r * 0.8)}px system-ui, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('O₂', 0, r * 0.1);
        break;
      }
      case 'pearl': {
        const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
        g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#e0c9a6');
        ctx.fillStyle = g;
        ctx.shadowColor = '#fff3c4'; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'sock':
      case 'chest': {
        const { sock, side } = obj.item;
        const color = RARITIES[sock.rarity].color;
        const rank = RARITY_ORDER.indexOf(sock.rarity);
        ctx.shadowColor = color;
        ctx.shadowBlur = 8 + rank * 6 + Math.sin(dive.t * 5 + obj.phase) * 4;
        ctx.fillStyle = `${color}55`;
        ctx.beginPath(); ctx.arc(0, 0, r * 1.05, 0, Math.PI * 2); ctx.fill();
        if (obj.kind === 'chest') {
          ctx.fillStyle = '#8d5524';
          ctx.fillRect(-r, -r * 0.6, r * 2, r * 1.3);
          ctx.fillStyle = '#ffd54f';
          ctx.fillRect(-r, -r * 0.15, r * 2, r * 0.2);
          ctx.fillRect(-r * 0.15, -r * 0.6, r * 0.3, r * 1.3);
          ctx.font = `${Math.round(r)}px system-ui, sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('✨', 0, -r * 1.2);
        } else {
          ctx.rotate(Math.sin(dive.t * 1.5 + obj.phase) * 0.35);
          const img = sockImage(sock, side);
          if (img.complete) ctx.drawImage(img, -r, -r * 1.18, r * 2, r * 2.37);
        }
        break;
      }
      case 'urchin': {
        ctx.rotate(dive.t * 0.5 + obj.phase);
        ctx.strokeStyle = '#2d1b3d'; ctx.lineWidth = 2;
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2;
          ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5);
          ctx.lineTo(Math.cos(a) * r * 1.3, Math.sin(a) * r * 1.3); ctx.stroke();
        }
        ctx.fillStyle = '#5e2a84';
        ctx.beginPath(); ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'jelly': {
        const pulse = 1 + Math.sin(dive.t * 4 + obj.phase) * 0.08;
        ctx.fillStyle = 'rgba(255, 128, 200, .75)';
        ctx.shadowColor = '#ff80c8'; ctx.shadowBlur = dive.depth > 250 ? 16 : 4;
        ctx.beginPath(); ctx.ellipse(0, 0, r * pulse, r * 0.75 / pulse, 0, Math.PI, 0); ctx.fill();
        ctx.strokeStyle = 'rgba(255, 170, 220, .8)'; ctx.lineWidth = 2;
        for (let i = -2; i <= 2; i++) {
          ctx.beginPath(); ctx.moveTo(i * r * 0.35, 0);
          for (let k = 1; k <= 4; k++) ctx.lineTo(i * r * 0.35 + Math.sin(dive.t * 5 + k + i) * 3, k * r * 0.35);
          ctx.stroke();
        }
        break;
      }
      case 'eel': {
        const dir = Math.cos(dive.t * obj.speed * 1.4 + obj.phase) >= 0 ? 1 : -1;
        ctx.scale(dir, 1);
        ctx.strokeStyle = '#2e7d32'; ctx.lineWidth = r * 0.9; ctx.lineCap = 'round';
        ctx.beginPath();
        for (let k = 0; k <= 8; k++) ctx.lineTo(-k * r * 0.45, Math.sin(dive.t * 8 - k) * r * 0.25);
        ctx.stroke();
        ctx.fillStyle = '#ffeb3b';
        ctx.beginPath(); ctx.arc(r * 0.15, -r * 0.12, r * 0.14, 0, Math.PI * 2); ctx.fill();
        break;
      }
    }
    ctx.restore();
  }

  function drawDiver() {
    const [sx, sy] = toScreen(dive.x, dive.depth);
    const r = D.DIVER_R * scale;
    if (dive.invuln > 0 && Math.floor(dive.invuln * 10) % 2 === 0) return;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(Math.max(-0.4, Math.min(0.4, dive.vx / 50)));
    // Le plongeur : ta chaussette la plus rare, dans une cloche de plongée.
    const best = rarestSock(getState());
    const sock = best ? best.sock : SOCK_BY_ID['blanche-sport'];
    const img = sockImage(sock, 'R');
    if (img.complete) ctx.drawImage(img, -r * 0.8, -r * 0.95, r * 1.6, r * 1.9);
    ctx.strokeStyle = 'rgba(255, 255, 255, .9)';
    ctx.fillStyle = 'rgba(200, 240, 255, .18)';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, 0, r * 1.15, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, .7)';
    ctx.beginPath(); ctx.ellipse(-r * 0.5, -r * 0.55, r * 0.25, r * 0.12, -0.7, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    ctx.strokeStyle = 'rgba(220, 250, 255, .7)';
    ctx.lineWidth = 1.5;
    for (const b of trail) {
      const [bx, by] = toScreen(b.x, b.y);
      ctx.globalAlpha = Math.min(1, b.t);
      ctx.beginPath(); ctx.arc(bx, by, b.r * scale, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawHUD() {
    const pad = 10;
    ctx.save();
    ctx.font = '800 26px system-ui, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 4;
    ctx.fillText(`${Math.floor(dive.depth)} m`, pad, 34);
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.fillText(dive.zone.name, pad, 52);

    // Butin.
    ctx.textAlign = 'right';
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.fillText(`🧦 ${dive.loot.socks.length}   🧵 ${fmt(dive.loot.fils)}`, viewW - pad, viewH - 42);
    if (dive.combo > 1) {
      ctx.font = '800 18px system-ui, sans-serif';
      ctx.fillStyle = '#ffd54f';
      ctx.fillText(`Combo ×${D.comboMultiplier(dive.combo).toFixed(1)}`, viewW - pad, viewH - 64);
    }
    ctx.restore();

    // Jauge d'oxygène.
    const ratio = dive.oxygen / dive.maxOxygen;
    const w = viewW - pad * 2;
    ctx.fillStyle = 'rgba(0, 0, 0, .45)';
    roundRect(pad, viewH - 28, w, 16, 8); ctx.fill();
    const low = ratio < 0.25;
    ctx.fillStyle = low ? (Math.floor(dive.t * 6) % 2 ? '#ff5252' : '#ff8a80') : ratio < 0.5 ? '#ffca28' : '#4dd0e1';
    roundRect(pad, viewH - 28, Math.max(0, w * ratio), 16, 8); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.fillText('O₂', pad + 6, viewH - 16);

    // Vignette rouge quand l'oxygène manque.
    if (low) {
      const g = ctx.createRadialGradient(viewW / 2, viewH / 2, viewH * 0.3, viewW / 2, viewH / 2, viewH * 0.75);
      g.addColorStop(0, 'rgba(255,0,0,0)');
      g.addColorStop(1, `rgba(255,0,0,${0.25 + Math.sin(dive.t * 8) * 0.12})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, viewW, viewH);
    }

    if (zoneBanner) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, zoneBanner.t);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.shadowColor = 'rgba(0,0,0,.7)'; ctx.shadowBlur = 8;
      ctx.font = '800 22px system-ui, sans-serif';
      ctx.fillText(zoneBanner.text, viewW / 2, viewH * 0.6);
      if (zoneBanner.sub) {
        ctx.font = '600 14px system-ui, sans-serif';
        ctx.fillText(zoneBanner.sub, viewW / 2, viewH * 0.6 + 22);
      }
      ctx.restore();
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y, w, h, Math.min(r, w / 2)) : ctx.rect(x, y, w, h);
  }

  function draw() {
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake * 24, (Math.random() - 0.5) * shake * 24);
    drawBackground();
    for (const obj of dive.objects) drawObject(obj);
    drawDiver();
    ctx.textAlign = 'center';
    for (const f of floaters) {
      const [fx, fy] = toScreen(f.x, f.y);
      ctx.globalAlpha = Math.min(1, f.t * 1.5);
      ctx.font = `800 ${f.size}px system-ui, sans-serif`;
      ctx.fillStyle = f.color;
      ctx.shadowColor = 'rgba(0,0,0,.7)'; ctx.shadowBlur = 4;
      ctx.fillText(f.text, Math.max(60, Math.min(viewW - 60, fx)), fy - 14);
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.textAlign = 'left';
    ctx.restore();
    drawHUD();
  }

  // --- Fin de plongée ---

  function finish() {
    cancelAnimationFrame(raf);
    const state = getState();
    const summary = D.finishDive(state, dive);
    dive = null;
    save();
    renderStats();

    const title = summary.reason === 'surface'
      ? '🌊 Remontée réussie !'
      : "😵 Panne d'oxygène !";
    const sub = summary.reason === 'surface'
      ? `Bonus de profondeur : +${fmt(summary.depthBonus)} fils`
      : `Remontée d'urgence : tu as perdu ${summary.lost.length} chaussette${summary.lost.length > 1 ? 's' : ''} et la moitié des fils.`;
    const cards = summary.results.map((r) => cardHTML(r, true)).join('');
    const lost = summary.lost.map(({ sock, side }) => `<span class="lost" title="${sock.name}">${sockSVG(sock, side, { size: 30 })}</span>`).join('');
    const state2 = getState();
    resultBox.innerHTML = `
      <div class="dive-summary ${summary.reason}">
        <h2>${title}</h2>
        <p class="big-depth">${Math.floor(summary.depth)} m ${summary.newRecord ? '<span class="badge">Nouveau record !</span>' : ''}</p>
        <p>${sub}</p>
        <p>+${fmt(summary.fils)} fils · ${summary.results.length} chaussette${summary.results.length > 1 ? 's' : ''} rapportée${summary.results.length > 1 ? 's' : ''}</p>
        <div class="dive-cards">${cards || '<p class="hint">Aucune chaussette cette fois…</p>'}</div>
        ${lost ? `<p class="hint">Perdues dans les profondeurs :</p><div class="lost-row">${lost}</div>` : ''}
        <div class="dive-buttons">
          <button id="dive-again" class="btn primary big" ${state2.dive.tanks > 0 ? '' : 'disabled'}>Replonger (${state2.dive.tanks} 🫧)</button>
          <button id="dive-back" class="btn">Retour</button>
        </div>
      </div>`;
    stage.hidden = true;
    resultBox.hidden = false;
    $('#dive-again').addEventListener('click', start);
    $('#dive-back').addEventListener('click', showLobby);
    celebrate(summary.results);
  }

  // --- Commandes ---

  function pointerToWorld(e) {
    const rect = canvas.getBoundingClientRect();
    input.targetX = ((e.clientX - rect.left) / rect.width) * D.WORLD_W;
  }
  canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture?.(e.pointerId); pointerToWorld(e); });
  canvas.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' || e.buttons) pointerToWorld(e); });

  const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', KeyQ: 'left', ArrowRight: 'right', KeyD: 'right' };
  window.addEventListener('keydown', (e) => {
    if (!dive) return;
    if (KEYMAP[e.code]) { keys.add(KEYMAP[e.code]); input.targetX = null; e.preventDefault(); }
    if (e.code === 'ArrowUp' || e.code === 'Space') { D.surface(dive); e.preventDefault(); }
  });
  window.addEventListener('keyup', (e) => { if (KEYMAP[e.code]) keys.delete(KEYMAP[e.code]); });
  window.addEventListener('resize', () => { if (dive) resize(); });
  $('#dive-surface').addEventListener('click', () => { if (dive) D.surface(dive); });

  return {
    show() { if (!dive) showLobby(); },
    // Quitter l'onglet pendant une plongée = remonter (on garde le butin).
    leave() { if (dive) D.surface(dive); },
    tick: updateTimer,
    active: () => !!dive,
  };
}
