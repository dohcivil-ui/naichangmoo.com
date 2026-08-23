import Link from "next/link";
import { SignInButton } from "@/components/landing/sign-in-button";

const copy = {
  unauthenticated: {
    heading: "ต้องเข้าสู่ระบบก่อนใช้งาน ESTIMETR",
    detail: "ระบบตรวจสอบสิทธิ์การใช้งานบนฝั่งเซิร์ฟเวอร์หลังยืนยันตัวตน จึงต้องเข้าสู่ระบบด้วยบัญชีนายช่างหมูก่อน"
  },
  entitlement_unavailable: {
    heading: "ตรวจสอบสิทธิ์การใช้งานไม่ได้ชั่วคราว",
    detail: "ระบบยังไม่สามารถยืนยันสิทธิ์ของบัญชีนี้ได้ จึงยังไม่เปิดพื้นที่ทำงานให้ กรุณาลองใหม่อีกครั้ง หากยังพบปัญหาให้แจ้งผู้ดูแลระบบพร้อมเวลาที่เกิดเหตุ"
  }
} as const;

export function EstimeterEntryBlocked({ reason }: { reason: keyof typeof copy }) {
  const { heading, detail } = copy[reason];

  return (
    <section className="app-workspace-intro">
      <div className="container">
        <div className="eyebrow">ESTIMETR · ACCESS CHECK</div>
        <h1>{heading}</h1>
        <p className="hero__note">{detail}</p>
        <div className="hero__actions">
          {reason === "unauthenticated" ? <SignInButton /> : null}
          <Link className="button button--orange micro-button" href="/">กลับหน้ารวมแอป</Link>
        </div>
      </div>
    </section>
  );
}
