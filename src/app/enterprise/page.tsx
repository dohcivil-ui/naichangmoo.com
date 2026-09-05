import { EnterpriseQuoteForm } from "@/components/landing/enterprise-quote-form";
import { QuoteIcon } from "@/components/icons/platform-icons";
import { PlatformFooter } from "@/components/platform/platform-footer";
import { SiteHeader } from "@/components/platform/site-header";

export default function EnterpriseQuotationPage() {
  return (
    <main className="site-shell">
      <SiteHeader />
      <section className="section enterprise-page">
        <div className="container quote-grid">
          <div className="quote-intro">
            <QuoteIcon title="ขอใบเสนอราคาสำหรับองค์กร" />
            <div className="eyebrow" style={{ color: "var(--teal-text)" }}>ORGANIZATION / AGENCY</div>
            <h1>ขอใบเสนอราคาสำหรับองค์กรหรือหน่วยงาน</h1>
            <p>แจ้งจำนวนผู้ใช้ แอปที่สนใจ และข้อกำหนดจัดซื้อ เพื่อให้ทีมงานจัดทำข้อเสนอที่ตรงกับบริบทการใช้งานของคุณ</p>
            <p>แบบฟอร์มนี้เป็นเพียงการรับ requirement ยังไม่ถือเป็นใบเสนอราคา สัญญา หรือการชำระเงิน</p>
          </div>
          <EnterpriseQuoteForm />
        </div>
      </section>
      <PlatformFooter />
    </main>
  );
}
