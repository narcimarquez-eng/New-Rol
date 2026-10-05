// Estado persistente de la partida: inventario, monedas, banderas de historia,
// misiones, cofres abiertos, objetos recogidos y casillas exploradas.
import { QUESTS } from '../data/quests.js';

export class Progress {
  constructor() { this.reset(); }

  reset() {
    this.coins = 0;
    this.items = {};
    this.flags = new Set();
    this.quests = {};   // id -> { state: 'active'|'done', kills }
    this.totalKills = 0;
    this.seen = {};     // zoneId -> Uint8Array
    this.playTime = 0;
  }

  count(item) { return this.items[item] || 0; }
  has(item, n = 1) { return this.count(item) >= n; }
  add(item, n = 1) { this.items[item] = this.count(item) + n; }
  take(item, n = 1) { this.items[item] = Math.max(0, this.count(item) - n); }

  /** Evalúa una condición de los datos (diálogos, puertas, historia). */
  check(cond) {
    if (!cond) return true;
    if (cond.any) return cond.any.some((c) => this.check(c));
    if (cond.all) return cond.all.every((c) => this.check(c));
    if (cond.flag && !this.flags.has(cond.flag)) return false;
    if (cond.notFlag && this.flags.has(cond.notFlag)) return false;
    if (cond.has && !this.has(cond.has)) return false;
    if (cond.item && !this.has(cond.item)) return false;
    if (cond.quest && this.questState(cond.quest.id) !== cond.quest.state) return false;
    return true;
  }

  questState(id) {
    const q = this.quests[id];
    if (!q) return 'none';
    if (q.state === 'done') return 'done';
    const def = QUESTS[id];
    if (def.type === 'kill' && (q.kills || 0) >= def.count) return 'ready';
    if (def.type === 'collect' && this.count(def.item) >= def.count) return 'ready';
    if (def.type === 'talk' && this.flags.has(`talked_${id}`)) return 'ready';
    return 'active';
  }

  questProgress(id) {
    const def = QUESTS[id], q = this.quests[id];
    if (!q || q.state === 'done') return '';
    if (def.type === 'kill') return `${Math.min(def.count, q.kills || 0)}/${def.count}`;
    if (def.type === 'collect') return `${Math.min(def.count, this.count(def.item))}/${def.count}`;
    return '';
  }

  startQuest(id) { this.quests[id] = { state: 'active', kills: 0 }; }
  finishQuest(id) { this.quests[id] = { ...(this.quests[id] || {}), state: 'done' }; }

  onKill(kind) {
    this.totalKills++;
    const done = [];
    for (const [id, q] of Object.entries(this.quests)) {
      const def = QUESTS[id];
      if (q.state !== 'active' || def.type !== 'kill' || def.enemy !== kind) continue;
      const before = this.questState(id);
      q.kills = (q.kills || 0) + 1;
      if (before !== 'ready' && this.questState(id) === 'ready') done.push(id);
    }
    return done;
  }

  seenTiles(zoneId, size) {
    if (!this.seen[zoneId] || this.seen[zoneId].length !== size) this.seen[zoneId] = new Uint8Array(size);
    return this.seen[zoneId];
  }

  serialize() {
    const seen = {};
    for (const [k, v] of Object.entries(this.seen)) seen[k] = btoa(String.fromCharCode(...v));
    return { coins: this.coins, items: this.items, flags: [...this.flags], quests: this.quests, totalKills: this.totalKills, seen, playTime: this.playTime };
  }

  load(d) {
    this.reset();
    if (!d) return;
    this.coins = d.coins || 0;
    this.items = d.items || {};
    this.flags = new Set(d.flags || []);
    this.quests = d.quests || {};
    this.totalKills = d.totalKills || 0;
    this.playTime = d.playTime || 0;
    for (const [k, v] of Object.entries(d.seen || {})) {
      try { this.seen[k] = Uint8Array.from(atob(v), (ch) => ch.charCodeAt(0)); } catch { /* ignorar */ }
    }
  }
}
