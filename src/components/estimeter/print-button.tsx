"use client";

import { Button } from "@/components/platform/button";

/**
 * ปุ่มสั่งพิมพ์ backup sheet (IP-243)
 *
 * มีอยู่เพราะ `window.print()` เรียกได้เฉพาะบนเบราว์เซอร์ ส่วนหน้า backup sheet เป็น Server Component
 * ทั้งหน้า · ชิ้นเล็ก ๆ ชิ้นนี้จึงเป็นของเดียวที่ต้องส่งไปทำงานฝั่งเบราว์เซอร์
 *
 * **ไม่มีคลาสของตัวเอง** ทรงกับความสูงมาจาก `<Button>` เหมือนปุ่มทุกตัวในเว็บ
 * `src/button-fence.test.ts` เฝ้าไม่ให้ใครพิมพ์คลาสปุ่มเอง
 */
export function PrintButton() {
  return (
    <Button type="button" onClick={() => window.print()}>
      พิมพ์เอกสาร
    </Button>
  );
}
