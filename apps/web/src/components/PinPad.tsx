"use client";

import { useState } from "react";

/** Parent PIN entry. Prototype PIN is 1234; real PINs are checked server-side and rate-limited. */
export function PinPad({ title, onSubmit, onCancel }: { title: string; onSubmit: (pin: string) => boolean; onCancel: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  function press(d: string) {
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    setError(false);
    if (next.length === 4) {
      setTimeout(() => {
        if (!onSubmit(next)) {
          setError(true);
          setPin("");
        }
      }, 120);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm p-4" role="dialog" aria-modal aria-label={title}>
      <div className="w-full max-w-xs rounded-3xl bg-ink-2 p-6 text-paper ring-1 ring-white/10">
        <div className="text-center font-display text-xl">{title}</div>
        <p className="mt-1 text-center text-sm text-muted">Enter the parent PIN <span className="text-white/60">(demo: 1234)</span></p>
        <div className={`mt-5 flex justify-center gap-3 ${error ? "animate-[shake_.3s]" : ""}`} aria-live="polite">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`h-3.5 w-3.5 rounded-full ${i < pin.length ? "bg-sun" : "bg-white/20"}`} />
          ))}
        </div>
        {error && <p className="mt-3 text-center text-sm text-coral-2">That PIN didn’t match. Try again.</p>}
        <div className="mt-5 grid grid-cols-3 gap-3">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <button key={d} onClick={() => press(d)} className="h-14 rounded-2xl bg-ink-3 text-xl font-semibold hover:bg-line active:scale-95 transition">
              {d}
            </button>
          ))}
          <button onClick={onCancel} className="h-14 rounded-2xl text-sm text-muted hover:text-paper">Cancel</button>
          <button onClick={() => press("0")} className="h-14 rounded-2xl bg-ink-3 text-xl font-semibold hover:bg-line active:scale-95 transition">0</button>
          <button onClick={() => setPin(pin.slice(0, -1))} className="h-14 rounded-2xl text-sm text-muted hover:text-paper" aria-label="Delete digit">⌫</button>
        </div>
        <p className="mt-4 text-center text-xs text-muted">Forgot it? The account owner can reset the PIN by email.</p>
      </div>
    </div>
  );
}
