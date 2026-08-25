"use client";

import { useEffect } from "react";

/**
 * Reveals anything carrying `data-reveal` once it comes into view.
 *
 * Two things are deliberate. A hero element does not wait to be scrolled into view — it is
 * already there on load, so waiting would mean the opening cascade never plays for the one
 * visitor who never scrolls. And `data-delay` is honoured in milliseconds rather than as a step
 * index, because the order a hero introduces itself in is a written sequence, not a grid.
 *
 * Under reduced motion everything is marked revealed at once and the global motion reset in
 * globals.css strips the transition, so the page arrives complete rather than arriving quickly.
 */
export function LandingMotion() {
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reducedMotion || typeof IntersectionObserver === "undefined") {
      nodes.forEach((node) => { node.dataset.revealed = "true"; });
      return;
    }

    const timers: number[] = [];
    const reveal = (node: HTMLElement) => {
      const delay = Number.parseInt(node.dataset.delay ?? "0", 10);
      if (!delay) { node.dataset.revealed = "true"; return; }
      timers.push(window.setTimeout(() => { node.dataset.revealed = "true"; }, delay));
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        reveal(entry.target as HTMLElement);
        observer.unobserve(entry.target);
      });
    }, { threshold: 0, rootMargin: "0px 0px -8% 0px" });

    const hero = document.querySelector(".hero");
    nodes.forEach((node) => {
      if (hero?.contains(node)) reveal(node);
      else observer.observe(node);
    });

    return () => {
      observer.disconnect();
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  return null;
}
