"use client";

import { useEffect, useRef } from "react";

export type PlatformStat = { value: number; label: string };

/**
 * IP-192: numbers that count up when they enter the viewport, so the page opens with motion
 * instead of a static row. The values arrive from the server — the landing page computes them
 * from the catalogue, the registry and the live roadmap, never from a typed literal, so the
 * animation never lends energy to a number nobody can stand behind.
 *
 * Under prefers-reduced-motion the final value renders immediately: the global reduced-motion
 * rule cannot reach a rAF loop, so the component checks the media query itself.
 */
export function StatStrip({ stats }: { stats: PlatformStat[] }) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const nodes = Array.from(root.querySelectorAll<HTMLElement>("[data-stat-value]"));

    if (reduced) {
      for (const node of nodes) node.textContent = Number(node.dataset.statValue).toLocaleString("th-TH");
      return;
    }

    const seen = new WeakSet<Element>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || seen.has(entry.target)) continue;
          seen.add(entry.target);
          const node = entry.target as HTMLElement;
          const end = Number(node.dataset.statValue);
          const start = performance.now();
          const duration = 1000;
          const step = (now: number) => {
            const p = Math.min(1, (now - start) / duration);
            // ease-out-quad: fast start, settle at the end, matching the reveal easing family
            const eased = 1 - (1 - p) * (1 - p);
            node.textContent = Math.round(end * eased).toLocaleString("th-TH");
            if (p < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.6 }
    );
    for (const node of nodes) observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="stat-strip" ref={rootRef}>
      {stats.map((stat) => (
        <div className="stat-strip__cell" key={stat.label}>
          <span className="stat-strip__num" data-stat-value={stat.value}>
            0
          </span>
          <span className="stat-strip__label">{stat.label}</span>
        </div>
      ))}
    </div>
  );
}
