import type { EntitlementState } from "@/lib/entitlement";

/**
 * Thai labels for the enforced entitlement states, kept beside the back office rather than inside
 * the entitlement module: the states are policy and the wording is presentation, and mixing them
 * would put copy edits inside a file that decides what a user is allowed to do.
 */
export const entitlementStateLabel: Record<EntitlementState | string, string> = {
  trial: "ทดลองใช้งาน",
  active: "ใช้งานเต็มสิทธิ์",
  member_free: "สมาชิกใช้ฟรี",
  doh_staff_only: "บุคลากรกรมทางหลวง",
  expired_read_only: "ครบกำหนด เปิดดูได้อย่างเดียว",
  suspended: "ถูกระงับ",
  // The two states that only exist once an entitlement is resolved against the clock. The back
  // office reads stored states and never meets them; the member's own account panel reads
  // effective ones and does, so they are labelled here rather than in a second copy of this map.
  not_started: "ยังไม่ถึงวันเริ่ม",
  not_activated: "ยังไม่ได้เริ่มใช้งาน"
};
