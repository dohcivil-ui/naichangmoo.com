import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { title?: string };

function BaseIcon({ title, children, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden={title ? undefined : true} role={title ? "img" : undefined} {...props}>
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export function NaiChangMooMark(props: IconProps) {
  return <BaseIcon {...props}><path d="M7 39h34" /><path d="M11 39V18l13-9 13 9v21" /><path d="M17 39V25h14v14" /><path d="M20 18h8" /><path d="M24 14v8" /></BaseIcon>;
}

export function EstimateIcon(props: IconProps) {
  return <BaseIcon {...props}><rect x="9" y="6" width="24" height="35" rx="3" /><path d="M16 14h10M16 21h10M16 28h4" /><path d="M36 28v11M31 34h10" /></BaseIcon>;
}

export function WallIcon(props: IconProps) {
  return <BaseIcon {...props}><path d="M8 39h32" /><path d="M11 39 19 12h15l4 27" /><path d="M14 29h22M17 20h18" /><path d="M22 12v27M30 12v27" /></BaseIcon>;
}

export function SignIcon(props: IconProps) {
  return <BaseIcon {...props}><path d="M24 39V25" /><path d="M15 39h18" /><rect x="10" y="7" width="28" height="18" rx="2" /><path d="m17 19 5-6 4 4 3-3 3 5" /></BaseIcon>;
}

export function LandIcon(props: IconProps) {
  return <BaseIcon {...props}><path d="M8 39h32" /><path d="M11 39V15l13-7 13 7v24" /><path d="M18 39V26h12v13" /><path d="M17 19h.01M24 19h.01M31 19h.01" /></BaseIcon>;
}

export function HermesIcon(props: IconProps) {
  return <BaseIcon {...props}><path d="M10 19a14 14 0 0 1 28 0v12a7 7 0 0 1-7 7H17a7 7 0 0 1-7-7V19Z" /><path d="M17 24h.01M31 24h.01M19 31c3 2 7 2 10 0" /><path d="M24 5v5M8 14l4 3M40 14l-4 3" /></BaseIcon>;
}

export function QuoteIcon(props: IconProps) {
  return <BaseIcon {...props}><path d="M10 7h19l9 9v25H10z" /><path d="M29 7v10h9M17 24h14M17 31h10" /><path d="m31 33 3 3 6-7" /></BaseIcon>;
}

export function ShieldIcon(props: IconProps) {
  return <BaseIcon {...props}><path d="M24 5 39 11v11c0 9-6.4 16.2-15 20-8.6-3.8-15-11-15-20V11z" /><path d="m18 24 4 4 8-9" /></BaseIcon>;
}

/**
 * The four below are commissioned but not yet drawn.
 *
 * Each one stands for a symbol the interface currently spells with a character — a check mark, an
 * empty circle, an em dash and an arrow — every one of them wrapped in `aria-hidden`, which is the
 * admission that the character was doing an icon's job. The house rule is that symbols are drawn
 * artwork, never characters, so those sites are waiting on these.
 *
 * They render nothing on purpose. An empty frame is honest about being unfinished, where a stand-in
 * glyph would quietly become the thing it was meant to replace. Nothing calls them yet, so the
 * interface is unchanged until the artwork lands and the swap happens deliberately.
 *
 * The prompt that produces the path data, and the subject line written for each one, are in
 * `docs/design-system/icon-prompts.md`. Paste only the inner elements: `BaseIcon` above already
 * supplies the `<svg>`, the 48-unit grid and the stroke, and a second wrapper would cost the icon
 * its colour inheritance.
 */

export function CheckIcon(props: IconProps) {
  return <BaseIcon {...props} />;
}

export function PendingIcon(props: IconProps) {
  return <BaseIcon {...props} />;
}

export function NotIncludedIcon(props: IconProps) {
  return <BaseIcon {...props} />;
}

export function ArrowRightIcon(props: IconProps) {
  return <BaseIcon {...props} />;
}
