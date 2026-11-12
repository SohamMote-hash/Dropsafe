import { useEffect, useState } from 'react';
import { RotateCcw, Save, Volume2 } from 'lucide-react';
import type { Settings } from '../types';
import { DEFAULT_SETTINGS, LIMITS, validateSettings } from '../lib/settings';
import { ensureAudio, playAlarm } from '../lib/sound';

interface Draft { lowMl: string; criticalMl: string; intervalSec: string; soundEnabled: boolean; autoUpdates: boolean }

const toDraft = (s: Settings): Draft => ({
  lowMl: String(s.lowMl), criticalMl: String(s.criticalMl), intervalSec: String(s.intervalSec),
  soundEnabled: s.soundEnabled, autoUpdates: s.autoUpdates,
});

/** Empty text must not become 0, so it is turned into NaN (which fails validation). */
const num = (t: string) => (t.trim() === '' ? NaN : Number(t));

export function SettingsForm({ settings, onSave }: { settings: Settings; onSave: (s: Settings) => void }) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(settings));
  const [saved, setSaved] = useState<string | null>(null);

  // Keep the form in sync when settings change elsewhere (e.g. the header sound button).
  useEffect(() => setDraft(toDraft(settings)), [settings]);

  const parsed = {
    lowMl: num(draft.lowMl), criticalMl: num(draft.criticalMl), intervalSec: num(draft.intervalSec),
    soundEnabled: draft.soundEnabled, autoUpdates: draft.autoUpdates,
  };
  const errors = validateSettings(parsed);
  const valid = Object.keys(errors).length === 0;
  const dirty =
    !Object.is(parsed.lowMl, settings.lowMl) || !Object.is(parsed.criticalMl, settings.criticalMl) ||
    !Object.is(parsed.intervalSec, settings.intervalSec) || parsed.soundEnabled !== settings.soundEnabled ||
    parsed.autoUpdates !== settings.autoUpdates;

  const save = () => {
    if (!valid) return;
    if (parsed.soundEnabled) ensureAudio(); // this click is the user gesture browsers require
    onSave(parsed);
    setSaved('Settings saved.');
  };
  const restore = () => {
    setDraft(toDraft(DEFAULT_SETTINGS));
    onSave(DEFAULT_SETTINGS);
    setSaved('Defaults restored.');
  };

  const field = (key: 'lowMl' | 'criticalMl' | 'intervalSec', label: string, unit: string, help: string) => (
    <div>
      <label htmlFor={key} className="block text-sm font-semibold text-navy-900">{label}</label>
      <div className="mt-1 flex items-center gap-2">
        <input id={key} type="number" inputMode="decimal" value={draft[key]}
          onChange={(e) => { setSaved(null); setDraft({ ...draft, [key]: e.target.value }); }}
          aria-invalid={!!errors[key]}
          className={`w-32 rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 ${
            errors[key] ? 'border-red-400 focus:ring-red-200' : 'border-slate-300 focus:ring-cyan-200'}`} />
        <span className="text-sm text-slate-500">{unit}</span>
      </div>
      {errors[key] ? <p className="mt-1 text-xs font-medium text-red-600" role="alert">{errors[key]}</p>
        : <p className="mt-1 text-xs text-slate-500">{help}</p>}
    </div>
  );

  const toggle = (key: 'soundEnabled' | 'autoUpdates', label: string, help: string) => (
    <label className="flex cursor-pointer items-start gap-3">
      <input type="checkbox" checked={draft[key]} className="mt-1 h-4 w-4 accent-cyan-600"
        onChange={(e) => { setSaved(null); setDraft({ ...draft, [key]: e.target.checked }); }} />
      <span>
        <span className="block text-sm font-semibold text-navy-900">{label}</span>
        <span className="block text-xs text-slate-500">{help}</span>
      </span>
    </label>
  );

  return (
    <form onSubmit={(e) => { e.preventDefault(); save(); }} className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-2">
        {field('lowMl', 'Low-fluid threshold', 'mL', `LOW when remaining fluid is at or below this (max ${LIMITS.maxThresholdMl}).`)}
        {field('criticalMl', 'Critical-fluid threshold', 'mL', 'CRITICAL at or below this. Must be lower than the low threshold.')}
        {field('intervalSec', 'Simulation update interval', 'seconds', `How often a new demo reading is taken (${LIMITS.minIntervalSec}–${LIMITS.maxIntervalSec} s).`)}
      </div>
      <div className="space-y-4">
        {toggle('soundEnabled', 'Alarm sound', 'Browser-generated tones for unacknowledged alerts.')}
        {toggle('autoUpdates', 'Automatic demo updates', 'When off, nothing changes by itself; only the manual test controls work.')}
        <button type="button" onClick={() => { ensureAudio(); playAlarm('CRITICAL'); }}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50">
          <Volume2 className="h-4 w-4" aria-hidden /> Test alarm sound
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
        <button type="submit" disabled={!valid || !dirty}
          className="inline-flex items-center gap-2 rounded-lg bg-navy-900 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-700 disabled:cursor-not-allowed disabled:opacity-50">
          <Save className="h-4 w-4" aria-hidden /> Save settings
        </button>
        <button type="button" onClick={restore}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50">
          <RotateCcw className="h-4 w-4" aria-hidden /> Restore defaults
        </button>
        {saved && <p className="text-sm font-medium text-green-700" role="status">{saved}</p>}
      </div>
    </form>
  );
}
