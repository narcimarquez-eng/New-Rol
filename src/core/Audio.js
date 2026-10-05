// Audio 100% procedural con WebAudio: efectos sintetizados y música generativa
// por zona (cada zona define escala, tempo y timbre en sus datos).

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.music = null;
    this.muted = false;
  }

  /** Debe llamarse tras un gesto del usuario (política de autoplay). */
  unlock() {
    if (this.ctx) { this.ctx.resume?.(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.7;
    this.master.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.6;
    this.sfxGain.connect(this.master);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.18;
    this.musicGain.connect(this.master);
    this.noiseBuf = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    if (this.pendingMusic) this.playMusic(this.pendingMusic);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.7;
    return this.muted;
  }

  tone(freq, dur, { type = 'square', vol = 0.3, slide = 0, delay = 0, attack = 0.005, dest } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.sfxGain);
    o.start(t); o.stop(t + dur + 0.05);
  }

  noise(dur, { vol = 0.3, freq = 1200, q = 1, delay = 0, type = 'bandpass', sweep = 0 } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq + sweep), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.sfxGain);
    s.start(t); s.stop(t + dur + 0.05);
  }

  /** Catálogo de efectos de sonido. */
  sfx(name) {
    if (!this.ctx) return;
    switch (name) {
      case 'swing': this.noise(0.18, { vol: 0.25, freq: 900, sweep: 2500, q: 2 }); break;
      case 'hit': this.tone(180, 0.12, { type: 'square', vol: 0.25, slide: -120 }); this.noise(0.1, { vol: 0.3, freq: 2000 }); break;
      case 'kill': this.tone(400, 0.25, { type: 'triangle', vol: 0.25, slide: -350 }); this.noise(0.3, { vol: 0.2, freq: 600, sweep: -400 }); break;
      case 'block': this.tone(900, 0.08, { type: 'square', vol: 0.15 }); this.tone(1300, 0.1, { type: 'triangle', vol: 0.15, delay: 0.02 }); break;
      case 'hurt': this.tone(220, 0.25, { type: 'sawtooth', vol: 0.22, slide: -150 }); break;
      case 'dodge': this.noise(0.22, { vol: 0.18, freq: 400, sweep: 800, q: 0.7 }); break;
      case 'coin': this.tone(NOTE(88), 0.08, { type: 'square', vol: 0.12 }); this.tone(NOTE(93), 0.2, { type: 'square', vol: 0.12, delay: 0.07 }); break;
      case 'heart': [72, 76, 79].forEach((n, i) => this.tone(NOTE(n), 0.15, { type: 'triangle', vol: 0.2, delay: i * 0.06 })); break;
      case 'item': [67, 71, 74, 79].forEach((n, i) => this.tone(NOTE(n), 0.25, { type: 'triangle', vol: 0.2, delay: i * 0.09 })); break;
      case 'chest': [60, 64, 67, 72, 76].forEach((n, i) => this.tone(NOTE(n), 0.35, { type: 'triangle', vol: 0.2, delay: i * 0.12 })); break;
      case 'secret': [79, 78, 75, 69, 68, 76, 80, 84].forEach((n, i) => this.tone(NOTE(n), 0.18, { type: 'square', vol: 0.09, delay: i * 0.1 })); break;
      case 'door': this.noise(0.6, { vol: 0.3, freq: 200, sweep: -100, type: 'lowpass' }); this.tone(90, 0.5, { type: 'sawtooth', vol: 0.1, slide: -30 }); break;
      case 'locked': this.tone(150, 0.12, { type: 'square', vol: 0.15 }); this.tone(130, 0.15, { type: 'square', vol: 0.15, delay: 0.12 }); break;
      case 'talk': this.tone(NOTE(72 + Math.floor(Math.random() * 5)), 0.04, { type: 'square', vol: 0.05 }); break;
      case 'select': this.tone(NOTE(84), 0.06, { type: 'square', vol: 0.1 }); break;
      case 'quest': [72, 76, 79, 84, 79, 84].forEach((n, i) => this.tone(NOTE(n), 0.22, { type: 'triangle', vol: 0.18, delay: i * 0.1 })); break;
      case 'potion': [60, 67, 72, 79].forEach((n, i) => this.tone(NOTE(n), 0.2, { type: 'sine', vol: 0.25, delay: i * 0.07 })); break;
      case 'bush': this.noise(0.25, { vol: 0.25, freq: 3000, q: 0.5, sweep: -2000 }); break;
      case 'enemyAtk': this.tone(300, 0.15, { type: 'sawtooth', vol: 0.1, slide: 200 }); break;
      case 'hop': this.tone(200, 0.1, { type: 'sine', vol: 0.12, slide: 200 }); break;
      case 'death': [67, 63, 60, 55].forEach((n, i) => this.tone(NOTE(n), 0.4, { type: 'triangle', vol: 0.2, delay: i * 0.25 })); break;
      case 'boss': [43, 46, 43, 49].forEach((n, i) => this.tone(NOTE(n), 0.35, { type: 'sawtooth', vol: 0.15, delay: i * 0.3 })); break;
      case 'stamina': this.tone(140, 0.1, { type: 'square', vol: 0.06 }); break;
      default: break;
    }
  }

  /**
   * Música generativa: arpegios sobre una progresión según los datos de la zona.
   * @param {{root:number, scale:number[], tempo:number, prog:number[], lead:string, pad:string}} cfg
   */
  playMusic(cfg) {
    this.pendingMusic = cfg;
    if (!this.ctx) return;
    if (this.music) { clearInterval(this.music.timer); this.music = null; }
    if (!cfg) return;
    const beat = 60 / cfg.tempo / 2; // corcheas
    let step = 0;
    const scaleNote = (deg) => {
      const s = cfg.scale, oct = Math.floor(deg / s.length);
      return cfg.root + s[((deg % s.length) + s.length) % s.length] + 12 * oct;
    };
    const melodyPattern = [0, 2, 4, 2, 5, 4, 2, 1, 0, 2, 4, 6, 4, 2, 3, 1];
    let nextTime = this.ctx.currentTime + 0.1;
    const tick = () => {
      if (!this.ctx) return;
      while (nextTime < this.ctx.currentTime + 0.3) {
        const bar = Math.floor(step / 8) % cfg.prog.length;
        const chord = cfg.prog[bar];
        const d = nextTime - this.ctx.currentTime;
        if (step % 8 === 0) {
          // bajo + acorde (pad)
          this.tone(NOTE(scaleNote(chord) - 12), beat * 7, { type: 'triangle', vol: 0.35, delay: d, attack: 0.05, dest: this.musicGain });
          [0, 2, 4].forEach((o) => this.tone(NOTE(scaleNote(chord + o)), beat * 7.5, { type: cfg.pad || 'sine', vol: 0.12, delay: d, attack: 0.3, dest: this.musicGain }));
        }
        // arpegio
        const arp = [0, 2, 4, 7][step % 4];
        this.tone(NOTE(scaleNote(chord + arp) + 12), beat * 0.9, { type: 'triangle', vol: 0.09, delay: d, dest: this.musicGain });
        // melodía ocasional
        if (step % 2 === 0 && ((step * 7 + bar * 3) % 5) < 3) {
          const m = melodyPattern[(step / 2 + bar * 3) % melodyPattern.length];
          this.tone(NOTE(scaleNote(chord + m) + 12), beat * 1.8, { type: cfg.lead || 'square', vol: 0.05, delay: d, attack: 0.02, dest: this.musicGain });
        }
        nextTime += beat; step++;
      }
    };
    this.music = { timer: setInterval(tick, 80) };
    tick();
  }

  stopMusic() {
    this.pendingMusic = null;
    if (this.music) { clearInterval(this.music.timer); this.music = null; }
  }
}
