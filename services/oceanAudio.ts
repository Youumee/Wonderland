export class WonderlandSynth {
  private ctx: AudioContext | null = null;
  private nodes: AudioNode[] = [];
  private isPlaying: boolean = false;
  private chimeInterval: number | null = null;

  constructor() {}

  async toggle(): Promise<boolean> {
    if (this.isPlaying) {
      this.stop();
      return false;
    } else {
      await this.start();
      return true;
    }
  }

  private async start() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    // 1. Ethereal Wind (Pink Noise + Lowpass Filter)
    const bufferSize = 2 * this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + (0.02 * white)) / 1.02;
      lastOut = output[i];
      output[i] *= 3.5;
    }

    const noiseNode = this.ctx.createBufferSource();
    noiseNode.buffer = buffer;
    noiseNode.loop = true;

    const windFilter = this.ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 200;
    
    const windGain = this.ctx.createGain();
    windGain.gain.value = 0.05;

    // Modulate wind frequency
    const windLfo = this.ctx.createOscillator();
    windLfo.type = 'sine';
    windLfo.frequency.value = 0.05;
    const windLfoGain = this.ctx.createGain();
    windLfoGain.gain.value = 100;

    windLfo.connect(windLfoGain);
    windLfoGain.connect(windFilter.frequency);
    noiseNode.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(this.ctx.destination);
    
    noiseNode.start();
    windLfo.start();

    this.nodes.push(noiseNode, windFilter, windGain, windLfo, windLfoGain);

    // 2. Random Chimes
    this.scheduleChime();

    this.isPlaying = true;
  }

  private scheduleChime() {
    if (!this.ctx) return;
    const delay = Math.random() * 5000 + 2000; // 2-7 seconds
    this.chimeInterval = window.setTimeout(() => {
      this.playChime();
      if (this.isPlaying) this.scheduleChime();
    }, delay);
  }

  private playChime() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    // Pentatonic scale-ish frequencies
    const freqs = [523.25, 659.25, 783.99, 987.77, 1046.50];
    osc.frequency.value = freqs[Math.floor(Math.random() * freqs.length)];
    osc.type = 'sine';

    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.05, this.ctx.currentTime + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 2);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 2);
  }

  stop() {
    this.nodes.forEach(n => {
      try { n.disconnect(); } catch(e){}
      if (n instanceof AudioBufferSourceNode || n instanceof OscillatorNode) {
        try { n.stop(); } catch(e){}
      }
    });
    this.nodes = [];
    if (this.chimeInterval) clearTimeout(this.chimeInterval);
    
    if (this.ctx) {
        this.ctx.suspend();
    }
    this.isPlaying = false;
  }
}