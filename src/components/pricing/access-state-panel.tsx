import Link from "next/link";
import { formatTrialDate } from "@/lib/estimeter-access-view";
import { landingActionContract } from "@/lib/landing-interactions";
import { resolveEstimeterContext } from "@/server/estimeter/context";
import { Button } from "@/components/platform/button";

/**
 * The Typeform layout this page borrows its shape from puts a running order total here, with a
 * button that charges a card. There is no total to show, so the column answers the question a
 * visitor actually arrives with instead: what am I allowed to do right now, and until when.
 *
 * It deliberately does not print the project cap even for a signed-in member. ADR 0010 holds that
 * no surface before entry names the cap, and this page is one; the real counter lives inside the
 * app, next to the projects it counts.
 *
 * `resolveEstimeterContext` fails closed. Any reason it returns — no session, or an entitlement
 * that cannot be read — lands on the same invitation, because a page that cannot prove what
 * someone has should not guess.
 */

const STATE_LABEL: Record<string, string> = {
  not_started: "ยังไม่มีสิทธิ์ในแอปนี้",
  not_activated: "เป็นสมาชิกแล้ว ยังไม่ได้กดเริ่มทดลองใช้",
  trial: "อยู่ในช่วงทดลองใช้งาน",
  active: "ใช้งานได้เต็มสิทธิ์",
  member_free: "สมาชิกใช้ฟรี",
  doh_staff_only: "สิทธิ์บุคลากรกรมทางหลวง",
  expired_read_only: "ครบกำหนดแล้ว เปิดดูข้อมูลเดิมได้",
  suspended: "สิทธิ์ถูกระงับ"
};

export async function AccessStatePanel() {
  const result = await resolveEstimeterContext();

  if (!result.ok) {
    return (
      <aside className="access-panel" aria-label="สิทธิ์ของคุณ">
        <h2>สิทธิ์ของคุณ</h2>
        <p className="access-panel__lead">
          เข้าสู่ระบบเพื่อดูว่าบัญชีของคุณใช้อะไรได้อยู่ และเหลือเวลาอีกเท่าไหร่
        </p>
        <div className="access-panel__actions">
          <Button tone="primary" href="/market/estimeter">
            เริ่มทดลองใช้งาน
          </Button>
          <Link className="text-link" href={landingActionContract.allAppsHref}>
            ดูแอปทั้งหมด<span aria-hidden="true">→</span>
          </Link>
        </div>
      </aside>
    );
  }

  const { access, user } = result.context;
  const endsAtLabel = formatTrialDate(access.endsAtIso);

  return (
    <aside className="access-panel" aria-label="สิทธิ์ของคุณ">
      <h2>สิทธิ์ของคุณ</h2>
      <p className="access-panel__lead">{user.email}</p>
      <dl className="access-panel__facts">
        <div>
          <dt>สถานะ</dt>
          <dd>{STATE_LABEL[access.state] ?? access.state}</dd>
        </div>
        {access.daysRemaining !== null ? (
          <div>
            <dt>เหลืออีก</dt>
            <dd>{access.daysRemaining} วัน</dd>
          </div>
        ) : null}
        {endsAtLabel ? (
          <div>
            <dt>ครบกำหนด</dt>
            <dd>{endsAtLabel}</dd>
          </div>
        ) : null}
      </dl>
      <div className="access-panel__actions">
        <Button tone="primary" href="/apps/estimeter">
          เปิด ESTIMETR
        </Button>
        <Link className="text-link" href="/enterprise">
          ขอใบเสนอราคาสำหรับหน่วยงาน<span aria-hidden="true">→</span>
        </Link>
      </div>
    </aside>
  );
}
