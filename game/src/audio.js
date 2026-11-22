// Every sound is synthesised with the Web Audio API: no audio files, no network.
// The context starts on the first key or click the browser accepts.

export function createAudio() {
  let ctx = null;
  let master = null;
  let ambientGain = null;
  let ambientOsc = null;
  let muted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return null;
    ctx = new AudioCtor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.55;
    master.connect(ctx.destination);
    return ctx;
  }

  function tone({ freq = 440, to = freq, type = 'sine', gain = 0.2, attack = 0.005, release = 0.2, delay = 0, detune = 0 }) {
    const ac = ensure();
    if (!ac) return;
    const at = ac.currentTime + delay;
    const osc = ac.createOscillator();
    const env = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), at + attack + release);
    osc.detune.value = detune;
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(gain, at + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, at + attack + release);
    osc.connect(env);
    env.connect(master);
    osc.start(at);
    osc.stop(at + attack + release + 0.05);
  }

  function noise({ duration = 0.12, gain = 0.12, lowpass = 900 }) {
    const ac = ensure();
    if (!ac) return;
    const frames = Math.max(1, Math.floor(ac.sampleRate * duration));
    const buffer = ac.createBuffer(1, frames, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    }
    const src = ac.createBufferSource();
    const filter = ac.createBiquadFilter();
    const env = ac.createGain();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    env.gain.value = gain;
    src.buffer = buffer;
    src.connect(filter);
    filter.connect(env);
    env.connect(master);
    src.start();
  }

  function startAmbient() {
    const ac = ensure();
    if (!ac || ambientOsc) return;
    ambientGain = ac.createGain();
    ambientGain.gain.value = 0.035;
    ambientGain.connect(master);
    ambientOsc = ac.createOscillator();
    ambientOsc.type = 'sawtooth';
    ambientOsc.frequency.value = 55;
    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 180;
    ambientOsc.connect(filter);
    filter.connect(ambientGain);
    ambientOsc.start();
  }

  return {
    ensure() {
      ensure();
      startAmbient();
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.55;
    },
    isMuted() {
      return muted;
    },
    footstep(running) {
      noise({ duration: running ? 0.09 : 0.06, gain: running ? 0.1 : 0.045, lowpass: running ? 1300 : 700 });
    },
    alarmPulse(intensity) {
      tone({ freq: 660, to: 520, type: 'square', gain: 0.035 + intensity * 0.03, release: 0.16 });
    },
    spotted() {
      tone({ freq: 880, to: 1320, type: 'sawtooth', gain: 0.08, release: 0.18 });
      tone({ freq: 1320, to: 990, type: 'square', gain: 0.04, release: 0.22, delay: 0.08 });
    },
    smoke() {
      noise({ duration: 0.5, gain: 0.2, lowpass: 1600 });
    },
    emp() {
      tone({ freq: 1200, to: 90, type: 'sine', gain: 0.16, release: 0.5 });
      noise({ duration: 0.3, gain: 0.12, lowpass: 2200 });
    },
    decoy() {
      tone({ freq: 1760, to: 1760, type: 'triangle', gain: 0.05, release: 0.08 });
      tone({ freq: 1760, to: 1480, type: 'triangle', gain: 0.04, release: 0.18, delay: 0.14 });
    },
    pickup() {
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, index) => {
        tone({ freq, type: 'triangle', gain: 0.09, release: 0.5, delay: index * 0.09 });
      });
    },
    hack() {
      tone({ freq: 330, to: 660, type: 'square', gain: 0.03, release: 0.16 });
    },
    caught() {
      tone({ freq: 220, to: 55, type: 'sawtooth', gain: 0.2, release: 1.1 });
      noise({ duration: 0.7, gain: 0.14, lowpass: 500 });
    },
    escape() {
      [392, 523.25, 659.25, 783.99, 1046.5].forEach((freq, index) => {
        tone({ freq, type: 'sine', gain: 0.1, release: 0.8, delay: index * 0.11 });
      });
    },
    ui() {
      tone({ freq: 740, to: 900, type: 'triangle', gain: 0.035, release: 0.07 });
    },
  };
}
