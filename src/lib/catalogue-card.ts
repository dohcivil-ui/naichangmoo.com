import type { AppAccess } from "@/lib/platform";
import { accessLabel, appReadinessLabel } from "@/lib/platform";
import { formatThaiDate } from "@/lib/thai-format";
import type { AppClaim } from "@/server/app-registry";

/**
 * Everything a catalogue card is allowed to say, worked out from the registry alone.
 *
 * ADR 0015 splits the card in two. The introduction — name, icon, purpose — comes from
 * `platformApps` and is not decided here at all. The four fields below are the claims, and every
 * one of them can be `null`: an app nobody has announced gets a card with an introduction and
 * nothing else, which is the correct output rather than a degraded one.
 *
 * This lives apart from the component so the rules are held by tests that need no DOM. The card
 * is then markup, and the question "may the card say this" has exactly one answer in one file.
 */
export type CardClaimView = {
  readiness: { label: string; modifier: "available" | "coming_soon" } | null;
  access: { label: string; modifier: AppAccess } | null;
  /** Only while announced and not yet open — see `describeCardClaims`. */
  announcedOn: string | null;
  cta: { label: string; tone: "go" | "quiet" };
};

export function describeCardClaims(claim: AppClaim): CardClaimView {
  const open = claim.announced && claim.open;

  return {
    readiness: claim.announced
      ? open
        ? { label: appReadinessLabel.open, modifier: "available" }
        : { label: appReadinessLabel.preparing, modifier: "coming_soon" }
      : null,

    access: claim.announced && claim.access ? { label: accessLabel[claim.access], modifier: claim.access } : null,

    /**
     * An open app has already answered "when" — now — and an unannounced one has no date anyone
     * put their name to. The date earns its place in exactly one state: announced, still being
     * prepared. ADR 0015 §5 also settles why it is this date and not a progress percentage.
     */
    announcedOn: claim.announced && !open ? formatThaiDate(claim.announcedAt) : null,

    /**
     * The wording is a claim too: inviting someone to start using an app asserts there is a way
     * in. Both variants lead to the detail page, so neither promises entry the door would refuse.
     */
    cta: open ? { label: "ดูรายละเอียดและเริ่มใช้", tone: "go" } : { label: "ดูรายละเอียดแอป", tone: "quiet" }
  };
}
