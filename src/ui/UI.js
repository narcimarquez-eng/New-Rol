// Capa de interfaz DOM: HUD (corazones, stamina, contadores, objetivo,
// minimapa), diálogos con escritura progresiva, tienda, menú de pausa,
// avisos y controles táctiles.
import { ITEMS } from '../data/items.js';
import { QUESTS } from '../data/quests.js';
import { TILE, tileInfo } from '../world/tiles.js';

const $ = (id) => document.getElementById(id);

function heartSVG(fill) {
  // fill: 0, 0.5 o 1
  const id = 'h' + Math.random().toString(36).slice(2, 7);
  return `<svg viewBox="0 0 32 30"><defs><clipPath id="${id}"><rect x="0" y="0" width="${32 * fill}" height="30"/></clipPath></defs>
    <path d="M16 28 C 6 20 1 14 1 8.5 A7.5 7.5 0 0 1 16 6 A7.5 7.5 0 0 1 31 8.5 C 31 14 26 20 16 28 Z" fill="#3a1820" stroke="#fff" stroke-width="2"/>
    <path clip-path="url(#${id})" d="M16 28 C 6 20 1 14 1 8.5 A7.5 7.5 0 0 1 16 6 A7.5 7.5 0 0 1 31 8.5 C 31 14 26 20 16 28 Z" fill="#ff3b5c" stroke="#fff" stroke-width="2"/>
    <ellipse clip-path="url(#${id})" cx="9" cy="9" rx="3" ry="2" fill="#ffb3c1"/></svg>`;
}

export class UI {
  constructor(game) {
    this.game = game;
    this.lastHearts = '';
    this.dialog = null;
    this.mapCanvas = $('minimap');
    this.mapCtx = this.mapCanvas.getContext('2d');
    this.bigCanvas = $('bigmap');
    this.bigCtx = this.bigCanvas.getContext('2d');
    this.bossTarget = null;

    $('btn-menu').addEventListener('click', () => game.togglePause('inv'));
    $('btn-resume').addEventListener('click', () => game.togglePause());
    $('btn-save').addEventListener('click', () => { game.save(); this.toast('Partida guardada'); });
    $('btn-title').addEventListener('click', () => game.toTitle());
    $('btn-mute').addEventListener('click', () => { const m = game.audio.toggleMute(); $('btn-mute').textContent = `Sonido: ${m ? 'no' : 'sí'}`; });
    $('shop-close').addEventListener('click', () => this.closeShop());
    document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => this.showTab(t.dataset.tab)));
    $('dialog').addEventListener('click', (e) => { if (!e.target.classList.contains('btn')) this.advanceDialog(); });
  }

  show(id, on = true) { $(id).classList.toggle('hidden', !on); }

  // ---------------- HUD ----------------
  updateHUD() {
    const g = this.game, p = g.player, pr = g.progress;
    const key = `${p.hp}/${p.maxHp}`;
    if (key !== this.lastHearts) {
      const hearts = [];
      for (let i = 0; i < p.maxHp / 2; i++) {
        const v = Math.max(0, Math.min(2, p.hp - i * 2)) / 2;
        hearts.push(`<div class="heart">${heartSVG(v)}</div>`);
      }
      $('hearts').innerHTML = hearts.join('');
      this.lastHearts = key;
    }
    $('stamina-fill').style.width = `${(p.stamina / p.maxStamina) * 100}%`;
    $('stamina').style.width = `${120 + p.maxStamina * 0.5}px`;
    $('stamina').classList.toggle('exhausted', p.exhausted);
    $('coins').textContent = pr.coins;
    $('potions').textContent = pr.count('potion');
    const keys = ['key_small', 'key_maze', 'key_forest'].filter((k) => pr.count(k) > 0)
      .map((k) => `<span title="${ITEMS[k].name}" style="color:#${ITEMS[k].color.toString(16).padStart(6, '0')}">🗝️${pr.count(k) > 1 ? '×' + pr.count(k) : ''}</span>`).join(' ');
    $('keys-counter').innerHTML = keys;
    $('objective-text').textContent = g.currentObjective();
    if (this.bossTarget) {
      const b = this.bossTarget;
      $('boss-fill').style.width = `${Math.max(0, b.hp / b.maxHp) * 100}%`;
      if (!b.alive) { this.bossTarget = null; setTimeout(() => this.show('boss', false), 800); }
    }
  }

  showBoss(enemy) {
    this.bossTarget = enemy;
    $('boss-name').textContent = enemy.def.name;
    this.show('boss', true);
  }
  hideBoss() { this.bossTarget = null; this.show('boss', false); }

  zoneTitle(name, subtitle) {
    const el = $('zone-name');
    el.innerHTML = `${name}<small>${subtitle || ''}</small>`;
    el.classList.add('show');
    clearTimeout(this.zoneT);
    this.zoneT = setTimeout(() => el.classList.remove('show'), 2600);
  }

  prompt(text) {
    const el = $('prompt');
    if (!text) { el.classList.add('hidden'); this.promptText = null; return; }
    if (text !== this.promptText) {
      const key = this.game.input.isTouch ? 'E' : 'E';
      el.innerHTML = `<kbd>${key}</kbd>${text}`;
      this.promptText = text;
    }
    el.classList.remove('hidden');
  }

  toast(text) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = text;
    $('toasts').appendChild(t);
    setTimeout(() => t.remove(), 2700);
    while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
  }

  itemGet(itemId, qty = 1) {
    const it = ITEMS[itemId];
    if (!it) return;
    const el = $('itemget');
    el.querySelector('.itemget-icon').textContent = it.icon;
    el.querySelector('.itemget-name').textContent = qty > 1 ? `${it.name} ×${qty}` : it.name;
    el.querySelector('.itemget-desc').textContent = it.desc || '';
    el.classList.remove('hidden');
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    clearTimeout(this.itemT);
    this.itemT = setTimeout(() => el.classList.add('hidden'), 2600);
  }

  // ---------------- diálogo ----------------
  /**
   * Abre un diálogo. lines: string[]; opts: {name, choices:[{label, fn}], onEnd}
   */
  openDialog(name, lines, opts = {}) {
    this.dialog = { name, lines, i: 0, opts, shown: 0, full: false };
    $('dialog-name').textContent = name;
    $('dialog-choices').innerHTML = '';
    this.show('dialog', true);
    this.prompt(null);
    this.renderLine();
  }

  renderLine() {
    const d = this.dialog;
    d.shown = 0; d.full = false;
    $('dialog-text').textContent = '';
    $('dialog-choices').innerHTML = '';
    $('dialog-next').classList.remove('hidden');
  }

  /** Avanza el texto letra a letra (llamado cada frame). */
  updateDialog(dt) {
    const d = this.dialog;
    if (!d || d.full) return;
    const line = d.lines[d.i];
    const before = Math.floor(d.shown);
    d.shown += dt * 55;
    const n = Math.min(line.length, Math.floor(d.shown));
    if (n !== before) {
      $('dialog-text').textContent = line.slice(0, n);
      if (n % 3 === 0 && line[n - 1] !== ' ') this.game.audio.sfx('talk');
    }
    if (n >= line.length) this.finishLine();
  }

  finishLine() {
    const d = this.dialog;
    d.full = true;
    $('dialog-text').textContent = d.lines[d.i];
    const last = d.i === d.lines.length - 1;
    if (last && d.opts.choices) {
      $('dialog-next').classList.add('hidden');
      const box = $('dialog-choices');
      box.innerHTML = '';
      d.choiceIdx = 0;
      d.opts.choices.forEach((c, i) => {
        const b = document.createElement('button');
        b.className = 'btn' + (i === 0 ? ' sel' : '');
        b.textContent = c.label;
        b.addEventListener('click', () => this.choose(i));
        box.appendChild(b);
      });
    }
  }

  choose(i) {
    const d = this.dialog;
    if (!d) return;
    const c = d.opts.choices[i];
    this.closeDialog();
    this.game.audio.sfx('select');
    c.fn?.();
  }

  advanceDialog() {
    const d = this.dialog;
    if (!d) return;
    if (!d.full) { this.finishLine(); return; }
    if (d.i === d.lines.length - 1 && d.opts.choices) { this.choose(d.choiceIdx || 0); return; }
    d.i++;
    if (d.i >= d.lines.length) {
      const end = d.opts.onEnd;
      this.closeDialog();
      end?.();
      return;
    }
    this.renderLine();
  }

  /** Navegación de opciones con teclado. */
  moveChoice(dir) {
    const d = this.dialog;
    if (!d || !d.full || !d.opts.choices) return;
    d.choiceIdx = (d.choiceIdx + dir + d.opts.choices.length) % d.opts.choices.length;
    [...$('dialog-choices').children].forEach((b, i) => b.classList.toggle('sel', i === d.choiceIdx));
  }

  closeDialog() {
    this.dialog = null;
    this.show('dialog', false);
    this.game.onDialogClosed();
  }

  // ---------------- tienda ----------------
  openShop(npc) {
    this.shopNpc = npc;
    this.renderShop();
    this.show('shop', true);
    this.game.setMode('shop');
  }

  renderShop() {
    const g = this.game, pr = g.progress;
    const list = $('shop-list');
    list.innerHTML = '';
    for (const offer of this.shopNpc.data.shop) {
      const it = ITEMS[offer.item];
      const sold = offer.id && pr.flags.has(offer.id);
      const full = it.max && pr.count(offer.item) >= it.max;
      const row = document.createElement('div');
      row.className = 'shop-row';
      row.innerHTML = `<span class="i">${it.icon}</span><div class="info"><b>${it.name}</b><small>${it.desc || ''}</small></div><b>🪙 ${offer.price}</b>`;
      const b = document.createElement('button');
      b.className = 'btn';
      b.textContent = sold ? 'Agotado' : full ? 'Lleno' : 'Comprar';
      b.disabled = sold || full || pr.coins < offer.price;
      b.addEventListener('click', () => {
        if (pr.coins < offer.price) return;
        pr.coins -= offer.price;
        if (offer.id) pr.flags.add(offer.id);
        g.giveItem(offer.item, 1, { silent: true });
        g.audio.sfx('coin');
        this.toast(`Has comprado: ${it.name}`);
        this.renderShop();
      });
      row.appendChild(b);
      list.appendChild(row);
    }
    const coins = document.createElement('p');
    coins.innerHTML = `Tienes <b>🪙 ${pr.coins}</b> monedas.`;
    list.appendChild(coins);
  }

  closeShop() {
    this.show('shop', false);
    this.game.setMode('play');
  }

  // ---------------- menú de pausa ----------------
  openPause(tab = 'inv') {
    this.show('pause', true);
    this.showTab(tab);
  }
  closePause() { this.show('pause', false); }

  showTab(tab) {
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
    for (const id of ['inv', 'quests', 'map', 'help']) this.show(`tab-${id}`, id === tab);
    if (tab === 'inv') this.renderInventory();
    if (tab === 'quests') this.renderQuests();
    if (tab === 'map') this.drawMap(this.bigCtx, this.bigCanvas.width, true);
  }

  renderInventory() {
    const g = this.game, pr = g.progress, p = g.player;
    const items = Object.entries(pr.items).filter(([, n]) => n > 0);
    const upgrades = [];
    if (pr.flags.has('sword_up')) upgrades.push('sword_up');
    $('tab-inv').innerHTML = `
      <div class="stats">
        <span>Vida: <b>${p.hp / 2} / ${p.maxHp / 2} ❤️</b></span>
        <span>Resistencia: <b>${p.maxStamina}</b></span>
        <span>Daño de espada: <b>${p.swordDamage}</b></span>
        <span>Monedas: <b>${pr.coins}</b></span>
        <span>Enemigos derrotados: <b>${pr.totalKills}</b></span>
      </div>
      <div class="inv-grid">
        ${[...items.map(([id, n]) => [id, n]), ...upgrades.map((u) => [u, 1])].map(([id, n]) => {
          const it = ITEMS[id];
          return `<div class="inv-item"><span class="i">${it.icon}</span><div><b>${it.name}${n > 1 ? ' ×' + n : ''}</b><small>${it.desc || ''}</small></div></div>`;
        }).join('') || '<p>No llevas nada todavía.</p>'}
      </div>`;
  }

  renderQuests() {
    const pr = this.game.progress;
    const label = { active: 'En curso', ready: '¡Completada! Vuelve a hablar', done: 'Terminada' };
    const html = [`<div class="quest"><h4>⭐ Historia principal</h4><p>${this.game.currentObjective()}</p></div>`];
    for (const [id, q] of Object.entries(QUESTS)) {
      const st = pr.questState(id);
      if (st === 'none') continue;
      const prog = pr.questProgress(id);
      html.push(`<div class="quest"><h4>${q.name}<span class="state ${st}">${label[st]}</span></h4><p>${q.desc}${prog ? ` <b>(${prog})</b>` : ''}</p></div>`);
    }
    if (html.length === 1) html.push('<p style="color:var(--muted)">Habla con los habitantes para descubrir misiones secundarias.</p>');
    $('tab-quests').innerHTML = html.join('');
  }

  // ---------------- minimapa ----------------
  drawMap(ctx, size, full = false) {
    const g = this.game, z = g.zone, p = g.player;
    ctx.clearRect(0, 0, size, size);
    const pal = z.palette.ground;
    const hex = (n) => '#' + n.toString(16).padStart(6, '0');
    const scale = full ? size / Math.max(z.W, z.H) : 7; // px por casilla
    const [pc, pr] = z.collision.tileOf(p.x, p.z);
    const pcx = (p.x - z.collision.originX) / TILE, pcz = (p.z - z.collision.originZ) / TILE;
    const ox = full ? (size - z.W * scale) / 2 : size / 2 - pcx * scale;
    const oy = full ? (size - z.H * scale) / 2 : size / 2 - pcz * scale;
    ctx.save();
    if (!full) { ctx.beginPath(); ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2); ctx.clip(); }
    ctx.fillStyle = '#0c141b'; ctx.fillRect(0, 0, size, size);
    const seen = g.progress.seenTiles(z.id, z.W * z.H);
    const range = full ? Math.max(z.W, z.H) : 14;
    for (let r = Math.max(0, pr - range); r < Math.min(z.H, pr + range + 1); r++) {
      for (let c = Math.max(0, pc - range); c < Math.min(z.W, pc + range + 1); c++) {
        if (!seen[r * z.W + c]) continue;
        const ch = z.charAt(c, r);
        const info = tileInfo(ch);
        let col = hex(pal[info.ground] || pal.grass);
        if (info.solid === 'box' && info.tall) col = '#1d3b24';
        if (info.secret) col = '#1d3b24';
        if (ch === '^') col = '#5a5a5a';
        if (info.water) col = hex(pal.water);
        if (ch === 'F') col = '#8b5a2b';
        ctx.fillStyle = col;
        ctx.fillRect(ox + c * scale, oy + r * scale, scale + 0.5, scale + 0.5);
      }
    }
    // marcadores
    const dot = (x, zz, color, r = 3) => {
      const mx = ox + ((x - z.collision.originX) / TILE) * scale, my = oy + ((zz - z.collision.originZ) / TILE) * scale;
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(mx, my, r, 0, Math.PI * 2); ctx.fill();
    };
    for (const it of g.interactables) {
      if (!it.mapColor || !it.visible) continue;
      const [c, r] = z.collision.tileOf(it.x, it.z);
      if (!seen[r * z.W + c]) continue;
      dot(it.x, it.z, it.mapColor, full ? 4 : 3);
    }
    for (const e of g.enemies) if (e.alive && e.state !== 'idle' && e.state !== 'patrol') dot(e.x, e.z, '#ff4d4d', 2.5);
    // jugador (flecha)
    const mx = ox + pcx * scale, my = oy + pcz * scale;
    ctx.translate(mx, my);
    ctx.rotate(-p.facing + Math.PI);
    ctx.fillStyle = '#ffd34d'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 5); ctx.lineTo(0, 2); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
}
