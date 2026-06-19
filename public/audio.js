/* ============================================================
   PokeDungeon — audio engine (Web Audio synth, no asset files)
   Exposes window.Sound: SFX + a looping chiptune, with settings
   persisted to localStorage. Must be created after a user gesture
   (call Sound.unlock() on the first tap/keypress).
   ============================================================ */
(function () {
  let ac = null, master, musicGain, sfxGain;
  const s = { music: true, sfx: true, musicVol: 0.45, sfxVol: 0.6 };
  try { const j = JSON.parse(localStorage.getItem("pokedungeon_audio")); if (j) Object.assign(s, j); } catch (e) {}
  function persist() { try { localStorage.setItem("pokedungeon_audio", JSON.stringify(s)); } catch (e) {} }

  function ensure() {
    if (ac) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain(); master.gain.value = 0.9; master.connect(ac.destination);
    musicGain = ac.createGain(); musicGain.gain.value = s.music ? s.musicVol : 0; musicGain.connect(master);
    sfxGain = ac.createGain(); sfxGain.gain.value = s.sfx ? s.sfxVol : 0; sfxGain.connect(master);
  }
  function resume() { if (ac && ac.state === "suspended") ac.resume(); }

  /* ---- SFX ---- (audibility controlled by sfxGain; 0 when disabled) */
  function blip(freq, dur, type, gain, slideTo) {
    if (!ac) return;
    const t0 = ac.currentTime;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type || "square"; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain || 0.3, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(sfxGain); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function seq(notes, type, gain, step) { notes.forEach((f, i) => setTimeout(() => blip(f, step * 1.4, type, gain), i * step * 1000)); }

  const sfx = {
    throw() { blip(420, 0.16, "square", 0.25, 150); },
    catch() { seq([523, 659, 784, 1046], "square", 0.26, 0.08); },
    fail() { blip(240, 0.28, "sawtooth", 0.22, 90); },
    chest() { seq([784, 988, 1318], "triangle", 0.26, 0.06); },
    bomb() {
      if (!ac) return;
      const t0 = ac.currentTime, len = Math.floor(ac.sampleRate * 0.55);
      const buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
      const b = ac.createBufferSource(); b.buffer = buf;
      const f = ac.createBiquadFilter(); f.type = "lowpass";
      f.frequency.setValueAtTime(1200, t0); f.frequency.exponentialRampToValueAtTime(120, t0 + 0.5);
      const g = ac.createGain(); g.gain.setValueAtTime(0.6, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.55);
      b.connect(f); f.connect(g); g.connect(sfxGain); b.start(t0);
      blip(80, 0.5, "sawtooth", 0.4, 38);
    },
    click() { blip(620, 0.05, "square", 0.18); },
    win() { seq([523, 659, 784, 1046, 784, 1046, 1318], "square", 0.28, 0.12); },
  };

  /* ---- music: a small looping chiptune (lead + bass) ---- */
  const F = {
    A2: 110.0, C3: 130.81, E3: 164.81, F3: 174.61, G3: 196.0,
    C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88,
    C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99,
  };
  const LEAD = ["A4", 0, "C5", "E5", 0, "D5", "C5", 0, "A4", 0, "E5", 0, "D5", "C5", "B4", 0,
    "C5", 0, "E5", "G5", 0, "F5", "E5", 0, "D5", 0, "B4", 0, "C5", "D5", "E5", 0];
  const BASS = ["A2", 0, 0, 0, "F3", 0, 0, 0, "C3", 0, 0, 0, "G3", 0, 0, 0,
    "A2", 0, 0, 0, "F3", 0, 0, 0, "C3", 0, 0, 0, "G3", 0, "G3", 0];
  let playing = false, step = 0, nextT = 0, timer = null;
  const BPM = 104, stepDur = 60 / BPM / 2;

  function noteAt(name, time, dur, type, gain) {
    const freq = F[name]; if (!freq) return;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(gain, time + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    o.connect(g); g.connect(musicGain); o.start(time); o.stop(time + dur + 0.03);
  }
  function scheduler() {
    if (!playing || !ac) return;
    while (nextT < ac.currentTime + 0.25) {
      noteAt(LEAD[step % LEAD.length], nextT, stepDur * 0.9, "square", 0.16);
      noteAt(BASS[step % BASS.length], nextT, stepDur * 1.6, "triangle", 0.2);
      nextT += stepDur; step++;
    }
    timer = setTimeout(scheduler, 60);
  }
  function startMusic() { ensure(); if (!ac || playing) return; playing = true; step = 0; nextT = ac.currentTime + 0.1; scheduler(); }
  function stopMusic() { playing = false; if (timer) { clearTimeout(timer); timer = null; } }

  window.Sound = {
    unlock() { ensure(); resume(); if (s.music) startMusic(); },
    sfx,
    setMusic(on) { s.music = on; persist(); if (ac) { if (on) { musicGain.gain.value = s.musicVol; startMusic(); } else { stopMusic(); musicGain.gain.value = 0; } } },
    setSfx(on) { s.sfx = on; persist(); if (ac) sfxGain.gain.value = on ? s.sfxVol : 0; },
    setMusicVol(v) { s.musicVol = v; persist(); if (ac && s.music) musicGain.gain.value = v; },
    setSfxVol(v) { s.sfxVol = v; persist(); if (ac && s.sfx) sfxGain.gain.value = v; },
    get() { return Object.assign({}, s); },
  };
})();
