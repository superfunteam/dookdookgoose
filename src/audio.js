const CHAPTERS = ['house', 'woods', 'zoo'];
const EFFECTS = {
  click: { gain: .30, cooldown: .06, limit: 2, age: .6 },
  message: { gain: .42, cooldown: .18, limit: 1, age: 1.8 },
  jump: { gain: .44, cooldown: .10, limit: 2 },
  roll: { gain: .40, cooldown: .22, limit: 1 },
  slide: { gain: .32, cooldown: .15, limit: 1 },
  dook: { gain: .48, cooldown: .22, limit: 1, voice: true },
  hit: { gain: .46, cooldown: .20, limit: 1, priority: 3 },
  coin: { gain: .27, cooldown: .075, limit: 2, age: .35, variation: .04 },
  heart: { gain: .40, cooldown: .20, limit: 1, priority: 2 },
  bounce: { gain: .45, cooldown: .20, limit: 1, priority: 2 },
  gate: { gain: .38, cooldown: .24, limit: 1 },
  window: { gain: .42, cooldown: .40, limit: 1, priority: 2 },
  win: { gain: .52, cooldown: .80, limit: 1, priority: 4, duck: true, age: 2 },
  fail: { gain: .45, cooldown: .80, limit: 1, priority: 4, duck: true, age: 2 },
  goose: { gain: .45, cooldown: .25, limit: 1, voice: true },
  land: { gain: .29, cooldown: .10, limit: 2, variation: .035 },
  ready: { gain: .44, cooldown: .45, limit: 1, priority: 3, age: 1.5 },
  paws: { gain: .15, cooldown: .18, limit: 2, age: .25, variation: .07 },
};
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

function sceneFor(mode, chapter) {
  if (mode === 'playing' || CHAPTERS.includes(mode)) return { music: CHAPTERS.includes(mode) ? mode : chapter, ambience: CHAPTERS.includes(mode) ? mode : chapter, score: .75, environment: .45 };
  if (mode === 'failed') return { music: 'setback', ambience: chapter, score: .44, environment: .25 };
  if (mode === 'ending' || mode === 'credits') return { music: 'ending', ambience: 'zoo', score: .68, environment: .38 };
  if (['story', 'briefing', 'result'].includes(mode)) return { music: 'story', ambience: chapter, score: .42, environment: .28 };
  return { music: 'title', ambience: 'woods', score: .70, environment: .32 };
}

/** Generated local audio only. AudioContext is created by the first user gesture. */
export class Sound {
  constructor() {
    this._enabled = true; this._music = true; this._volume = .75;
    this.ctx = null; this.master = null; this._unlocked = false; this._disposed = false; this._blocked = true;
    this._mode = 'title'; this._level = 'house'; this._scene = sceneFor(this._mode, this._level);
    this._focused = document.hasFocus(); this._foreground = !document.hidden && this._focused;
    this._buffers = new Map(); this._loading = new Map(); this._failedUntil = new Map(); this._lastEffect = new Map();
    this._targets = new WeakMap(); this._requests = new Set(); this._pendingEffects = new Set(); this._effects = new Set(); this._loops = new Set();
    this._wanted = { music: { key: null, version: 0 }, ambience: { key: null, version: 0 } };
    this._used = 0; this._serial = 0; this._silenceEpoch = 0; this._voiceEpoch = 0;
    this._played = {}; this._errors = []; this._dropped = 0; this._warmed = false;
    this._visibility = () => { this._foreground = !document.hidden && this._focused; this._sync(); };
    this._blur = () => { this._focused = false; this._visibility(); };
    this._focus = () => { this._focused = true; this._visibility(); };
    document.addEventListener('visibilitychange', this._visibility);
    window.addEventListener('blur', this._blur); window.addEventListener('focus', this._focus);
  }

  get enabled() { return this._enabled; }
  set enabled(value) { this._enabled = !!value; this._sync(); }
  get music() { return this._music; }
  set music(value) { this._music = !!value; this._sync(); }
  get volume() { return this._volume; }
  set volume(value) { if (Number.isFinite(value)) this._volume = clamp(value, 0, 1); this._sync(); }

  start() {
    if (this._disposed || !this._foreground) return Promise.resolve(false);
    if (!this.ctx) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return Promise.resolve(false);
      try {
        this.ctx = new Audio(); this.master = this.ctx.createGain(); this.master.gain.value = 0; this.master.connect(this.ctx.destination);
        for (const name of ['music', 'ambience', 'effects', 'voice']) {
          this[`_${name}Bus`] = this.ctx.createGain(); this[`_${name}Bus`].connect(this.master);
        }
      } catch { this._error('audio-context'); return Promise.resolve(false); }
    }
    this._unlocked = true; this._sync();
    if (this._enabled && !this._warmed) {
      this._warmed = true;
      // Only short cues are prewarmed; chapter scores are decoded on demand.
      for (const kind of Object.keys(EFFECTS)) void this._load(`sfx/${kind}`);
    }
    return this._resumePromise || Promise.resolve(this.ctx.state === 'running');
  }

  tick(mode, level) {
    if (typeof mode === 'object' && mode) { level = mode.level; mode = mode.mode; }
    if (typeof level === 'object' && level) level = level.id;
    if (Number.isInteger(level)) level = CHAPTERS[level];
    if (CHAPTERS.includes(level)) this._level = level;
    if (typeof mode === 'string') this._mode = mode;
    if (this._mode !== 'paused') this._scene = sceneFor(this._mode, this._level);
    this._sync();
  }
  setScene(mode, level) { this.tick(mode, level); }
  voice(kind) { this.cancelVoice(); return this.effect(kind, { voice: true }); }
  cancelVoice() {
    this._voiceEpoch++;
    for (const request of this._pendingEffects) if (request.voice) this._pendingEffects.delete(request);
    for (const effect of this._effects) if (effect.voice) this._stopEffect(effect, .035);
    this._duck();
  }

  async effect(kind, options = {}) {
    const config = EFFECTS[kind];
    if (!config || !this._enabled || !this._foreground || this._mode === 'paused' || this._disposed) return false;
    const started = this.start(), now = performance.now() / 1000;
    const active = [...this._effects, ...this._pendingEffects].filter(item => item.kind === kind).length;
    if (now - (this._lastEffect.get(kind) ?? -Infinity) < config.cooldown || active >= config.limit || this._pendingEffects.size >= 8) { this._dropped++; return false; }
    this._lastEffect.set(kind, now);
    const voice = options.voice === true || config.voice === true;
    const request = { kind, voice }, silenceEpoch = this._silenceEpoch, voiceEpoch = this._voiceEpoch;
    this._pendingEffects.add(request);
    try {
      const [buffer] = await Promise.all([this._load(`sfx/${kind}`), started]);
      if (!buffer || !this._canPlay() || this.ctx.state !== 'running' || silenceEpoch !== this._silenceEpoch || (voice && voiceEpoch !== this._voiceEpoch) || performance.now() / 1000 - now > (config.age ?? 1.1)) return false;
      if (this._effects.size >= 8) {
        const oldest = [...this._effects].sort((a, b) => a.priority - b.priority || a.serial - b.serial)[0];
        if ((config.priority || 0) < oldest.priority) { this._dropped++; return false; }
        this._stopEffect(oldest, .015);
      }
      const source = this.ctx.createBufferSource(), gain = this.ctx.createGain();
      source.buffer = buffer;
      source.playbackRate.value = Number.isFinite(options.rate) ? clamp(options.rate, .7, 1.4) : 1 + Math.sin(++this._serial * 2.4) * (config.variation || 0);
      gain.gain.value = 0; source.connect(gain); gain.connect(voice ? this._voiceBus : this._effectsBus);
      const item = { kind, source, gain, voice, duck: voice || !!config.duck, priority: config.priority || 0, serial: ++this._serial };
      this._effects.add(item);
      source.onended = () => { this._effects.delete(item); source.disconnect(); gain.disconnect(); this._duck(); };
      this._ramp(gain.gain, config.gain * (Number.isFinite(options.volume) ? clamp(options.volume, 0, 2) : 1), .008);
      source.start(); this._played[kind] = (this._played[kind] || 0) + 1; this._duck(); return true;
    } catch { return false; }
    finally { this._pendingEffects.delete(request); }
  }

  _canPlay() { return !this._disposed && this._unlocked && this._enabled && this._foreground && this._mode !== 'paused'; }
  _sync() {
    if (!this.ctx || this._disposed) return;
    if (!this._canPlay()) {
      if (!this._blocked) {
        this._blocked = true; this._silenceEpoch++;
        for (const item of this._effects) this._stopEffect(item, this._foreground ? .025 : 0);
        this._pendingEffects.clear(); this._ramp(this.master.gain, 0, this._foreground ? .035 : 0);
      }
      if (!this._suspendTimer && this.ctx.state !== 'suspended') this._suspendTimer = setTimeout(() => {
        this._suspendTimer = null;
        if (!this._canPlay() && this.ctx.state !== 'closed') void this.ctx.suspend().catch(() => {});
      }, this._foreground ? 45 : 0);
      return;
    }
    clearTimeout(this._suspendTimer); this._suspendTimer = null;
    if (this.ctx.state !== 'running' && !this._resumePromise) {
      this._resumePromise = this.ctx.resume().then(() => this.ctx.state === 'running').catch(() => false).finally(() => { this._resumePromise = null; });
    }
    this._blocked = false; this._ramp(this.master.gain, this._volume, .10);
    this._setLoop('music', this._music ? `music/${this._scene.music}` : null, this._scene.score);
    this._setLoop('ambience', `ambience/${this._scene.ambience}`, this._scene.environment);
    this._duck();
  }
  _ramp(param, target, seconds, force = false) {
    if (!this.ctx || (!force && this._targets.get(param) === target)) return;
    this._targets.set(param, target); const now = this.ctx.currentTime;
    if (typeof param.cancelAndHoldAtTime === 'function') param.cancelAndHoldAtTime(now);
    else { const current = param.value; param.cancelScheduledValues(now); param.setValueAtTime(current, now); }
    if (seconds > 0) param.linearRampToValueAtTime(target, now + seconds); else param.setValueAtTime(target, now);
  }
  _duck() {
    if (this._musicBus && !this._disposed) this._ramp(this._musicBus.gain, [...this._effects].some(item => item.duck) ? .46 : 1, .18);
  }
  _stopEffect(item, fade) {
    this._effects.delete(item); this._ramp(item.gain.gain, 0, fade, true);
    try { item.source.stop(this.ctx.currentTime + fade); } catch { /* Already ended. */ }
    this._duck();
  }

  _setLoop(channel, key, volume) {
    const wanted = this._wanted[channel];
    if (wanted.key !== key) { wanted.key = key; wanted.version++; wanted.pending = false; }
    const current = [...this._loops].find(loop => loop.channel === channel && loop.key === key && !loop.retiring);
    if (current) { this._ramp(current.gain.gain, volume, .35); return; }
    if (!key) { for (const loop of this._loops) if (loop.channel === channel) this._retireLoop(loop, .18); return; }
    if (wanted.pending) return;
    if ((this._failedUntil.get(key) || 0) > Date.now()) {
      for (const loop of this._loops) if (loop.channel === channel) this._retireLoop(loop, .25);
      return;
    }
    wanted.pending = true; const version = wanted.version;
    void this._load(key).then(buffer => {
      if (version !== wanted.version) return;
      wanted.pending = false;
      if (!this._canPlay() || wanted.key !== key || (channel === 'music' && !this._music)) return;
      if (!buffer) { for (const loop of this._loops) if (loop.channel === channel) this._retireLoop(loop, .25); return; }
      const source = this.ctx.createBufferSource(), gain = this.ctx.createGain();
      source.buffer = buffer; source.loop = true; gain.gain.value = 0;
      source.connect(gain); gain.connect(this[`_${channel}Bus`]);
      const loop = { key, channel, source, gain, started: this.ctx.currentTime, duration: buffer.duration, retiring: false, serial: ++this._serial };
      for (const previous of this._loops) if (previous.channel === channel) this._retireLoop(previous, .8);
      this._loops.add(loop);
      source.onended = () => { this._loops.delete(loop); source.disconnect(); gain.disconnect(); };
      source.start(); this._ramp(gain.gain, volume, .8); this._played[key] = (this._played[key] || 0) + 1;
      const retiring = [...this._loops].filter(item => item.channel === channel && item.retiring).sort((a, b) => a.serial - b.serial);
      for (const previous of retiring.slice(0, -1)) this._retireLoop(previous, .025, true);
    }).catch(() => { if (version === wanted.version) wanted.pending = false; });
  }
  _retireLoop(loop, fade, force = false) {
    if (loop.retiring && !force) return;
    loop.retiring = true; this._ramp(loop.gain.gain, 0, fade, force);
    try { loop.source.stop(this.ctx.currentTime + fade); } catch { /* Already ended. */ }
  }

  async _load(key) {
    const cached = this._buffers.get(key);
    if (cached) { cached.used = ++this._used; return cached.buffer; }
    if (this._loading.has(key)) return this._loading.get(key);
    if (!this.ctx || this._disposed || (this._failedUntil.get(key) || 0) > Date.now()) return null;
    const controller = new AbortController(); this._requests.add(controller);
    const timeout = setTimeout(() => controller.abort(), 12000);
    const pending = (async () => {
      try {
        const response = await fetch(`/audio/${key}.mp3`, { signal: controller.signal });
        if (!response.ok) throw new Error('Missing audio');
        const bytes = await response.arrayBuffer();
        if (this._disposed) return null;
        const buffer = await this.ctx.decodeAudioData(bytes);
        if (this._disposed) return null;
        this._buffers.set(key, { buffer, used: ++this._used }); this._trimBuffers(); return buffer;
      } catch {
        if (!this._disposed) { this._failedUntil.set(key, Date.now() + 60000); this._error(key); }
        return null;
      } finally { clearTimeout(timeout); this._requests.delete(controller); this._loading.delete(key); }
    })();
    this._loading.set(key, pending); return pending;
  }
  _trimBuffers() {
    // Sources retain their own buffers during crossfades; the cache retains only recent chapters.
    for (const [prefix, limit] of [['music/', 2], ['ambience/', 1]]) {
      const entries = [...this._buffers].filter(([key]) => key.startsWith(prefix)).sort((a, b) => b[1].used - a[1].used);
      for (const [key] of entries.slice(limit)) this._buffers.delete(key);
    }
  }
  _error(key) { if (!this._errors.includes(key)) { this._errors.push(key); if (this._errors.length > 12) this._errors.shift(); } }

  snapshot() {
    const audible = this._canPlay() && this.ctx?.state === 'running' && this._volume > 0;
    const current = [...this._loops].find(loop => loop.channel === 'music' && !loop.retiring && loop.key === this._wanted.music.key);
    const decoded = { music: 0, ambience: 0, sfx: 0, bytes: 0 };
    for (const [key, { buffer }] of this._buffers) { decoded[key.split('/')[0]]++; decoded.bytes += buffer.length * buffer.numberOfChannels * 4; }
    return Object.freeze({
      enabled: this._enabled, music: this._music, volume: this._volume, unlocked: this._unlocked, foreground: this._foreground,
      mode: this._mode, level: this._level, context: this.ctx?.state || 'locked', audible,
      desiredMusic: this._music ? this._scene.music : null, currentMusic: current?.key.split('/')[1] || null,
      playingMusic: audible && this._music ? current?.key.split('/')[1] || null : null, ambience: this._scene.ambience,
      musicPosition: current ? (this.ctx.currentTime - current.started) % current.duration : 0,
      activeEffects: this._effects.size, pendingEffects: this._pendingEffects.size,
      effectKinds: Object.freeze([...this._effects].map(item => item.kind)), voiceCount: [...this._effects].filter(item => item.voice).length,
      musicDucked: [...this._effects].some(item => item.duck), dropped: this._dropped,
      loops: Object.freeze([...this._loops].map(({ key, retiring }) => Object.freeze({ key, retiring }))),
      decoded: Object.freeze(decoded), played: Object.freeze({ ...this._played }), errors: Object.freeze([...this._errors]),
    });
  }
  dispose() {
    this._disposed = true; clearTimeout(this._suspendTimer);
    document.removeEventListener('visibilitychange', this._visibility); window.removeEventListener('blur', this._blur); window.removeEventListener('focus', this._focus);
    for (const request of this._requests) request.abort();
    for (const item of this._effects) this._stopEffect(item, 0);
    for (const loop of this._loops) { try { loop.source.stop(); } catch { /* Already stopped. */ } }
    this._loops.clear(); this._buffers.clear(); this._pendingEffects.clear();
    if (this.ctx && this.ctx.state !== 'closed') void this.ctx.close().catch(() => {});
  }
}
