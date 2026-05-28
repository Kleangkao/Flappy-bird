type SoundName = 'flap' | 'score' | 'hit' | 'start';

const SOUND_CONFIG: Record<SoundName, { frequency: number; duration: number; type: OscillatorType }> = {
  flap: { frequency: 540, duration: 0.06, type: 'sine' },
  score: { frequency: 880, duration: 0.09, type: 'triangle' },
  hit: { frequency: 130, duration: 0.18, type: 'sawtooth' },
  start: { frequency: 420, duration: 0.08, type: 'square' }
};

export class SoundManager {
  private context: AudioContext | null = null;
  private enabled = true;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  play(sound: SoundName): void {
    if (!this.enabled) {
      return;
    }

    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextCtor) {
      return;
    }

    this.context ??= new AudioContextCtor();
    const config = SOUND_CONFIG[sound];
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const now = this.context.currentTime;

    oscillator.type = config.type;
    oscillator.frequency.setValueAtTime(config.frequency, now);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + config.duration);

    oscillator.connect(gain);
    gain.connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + config.duration);
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
