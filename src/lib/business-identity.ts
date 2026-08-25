/**
 * Who operates the platform, and which marks it is entitled to display.
 *
 * ADR 0016. A trustmark is a claim with an issuer, exactly as an app's access model is a claim with
 * an administrator. The registry pattern is the same and so is the failure mode: a mark rendered
 * before an authority granted it is an assertion of a registration that does not exist, which is a
 * legal matter rather than a design one. So this file ships populated with the *shape* and empty of
 * *evidence*, and the renderer below refuses anything it cannot back.
 *
 * Adding a mark later — a new company registration, a payment provider's badge — is one entry in
 * `trustMarks` and no code at all.
 */

export type TrustMark = {
  id: string;
  /** What the mark asserts, in one line. Used as the image's alt text. */
  label: string;
  /** Who granted it. A mark with no issuer is decoration wearing a uniform. */
  issuer: string;
  /**
   * The number the issuer granted. `null` means not granted yet, and while it is null the mark does
   * not render. This is the field that turns the mark on, and only the issuer can fill it.
   */
  registrationNumber: string | null;
  /** Where a visitor can check the number against the issuer. `null` where the issuer publishes no lookup. */
  verifyUrl: string | null;
  /**
   * The issuer's own artwork, served from this origin. Never a lookalike drawn in-house: a mark
   * that resembles an official one without being it is the same false claim with extra steps.
   */
  imageSrc: string | null;
};

/**
 * The legal entity that operates the platform and receives payment.
 *
 * `publish` is false because putting a legal name on the page is the owner's decision and has not
 * been made, and because no payment is collected anywhere yet (IP-081). The fact is recorded here
 * so the decision has something to switch on rather than something to rediscover.
 */
export const businessOperator = {
  legalName: "หจก.ไทสกลวิศวกรรม",
  publish: false
} as const;

export const trustMarks: TrustMark[] = [
  {
    id: "dbd-registered",
    label: "จดทะเบียนพาณิชย์อิเล็กทรอนิกส์",
    issuer: "กรมพัฒนาธุรกิจการค้า กระทรวงพาณิชย์",
    // Not granted. The mark stays off the page until it is, and filling this in is the whole act.
    registrationNumber: null,
    verifyUrl: null,
    imageSrc: null
  }
];

export type TrustRowView = {
  /** Only the marks that can be backed. Never partially-filled ones. */
  marks: Array<TrustMark & { registrationNumber: string; imageSrc: string }>;
  /** False when nothing qualifies, so the footer renders no row at all rather than an empty strip. */
  visible: boolean;
};

/**
 * A mark renders only when the issuer has granted a number **and** supplied the artwork. Either one
 * missing means we would be filling in the other half ourselves, which is the thing this module
 * exists to prevent.
 */
export function describeTrustRow(marks: readonly TrustMark[] = trustMarks): TrustRowView {
  const renderable = marks.filter(
    (mark): mark is TrustMark & { registrationNumber: string; imageSrc: string } =>
      Boolean(mark.registrationNumber && mark.imageSrc)
  );

  return { marks: renderable, visible: renderable.length > 0 };
}
