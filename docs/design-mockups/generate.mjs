import fs from 'node:fs';
import path from 'node:path';
import { renderPage } from './template.mjs';

const ROOT = 'D:/AIProject/naichangmoo';
const SRC = path.join(ROOT, 'skill/awesome-design-md-main/design-md');
const README = path.join(ROOT, 'skill/awesome-design-md-main/README.md');
const OWN = ROOT; // our own DESIGN.md now lives at the project root
const OUT = path.join(ROOT, 'docs/design-mockups');
const STYLES = path.join(OUT, 'styles');

/* ---------- yaml-ish front matter ---------- */
function parseFrontMatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const root = {};
  const stack = [{ indent: -1, obj: root }];
  for (const raw of m[1].split(/\r?\n/)) {
    if (!raw.trim() || /^\s*#/.test(raw)) continue;
    const indent = raw.match(/^ */)[0].length;
    const line = raw.trim();
    const ci = line.indexOf(':');
    if (ci < 0) continue;
    const key = line.slice(0, ci).trim();
    let val = line.slice(ci + 1).trim();
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
    const parent = stack[stack.length - 1].obj;
    if (val === '') { const obj = {}; parent[key] = obj; stack.push({ indent, obj }); }
    else { parent[key] = val.replace(/^["']/, '').replace(/["']$/, ''); }
  }
  return root;
}

/* ---------- legacy (no front matter) parser ---------- */
function parseLegacy(text) {
  const chunks = text.split(/^## /m).slice(1);
  const secOf = (n) => {
    const c = chunks.find((x) => x.startsWith(n + '.'));
    return c || '';
  };
  const colorSec = secOf(2);
  if (!colorSec) return null;
  const groups = {};
  let cur = 'root';
  for (const line of colorSec.split(/\r?\n/)) {
    const h = line.match(/^###\s+(.+)$/);
    if (h) { cur = h[1].trim(); groups[cur] = groups[cur] || []; continue; }
    const b = line.match(/^\s*[-*]\s+\*\*(.+?)\*\*\s*\(`?(#[0-9a-fA-F]{3,6})`?\)\s*:?\s*(.*)$/);
    if (b) { (groups[cur] = groups[cur] || []).push({ name: b[1], hex: b[2].toLowerCase(), desc: b[3] || '' }); }
  }
  const all = Object.values(groups).flat();
  if (all.length < 4) return null;
  const g = (re) => Object.entries(groups).filter(([k]) => re.test(k)).flatMap(([, v]) => v);
  const find = (list, re) => list.find((e) => re.test(e.name + ' ' + e.desc));

  const gPrim = g(/primary/i), gSurf = g(/surface|background/i), gText = g(/neutral|text|typography/i);
  const gAcc = g(/secondary|accent/i), gSem = g(/semantic|status|feedback|state/i);

  const canvas = (find(gSurf, /canvas|page background|default|dominant|primary surface/i) || gSurf[0] || find(all, /white|background/i) || { hex: '#ffffff' }).hex;
  const dark = lum(canvas) < 0.35;
  const sat = (h) => { const [r, g, b] = rgb(h); return (Math.max(r, g, b) - Math.min(r, g, b)) / 255; };
  const strong = (e) => contrast(e.hex, canvas) >= 2.5;

  // primary must read against the canvas; a real brand color beats a neutral, but a
  // barely-tinted gray is NOT a brand color — monochrome brands keep their black CTA
  const chromatic = (e) => strong(e) && hue(e.hex) >= 0 && sat(e.hex) >= 0.15;
  const primary = (gPrim.find(chromatic) || gAcc.find(chromatic) || all.find(chromatic)
    || gPrim.find(strong) || all.find(strong) || { hex: dark ? '#ffffff' : '#111111' }).hex;

  const card = (gSurf.find((e) => e.hex !== canvas && Math.abs(lum(e.hex) - lum(canvas)) < 0.35 && /surface|card|panel|tile|alternate|secondary/i.test(e.name + e.desc)) || {}).hex
    || (dark ? mix(canvas, '#ffffff', 0.06) : '#ffffff');

  // ink = strongest text color anywhere in the doc, not just the "Neutrals" group
  const textish = all.filter((e) => /text|heading|headline|type|ink|body copy|black/i.test(e.name + ' ' + e.desc));
  const inkEnt = (textish.concat(gText).sort((a, b) => contrast(b.hex, canvas) - contrast(a.hex, canvas))[0])
    || { hex: dark ? '#ffffff' : '#111111' };
  let mutedHex = (find(gText, /body|secondary/i) || {}).hex;
  if (!mutedHex || mutedHex === inkEnt.hex) mutedHex = mix(inkEnt.hex, canvas, 0.28);
  let subtleHex = (find(gText, /tertiary|placeholder|muted|disabled|caption|meta/i) || {}).hex;
  if (!subtleHex || subtleHex === mutedHex || subtleHex === inkEnt.hex) subtleHex = mix(inkEnt.hex, canvas, 0.5);

  // hairline must be quiet against the canvas — reject brand-colored "borders", prefer the least saturated
  const hairCands = all.filter((e) => /border|divider|rule|hairline|frame|outline|stroke/i.test(e.name + ' ' + e.desc)
    && e.hex !== primary && contrast(e.hex, canvas) < 2.4);
  const hairEnt = hairCands.sort((a, b) => sat(a.hex) - sat(b.hex))[0];

  const accEnt = gAcc.find((e) => e.hex !== primary && hue(e.hex) >= 0 && contrast(e.hex, canvas) >= 1.8)
    || gAcc.find((e) => e.hex !== primary && contrast(e.hex, canvas) >= 1.8) || { hex: primary };
  const okRaw = find(gSem, /green|success|positive|valid/i);
  const warnRaw = find(gSem, /amber|yellow|warn|caution|gold/i);
  const okEnt = okRaw && hue(okRaw.hex) >= 70 && hue(okRaw.hex) <= 190 ? okRaw : { hex: '#2f9e5f' };
  const warnEnt = warnRaw && hue(warnRaw.hex) >= 15 && hue(warnRaw.hex) <= 70 ? warnRaw : { hex: '#b8770c' };

  const typoSec = secOf(3).slice(0, 600).replace(/sans-serif/gi, 'sans');
  let dWeight = 600;
  const wm = typoSec.match(/(?:weight|wght)[^\d]{0,8}(\d{3})/i) || typoSec.match(/\((\d{3})\)/);
  if (wm) dWeight = Math.max(300, Math.min(800, parseInt(wm[1], 10)));
  // only trust a px value that appears AFTER the word "radius", and ignore 1px (that's a border)
  const radAll = [...text.matchAll(/([^\n]{0,70}radius[^\n]{0,90})/gi)].map((m) => m[1]);
  const valOf = (line) => {
    const after = line.slice(line.toLowerCase().indexOf('radius'));
    const hits = [...after.matchAll(/(\d{1,4})\s*px/g)].map((m) => parseInt(m[1], 10)).filter((n) => n === 0 || n >= 2);
    if (/9999|full|pill|round(ed)?\s*full|capsule/i.test(after) && !hits.length) return 9999;
    return hits.length ? hits[0] : null;
  };
  const pick = (re, fb) => {
    for (const line of radAll) { if (re.test(line)) { const v = valOf(line); if (v !== null) return v + 'px'; } }
    for (const line of radAll) { const v = valOf(line); if (v !== null) return v + 'px'; }
    return fb;
  };

  return {
    name: (text.match(/^#\s+(.+)$/m) || [, 'legacy'])[1],
    description: (text.match(/^##\s*1\.[^\n]*\n+([^\n]+)/m) || [, ''])[1],
    colors: {
      primary, canvas, 'surface-1': card, hairline: hairEnt ? hairEnt.hex : mix(canvas, inkEnt.hex, 0.12),
      ink: inkEnt.hex, 'ink-muted': mutedHex, 'ink-subtle': subtleHex,
      accent: accEnt.hex, 'semantic-success': okEnt.hex, 'semantic-warning': warnEnt.hex,
      'on-primary': readable(primary),
    },
    typography: {
      'display-md': { fontFamily: typoSec, fontSize: '44px', fontWeight: String(dWeight), lineHeight: '1.12', letterSpacing: '-1.4px' },
      body: { fontFamily: typoSec, fontSize: '16px', fontWeight: '400', lineHeight: '1.55' },
    },
    rounded: { sm: pick(/input|field/i, '6px'), md: pick(/button/i, '8px'), lg: pick(/card|panel|tile/i, '12px'), pill: '9999px' },
    spacing: {},
    components: {},
  };
}

/* ---------- color utils ---------- */
const isHex = (s) => typeof s === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s.trim());
function rgb(c) {
  let h = c.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
const toHex = (a) => '#' + a.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
function lum(c) {
  const [r, g, b] = rgb(c).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) { const l1 = lum(a), l2 = lum(b); const hi = Math.max(l1, l2), lo = Math.min(l1, l2); return (hi + 0.05) / (lo + 0.05); }
function mix(a, b, t) { const A = rgb(a), B = rgb(b); return toHex(A.map((v, i) => v + (B[i] - v) * t)); }
const rgba = (c, a) => `rgba(${rgb(c).join(',')},${a})`;
function hue(c) {
  const [r, g, b] = rgb(c).map((v) => v / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (d < 0.04) return -1;
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60; return h < 0 ? h + 360 : h;
}
const readable = (bg) => (contrast(bg, '#ffffff') >= contrast(bg, '#111111') ? '#ffffff' : '#111111');

/* ---------- token resolution ---------- */
function makeResolver(fm) {
  const colors = fm.colors || {}, rounded = fm.rounded || {}, spacing = fm.spacing || {}, typography = fm.typography || {};
  return function resolve(v) {
    if (typeof v !== 'string') return v;
    const m = v.match(/^\{(colors|rounded|spacing|typography)\.([a-z0-9-]+)\}$/i);
    if (!m) return v;
    const bag = { colors, rounded, spacing, typography }[m[1]];
    return bag ? bag[m[2]] : undefined;
  };
}
const firstHex = (...vals) => vals.find((v) => isHex(v));
const px = (v, fb) => { const n = parseFloat(v); return Number.isFinite(n) ? n : fb; };

function findComp(comps, exact, re, avoid) {
  for (const n of exact) if (comps[n]) return comps[n];
  const key = Object.keys(comps).find((k) => re.test(k) && !(avoid && avoid.test(k)));
  return key ? comps[key] : null;
}
function pickType(typo, re, target) {
  const c = Object.entries(typo).filter(([k, v]) => re.test(k) && v && typeof v === 'object' && v.fontSize);
  if (!c.length) return null;
  c.sort((a, b) => Math.abs(px(a[1].fontSize, 99) - target) - Math.abs(px(b[1].fontSize, 99) - target));
  return c[0][1];
}

/* ---------- fonts ---------- */
function thaiFont(family, weight, name) {
  const f = (family || '').toLowerCase();
  const n = (name || '').toLowerCase();
  if (/plex/.test(f) || /ibm/.test(n)) return 'IBM Plex Sans Thai';
  if (/serif|manuka|times|georgia|garamond|tiempos|canela|freight/.test(f)) return 'Noto Serif Thai';
  if (/mono|terminal/.test(f)) return 'Chakra Petch';
  if (weight >= 800) return 'Kanit';
  if (weight >= 700) return 'Bai Jamjuree';
  if (weight <= 300) return 'Noto Sans Thai';
  if (/circular|nunito|rubik|poppins|geometric|futura/.test(f)) return 'Sarabun';
  return 'Anuphan';
}
function latinFont(family) {
  const f = (family || '').toLowerCase();
  if (/plex|ibm/.test(f)) return 'IBM Plex Sans';
  if (/serif|manuka|times|georgia|garamond|tiempos|canela|freight/.test(f)) return 'Source Serif 4';
  if (/mono|jetbrains|menlo|consolas/.test(f)) return 'JetBrains Mono';
  if (/rubik/.test(f)) return 'Rubik';
  if (/grotesk|grotesque|founders|graphik/.test(f)) return 'Space Grotesk';
  if (/futura|poppins|circular|geometric|gotham|nunito/.test(f)) return 'Poppins';
  return 'Inter';
}
const HEAVY = new Set(['Kanit', 'Noto Sans Thai', 'Sarabun', 'Noto Serif Thai']);
function fontsHref(list) {
  const uniq = [...new Set(list)].filter(Boolean);
  const fams = uniq.map((f) => {
    const w = HEAVY.has(f) ? '300;400;500;600;700;800' : '300;400;500;600;700';
    return `family=${f.replace(/ /g, '+')}:wght@${w}`;
  });
  return `https://fonts.googleapis.com/css2?${fams.join('&')}&display=swap`;
}

/* ---------- build a design profile ---------- */
function profile(slug, fm, meta) {
  const R = makeResolver(fm);
  const C = fm.colors || {}, T = fm.typography || {}, RD = fm.rounded || {}, comps = fm.components || {};

  const canvas = firstHex(C.canvas, C['canvas-soft'], C['surface-canvas-light'], C['surface-1'], '#ffffff') || '#ffffff';
  const dark = lum(canvas) < 0.35;

  const ink = firstHex(C.ink, C['ink-deep'], dark ? C['on-dark'] : C.charcoal, C['inverse-ink'], dark ? '#ffffff' : '#111111') || (dark ? '#ffffff' : '#111111');
  const muted = firstHex(C['ink-muted'], C['ink-mute'], C.body, C['ink-secondary'], C.muted, C.slate, C['on-dark-muted'], mix(ink, canvas, 0.3)) || mix(ink, canvas, 0.3);
  const subtle = firstHex(C['ink-subtle'], C['ink-mute-2'], C.mute, C['muted-soft'], C.stone, C.steel, mix(ink, canvas, 0.52)) || mix(ink, canvas, 0.52);
  const hair = firstHex(C.hairline, C['hairline-soft'], C['hairline-cool'], C['hairline-cloud'], C['hairline-violet'], mix(canvas, ink, dark ? 0.14 : 0.11)) || mix(canvas, ink, 0.11);
  const hairStrong = firstHex(C['hairline-strong'], C['hairline-input'], C['hairline-tertiary'], mix(hair, ink, 0.35)) || mix(hair, ink, 0.35);
  const primary = firstHex(C.primary, C['brand-green'], C['accent-lime'], C.link, ink) || ink;
  const onPrimary = firstHex(C['on-primary'], C['on-yellow'], readable(primary)) || readable(primary);

  const cardComp = findComp(comps, ['feature-card', 'card-base', 'card-feature-light', 'feature-card-dark', 'pricing-card', 'workspace-panel', 'card-pricing', 'product-card'], /card|panel|tile/, /featured|yellow|cream|tint|mockup|logo|dark-band/);
  let card = isHex(R(cardComp && cardComp.backgroundColor)) ? R(cardComp.backgroundColor)
    : firstHex(C['surface-1'], C.surface, C['surface-card'], C['surface-soft'], dark ? mix(canvas, '#ffffff', 0.06) : '#ffffff');
  if (!isHex(card)) card = dark ? mix(canvas, '#ffffff', 0.06) : '#ffffff';
  if (card.toLowerCase() === canvas.toLowerCase() && !dark && lum(canvas) < 0.96) card = '#ffffff';

  const surface2 = firstHex(C['surface-2'], C['surface-elevated'], C['surface-3'], C['canvas-soft'], C['surface-soft'], mix(card, ink, dark ? 0.06 : 0.045)) || mix(card, ink, 0.05);
  const accent = firstHex(C.accent, C['accent-lime'], C['brand-orange'], C.ruby, C['brand-pink'], C['accent-purple'], C.link, primary) || primary;
  const success = firstHex(C['semantic-success'], C.success, C.positive, C['accent-emerald'], C['brand-green'], '#2f9e5f') || '#2f9e5f';
  const warning = firstHex(C['semantic-warning'], C.warning, C['brand-warn'], C['badge-orange'], C['accent-orange'], '#b8770c') || '#b8770c';

  const btn = findComp(comps, ['button-primary', 'button-primary-pill', 'button-primary-large'], /^button/, /disabled|ghost|text/);
  const inp = findComp(comps, ['text-input', 'input', 'newsletter-input'], /input|field|search/);
  const nav = findComp(comps, ['top-nav', 'nav-bar-on-mesh', 'navigation'], /nav/);
  const badge = findComp(comps, ['status-badge', 'badge-pill', 'pill-tag-soft', 'badge-purple'], /badge|chip|pill|tag/);

  const rBtn = px(R(btn && btn.rounded), px(RD.md, 8));
  const rCard = px(R(cardComp && cardComp.rounded), px(RD.lg, 12));
  const rInput = px(R(inp && inp.rounded), px(RD.sm, 6));
  const rBadge = px(R(badge && badge.rounded), px(RD.pill, 999));
  const padBtn = (btn && btn.padding && /px/.test(btn.padding)) ? btn.padding : '11px 18px';
  const padCard = (cardComp && cardComp.padding && /px/.test(cardComp.padding)) ? cardComp.padding.split(' ')[0] : '28px';
  const navH = px(nav && nav.height, 64);

  const disp = pickType(T, /display|hero|heading-1|heading-2|headline/i, 42) || { fontSize: '42px', fontWeight: '600', letterSpacing: '-1px', lineHeight: '1.15', fontFamily: 'Inter' };
  const body = pickType(T, /body(-md)?$|body-lg|subtitle|subhead/i, 16) || { fontSize: '16px', fontWeight: '400', lineHeight: '1.55', fontFamily: 'Inter' };
  const eyeb = pickType(T, /eyebrow|micro-cap|caption-uppercase|overline/i, 12);
  const btnT = pickType(T, /button/i, 14) || { fontSize: '14px', fontWeight: '500' };

  const dW = Math.min(px(disp.fontWeight, 600), 800);
  const dSize = Math.max(32, Math.min(52, px(disp.fontSize, 42)));
  const dLS = px(disp.letterSpacing, -1) * (dSize / Math.max(px(disp.fontSize, 42), 1));

  const dispThai = thaiFont(disp.fontFamily, dW, fm.name);
  const bodyThai = thaiFont(body.fontFamily, px(body.fontWeight, 400), fm.name);
  const dispLatin = latinFont(disp.fontFamily);
  const bodyLatin = latinFont(body.fontFamily);
  const monoLatin = /plex|ibm/i.test(String(fm.name)) ? 'IBM Plex Mono' : 'JetBrains Mono';

  const eyeLS = eyeb ? px(eyeb.letterSpacing, 0) : 0.6;
  const shadow = dark ? 'none' : `0 1px 2px ${rgba(ink, 0.05)}, 0 14px 32px ${rgba(ink, 0.06)}`;
  const theadBg = dark ? 'transparent' : surface2;

  // legibility guards — no generated page may ship unreadable text
  let ink2 = ink, muted2 = muted, subtle2 = subtle, hair2 = hair;
  if (contrast(ink2, card) < 4.5) ink2 = dark ? '#f5f5f5' : '#141414';
  if (contrast(muted2, card) < 3.2 || muted2.toLowerCase() === ink2.toLowerCase()) muted2 = mix(ink2, card, 0.24);
  if (contrast(subtle2, card) < 2.4 || subtle2.toLowerCase() === muted2.toLowerCase()) subtle2 = mix(ink2, card, 0.45);
  if (contrast(hair2, card) > 3.5) hair2 = mix(card, ink2, dark ? 0.16 : 0.12);
  const numColor = contrast(primary, card) >= 2.6 ? primary : ink2;

  return {
    slug, name: (meta && meta.title) || String(fm.name || slug).replace(/-design-analysis|-Inspired/gi, ''),
    category: (meta && meta.category) || 'อื่น ๆ',
    blurb: (meta && meta.blurb) || String(fm.description || '').slice(0, 190),
    dark, canvas, card, surface2, hair: hair2, hairStrong: contrast(hairStrong, card) > 6 ? mix(hair2, ink2, 0.4) : hairStrong,
    ink: ink2, muted: muted2, subtle: subtle2, primary, onPrimary, accent, success, warning,
    rBtn: Math.min(rBtn, 999), rCard: Math.min(rCard, 28), rInput: Math.min(rInput, 999), rBadge: Math.min(rBadge, 9999),
    padBtn, padCard, navH,
    dSize, dW, dLS, dLH: px(disp.lineHeight, 1.15),
    bSize: Math.max(14, Math.min(17, px(body.fontSize, 16))), bWeight: px(body.fontWeight, 400), bLH: Math.max(1.4, Math.min(1.8, px(body.lineHeight, 1.55))),
    btnSize: px(btnT.fontSize, 14), btnWeight: px(btnT.fontWeight, 500),
    eyeLS, eyeUpper: eyeLS > 0.5, eyeWeight: eyeb ? px(eyeb.fontWeight, 600) : 600, eyeSize: eyeb ? Math.max(11, px(eyeb.fontSize, 12)) : 12,
    dispThai, bodyThai, dispLatin, bodyLatin, monoLatin, shadow, numColor, theadBg,
    fontsHref: fontsHref([dispThai, bodyThai, dispLatin, bodyLatin, monoLatin]),
  };
}

/* ---------- page (markup lives in template.mjs) ---------- */
const page = (p) => renderPage(p, { mix, rgba, contrast });

/* ---------- README metadata ---------- */
function readmeMeta() {
  const txt = fs.readFileSync(README, 'utf8');
  const out = {};
  let cat = 'อื่น ๆ';
  let inCollection = false;
  for (const line of txt.split(/\r?\n/)) {
    if (/^## Collection/.test(line)) { inCollection = true; continue; }
    if (!inCollection) continue;
    if (/^## /.test(line)) break;
    const h = line.match(/^### (.+)$/);
    if (h) { cat = h[1].trim(); continue; }
    const m = line.match(/^- \[\*\*(.+?)\*\*\]\(https:\/\/getdesign\.md\/([^/]+)\/design-md\)\s*-\s*(.*)$/);
    if (m) out[m[2]] = { title: m[1], category: cat, blurb: m[3].trim() };
  }
  return out;
}

/* ---------- run ---------- */
const meta = readmeMeta();
meta.slack = meta.slack || { title: 'Slack', category: 'Productivity & SaaS', blurb: 'แพลตฟอร์มแชททีม — aubergine เข้ม การ์ดขาว ปุ่มเขียวสด' };
fs.mkdirSync(STYLES, { recursive: true });

const dirs = fs.readdirSync(SRC, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
const entries = [{ slug: 'naichangmoo', file: path.join(OWN, 'DESIGN.md'), own: true }]
  .concat(dirs.map((d) => ({ slug: d, file: path.join(SRC, d, 'DESIGN.md'), own: false })));

const built = [];
const failed = [];
for (const e of entries) {
  try {
    if (!fs.existsSync(e.file)) { failed.push([e.slug, 'no DESIGN.md']); continue; }
    const raw = fs.readFileSync(e.file, 'utf8');
    let fm = parseFrontMatter(raw);
    if (!fm || !fm.colors) fm = parseLegacy(raw);
    if (!fm || !fm.colors) { failed.push([e.slug, 'unparsable']); continue; }
    const m = e.own
      ? { title: 'นายช่างหมู (ของเดิม)', category: 'ของเราเอง', blurb: 'ภาษาการออกแบบปัจจุบันของแพลตฟอร์ม — teal + orange บน canvas เทาอมเขียว IBM Plex Sans Thai' }
      : meta[e.slug];
    const p = profile(e.slug, fm, m);
    fs.writeFileSync(path.join(STYLES, `${e.slug}.html`), page(p), 'utf8');
    built.push(p);
  } catch (err) { failed.push([e.slug, err.message]); }
}

/* gallery */
built.sort((a, b) => (a.slug === 'naichangmoo' ? -1 : b.slug === 'naichangmoo' ? 1 : a.name.localeCompare(b.name)));
const cats = [...new Set(built.map((b) => b.category))];
const cards = built.map((b) => `  <article class="g" data-name="${b.name.toLowerCase()} ${b.slug}" data-cat="${b.category}" data-tone="${b.dark ? 'dark' : 'light'}">
    <a class="prev" href="styles/${b.slug}.html" target="_blank" style="background:${b.canvas}">
      <span class="mini" style="background:${b.card};border-color:${b.hair}">
        <em style="background:${b.primary}"></em>
        <i style="background:${b.hair}"></i><i style="background:${b.hair};width:60%"></i>
        <u style="background:${b.primary};color:${b.onPrimary}">2.373</u>
      </span>
    </a>
    <div class="body">
      <div class="row"><h3>${b.name}</h3><span class="tone ${b.dark ? 'd' : 'l'}">${b.dark ? 'มืด' : 'สว่าง'}</span></div>
      <p class="cat">${b.category}</p>
      <p class="blurb">${b.blurb.replace(/</g, '&lt;')}</p>
      <div class="sw">${[b.canvas, b.card, b.primary, b.accent, b.ink, b.hair].map((c) => `<i style="background:${c}" title="${c}"></i>`).join('')}</div>
      <p class="font">${b.dispThai} / ${b.dispLatin} · มุม ${b.rCard}px · ปุ่ม ${b.rBtn}px</p>
      <div class="acts"><button data-src="styles/${b.slug}.html">ดูตัวอย่าง</button><a href="styles/${b.slug}.html" target="_blank">เปิดเต็มจอ ↗</a></div>
    </div>
  </article>`).join('\n');

const gallery = `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ESTIMETR · แกลเลอรีแนวออกแบบ ${built.length} แบบ</title>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{--bg:#f4f7f7;--card:#fff;--hair:#d9e5e4;--ink:#073047;--muted:#5f7178;--teal:#0d8282;--orange:#f47721}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--ink);font-family:"IBM Plex Sans Thai",system-ui,sans-serif;font-size:15px}
header{padding:30px 32px 18px}
h1{font-size:28px;letter-spacing:-1.2px}
header p{color:var(--muted);font-size:14px;margin-top:6px;max-width:70ch;line-height:1.65}
.bar{position:sticky;top:0;z-index:20;background:rgba(244,247,247,.94);backdrop-filter:blur(10px);
  border-bottom:1px solid var(--hair);padding:14px 32px;display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.bar input{flex:0 0 240px;border:1px solid var(--hair);border-radius:7px;padding:9px 12px;font-family:inherit;font-size:14px;background:#fbfdfd;color:var(--ink)}
.bar button{border:1px solid var(--hair);background:#fff;color:var(--muted);border-radius:999px;padding:7px 13px;
  font-family:inherit;font-size:13px;font-weight:600;cursor:pointer}
.bar button.on{background:var(--teal);border-color:var(--teal);color:#fff}
.bar .count{margin-left:auto;color:var(--muted);font-size:13px}
main{display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:18px;padding:24px 32px 80px}
.g{background:var(--card);border:1px solid var(--hair);border-radius:14px;overflow:hidden;display:flex;flex-direction:column}
.g:hover{border-color:var(--teal);box-shadow:0 14px 30px rgba(7,48,71,.09)}
.prev{display:block;height:132px;padding:16px;display:grid;place-items:center}
.mini{width:100%;height:100px;border:1px solid;border-radius:8px;padding:10px;display:grid;gap:7px;align-content:start;position:relative}
.mini em{display:block;width:34px;height:7px;border-radius:3px}
.mini i{display:block;height:6px;width:85%;border-radius:3px;opacity:.75}
.mini u{position:absolute;right:10px;bottom:10px;font-size:11px;font-weight:700;text-decoration:none;
  padding:4px 8px;border-radius:6px;font-variant-numeric:tabular-nums}
.body{padding:14px 16px 16px;border-top:1px solid var(--hair);display:flex;flex-direction:column;gap:7px;flex:1}
.row{display:flex;justify-content:space-between;align-items:center;gap:8px}
h3{font-size:16px;letter-spacing:-.4px}
.tone{font-size:11px;font-weight:700;padding:3px 8px;border-radius:999px}
.tone.d{background:#e6ebef;color:#334}
.tone.l{background:#fff6eb;color:#a5500b}
.cat{font-size:11px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:var(--teal)}
.blurb{font-size:12.5px;color:var(--muted);line-height:1.55;flex:1}
.sw{display:flex;gap:5px}
.sw i{width:22px;height:22px;border-radius:5px;border:1px solid rgba(7,48,71,.12);display:block}
.font{font-size:11.5px;color:#8a9ba0}
.acts{display:flex;gap:8px;margin-top:4px}
.acts button,.acts a{flex:1;text-align:center;border:1px solid var(--hair);background:#fbfdfd;color:var(--ink);
  border-radius:7px;padding:8px;font-family:inherit;font-size:12.5px;font-weight:700;cursor:pointer}
.acts button{background:var(--ink);color:#fff;border-color:var(--ink)}
#ov{position:fixed;inset:0;z-index:50;background:rgba(5,31,47,.72);display:none}
#ov.open{display:grid;grid-template-rows:auto 1fr}
#ov .top{display:flex;gap:12px;align-items:center;padding:12px 18px;color:#fff}
#ov .top b{font-size:15px}
#ov .top .sp{flex:1}
#ov .top a,#ov .top button{border:1px solid rgba(255,255,255,.4);background:transparent;color:#fff;
  border-radius:7px;padding:7px 12px;font-family:inherit;font-size:13px;cursor:pointer}
#ov iframe{width:100%;height:100%;border:0;background:#fff}
</style>
</head>
<body>
<header>
  <h1>ESTIMETR · หน้า “ถอดปริมาณด้วยมือ” ใน ${built.length} ภาษาการออกแบบ</h1>
  <p>ทุกหน้ามีฟังก์ชันครบชุดเท่ากันหมด — แถบขั้นตอน 4 ขั้น, ตาราง take-off 8 คอลัมน์, เซลล์รายการคำนวณ/หลักฐานที่กดกางได้จริง, ฟอร์มเพิ่มบรรทัดการวัด ค่าเผื่อ หลักฐาน และรายการใหม่, ยอดรวมตามหน่วย, ปิดรอบ, ประวัติรอบ และแผงเงื่อนไขก่อนปิดรอบ ต่างกันเฉพาะ design token ที่ดึงตรงจาก DESIGN.md ของแต่ละแบรนด์ (สี ตัวอักษร ความมนของมุม ระยะ padding เงา) — ตัวแรกสุดคือหน้าตาปัจจุบันของนายช่างหมูเอง ที่ถอด token มาจาก <code>src/app/globals.css</code> จริง ไว้เป็นตัวเทียบ · <a href="handmade/handmade-index.html" style="color:#0d8282;font-weight:700">ดู 5 แบบที่จัดหน้าเองทีละแบบ →</a></p>
</header>
<div class="bar">
  <input id="q" placeholder="ค้นหาชื่อแบรนด์...">
  <button class="on" data-f="all">ทั้งหมด</button>
  <button data-f="light">โทนสว่าง</button>
  <button data-f="dark">โทนมืด</button>
  ${cats.map((c) => `<button data-c="${c}">${c}</button>`).join('\n  ')}
  <span class="count" id="count"></span>
</div>
<main id="grid">
${cards}
</main>
<div id="ov"><div class="top"><b id="ovname"></b><span class="sp"></span><a id="ovlink" target="_blank">เปิดเต็มจอ ↗</a><button id="ovclose">ปิด (Esc)</button></div><iframe id="ovframe"></iframe></div>
<script>
const grid=document.getElementById('grid'),q=document.getElementById('q'),count=document.getElementById('count');
let tone='all',cat=null;
function apply(){
  const s=q.value.trim().toLowerCase();let n=0;
  grid.querySelectorAll('.g').forEach(g=>{
    const okT=tone==='all'||g.dataset.tone===tone;
    const okC=!cat||g.dataset.cat===cat;
    const okS=!s||g.dataset.name.includes(s);
    const show=okT&&okC&&okS;g.style.display=show?'':'none';if(show)n++;
  });
  count.textContent=n+' แบบ';
}
q.addEventListener('input',apply);
document.querySelectorAll('.bar button').forEach(b=>b.addEventListener('click',()=>{
  if(b.dataset.f){tone=b.dataset.f;cat=null;document.querySelectorAll('.bar button').forEach(x=>x.classList.remove('on'));b.classList.add('on');}
  else{cat=cat===b.dataset.c?null:b.dataset.c;document.querySelectorAll('.bar button').forEach(x=>x.classList.remove('on'));if(cat)b.classList.add('on');else document.querySelector('[data-f=all]').classList.add('on');}
  apply();
}));
const ov=document.getElementById('ov'),fr=document.getElementById('ovframe'),nm=document.getElementById('ovname'),lk=document.getElementById('ovlink');
grid.addEventListener('click',e=>{const b=e.target.closest('button[data-src]');if(!b)return;
  fr.src=b.dataset.src;lk.href=b.dataset.src;nm.textContent=b.closest('.g').querySelector('h3').textContent;ov.classList.add('open');});
document.getElementById('ovclose').addEventListener('click',()=>{ov.classList.remove('open');fr.src='about:blank';});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){ov.classList.remove('open');fr.src='about:blank';}});
apply();
</script>
</body>
</html>
`;
fs.writeFileSync(path.join(OUT, 'index.html'), gallery, 'utf8');

console.log('built:', built.length);
console.log('dark:', built.filter((b) => b.dark).length, 'light:', built.filter((b) => !b.dark).length);
if (failed.length) console.log('FAILED:', failed);
console.log('no-readme-meta:', built.filter((b) => b.category === 'อื่น ๆ').map((b) => b.slug).join(', ') || '-');
