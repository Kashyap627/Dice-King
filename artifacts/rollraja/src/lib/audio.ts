let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
  }
  if (ctx.state === 'suspended') {
    ctx.resume();
  }
  return ctx;
}

function masterGain(ac: AudioContext, vol: number) {
  const g = ac.createGain();
  g.gain.value = vol;
  g.connect(ac.destination);
  return g;
}

export function playDiceRattle() {
  try {
    const ac = getCtx();
    const g = masterGain(ac, 0.3);
    const bufSize = ac.sampleRate * 0.5;
    const buf = ac.createBuffer(1, bufSize, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      const env = Math.exp(-i / (ac.sampleRate * 0.1));
      data[i] = (Math.random() * 2 - 1) * env;
    }
    // clicks
    for (let c = 0; c < 8; c++) {
      const pos = Math.floor(Math.random() * bufSize * 0.8);
      for (let j = 0; j < 200; j++) {
        if (pos + j < bufSize) {
          const e = Math.exp(-j / 40);
          data[pos + j] += (Math.random() * 2 - 1) * e * 0.6;
        }
      }
    }
    const src = ac.createBufferSource();
    src.buffer = buf;
    const filt = ac.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = 2000;
    filt.Q.value = 2;
    src.connect(filt);
    filt.connect(g);
    src.start();
  } catch (_) {}
}

export function playWinChime() {
  try {
    const ac = getCtx();
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((freq, i) => {
      const g = masterGain(ac, 0.15);
      const osc = ac.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const env = ac.createGain();
      env.gain.setValueAtTime(0, ac.currentTime + i * 0.1);
      env.gain.linearRampToValueAtTime(0.8, ac.currentTime + i * 0.1 + 0.05);
      env.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + i * 0.1 + 1.2);
      osc.connect(env);
      env.connect(g);
      osc.start(ac.currentTime + i * 0.1);
      osc.stop(ac.currentTime + i * 0.1 + 1.5);
    });
  } catch (_) {}
}

export function playLossTone() {
  try {
    const ac = getCtx();
    const freqs = [220, 196, 174.61];
    freqs.forEach((freq, i) => {
      const g = masterGain(ac, 0.12);
      const osc = ac.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      const env = ac.createGain();
      env.gain.setValueAtTime(0.5, ac.currentTime + i * 0.2);
      env.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + i * 0.2 + 0.8);
      const filt = ac.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 600;
      osc.connect(filt);
      filt.connect(env);
      env.connect(g);
      osc.start(ac.currentTime + i * 0.2);
      osc.stop(ac.currentTime + i * 0.2 + 1.0);
    });
  } catch (_) {}
}

export function playChipStack() {
  try {
    const ac = getCtx();
    for (let c = 0; c < 5; c++) {
      const g = masterGain(ac, 0.08);
      const t = ac.currentTime + c * 0.08;
      const osc = ac.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(1200 + Math.random() * 400, t);
      osc.frequency.exponentialRampToValueAtTime(300, t + 0.05);
      const env = ac.createGain();
      env.gain.setValueAtTime(0.6, t);
      env.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      const filt = ac.createBiquadFilter();
      filt.type = 'highpass';
      filt.frequency.value = 500;
      osc.connect(filt);
      filt.connect(env);
      env.connect(g);
      osc.start(t);
      osc.stop(t + 0.1);
    }
  } catch (_) {}
}

export function playCountdownTick() {
  try {
    const ac = getCtx();
    const g = masterGain(ac, 0.15);
    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 880;
    const env = ac.createGain();
    env.gain.setValueAtTime(0.6, ac.currentTime);
    env.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.12);
    osc.connect(env);
    env.connect(g);
    osc.start();
    osc.stop(ac.currentTime + 0.15);
  } catch (_) {}
}

export function playNoDouble() {
  try {
    const ac = getCtx();
    const g = masterGain(ac, 0.1);
    const osc = ac.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 440;
    osc.frequency.setValueAtTime(440, ac.currentTime);
    osc.frequency.linearRampToValueAtTime(380, ac.currentTime + 0.3);
    const env = ac.createGain();
    env.gain.setValueAtTime(0.5, ac.currentTime);
    env.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.5);
    osc.connect(env);
    env.connect(g);
    osc.start();
    osc.stop(ac.currentTime + 0.6);
  } catch (_) {}
}

export function playBetPlaced() {
  try {
    const ac = getCtx();
    const g = masterGain(ac, 0.12);
    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 660;
    const env = ac.createGain();
    env.gain.setValueAtTime(0.5, ac.currentTime);
    env.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.15);
    osc.connect(env);
    env.connect(g);
    osc.start();
    osc.stop(ac.currentTime + 0.2);
  } catch (_) {}
}
