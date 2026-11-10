import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Plus, X } from 'lucide-react';
import { MAX_FLOW_ML_H } from '../lib/calculations';

const BAG_SIZES = [250, 500, 1000];

export interface NewBag {
  name: string;
  initialVolumeMl: number;
  startVolumeMl: number;
  flowMlH: number;
}

export function AddBagDialog({ open, nextId, onClose, onAdd }: {
  open: boolean;
  nextId: string;
  onClose: () => void;
  onAdd: (bag: NewBag) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [size, setSize] = useState(500);
  const [startVolume, setStartVolume] = useState('500');
  const [flow, setFlow] = useState('120');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setName(`IV bag ${Number(nextId.replace('IV-', ''))}`);
      setSize(500);
      setStartVolume('500');
      setFlow('120');
      setError(null);
      dialog.showModal();
      nameRef.current?.focus();
      nameRef.current?.select();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, nextId]);

  const changeSize = (value: number) => {
    setSize(value);
    setStartVolume(String(value));
    setError(null);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Enter a name for the bag.');
      return;
    }
    const volume = startVolume.trim() === '' ? NaN : Number(startVolume);
    if (!Number.isFinite(volume) || volume <= 0 || volume > size) {
      setError(`Starting volume must be between 1 and ${size} mL.`);
      return;
    }
    const flowRate = flow.trim() === '' ? NaN : Number(flow);
    if (!Number.isFinite(flowRate) || flowRate < 0) {
      setError('Flow rate must be 0 or more.');
      return;
    }
    onAdd({ name: trimmed, initialVolumeMl: size, startVolumeMl: volume, flowMlH: flowRate });
    dialogRef.current?.close();
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(event) => { if (event.target === dialogRef.current) dialogRef.current.close(); }}
      aria-labelledby="add-bag-title"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-slate-200 bg-white p-0 text-left shadow-2xl backdrop:bg-slate-900/50"
    >
      <form onSubmit={submit} className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="add-bag-title" className="text-lg font-bold text-navy-900">Add IV bag</h2>
            <p className="text-xs text-slate-500">Creates channel <span className="font-mono">{nextId}</span> as a simulated demo bag.</p>
          </div>
          <button type="button" onClick={() => dialogRef.current?.close()} aria-label="Close dialog"
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-navy-900">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div>
          <label htmlFor="bag-name" className="block text-sm font-semibold text-navy-900">Bag name</label>
          <input id="bag-name" ref={nameRef} value={name} maxLength={40}
            onChange={(event) => { setName(event.target.value); setError(null); }}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-200" />
        </div>

        <div>
          <label htmlFor="bag-size" className="block text-sm font-semibold text-navy-900">Bag size</label>
          <select id="bag-size" value={size}
            onChange={(event) => changeSize(Number(event.target.value))}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-200">
            {BAG_SIZES.map((ml) => <option key={ml} value={ml}>{ml} mL</option>)}
          </select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="bag-volume" className="block text-sm font-semibold text-navy-900">Starting volume</label>
            <div className="mt-1 flex items-center gap-2">
              <input id="bag-volume" type="number" inputMode="decimal" min={1} max={size} value={startVolume}
                onChange={(event) => { setStartVolume(event.target.value); setError(null); }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-200" />
              <span className="text-sm text-slate-500">mL</span>
            </div>
          </div>
          <div>
            <label htmlFor="bag-flow" className="block text-sm font-semibold text-navy-900">Flow rate</label>
            <div className="mt-1 flex items-center gap-2">
              <input id="bag-flow" type="number" inputMode="decimal" min={0} max={MAX_FLOW_ML_H} value={flow}
                onChange={(event) => { setFlow(event.target.value); setError(null); }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-200" />
              <span className="text-sm text-slate-500">mL/h</span>
            </div>
          </div>
        </div>

        {error && <p className="text-xs font-medium text-red-600" role="alert">{error}</p>}

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" onClick={() => dialogRef.current?.close()}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button type="submit"
            className="inline-flex items-center gap-2 rounded-lg bg-navy-900 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-700 active:scale-[0.98]">
            <Plus className="h-4 w-4" aria-hidden /> Add bag
          </button>
        </div>
      </form>
    </dialog>
  );
}
