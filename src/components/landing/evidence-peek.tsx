"use client";

import { useId, useState } from "react";

/**
 * IP-192 follow-up (owner request 2026-08-27, Fable option 1 "ขอดูที่มา"): each problem card
 * ends with a small "show me the source" control. Pressed, a real piece of evidence slides in
 * where the button was — the same gesture the product performs on every number it holds.
 *
 * The zone has a fixed height and the proof is absolutely stacked over the button, so the three
 * cards stay equal-height in every state at every breakpoint — no height animation, opacity and
 * a 6px rise only. Desktop hover previews the proof via CSS without touching aria-expanded; the
 * button is the real control (44px target, Tab/Enter/Escape). Reduced motion collapses the
 * transition through the global rule and loses nothing.
 */
export function EvidencePeek({ proof }: { proof: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <div
      className={open ? "evidence-peek is-open" : "evidence-peek"}
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
    >
      <button
        type="button"
        className="evidence-peek__btn"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "ซ่อนที่มา" : "ขอดูที่มา"}
        <span className="evidence-peek__arrow" aria-hidden="true">{open ? "×" : "↗"}</span>
      </button>
      <div className="evidence-peek__proof" id={id} aria-hidden={!open}>
        {proof}
      </div>
    </div>
  );
}
