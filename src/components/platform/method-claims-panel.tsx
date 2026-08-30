import { claimsForApp } from "@/lib/method-claims";

/**
 * แผงบอกวิธีทำงานของแอป — คำแนะนำตาม ADR 0015 ข้อ 2 ไม่ใช่คำแถลงเรื่องสิทธิ์หรือความพร้อม
 *
 * แสดงได้หลายที่โดยไม่คัดลอกข้อความ เพราะเนื้อความอยู่ที่ `method-claims.ts` ที่เดียว
 * `compact` ใช้เมื่ออยู่ในตัวแอปซึ่งพื้นที่แคบและคนกำลังทำงานอยู่ ไม่ได้มาอ่านโฆษณา
 *
 * **แอปที่ไม่มีข้อไหนเป็นจริงจะไม่เรนเดอร์อะไรเลย** ไม่ใช่เรนเดอร์แผงเปล่าที่มีแต่หัวข้อ
 * หัวข้อที่ตามด้วยความว่างเปล่ายังเป็นการชวนให้คิดว่ามีอะไรอยู่
 */
export function MethodClaimsPanel({ appSlug, compact = false }: { appSlug: string; compact?: boolean }) {
  const claims = claimsForApp(appSlug);
  if (claims.length === 0) return null;

  return (
    <section className={compact ? "method-claims method-claims--compact" : "method-claims"}>
      <div className="method-claims__head">
        <p className="eyebrow">HOW IT WORKS</p>
        <h2>ทำไมตัวเลขจากแอปนี้ถึงตรวจย้อนได้</h2>
        <p>
          งานประมาณราคาผิดพลาดแบบที่เห็นยากที่สุด คือผิดแล้วทุกตัวเลขยังดูสมเหตุสมผล
          แอปนี้จึงวางกลไกไว้ให้ความผิดพลาดแบบนั้นเกิดไม่ได้ตั้งแต่ต้น
        </p>
      </div>

      <ul className="method-claims__list">
        {claims.map((claim) => (
          <li key={claim.title}>
            <strong>{claim.title}</strong>
            <p>{claim.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
