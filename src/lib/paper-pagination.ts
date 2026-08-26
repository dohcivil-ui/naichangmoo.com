/**
 * ตัวแบ่งเนื้อหาลงหน้ากระดาษขนาดคงที่
 *
 * มีอยู่เพราะกระดาษ A4 สูง 297 มิลลิเมตรเสมอ ไม่ใช่สูงเท่าที่เนื้อหาต้องการ ของเดิมประกาศ
 * `min-height: 297mm` ซึ่งเป็นขั้นต่ำ พอเนื้อหายาวเกินหนึ่งหน้าแผ่นก็ยืดตามจนได้แผ่นสูง
 * 411 มิลลิเมตร ซึ่งเป็นกระดาษที่ไม่มีอยู่จริง และตัวอย่างบนหน้าจอก็เลยไม่ตรงกับ PDF ที่ได้
 *
 * สามข้อที่กำหนดรูปร่างของโมดูลนี้
 *
 * หนึ่ง — **เป็นฟังก์ชันบริสุทธิ์ รับความสูงเป็นตัวเลข ไม่แตะ DOM** การวัดเป็นหน้าที่ของ
 * คอมโพเนนต์ การตัดสินว่าอะไรอยู่หน้าไหนเป็นหน้าที่ของที่นี่ แยกกันแล้วเทสต์ได้โดยไม่ต้องมีเบราว์เซอร์
 *
 * สอง — **ตารางแตกข้ามหน้าได้ทีละแถว และหัวตารางซ้ำทุกหน้า** แผนสิบงวดกับแผนสองงวด
 * ต้องพิมพ์ได้เหมือนกัน ตารางที่ตัดกลางแล้วหน้าถัดไปไม่มีหัวคอลัมน์ คือตารางที่ผู้ตรวจอ่านไม่ออก
 * ว่าคอลัมน์ไหนคืออะไร
 *
 * สาม — **บล็อกที่สูงเกินหนึ่งหน้าไม่ถูกซ่อน แต่ถูกรายงาน** คืนค่า `overflowing` ออกมาให้
 * ผู้เรียกตัดสิน การตัดเนื้อหาทิ้งเงียบ ๆ บนเอกสารที่จะเอาไปยื่นราชการเป็นความเสียหายที่มองไม่เห็น
 */

/**
 * บล็อกที่แตกไม่ได้ ต้องอยู่ทั้งก้อนในหน้าเดียว
 *
 * `keepWithNext` สำหรับหัวข้อ หัวข้อที่ค้างท้ายหน้าโดยเนื้อหาไปอยู่หน้าถัดไปอ่านเหมือน
 * หัวข้อที่ไม่มีเนื้อหา ซึ่งบนเอกสารที่ผู้ตรวจอ้างถึงด้วยเลขหัวข้อคือความสับสนที่แก้ทีหลังไม่ได้
 */
export type AtomBlock = { kind: "atom"; id: string; height: number; keepWithNext?: boolean };

/** ตารางที่แตกข้ามหน้าได้ทีละแถว โดยหัวตารางซ้ำทุกหน้าที่มันไปโผล่ */
export type RowsBlock = {
  kind: "rows";
  id: string;
  headerHeight: number;
  footerHeight: number;
  rows: { id: string; height: number }[];
};

export type PageBlock = AtomBlock | RowsBlock;

export type PlacedItem =
  | { kind: "atom"; id: string }
  /** แถวที่ `from` ถึง `to` ของตาราง `id` โดย `to` ไม่รวม */
  | { kind: "rows"; id: string; from: number; to: number; withFooter: boolean };

export type Pagination = {
  pages: PlacedItem[][];
  /** id ของบล็อกที่สูงเกินหนึ่งหน้าจนวางให้พอดีไม่ได้ ว่างแปลว่าทุกอย่างลงตัว */
  overflowing: string[];
};

/**
 * จัดบล็อกลงหน้า โดยไล่จากบนลงล่างและขึ้นหน้าใหม่เมื่อของชิ้นถัดไปไม่พอ
 *
 * ไม่พยายามจัดให้สวยหรือเฉลี่ยความยาวหน้า เพราะเอกสารราชการอ่านจากบนลงล่างตามลำดับ
 * การสลับลำดับเพื่อให้หน้าดูเต็มคือการเปลี่ยนเอกสาร ไม่ใช่การจัดหน้า
 */
export function paginate(blocks: readonly PageBlock[], pageHeight: number): Pagination {
  const pages: PlacedItem[][] = [];
  const overflowing: string[] = [];
  let page: PlacedItem[] = [];
  let used = 0;

  const closePage = () => {
    if (page.length > 0) pages.push(page);
    page = [];
    used = 0;
  };

  /** หัวข้อที่เพิ่งวางลงท้ายหน้า ถ้าของถัดไปไม่พอ ต้องยกตามไปด้วย ไม่ปล่อยให้ค้างอยู่ลำพัง */
  const heldHeadings: AtomBlock[] = [];
  const carried: AtomBlock[] = [];

  const carryHeadings = () => {
    carried.length = 0;
    while (heldHeadings.length > 0) {
      const held = heldHeadings.pop()!;
      const last = page[page.length - 1];
      if (!last || last.kind !== "atom" || last.id !== held.id) break;
      page.pop();
      used -= held.height;
      carried.unshift(held);
    }
    heldHeadings.length = 0;
  };

  for (const block of blocks) {
    if (block.kind === "atom") {
      if (block.height > pageHeight) {
        // สูงเกินหนึ่งหน้าทั้งที่แตกไม่ได้ ให้อยู่หน้าของตัวเองแล้วบอกผู้เรียกว่ามันล้น
        closePage();
        pages.push([{ kind: "atom", id: block.id }]);
        overflowing.push(block.id);
        continue;
      }
      if (used + block.height > pageHeight) {
        carryHeadings();
        closePage();
        for (const held of carried) {
          page.push({ kind: "atom", id: held.id });
          used += held.height;
        }
        carried.length = 0;
      }
      page.push({ kind: "atom", id: block.id });
      used += block.height;
      if (block.keepWithNext) heldHeadings.push(block);
      else heldHeadings.length = 0;
      continue;
    }

    let index = 0;
    while (index < block.rows.length) {
      if (used + block.headerHeight + (block.rows[index]?.height ?? 0) > pageHeight && index === 0) {
        carryHeadings();
        closePage();
        for (const held of carried) {
          page.push({ kind: "atom", id: held.id });
          used += held.height;
        }
        carried.length = 0;
      }
      heldHeadings.length = 0;
      if (used + block.headerHeight >= pageHeight) closePage();
      let height = used + block.headerHeight;
      const from = index;
      while (index < block.rows.length && height + block.rows[index]!.height <= pageHeight) {
        height += block.rows[index]!.height;
        index += 1;
      }

      if (index === from) {
        // แถวเดียวยังไม่พอ แปลว่าหน้านี้เหลือที่น้อยเกินไป ขึ้นหน้าใหม่แล้วลองอีกครั้ง
        if (used > 0) {
          closePage();
          continue;
        }
        // หน้าว่างแล้วยังไม่พอ แถวนั้นสูงเกินหนึ่งหน้าจริง ๆ ต้องวางแล้วรายงาน
        height += block.rows[index]!.height;
        index += 1;
        overflowing.push(block.rows[from]!.id);
      }

      const last = index >= block.rows.length;
      const footerFits = height + block.footerHeight <= pageHeight;
      page.push({ kind: "rows", id: block.id, from, to: index, withFooter: last && footerFits });
      used = height + (last && footerFits ? block.footerHeight : 0);

      if (last && !footerFits) {
        // ท้ายตารางไม่พอในหน้านี้ ยกไปหน้าถัดไปพร้อมหัวตาราง ไม่ปล่อยให้ยอดรวมลอยไม่มีคอลัมน์กำกับ
        closePage();
        page.push({ kind: "rows", id: block.id, from: index, to: index, withFooter: true });
        used = block.headerHeight + block.footerHeight;
      }
      if (!last) closePage();
    }
  }

  closePage();
  return { pages: pages.length > 0 ? pages : [[]], overflowing };
}

/** หนึ่งมิลลิเมตรเป็นพิกเซลที่การย่อขยายปกติ 96 จุดต่อนิ้ว */
export const PX_PER_MM = 96 / 25.4;

/** ความสูงของพื้นที่พิมพ์ต่อหนึ่งหน้า A4 ตามระยะขอบที่ document-print.css ประกาศไว้ */
export const PAGE_CONTENT_HEIGHT_MM = 297 - 25 - 15;
export const PAGE_CONTENT_WIDTH_MM = 210 - 25 - 15;
