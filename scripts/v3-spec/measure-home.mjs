/**
 * เครื่องมือวัดหน้าแรก — อยู่นอกเรพอโดยตั้งใจ
 *
 * ไม่เข้า package.json ไม่เข้า devDependencies ไม่เข้าชุดเทสต์
 * `numeric-font-fence.test.ts` เขียนไว้เองว่าการวัดในเบราว์เซอร์เป็นงานตอนตรวจ ไม่ใช่งานของด่าน
 * เครื่องมือวัดไม่ใช่ผลผลิตของโปรเจกต์
 *
 * ใช้ Edge ที่ติดตั้งในเครื่อง (`channel: "msedge"`) ตามกฎของเจ้าของเครื่อง ไม่ดาวน์โหลด Chromium
 *
 * รัน: node scripts/v3-spec/measure-home.mjs [ความกว้าง]
 */
import { loadPlaywright } from "./playwright.mjs";

const { chromium } = await loadPlaywright();

const width = Number(process.argv[2] ?? 1280);
const URL = "http://localhost:3000/";

const browser = await chromium.launch({ channel: "msedge" });
const page = await browser.newPage({ viewport: { width, height: 900 } });
await page.goto(URL, { waitUntil: "domcontentloaded" });
await page.locator(".v3-hcard__poster").waitFor({ state: "visible" });

const result = await page.evaluate(() => {
  const box = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { w: +r.width.toFixed(2), h: +r.height.toFixed(2), x: +r.x.toFixed(2), y: +r.y.toFixed(2) };
  };
  const css = (sel, ...props) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const s = getComputedStyle(el);
    return Object.fromEntries(props.map((p) => [p, s.getPropertyValue(p)]));
  };

  /* คอนทราสต์คำนวณจากสีที่ getComputedStyle คืนบนของจริง ไม่ใช่จากค่าที่เขียนใน CSS */
  const lum = (rgb) => {
    const [r, g, b] = rgb.match(/[\d.]+/g).slice(0, 3).map(Number).map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (fg, bg) => {
    const a = lum(fg), b = lum(bg);
    return +(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05))).toFixed(2);
  };
  /* พื้นหลังจริงของตัวหนังสือ ไล่ขึ้นไปจนเจอตัวที่ไม่โปร่งใส */
  const bgOf = (el) => {
    let node = el;
    while (node) {
      const bg = getComputedStyle(node).backgroundColor;
      if (bg && !/rgba\(0, 0, 0, 0\)|transparent/.test(bg)) return bg;
      node = node.parentElement;
    }
    return "rgb(255, 255, 255)";
  };
  const contrast = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const s = getComputedStyle(el);
    return { fg: s.color, bg: bgOf(el), ratio: ratio(s.color, bgOf(el)), size: s.fontSize, weight: s.fontWeight };
  };

  return {
    แถบบน: box(".v3-header"),
    แถบหมวด: box(".v3-catbar"),
    ตราคำ: box(".v3-header__brand img"),
    ตะกร้า: box(".v3-header__cart svg"),
    ปุ่มขอใบเสนอราคา: box(".v3-header__right .button"),
    ช่องในแถบบน: document.querySelectorAll(".v3-hslot").length,

    แถวเปิดหน้า: box(".v3-hero"),
    แบนเนอร์: box(".v3-banner"),
    การ์ดHermes: box(".v3-hcard"),
    โปสเตอร์: box(".v3-hcard__poster"),
    กล่องข้อความสไลด์: box(".v3-banner__text"),
    หัวเรื่องสไลด์: box(".v3-banner__title"),
    ปุ่มเลื่อนขวา: box(".v3-banner__nav--next .button"),
    ปุ่มเลื่อนซ้าย: box(".v3-banner__nav--prev .button"),
    ขีดบอกสไลด์: box(".v3-banner__dots .button"),
    ปุ่มShopNow: box(".v3-banner__actions .button"),
    หัวเรื่องการ์ด: box(".v3-hcard__title"),

    สไตล์แบนเนอร์: css(".v3-banner", "border-radius", "padding", "min-height", "background-color"),
    สไตล์ปุ่มเลื่อน: css(".v3-banner__nav--next .button", "border-radius", "background-color", "padding"),
    สไตล์การ์ด: css(".v3-hcard", "border-radius", "background-color"),
    ขีดแดงHermes: box(".v3-hline"),

    คอนทราสต์: {
      หัวเรื่องสไลด์: contrast(".v3-banner__title"),
      เนื้อความสไลด์: contrast(".v3-banner__body"),
      ป้ายสิทธิ์: contrast(".v3-banner .v3-tag"),
      eyebrowการ์ด: contrast(".v3-hcard__eyebrow"),
      หัวเรื่องการ์ด: contrast(".v3-hcard__title"),
      คำโปรยการ์ด: contrast(".v3-hcard__lead"),
      บรรทัดซ่อนการ์ด: contrast(".v3-hsub")
    },

    หน้าล้นแนวนอน: document.documentElement.scrollWidth > document.documentElement.clientWidth
      ? { scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }
      : false
  };
});

console.log(JSON.stringify({ ความกว้างจอ: width, ...result }, null, 2));
await browser.close();
