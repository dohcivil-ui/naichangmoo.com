import { describe, expect, it } from "vitest";
import { describeCardClaims } from "@/lib/catalogue-card";
import { accessLabel, appReadinessLabel } from "@/lib/platform";
import type { AppClaim } from "@/server/app-registry";

/**
 * IP-115 / ADR 0015. The card's rule is "introduce freely, claim only what the registry said", and
 * these hold the claiming half. The introduction is not tested here because it is not decided here.
 *
 * The unannounced case is the one that matters most: it is the state every app in the catalogue is
 * in today, and the state the landing page has been getting wrong since ADR 0014 was accepted.
 */

const unannounced: AppClaim = { announced: false, access: null, open: false, announcedAt: null, availabilityNote: null, expectedOpenMonth: null };
const announcedAt = new Date("2026-03-14T04:00:00.000Z");

describe("what a catalogue card is allowed to say", () => {
  it("says nothing at all about an app nobody announced", () => {
    const says = describeCardClaims(unannounced);

    expect(says.readiness).toBeNull();
    expect(says.access).toBeNull();
    expect(says.announcedOn).toBeNull();
    // The action survives, because a card with no way forward is broken rather than silent — but
    // its wording promises nothing.
    expect(says.cta).toEqual({ label: "ดูรายละเอียดแอป", tone: "quiet" });
  });

  it("refuses to speak even when a row carries an access model, if it was never announced", () => {
    // A row exists for reasons that have nothing to do with an administrator: activateEstimeterTrial
    // writes one the moment a customer starts a trial. readCatalogueClaims already drops the fields;
    // this pins that the card would stay silent regardless.
    const says = describeCardClaims({ announced: false, access: "member_free", open: true, announcedAt, availabilityNote: null, expectedOpenMonth: null });

    expect(says.readiness).toBeNull();
    expect(says.access).toBeNull();
    expect(says.announcedOn).toBeNull();
    expect(says.cta.tone).toBe("quiet");
  });

  it("states access and readiness, and offers entry, once an app is announced and open", () => {
    const says = describeCardClaims({ announced: true, access: "paid_trial", open: true, announcedAt, availabilityNote: null, expectedOpenMonth: null });

    expect(says.readiness).toEqual({ label: appReadinessLabel.open, modifier: "available" });
    expect(says.access).toEqual({ label: accessLabel.paid_trial, modifier: "paid_trial" });
    expect(says.cta).toEqual({ label: "ดูรายละเอียดและเริ่มใช้", tone: "go" });
  });

  it("shows the announcement date only while an announced app is still being prepared", () => {
    const preparing = describeCardClaims({ announced: true, access: "paid_trial", open: false, announcedAt, availabilityNote: null, expectedOpenMonth: null });
    const open = describeCardClaims({ announced: true, access: "paid_trial", open: true, announcedAt, availabilityNote: null, expectedOpenMonth: null });

    // Bangkok, so the 14th rather than the 13th — the formatter pins the zone for exactly this.
    expect(preparing.announcedOn).toBe("14 มี.ค. 2569");
    expect(preparing.readiness).toEqual({ label: appReadinessLabel.preparing, modifier: "coming_soon" });
    expect(preparing.cta.tone).toBe("quiet");

    expect(open.announcedOn).toBeNull();
  });

  it("does not invent a date for an announced app whose row has none", () => {
    const says = describeCardClaims({ announced: true, access: "member_free", open: false, announcedAt: null, availabilityNote: null, expectedOpenMonth: null });

    expect(says.announcedOn).toBeNull();
    expect(says.readiness).toEqual({ label: appReadinessLabel.preparing, modifier: "coming_soon" });
  });
});
