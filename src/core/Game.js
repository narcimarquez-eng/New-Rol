// Núcleo del juego: bucle principal, modos (título, juego, diálogo, pausa...),
// carga de zonas data-driven, interacción, misiones, guardado y luces.
import * as THREE from 'three';
import { Renderer } from './Renderer.js';
import { Input } from './Input.js';
import { Audio } from './Audio.js';
import { EventBus } from './EventBus.js';
import { Save } from './Save.js';
import { Zone } from '../world/Zone.js';
import { Player } from '../entities/Player.js';
import { Companion } from '../entities/Companion.js';
import { Sandstorm } from '../systems/Sandstorm.js';
import { COMPANIONS } from '../data/companions.js';
import { charactersReady } from '../gfx/Characters.js';
import { Enemy } from '../entities/Enemy.js';
import { NPC, Chest, Door, Sign, Pickup, Dummy, Portal, IceBlock, Plate, ResetStone } from '../entities/Interactables.js';
import { Particles } from '../systems/Particles.js';
import { Projectiles } from '../systems/Projectiles.js';
import { GLOBAL } from '../gfx/ModelKit.js';
import { REALISTIC } from '../gfx/Style.js';
import { Combat } from '../systems/Combat.js';
import { CameraController } from '../systems/CameraController.js';
import { Progress } from '../systems/Progress.js';
import { UI } from '../ui/UI.js';
import { Touch } from '../ui/Touch.js';
import { ZONES, START_ZONE } from '../data/zones/index.js';
import { ITEMS } from '../data/items.js';
import { QUESTS } from '../data/quests.js';
import { STORY } from '../data/story.js';
import { TILE } from '../world/tiles.js';

const MAX_LIGHTS = 6;

export class Game {
  constructor(container) {
    const params = new URLSearchParams(location.search);
    const lowQuality = params.has('low') || (matchMedia('(pointer: coarse)').matches && Math.min(innerWidth, innerHeight) < 900);
    this.params = params;
    this.gfx = new Renderer(container, { lowQuality });
    this.scene = this.gfx.scene;
    this.camera = this.gfx.camera;
    this.input = new Input(this.gfx.renderer.domElement);
    this.audio = new Audio();
    this.events = new EventBus();
    this.progress = new Progress();
    this.particles = new Particles(this.scene);
    this.combat = new Combat(this);
    this.projectiles = new Projectiles(this);
    this.cam = new CameraController(this.camera);
    this.ui = new UI(this);
    this.touch = new Touch(this);
    this.player = new Player(this);
    this.scene.add(this.player.root);

    this.time = 0;
    this.mode = 'title';
    this.enemies = [];
    this.interactables = [];
    this.dummies = [];
    this.companions = [];
    this.hitstopT = 0;
    this.saveTimer = 0;
    this.godMode = params.has('god');

    this.setupLights(lowQuality);
    this.storm = new Sandstorm(this);
    this.lastFrame = performance.now();

    document.addEventListener('pointerlockchange', () => {
      if (!this.input.locked && this.mode === 'play' && !this.ignoreUnlock) {
        this.togglePause('inv');
        this.pauseGuard = performance.now();
      }
      this.ignoreUnlock = false;
    });
    addEventListener('keydown', (e) => {
      if (this.mode === 'dialog' && this.ui.dialog) {
        if (['ArrowLeft', 'KeyA'].includes(e.code)) this.ui.moveChoice(-1);
        if (['ArrowRight', 'KeyD'].includes(e.code)) this.ui.moveChoice(1);
      }
    });
    addEventListener('visibilitychange', () => { if (document.hidden && this.mode === 'play') this.togglePause('inv'); });

    // pantalla de título
    const saved = Save.load();
    const cont = document.getElementById('btn-continue');
    cont.disabled = !saved;
    cont.addEventListener('click', () => this.start(saved));
    document.getElementById('btn-new').addEventListener('click', () => {
      if (saved && !confirm('¿Empezar una partida nueva? Se perderá la partida guardada.')) return;
      Save.clear();
      this.start(null);
    });
    document.getElementById('btn-retry').addEventListener('click', () => this.respawn());
    document.getElementById('btn-keep').addEventListener('click', () => { this.ui.show('ending', false); this.setMode('play'); });

    // fondo de la pantalla de título: la aldea
    this.loadZone(START_ZONE, 'start', { silent: true });
    this.cam.yaw = 2.4; this.cam.pitch = 0.32; this.cam.wantDistance = this.cam.distance = 16;

    window.__game = this; // ganchos para tests automatizados y depuración
    // compilar los sombreadores sin bloquear la página antes del primer fotograma
    this.warmup().finally(() => {
      document.getElementById('loading').classList.add('hidden');
      this.loop();
    });
  }

  /** Compila de forma asíncrona los programas de la escena actual. */
  warmup() {
    const r = this.gfx.renderer;
    if (!r.compileAsync) return Promise.resolve();
    // con límite de tiempo: si el navegador no informa del progreso, seguimos igualmente
    const timeout = new Promise((res) => setTimeout(res, 3000));
    return Promise.race([r.compileAsync(this.scene, this.camera).catch(() => {}), timeout]);
  }

  // ------------------------------------------------------------------ luces
  setupLights(low) {
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x445544, 1);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.5);
    this.sun.castShadow = true;
    const s = low ? 1024 : REALISTIC ? 4096 : 2048;
    this.sun.shadow.mapSize.set(s, s);
    const sc = this.sun.shadow.camera;
    sc.left = -40; sc.right = 40; sc.top = 40; sc.bottom = -40; sc.near = 1; sc.far = 200;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.04;
    this.sun.shadow.radius = 3;
    this.scene.add(this.sun, this.sun.target);
    this.pointLights = [];
    for (let i = 0; i < MAX_LIGHTS; i++) {
      const l = new THREE.PointLight(0xffa040, 0, 14, 1.6);
      this.scene.add(l);
      this.pointLights.push(l);
    }
  }

  applyZoneLighting(zone) {
    if (REALISTIC) { this.applyRealLighting(zone); return; }
    this.scene.environment = null;
    const pal = zone.palette;
    this.hemi.color.set(pal.hemiSky); this.hemi.groundColor.set(pal.hemiGround); this.hemi.intensity = pal.hemiIntensity;
    this.sun.color.set(pal.sunColor); this.sun.intensity = pal.sunIntensity;
    this.scene.fog = new THREE.Fog(pal.fog, zone.data.fog.near, zone.data.fog.far);
    this.scene.background = new THREE.Color(pal.fog);
    this.gfx.setGrade(zone.data.grade || {});
    const bl = zone.data.bloom || {};
    this.gfx.bloom.strength = bl.strength ?? 0.38;
    this.gfx.bloom.threshold = bl.threshold ?? 0.9;
    this.torchPower = zone.data.torchIntensity ?? 9;
  }

  /** Luz del modo realista: sol en la dirección del cielo físico, IBL y niebla de distancia. */
  applyRealLighting(zone) {
    const atmo = zone.data.atmosphere || {};
    this.scene.environment = zone.envMap;
    this.scene.environmentIntensity = atmo.envIntensity ?? 0.4;
    this.scene.background = null;
    this.scene.fog = new THREE.FogExp2(zone.hazeColor, atmo.fogDensity ?? 0.004);
    this.sun.color.set(atmo.sunColor ?? 0xffe2b8);
    this.sun.intensity = atmo.sunIntensity ?? 5.5;
    this.hemi.color.set(atmo.skyLight ?? 0xbfd6ff); this.hemi.groundColor.set(atmo.groundLight ?? 0x5a5040);
    this.hemi.intensity = atmo.hemiIntensity ?? 0.1;
    this.sunOffset = zone.sunDir.clone().multiplyScalar(80);
    this.gfx.setGrade({ saturation: 1.06, contrast: 1.05, warmth: 0.018, vignette: 0.3, ...(zone.data.gradeReal || {}) });
    this.gfx.renderer.toneMappingExposure = atmo.exposure ?? 0.48;
    // solo lo muy brillante (sol, reflejos, antorchas) produce resplandor
    this.gfx.bloom.strength = atmo.bloom ?? 0.18;
    this.gfx.bloom.threshold = 1.4;
    this.gfx.bloom.radius = 0.25;
    this.torchPower = zone.data.torchIntensity ?? 9;
  }

  updateLights() {
    const p = this.player;
    if (this.sunOffset) this.sun.position.set(p.x + this.sunOffset.x, this.sunOffset.y, p.z + this.sunOffset.z);
    else this.sun.position.set(p.x + 30, 55, p.z + 22);
    this.sun.target.position.set(p.x, 0, p.z);
    // las luces puntuales se asignan a las antorchas más cercanas
    const torches = this.zone.torches
      .map((t) => ({ t, d: Math.hypot(t.x - p.x, t.z - p.z) }))
      .sort((a, b) => a.d - b.d);
    for (let i = 0; i < MAX_LIGHTS; i++) {
      const l = this.pointLights[i];
      const e = torches[i];
      if (!e || e.d > 45) { l.intensity = 0; continue; }
      const t = e.t;
      // antorchas parpadean; los cristales laten despacio
      const flick = t.crystal ? 0.85 + Math.sin(this.time * 1.5 + t.phase) * 0.15
        : 0.8 + Math.sin(this.time * 11 + t.phase) * 0.1 + Math.sin(this.time * 23 + t.phase * 2) * 0.07 + Math.random() * 0.05;
      l.position.set(t.x, t.y + 0.3, t.z);
      l.color.set(t.color ?? 0xffa040);
      l.intensity = (t.crystal ? 7 : this.torchPower ?? 9) * flick;
      if (t.obj.userData.flame) {
        const f = t.obj.userData.flame;
        f.scale.set(0.9 + flick * 0.2, 1.4 + flick * 0.5, 0.9 + flick * 0.2);
      }
    }
    // las llamas lejanas también se mueven
    for (const e of torches.slice(MAX_LIGHTS)) {
      const f = e.t.obj.userData.flame;
      if (f) f.scale.y = 1.5 + Math.sin(this.time * 12 + e.t.phase) * 0.2;
    }
  }

  // ------------------------------------------------------------------ partida
  start(saved) {
    this.audio.unlock();
    this.cam.wantDistance = this.cam.distance = 9;
    this.progress.reset();
    const p = this.player;
    p.maxHp = 6; p.hp = 6; p.maxStamina = 100; p.stamina = 100; p.swordDamage = 1;
    let zone = START_ZONE, spawn = 'start';
    if (saved) {
      this.progress.load(saved.progress);
      Object.assign(p, { maxHp: saved.player.maxHp, hp: Math.max(2, saved.player.hp), maxStamina: saved.player.maxStamina, swordDamage: saved.player.swordDamage });
      if (this.progress.flags.has('sword_steel')) p.setSwordGlow(true, 0xffe08a);
      else if (this.progress.flags.has('sword_up')) p.setSwordGlow(true);
      zone = ZONES[saved.zone] ? saved.zone : START_ZONE;
      spawn = saved.spawn || 'start';
    }
    p.stamina = p.maxStamina;
    this.ui.show('title', false);
    this.ui.show('hud', true);
    this.touch.setVisible(this.input.isTouch);
    this.loadZone(zone, spawn);
    this.setMode('play');
    if (!saved) setTimeout(() => this.ui.toast('Habla con el Anciano Bruno (E). Su casa es la del tejado azul.'), 3200);
  }

  toTitle() {
    this.save();
    this.ui.closePause();
    this.ui.show('hud', false);
    this.touch.setVisible(false);
    this.ui.show('title', true);
    document.getElementById('btn-continue').disabled = false;
    this.mode = 'title';
    this.audio.stopMusic();
    this.input.releaseLock();
  }

  save() {
    if (this.mode === 'title' || !this.zone) return;
    const p = this.player;
    Save.write({
      version: 1,
      zone: this.zone.id,
      spawn: this.lastSpawn,
      player: { hp: p.hp, maxHp: p.maxHp, maxStamina: p.maxStamina, swordDamage: p.swordDamage },
      progress: this.progress.serialize(),
    });
  }

  setMode(m) {
    this.mode = m;
    if (m !== 'dialog') this.lookTarget = null;
    if (m !== 'play') this.ui.prompt(null);
  }

  togglePause(tab) {
    if (this.mode === 'pause') {
      this.ui.closePause();
      this.setMode('play');
      return;
    }
    if (this.mode !== 'play') return;
    this.setMode('pause');
    this.ignoreUnlock = this.input.releaseLock();
    this.ui.openPause(tab);
  }

  // ------------------------------------------------------------------ zonas
  loadZone(id, spawnId, { silent = false } = {}) {
    // limpiar zona anterior
    if (this.zone) {
      this.scene.remove(this.zone.group);
      this.zone.dispose();
      for (const e of this.enemies) { this.scene.remove(e.root); e.dispose(); }
      for (const i of this.interactables) { this.scene.remove(i.root); i.dispose(); }
    }
    this.enemies = []; this.interactables = []; this.dummies = [];
    if (this.ui.dialog) this.ui.closeDialog();
    this.talkingNpc = null;
    this.particles.clear();
    this.projectiles.clear();
    this.ui.hideBoss();

    const data = ZONES[id];
    const zone = new Zone(data, { high: !this.gfx.lowQuality, renderer: this.gfx.renderer });
    this.zone = zone;
    this.scene.add(zone.group);
    this.applyZoneLighting(zone);
    this.storm?.reset(zone);

    // entidades dinámicas
    for (const e of data.entities) {
      if (e.when && !this.progress.check(e.when)) continue; // aparece solo si se cumplen sus condiciones
      switch (e.type) {
        case 'npc': this.addInteractable(new NPC(this, e)); break;
        case 'chest': this.addInteractable(new Chest(this, e)); break;
        case 'door': this.addInteractable(new Door(this, e)); break;
        case 'sign': this.addInteractable(new Sign(this, e)); break;
        case 'portal': this.addInteractable(new Portal(this, e)); break;
        case 'dummy': { const d = new Dummy(this, e); this.dummies.push(d); this.addInteractable(d); break; }
        case 'iceblock': this.addInteractable(new IceBlock(this, e)); break;
        case 'plate': this.addInteractable(new Plate(this, e)); break;
        case 'resetstone': this.addInteractable(new ResetStone(this, e)); break;
        case 'pickup':
          if (!this.progress.flags.has(`picked_${e.id}`)) this.addInteractable(new Pickup(this, e));
          break;
        case 'enemy':
          if (e.flag && this.progress.flags.has(e.flag)) break; // jefe ya derrotado
          this.spawnEnemy(e);
          break;
        default: break;
      }
    }

    // puzles ya resueltos: el bloque se queda sobre su placa
    for (const pl of this.interactables.filter((i) => i instanceof Plate && i.pressed)) {
      const b = this.interactables.find((i) => i instanceof IceBlock && i.id === pl.data.block);
      if (b) { b.setTile(...pl.tileRC); b.locked = true; }
    }

    const spawn = data.entities.find((e) => e.type === 'spawn' && e.id === spawnId) || data.entities.find((e) => e.type === 'spawn');
    const [sx, sz] = zone.tileToWorld(...spawn.tile);
    this.player.place(sx, sz, spawn.facing || 0);
    this.lastSpawn = spawn.id;
    this.spawnCompanions();
    this.cam.snapBehind(this.player);
    if (!silent) {
      this.audio.playMusic(data.music);
      this.ui.zoneTitle(data.name, data.subtitle);
      if (data.enterFlag) this.progress.flags.add(data.enterFlag);
      this.save();
    }
  }

  /** Crea (o recoloca) a los compañeros que se han unido al grupo. */
  spawnCompanions() {
    for (const c of this.companions) { this.scene.remove(c.root); c.dispose(); }
    this.companions = [];
    if (!charactersReady()) return;
    Object.keys(COMPANIONS).forEach((id) => {
      if (!this.progress.flags.has(`companion_${id}`)) return;
      const c = new Companion(this, id, this.companions.length);
      this.companions.push(c);
      this.scene.add(c.root);
      c.placeNear(this.player);
    });
  }

  /** Un compañero se une al grupo (acción de diálogo { recruit }). */
  recruit(id, npc) {
    const def = COMPANIONS[id];
    if (!def || this.progress.flags.has(`companion_${id}`)) return;
    this.progress.flags.add(`companion_${id}`);
    if (npc) { npc.removed = true; this.zone.collision.remove(npc.collider); }
    this.spawnCompanions();
    const c = this.companions.find((k) => k.id === id);
    if (c && npc) { c.pos.set(npc.x, npc.y, npc.z); c.facing = npc.facing; }
    this.audio.sfx('quest');
    this.ui.toast(`¡${def.name} ${def.title} se une a tu grupo!`);
  }

  addInteractable(it) {
    this.interactables.push(it);
    this.scene.add(it.root);
    return it;
  }

  spawnEnemy(spawn) {
    const e = new Enemy(this, spawn, this.zone.data);
    this.enemies.push(e);
    this.scene.add(e.root);
    return e;
  }

  spawnPickup(item, x, z) {
    return this.addInteractable(new Pickup(this, { item }, x, z));
  }

  usePortal(data) {
    if (!ZONES[data.to]) {
      // zona aún no construida: fin de la fase actual
      if (data.flag && !this.progress.flags.has(data.flag)) {
        this.progress.flags.add(data.flag);
        this.save();
      }
      this.showEnding(data.ending);
      // devolver al jugador un paso atrás para que no se repita
      this.player.pos.z += 4;
      return;
    }
    this.transitioning = true;
    const fade = document.getElementById('fade');
    fade.classList.add('on');
    this.audio.sfx('door');
    setTimeout(() => {
      this.loadZone(data.to, data.spawn);
      this.warmup().finally(() => {
        fade.classList.remove('on');
        this.transitioning = false;
      });
    }, 380);
  }

  showEnding(ending = {}) {
    const pr = this.progress;
    const el = document.getElementById('ending');
    if (ending.title) el.querySelector('h1').textContent = ending.title;
    if (ending.tagline) el.querySelector('.tagline').textContent = ending.tagline;
    if (ending.text) el.querySelector('.tagline + p').innerHTML = ending.text;
    const mins = Math.round(pr.playTime / 60);
    const done = Object.keys(QUESTS).filter((q) => pr.questState(q) === 'done').length;
    const chests = [...pr.flags].filter((f) => f.startsWith('chest_')).length;
    document.getElementById('ending-stats').innerHTML =
      `Tiempo: <b>${mins} min</b> · Misiones: <b>${done}/${Object.keys(QUESTS).length}</b> · Cofres: <b>${chests}</b> · Enemigos: <b>${pr.totalKills}</b>`;
    this.ui.show('ending', true);
    this.setMode('ending');
    this.input.releaseLock();
    this.audio.sfx('quest');
  }

  // ------------------------------------------------------------------ historia y diálogos
  currentObjective() {
    for (const s of STORY) if (!s.until || !this.progress.check(s.until)) return s.text;
    return '';
  }

  /** ¿Tiene el NPC algo nuevo que decir (misión disponible o lista para entregar)? */
  npcHasNews(npc) {
    const pr = this.progress;
    for (const [id, q] of Object.entries(QUESTS)) {
      if (q.target === npc.id && pr.questState(id) === 'active' && (q.type !== 'deliver' || pr.has(q.item))) return true;
    }
    for (const id of npc.data.quests || []) {
      const st = pr.questState(id);
      if (st === 'ready') return true;
      if (st === 'none' && pr.check(QUESTS[id].requires)) return true;
    }
    if (npc.id === 'elder') return !pr.flags.has('met_elder') || (pr.flags.has('dummies_done') && !pr.flags.has('tutorial_done'));
    return false;
  }

  /** Resuelve qué dice un NPC según el estado de misiones y banderas. */
  talkTo(npc) {
    const pr = this.progress;
    const say = (lines, opts = {}) => {
      npc.talking = true;
      this.setMode('dialog');
      // el héroe mira a quien le habla
      this.lookTarget = new THREE.Vector3(npc.root.position.x, npc.root.position.y + 1.4, npc.root.position.z);
      this.ui.openDialog(npc.name, lines, opts);
      this.talkingNpc = npc;
    };

    // 1) es el objetivo de una misión activa
    for (const [id, q] of Object.entries(QUESTS)) {
      if (q.target !== npc.id || pr.questState(id) !== 'active') continue;
      if (q.type === 'talk' && !pr.flags.has(`talked_${id}`)) {
        return say(q.lines.target, { onEnd: () => { pr.flags.add(`talked_${id}`); this.ui.toast(`${q.name}: vuelve a hablar con quien te lo pidió.`); this.audio.sfx('quest'); } });
      }
      if (q.type === 'deliver' && pr.has(q.item)) {
        return say(q.lines.target, { onEnd: () => { pr.take(q.item); this.completeQuest(id); } });
      }
    }
    // 2) misiones que ofrece
    const qs = npc.data.quests || [];
    for (const id of qs) {
      const q = QUESTS[id], st = pr.questState(id);
      if (st === 'ready') return say(q.lines.complete, { onEnd: () => { if (q.consume && q.item) pr.take(q.item, q.count); this.completeQuest(id, npc); } });
      if (st === 'active') return say(q.lines.active);
      if (st === 'none' && pr.check(q.requires)) {
        return say(q.lines.offer, {
          choices: [
            { label: 'Aceptar', fn: () => this.startQuest(id) },
            { label: 'Ahora no', fn: () => {} },
          ],
        });
      }
    }
    // 3) reglas propias del NPC
    const rule = (npc.data.talk || []).find((r) => pr.check(r.when));
    let lines = rule ? rule.lines : ['...'];
    const doneQuest = [...qs].reverse().find((id) => pr.questState(id) === 'done');
    if (doneQuest && (!rule || !rule.when)) lines = QUESTS[doneQuest].lines.done;
    const end = () => {
      if (rule?.do) this.runActions(rule.do, npc);
      if (npc.data.heal) this.healFull(npc);
      if (npc.data.shop) this.ui.openShop(npc);
    };
    return say(lines, { onEnd: end });
  }

  runActions(actions, npc = null) {
    for (const a of actions) {
      if (a.recruit) this.recruit(a.recruit, npc);
      if (a.flag) this.progress.flags.add(a.flag);
      if (a.give) this.giveItem(a.give[0], a.give[1] || 1, { fanfare: true });
      if (a.take) this.progress.take(a.take[0], a.take[1] || 1);
    }
    this.save();
  }

  startQuest(id) {
    const q = QUESTS[id];
    this.progress.startQuest(id);
    this.audio.sfx('quest');
    this.ui.toast(`Nueva misión: ${q.name}`);
    if (q.type === 'deliver') this.giveItem(q.item, 1, { fanfare: true });
    this.save();
  }

  completeQuest(id, npc = null) {
    const q = QUESTS[id];
    this.progress.finishQuest(id);
    if (q.recruit) setTimeout(() => this.recruit(q.recruit, npc), 600); // el que encarga la misión se une al grupo
    this.audio.sfx('quest');
    this.ui.toast(`¡Misión completada: ${q.name}!`);
    q.reward.forEach(([item, n], i) => setTimeout(() => this.giveItem(item, n, { fanfare: true }), 300 + i * 1300));
    this.save();
  }

  healFull(src) {
    const p = this.player;
    if (p.hp < p.maxHp) {
      p.hp = p.maxHp;
      this.audio.sfx('heart');
      this.particles.sparkle(p.x, p.pos.y, p.z, { color: 0xff8fab, count: 40 });
      this.ui.toast('Tus heridas sanan por completo.');
    }
  }

  onDialogClosed() {
    if (this.talkingNpc) { this.talkingNpc.talking = false; this.talkingNpc = null; }
    if (this.mode === 'dialog') this.setMode('play');
  }

  // ------------------------------------------------------------------ objetos
  giveItem(id, qty = 1, { fanfare = false, silent = false } = {}) {
    const it = ITEMS[id];
    if (!it) return;
    const p = this.player, pr = this.progress;
    switch (it.kind) {
      case 'currency': pr.coins += (it.amount || 1) * qty; if (!fanfare) this.audio.sfx('coin'); break;
      case 'instant': p.heal(it.heal * qty); this.audio.sfx('heart'); break;
      case 'upgrade':
        if (id === 'heart_container') { p.maxHp += 2 * qty; p.hp = p.maxHp; }
        if (id === 'stamina_up') { p.maxStamina += 25 * qty; p.stamina = p.maxStamina; }
        // cada mejora de espada suma 1 de daño
        if (id === 'sword_up') { p.swordDamage += 1; pr.flags.add('sword_up'); if (!pr.flags.has('sword_steel')) p.setSwordGlow(true); }
        if (id === 'sword_steel') { p.swordDamage += 1; pr.flags.add('sword_steel'); p.setSwordGlow(true, 0xffe08a); }
        break;
      default:
        pr.add(id, qty);
        if (it.max) pr.items[id] = Math.min(it.max, pr.items[id]);
    }
    if (fanfare && !silent) {
      this.ui.itemGet(id, qty);
      this.player.model.play?.('Cheer', { timeScale: 1.15 }); // el héroe celebra el hallazgo
      this.audio.sfx(it.kind === 'key' || it.kind === 'upgrade' ? 'item' : 'coin');
    }
    // avisar si una misión de recolección quedó lista
    for (const [qid, q] of Object.entries(QUESTS)) {
      if (q.type === 'collect' && q.item === id && pr.questState(qid) === 'ready') this.ui.toast(`${q.name}: ¡ya tienes todo! Vuelve a hablar.`);
    }
  }

  usePotion() {
    const p = this.player, pr = this.progress;
    if (!pr.has('potion')) { this.ui.toast('No tienes pociones.'); return; }
    if (p.hp >= p.maxHp && !(p.poisonT > 0)) { this.ui.toast('Ya tienes la vida completa.'); return; }
    pr.take('potion');
    p.heal(ITEMS.potion.heal);
    p.poisonT = 0; // la poción también cura el veneno
    this.audio.sfx('potion');
    this.particles.sparkle(p.x, p.pos.y, p.z, { color: 0xff6b8a, count: 30 });
  }

  // ------------------------------------------------------------------ combate
  onEnemyKilled(e) {
    const g = this;
    g.audio.sfx('kill');
    g.particles.puff(e.x, e.pos.y + 0.6 + (e.flyY || 0), e.z, { color: 0xffffff, count: 12, size: 2.4 });
    g.particles.burst(e.x, e.pos.y + 1 + (e.flyY || 0), e.z, { count: 20, color: e.def.color, speed: 6, up: 4, life: 0.7 });
    for (const [item, prob] of e.def.drops) {
      if (Math.random() < prob) {
        if (e.def.boss) setTimeout(() => this.giveItem(item, 1, { fanfare: true }), 1500);
        else this.spawnPickup(item, e.x + (Math.random() - 0.5), e.z + (Math.random() - 0.5));
      }
    }
    const ready = this.progress.onKill(e.kind);
    for (const id of ready) { this.audio.sfx('quest'); this.ui.toast(`${QUESTS[id].name}: ¡objetivo cumplido! Vuelve a hablar.`); }
    if (e.spawn.flag) {
      this.progress.flags.add(e.spawn.flag);
      this.ui.toast(`¡Has derrotado al ${e.def.name}!`);
      this.shake(0.8);
      this.particles.sparkle(e.x, e.pos.y, e.z, { count: 80, radius: 3, color: 0xffd34d, life: 2 });
      // los refuerzos invocados huyen
      for (const o of this.enemies) if (o.spawn.summoned && o.alive) o.die();
      this.save();
    }
  }

  onPlayerDeath() {
    this.audio.sfx('death');
    setTimeout(() => {
      this.setMode('dead');
      this.ui.show('gameover', true);
      this.input.releaseLock();
    }, 1400);
  }

  respawn() {
    this.ui.show('gameover', false);
    const p = this.player;
    p.hp = Math.max(6, Math.floor(p.maxHp / 2 / 2) * 2);
    p.stamina = p.maxStamina;
    this.loadZone(this.zone.id, this.lastSpawn);
    this.setMode('play');
  }

  hitstop(t) { this.hitstopT = Math.max(this.hitstopT, t); }
  shake(a) { this.cam.shake(a); }

  // ------------------------------------------------------------------ bucle
  loop() {
    requestAnimationFrame(() => this.loop());
    const now = performance.now();
    let dt = Math.min((now - this.lastFrame) / 1000, 1 / 30);
    this.lastFrame = now;
    if (this.params.has('fixeddt')) dt = 1 / 60;
    this.step(dt);
    if (!this.firstFrameAt) this.firstFrameAt = performance.now();
  }

  step(dt) {
    this.time += dt;
    GLOBAL.time.value = this.time;
    GLOBAL.playerPos.value.copy(this.player.pos);
    const inp = this.input;

    if (this.mode === 'title') {
      // cámara lenta orbitando la aldea
      this.cam.yaw += dt * 0.05;
      this.zone.update(this.time);
      for (const i of this.interactables) i.update(dt);
      this.player.model.animate(dt, { speed: 0 }); // reposo (los modelos con esqueleto necesitan animarse)
      this.cam.update(dt, { mouseDX: 0, mouseDY: 0, wheel: 0 }, this.player, this.zone);
      this.updateLights();
      this.particles.update(dt);
      this.gfx.render();
      inp.endFrame();
      return;
    }

    if ((inp.consume('pause') || inp.consume('menu')) && !(performance.now() - (this.pauseGuard || 0) < 250)) {
      if (this.mode === 'shop') this.ui.closeShop();
      else if (this.mode === 'play' || this.mode === 'pause') this.togglePause('inv');
    }

    if (this.mode === 'dialog') {
      this.ui.updateDialog(dt);
      if (inp.consume('interact') || inp.consume('attack')) this.ui.advanceDialog();
    }

    let simDt = dt;
    if (this.hitstopT > 0) { this.hitstopT -= dt; simDt = dt * 0.05; }
    const playing = this.mode === 'play';
    const simulate = playing || this.mode === 'dialog' || this.mode === 'dead';

    if (simulate) {
      this.progress.playTime += dt;
      if (playing) {
        this.player.update(simDt, inp, this.cam.yaw);
        if (inp.consume('potion')) this.usePotion();
      } else {
        this.player.update(simDt, { moveVector: () => ({ x: 0, y: 0 }), isDown: () => false, consume: () => false }, this.cam.yaw);
      }
      for (const c of this.companions) c.update(simDt);
      this.storm.update(simDt);
      for (const e of this.enemies) e.update(simDt, this.player);
      this.projectiles.update(simDt);
      this.combat.separate();
      this.enemies = this.enemies.filter((e) => {
        if (e.removed) { this.scene.remove(e.root); e.dispose(); return false; }
        return true;
      });
      for (const i of this.interactables) i.update(simDt);
      this.interactables = this.interactables.filter((i) => {
        if (i.removed) { this.scene.remove(i.root); i.dispose(); return false; }
        return true;
      });
      if (playing) this.updateInteraction(inp);
      this.updateExploration();
      this.updateAmbient(dt);
      this.saveTimer += dt;
      if (this.saveTimer > 30) { this.saveTimer = 0; this.save(); }
    }

    // cámara (en pausa se queda quieta)
    if (this.mode !== 'pause') {
      const boss = this.ui.bossTarget && this.ui.bossTarget.alive && this.ui.bossTarget.state !== 'idle' ? this.ui.bossTarget : null;
      const camInput = playing ? inp : { mouseDX: 0, mouseDY: 0, wheel: 0 };
      this.cam.update(dt, camInput, this.player, this.zone, boss && Math.hypot(boss.x - this.player.x, boss.z - this.player.z) < 22 ? boss : null, this.talkingNpc);
    }
    this.zone.update(this.time);
    this.updateLights();
    this.particles.update(simulate ? simDt : dt * 0.2);
    if (this.mode !== 'title') {
      this.ui.updateHUD();
      this.miniT = (this.miniT || 0) + dt;
      if (this.miniT > 0.1) { this.miniT = 0; this.ui.drawMap(this.ui.mapCtx, this.ui.mapCanvas.width); }
    }
    if (!this.noRender) {
      this.gfx.render();
      if (this.mode === 'play') this.gfx.adapt(dt);
    }
    inp.endFrame();
  }

  /** Busca el objeto interactivo más cercano y muestra el aviso. */
  updateInteraction(inp) {
    const p = this.player;
    let best = null, bd = Infinity;
    for (const it of this.interactables) {
      if (!it.visible || !it.prompt) continue;
      const d = Math.hypot(it.x - p.x, it.z - p.z);
      if (d > it.radius) continue;
      // preferir lo que está delante
      const ang = Math.atan2(it.x - p.x, it.z - p.z) - p.facing;
      const score = d + (Math.cos(ang) < 0 ? 1.5 : 0);
      if (score < bd) { bd = score; best = it; }
    }
    this.ui.prompt(best ? best.prompt : null);
    if (best && inp.consume('interact')) best.interact();
    // fuente de las hadas
    const f = this.zone.fountain;
    if (f && Math.hypot(p.x - f.x, p.z - f.z) < f.radius + 3 && p.hp < p.maxHp) {
      p.hp = Math.min(p.maxHp, p.hp + 0.75 * (1 / 60) * 4);
      if (Math.random() < 0.3) this.particles.spawn(p.x + (Math.random() - 0.5), p.pos.y + 0.5, p.z + (Math.random() - 0.5), { vy: 2, color: 0xff8fab, size: 0.6, gravity: -1, life: 0.8 });
      if (p.hp >= p.maxHp) { p.hp = p.maxHp; this.audio.sfx('heart'); }
    }
  }

  /** Niebla de guerra del minimapa: marca casillas vistas alrededor del jugador. */
  updateExploration() {
    const z = this.zone, p = this.player;
    const seen = this.progress.seenTiles(z.id, z.W * z.H);
    const [c0, r0] = z.collision.tileOf(p.x, p.z);
    const R = 5;
    for (let r = r0 - R; r <= r0 + R; r++) for (let c = c0 - R; c <= c0 + R; c++) {
      if (c < 0 || r < 0 || c >= z.W || r >= z.H) continue;
      if ((c - c0) ** 2 + (r - r0) ** 2 <= R * R) seen[r * z.W + c] = 1;
    }
  }

  updateAmbient(dt) {
    if (this.zone.data.ambient === 'snow') {
      const p = this.player;
      for (let i = 0; i < 2; i++) {
        if (Math.random() > dt * 60) continue;
        const a = Math.random() * Math.PI * 2, d = Math.random() * 22;
        this.particles.spawn(p.x + Math.cos(a) * d, p.pos.y + 7 + Math.random() * 4, p.z + Math.sin(a) * d, { color: 0xffffff, size: 0.45 + Math.random() * 0.3, life: 4, gravity: 0.6, vx: 0.6 + Math.random() * 0.4, vz: (Math.random() - 0.5) * 0.5, drag: 0.3 });
      }
    }
    if (this.zone.data.ambient === 'fireflies' && Math.random() < dt * 12) {
      const p = this.player;
      const a = Math.random() * Math.PI * 2, d = 4 + Math.random() * 18;
      const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
      this.particles.spawn(x, this.zone.height(x, z) + 0.5 + Math.random() * 2.5, z, { color: Math.random() < 0.5 ? 0xd8ff8a : 0x9fffd0, size: 0.35, life: 2.5, gravity: -0.05, vx: (Math.random() - 0.5) * 0.6, vz: (Math.random() - 0.5) * 0.6, drag: 0.2 });
    }
  }
}

export { TILE };
