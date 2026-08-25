import { describe, expect, it } from "vitest";
import { businessOperator, describeTrustRow, trustMarks, type TrustMark } from "@/lib/business-identity";

/**
 * ADR 0016. These are the tests that stop someone "just adding the badge": the module is built and
 * deliberately empty, and an empty module is indistinguishable from a broken one unless something
 * says out loud that empty is the intended state today.
 */

const granted: TrustMark = {
  id: "example",
  label: "จดทะเบียนพาณิชย์อิเล็กทรอนิกส์",
  issuer: "กรมพัฒนาธุรกิจการค้า กระทรวงพาณิชย์",
  registrationNumber: "0000000000000",
  verifyUrl: "https://example.invalid/verify",
  imageSrc: "/marks/example.png"
};

describe("a trustmark is only shown once an issuer has granted it", () => {
  it("shows nothing today, because nothing has been registered yet", () => {
    const row = describeTrustRow();

    expect(row.visible).toBe(false);
    expect(row.marks).toEqual([]);
  });

  it("keeps the DBD entry in the catalogue with no number, so granting one is the only step left", () => {
    const dbd = trustMarks.find((mark) => mark.id === "dbd-registered");

    expect(dbd).toBeDefined();
    expect(dbd?.registrationNumber).toBeNull();
    expect(dbd?.issuer).toContain("กรมพัฒนาธุรกิจการค้า");
  });

  it("refuses a mark that has a number but no artwork from the issuer", () => {
    // Half a credential. Drawing the missing half ourselves is the false claim this prevents.
    const row = describeTrustRow([{ ...granted, imageSrc: null }]);

    expect(row.visible).toBe(false);
  });

  it("refuses a mark that has artwork but no number behind it", () => {
    const row = describeTrustRow([{ ...granted, registrationNumber: null }]);

    expect(row.visible).toBe(false);
  });

  it("shows a mark that carries both, and only that one", () => {
    const row = describeTrustRow([granted, { ...granted, id: "pending", registrationNumber: null }]);

    expect(row.visible).toBe(true);
    expect(row.marks.map((mark) => mark.id)).toEqual(["example"]);
  });

  it("keeps the operator's legal name off the page until that is decided", () => {
    // Recorded so the decision has something to switch on, not so the footer prints it today.
    expect(businessOperator.publish).toBe(false);
  });
});
