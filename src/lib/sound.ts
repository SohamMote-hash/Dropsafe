// Browser-generated alarm tones (Web Audio API). No audio files needed.
// Browsers only allow audio after a user gesture, so ensureAudio() is called from the
// sound toggle / test button click handlers.
import type { AlertType } from '../types';

let ctx: AudioContext | null = null;

export function ensureAudio(): boolean {
  try {
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return false;
    if (!ctx) ctx = new Ctor();
    if (ctx.state === 'suspended') void ctx.resume();
    return true;
  } catch {
    return false;
  }
}

function beep(freq: number, offsetSec: number, durSec: number, type: OscillatorType, peak = 0.12) {
  if (!ctx) return;
  const t0 = ctx.currentTime + offsetSec;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durSec);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + durSec + 0.05);
}

/** LOW = one soft beep, CRITICAL = fast triple alternating pulse, FAULT = two low buzzes. */
export function playAlarm(kind: AlertType) {
  try {
    if (!ensureAudio()) return;
    if (kind === 'LOW') {
      beep(660, 0, 0.25, 'sine');
    } else if (kind === 'CRITICAL') {
      beep(988, 0, 0.14, 'square', 0.1);
      beep(784, 0.2, 0.14, 'square', 0.1);
      beep(988, 0.4, 0.14, 'square', 0.1);
    } else {
      beep(330, 0, 0.2, 'sawtooth', 0.08);
      beep(330, 0.3, 0.2, 'sawtooth', 0.08);
    }
  } catch { /* audio is best-effort */ }
}

/** How often each alarm repeats (ms) while unacknowledged. */
export const ALARM_PERIOD_MS: Record<AlertType, number> = { LOW: 5000, CRITICAL: 1800, SENSOR_FAULT: 3500 };
