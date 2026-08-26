/* ESTIMETR manual take-off — one screen, rendered from any DESIGN.md token set.
   Mirrors the real page: src/app/apps/estimeter/projects/[projectId]/takeoff/page.tsx */

export const ROWS = [
  {
    cat: 'งานคอนกรีต', desc: 'เสา C1 ชั้น 2 (8 ต้น)', unit: 'ลบ.ม.',
    gross: '2.304', waste: '3', qty: '2.373', state: 'confirmed',
    wasteNote: 'หลักเกณฑ์การเผื่อวัสดุมวลรวม งานคอนกรีตหล่อในที่ 3%',
    lines: [{ label: 'เสา C1 ต้นที่ 1–8', working: '8 × 0.30 × 0.30 × 3.20', sub: '2.304' }],
    ev: [{ note: 'แบบ S-04 ผังเสาชั้น 2 ตรวจกับ Rev.C', page: '12' }],
  },
  {
    cat: 'งานคอนกรีต', desc: 'คาน B1 ชั้น 2 (6 ตัว)', unit: 'ลบ.ม.',
    gross: '2.160', waste: '3', qty: '2.225', state: 'confirmed',
    wasteNote: 'หลักเกณฑ์การเผื่อวัสดุมวลรวม งานคอนกรีตหล่อในที่ 3%',
    lines: [{ label: 'คาน B1 ช่วง A–B', working: '6 × 0.20 × 0.40 × 4.50', sub: '2.160' }],
    ev: [{ note: 'แบบ S-05 ตารางคาน ช่วง A-B', page: '13' }],
  },
  {
    cat: 'งานคอนกรีต', desc: 'พื้น S1 ห้องประชุม', unit: 'ลบ.ม.',
    gross: '2.400', waste: '3', qty: '2.472', state: 'confirmed',
    wasteNote: 'หลักเกณฑ์การเผื่อวัสดุมวลรวม งานคอนกรีตหล่อในที่ 3%',
    lines: [{ label: 'พื้น S1 หนา 0.12 ม.', working: '1 × 4.00 × 5.00 × 0.12', sub: '2.400' }],
    ev: [{ note: 'แบบ S-07 ผังพื้นชั้น 2', page: '15' }],
  },
  {
    cat: 'งานเหล็กเสริม', desc: 'DB16 เสา C1 (4 เส้น/ต้น)', unit: 'กก.',
    gross: '181.79', waste: '0', qty: '181.79', state: 'confirmed',
    lines: [{ label: 'DB16 เสา C1 ทั้ง 8 ต้น', working: '32 × 3.60 × 1.578', sub: '181.79', conv: 'DB16 = 1.578 กก./ม. ตารางน้ำหนักเหล็กเสริม' }],
    ev: [{ note: 'แบบ S-04 ตารางเหล็กเสริมเสา', page: '12' }, { note: 'ตารางน้ำหนักเหล็กเสริม มอก.24-2559', page: '' }],
  },
  {
    cat: 'งานผนัง', desc: 'ก่ออิฐมอญครึ่งแผ่น ห้อง 201', unit: 'ตร.ม.',
    gross: '9.400', waste: '0', qty: '9.400', state: 'confirmed',
    lines: [
      { label: 'ผนังห้อง 201 ด้านทิศเหนือ', working: '1 × 4.00 × 2.80', sub: '11.200' },
      { label: 'หักช่องประตู ป-1', working: '−1 × 0.90 × 2.00', sub: '−1.800' },
    ],
    ev: [{ note: 'แบบ A-11 ผังผนังห้อง 201 Rev.B', page: '24' }],
  },
  {
    cat: 'งานฉาบปูน', desc: 'ฉาบเรียบ 2 ด้าน ห้อง 201', unit: 'ตร.ม.',
    gross: '18.800', waste: '0', qty: '18.800', state: 'confirmed',
    lines: [{ label: 'ฉาบสองด้านของผนังห้อง 201', working: '2 × 9.40', sub: '18.800' }],
    ev: [{ note: 'แบบ A-11 ผังผนังห้อง 201 Rev.B', page: '24' }],
  },
  {
    cat: 'งานหลังคา', desc: 'โครงหลังคาเหล็ก ช่วง A–B', unit: 'ตร.ม.',
    gross: null, waste: '0', qty: '—', state: 'review',
    lines: [], ev: [],
  },
];

const CATS = ['งานคอนกรีต', 'งานเหล็กเสริม', 'งานผนัง', 'งานฉาบปูน', 'งานหลังคา', 'งานระบบสุขาภิบาล'];
const UNITS = ['ลบ.ม.', 'ตร.ม.', 'กก.', 'ตัน', 'เมตร', 'ชุด'];

export function renderPage(p, u) {
  const { mix, rgba, contrast } = u;
  const softOk = mix(p.card, p.success, p.dark ? 0.22 : 0.14);
  const softWarn = mix(p.card, p.warning, p.dark ? 0.22 : 0.14);
  const onOk = p.dark ? mix(p.success, '#ffffff', 0.45) : mix(p.success, '#000000', 0.25);
  const onWarn = p.dark ? mix(p.warning, '#ffffff', 0.45) : mix(p.warning, '#000000', 0.35);
  const accentText = contrast(p.accent, p.card) >= 2.6 ? p.accent : p.numColor;
  const onAccent = contrast(p.accent, '#ffffff') >= contrast(p.accent, '#111111') ? '#ffffff' : '#111111';

  const measForm = (i) => `
              <div class="miniform">
                <p class="mf-title">เพิ่มบรรทัดการวัด</p>
                <div class="mf-grid">
                  <label>ชื่อบรรทัด<input value="" placeholder="เช่น F1 ฐานรากมุมอาคาร"></label>
                  <label>จำนวน<input value="" placeholder="เช่น 1.50"></label>
                  <label>ขนาด (ม.)<input value="" placeholder="เช่น 0.30 × 0.30 × 3.20"></label>
                  <label>ตัวคูณแปลงหน่วย<input value="" placeholder="เช่น 0.888"></label>
                  <label class="wide">ที่มาของตัวคูณ<input value="" placeholder="เช่น DB12 = 0.888 กก./ม. ตารางน้ำหนักเหล็กเสริม"></label>
                </div>
                <button class="btn btn-secondary sm">บันทึกบรรทัด</button>
              </div>
              <div class="miniform">
                <p class="mf-title">ค่าเผื่อสูญเสีย</p>
                <div class="mf-grid">
                  <label>เผื่อ (%)<input value="${ROWS[i].waste}" placeholder="เช่น 7"></label>
                  <label class="wide">ที่มาค่าเผื่อ<input value="${ROWS[i].wasteNote || ''}" placeholder="เช่น หลักเกณฑ์การเผื่อวัสดุมวลรวม งานเหล็กเสริม 7%"></label>
                </div>
                <button class="btn btn-secondary sm">บันทึกค่าเผื่อ</button>
              </div>`;

  const evForm = `
              <div class="miniform">
                <p class="mf-title">เพิ่มหลักฐานอ้างอิง</p>
                <div class="mf-grid">
                  <label class="wide">หลักฐาน<input value="" placeholder="เช่น แบบ S-05 คาน B1 ช่วง A-B วัดจากตารางคาน"></label>
                  <label>หน้า<input value="" placeholder="ไม่ระบุก็ได้"></label>
                </div>
                <button class="btn btn-secondary sm">แนบหลักฐาน</button>
              </div>`;

  const rows = ROWS.map((r, i) => {
    const locked = r.state === 'confirmed';
    const lines = r.lines.length
      ? `<ul class="mlist">${r.lines.map((l) => `<li><b>${l.label}</b><span class="work">${l.working} = ${l.sub} ${r.unit}</span>${l.conv ? `<em>${l.conv}</em>` : ''}${locked ? '' : '<button class="linkbtn">ลบบรรทัด</button>'}</li>`).join('')}</ul>`
      : '<p class="empty">ยังไม่ได้วัด — ปริมาณจะยืนยันไม่ได้จนกว่าจะมีบรรทัดการวัดอย่างน้อยหนึ่งบรรทัด</p>';
    const evs = r.ev.length
      ? `<ul class="elist">${r.ev.map((e) => `<li>${e.note}${e.page ? `<em> · หน้า ${e.page}</em>` : ''}</li>`).join('')}</ul>`
      : '<p class="empty">ยังไม่มีหลักฐาน</p>';

    return `            <tr>
              <td class="k">${r.cat}</td>
              <td>${r.desc}</td>
              <td class="right num${r.qty === '—' ? '' : ' q'}">${r.qty}
                ${r.gross === null ? '<em class="qnote">ยังไม่มีรายการคำนวณ</em>' : (Number(r.waste) > 0 ? `<em class="qnote">วัดได้ ${r.gross} · เผื่อ ${r.waste}%</em>` : '')}
              </td>
              <td>${r.unit}</td>
              <td class="cell-wide">
                <details${i === 0 ? ' open' : ''}>
                  <summary>${r.lines.length ? `${r.lines.length} บรรทัด` : 'ยังไม่ได้วัด'}</summary>
                  <div class="dbody">
                    ${lines}
                    ${r.wasteNote ? `<p class="src">ที่มาค่าเผื่อ: ${r.wasteNote}</p>` : ''}
                    ${locked ? '<p class="src">รายการนี้ยืนยันแล้ว จึงแก้ไขบรรทัดการวัดไม่ได้</p>' : measForm(i)}
                  </div>
                </details>
              </td>
              <td class="cell-wide">
                <details>
                  <summary>${r.ev.length ? `${r.ev.length} รายการ` : 'ยังไม่มีหลักฐาน'}</summary>
                  <div class="dbody">
                    ${evs}
                    ${locked ? '' : evForm}
                  </div>
                </details>
              </td>
              <td><span class="chip ${locked ? 'chip-ok' : 'chip-warn'}">${locked ? 'ยืนยันแล้ว' : 'ต้องตรวจ'}</span></td>
              <td class="actions"><div class="actwrap">
                ${locked
        ? '<span class="src">ล็อกแล้ว</span>'
        : '<button class="btn btn-primary sm" disabled title="ต้องมีทั้งรายการคำนวณและหลักฐานก่อน">ยืนยันปริมาณ</button><button class="linkbtn">ลบ</button>'}
              </div></td>
            </tr>`;
  }).join('\n');

  return `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ESTIMETR · ${p.name}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${p.fontsHref}" rel="stylesheet">
<style>
:root{
  --canvas:${p.canvas}; --card:${p.card}; --s2:${p.surface2}; --hair:${p.hair}; --hair-s:${p.hairStrong};
  --ink:${p.ink}; --muted:${p.muted}; --subtle:${p.subtle};
  --primary:${p.primary}; --on-primary:${p.onPrimary}; --accent:${p.accent}; --on-accent:${onAccent};
  --accent-text:${accentText}; --num:${p.numColor};
  --ok:${p.success}; --warn:${p.warning}; --soft-ok:${softOk}; --soft-warn:${softWarn}; --on-ok:${onOk}; --on-warn:${onWarn};
  --r-btn:${p.rBtn}px; --r-card:${p.rCard}px; --r-input:${p.rInput}px; --r-badge:${p.rBadge}px;
  --pad-card:${p.padCard}; --shadow:${p.shadow};
}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--canvas);color:var(--muted);
  font-family:"${p.bodyThai}","${p.bodyLatin}",system-ui,sans-serif;
  font-size:${p.bSize}px;line-height:${p.bLH};font-weight:${p.bWeight};-webkit-font-smoothing:antialiased}
h1,h2,h3,.disp{font-family:"${p.dispThai}","${p.dispLatin}",system-ui,sans-serif;color:var(--ink)}
.num{font-variant-numeric:tabular-nums}
code,.mono{font-family:"${p.monoLatin}",ui-monospace,monospace}
a{color:inherit;text-decoration:none}
button{font-family:inherit;cursor:pointer}
input,select{font:inherit}

/* ---- chrome ---- */
.ctxbar{background:var(--s2);border-bottom:1px solid var(--hair);font-size:12.5px;color:var(--subtle)}
.ctxbar div{max-width:1220px;margin:0 auto;padding:9px 28px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.ctxbar b{color:var(--ink);font-weight:600}
.ctxbar a{color:var(--accent-text);font-weight:600}
.topnav{height:${p.navH}px;display:flex;align-items:center;gap:22px;padding:0 28px;background:var(--canvas);
  border-bottom:1px solid var(--hair);position:sticky;top:0;z-index:9}
.brand{display:flex;align-items:center;gap:10px;font-weight:700;font-size:16px;color:var(--ink)}
.brand i{width:20px;height:20px;border-radius:${Math.min(p.rBtn, 10)}px;background:var(--primary);display:block}
.topnav nav{display:flex;gap:18px;font-size:14px;color:var(--subtle)}
.topnav nav a.on{color:var(--ink);font-weight:600}
.topnav .sp{flex:1}
.btn{font-size:${p.btnSize}px;font-weight:${p.btnWeight};line-height:1.15;padding:${p.padBtn};
  border:1px solid transparent;border-radius:var(--r-btn)}
.btn.sm{font-size:12.5px;padding:7px 12px}
.btn-primary{background:var(--primary);color:var(--on-primary)}
.btn-accent{background:var(--accent);color:var(--on-accent)}
.btn-secondary{background:var(--card);color:var(--ink);border-color:var(--hair-s)}
.btn-ghost{background:transparent;color:var(--subtle)}
.btn:disabled{opacity:.45;cursor:not-allowed}
.linkbtn{background:none;border:0;color:var(--subtle);font-size:12px;text-decoration:underline;padding:0}

.wrap{max-width:1220px;margin:0 auto;padding:32px 28px 80px}
.crumbs{font-size:12px;color:var(--subtle);display:flex;gap:8px;margin-bottom:20px}
.eyebrow{font-size:${p.eyeSize}px;font-weight:${p.eyeWeight};letter-spacing:${p.eyeLS}px;color:var(--accent-text);
  ${p.eyeUpper ? 'text-transform:uppercase;' : ''}margin-bottom:12px}
h1{font-size:${p.dSize}px;font-weight:${p.dW};line-height:${p.dLH};letter-spacing:${p.dLS.toFixed(2)}px}
.lead{font-size:${Math.round(p.bSize * 1.05)}px;color:var(--muted);max-width:62ch;margin-top:14px}
.head{display:flex;justify-content:space-between;align-items:flex-start;gap:32px;padding-bottom:26px;
  border-bottom:1px solid var(--hair)}
.progress{background:var(--card);border:1px solid var(--hair);border-radius:var(--r-card);padding:16px 20px;
  text-align:right;min-width:150px;box-shadow:var(--shadow)}
.progress span{display:block;font-size:11px;font-weight:600;letter-spacing:.6px;color:var(--subtle);text-transform:uppercase}
.progress strong{display:block;font-size:30px;font-weight:${p.dW};letter-spacing:-.6px;margin:4px 0;color:var(--accent-text)}
.progress small{font-size:12px;color:var(--subtle)}

.notice{margin:20px 0;border-left:3px solid var(--accent);background:${mix(p.card, p.accent, p.dark ? 0.14 : 0.08)};
  padding:12px 16px;font-size:13px;border-radius:0 var(--r-input) var(--r-input) 0}
.notice b{color:var(--ink)}

/* ---- 4-step rail ---- */
.steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:22px 0 26px}
.step{background:var(--card);border:1px solid var(--hair);border-radius:var(--r-card);padding:14px;
  display:flex;flex-direction:column;gap:6px;align-items:flex-start;text-align:left}
.step.is-active{border-color:var(--primary);background:var(--s2);box-shadow:inset 0 0 0 1px ${rgba(p.primary, 0.14)}}
.step.is-done .n{background:var(--primary);color:var(--on-primary)}
.step.is-locked{opacity:.55}
.step .n{width:28px;height:28px;display:grid;place-items:center;border-radius:${Math.min(p.rBadge, 999) > 20 ? '50%' : 'var(--r-input)'};
  background:var(--s2);color:var(--accent-text);font-size:12px;font-weight:700}
.step b{color:var(--ink);font-size:14px;font-weight:600}
.step small{font-size:10.5px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:var(--subtle)}
.step em{font-style:normal;font-size:12px;color:var(--subtle);line-height:1.45}

.grid{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:22px;align-items:start}
.card{background:var(--card);border:1px solid var(--hair);border-radius:var(--r-card);padding:var(--pad-card);
  margin-bottom:22px;box-shadow:var(--shadow)}
.card-head{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:6px;
  padding-bottom:14px;border-bottom:1px solid var(--hair)}
.card-head h2{font-size:${Math.round(p.dSize * 0.5)}px;font-weight:${Math.max(500, p.dW - 100)};line-height:1.3;letter-spacing:-.3px}
.note{font-size:13px;color:var(--subtle);margin:14px 0 18px}
.chip{display:inline-block;font-size:12px;font-weight:600;padding:4px 10px;border-radius:var(--r-badge);
  background:var(--s2);color:var(--muted);white-space:nowrap}
.chip-ok{background:var(--soft-ok);color:var(--on-ok)}
.chip-warn{background:var(--soft-warn);color:var(--on-warn)}

/* ---- tables ---- */
.tw{overflow-x:auto;border:1px solid var(--hair);border-radius:var(--r-card);margin-bottom:18px}
table{width:100%;border-collapse:collapse;font-size:13px;min-width:900px}
.tw--narrow table{min-width:420px}
th{text-align:left;font-size:10.5px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--subtle);
  background:${p.theadBg};padding:10px 12px;white-space:nowrap;border-bottom:1px solid var(--hair-s)}
td{padding:12px;border-top:1px solid var(--hair);color:var(--muted);vertical-align:top}
tbody tr:hover td{background:var(--s2)}
td.k{color:var(--ink);font-weight:600;white-space:nowrap}
td.q{color:var(--num);font-weight:700}
.right{text-align:right}
.cell-wide{min-width:200px}
.qnote{display:block;font-style:normal;font-size:11px;font-weight:400;color:var(--subtle);margin-top:3px;white-space:nowrap}
.actions{white-space:nowrap}
.actwrap{display:flex;flex-direction:column;gap:6px;align-items:flex-start}

/* ---- expandable measurement / evidence cells ---- */
details summary{cursor:pointer;font-size:12.5px;color:var(--accent-text);font-weight:600;list-style:none}
details summary::-webkit-details-marker{display:none}
details summary::before{content:"▸ ";font-size:10px}
details[open] summary::before{content:"▾ "}
.dbody{margin-top:10px;padding:12px;background:var(--s2);border-radius:var(--r-input)}
td .dbody{max-width:340px}
.mlist,.elist{list-style:none;display:grid;gap:9px}
.mlist li,.elist li{font-size:12.5px;color:var(--muted);padding-bottom:9px;border-bottom:1px solid var(--hair)}
.mlist li:last-child,.elist li:last-child{border-bottom:0;padding-bottom:0}
.mlist b{display:block;color:var(--ink);font-weight:600;margin-bottom:2px}
.work{font-family:"${p.monoLatin}",monospace;font-size:12px;color:var(--subtle);font-variant-numeric:tabular-nums}
.mlist em,.elist em{font-style:normal;font-size:11.5px;color:var(--subtle);display:block;margin-top:2px}
.empty{font-size:12px;color:var(--subtle);line-height:1.5}
.src{font-size:11.5px;color:var(--subtle);margin-top:8px;line-height:1.5}
.miniform{margin-top:12px;padding-top:12px;border-top:1px dashed var(--hair-s)}
.mf-title{font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--subtle);margin-bottom:8px}
.mf-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:9px}
.mf-grid label{display:grid;gap:4px;font-size:11.5px;color:var(--subtle)}
.mf-grid label.wide{grid-column:1/-1}
.mf-grid input{background:var(--card);border:1px solid var(--hair-s);border-radius:var(--r-input);
  padding:7px 10px;font-size:12.5px;color:var(--ink)}
.mf-grid input:focus{outline:none;border-color:var(--primary);box-shadow:0 0 0 3px ${rgba(p.primary, 0.16)}}

/* ---- add item form ---- */
.additem{background:var(--s2);border-radius:var(--r-card);padding:18px;margin-bottom:18px}
.additem .mf-title{margin-bottom:10px}
.ai-grid{display:grid;grid-template-columns:180px minmax(0,1fr) 140px auto;gap:10px;align-items:end}
.ai-grid label{display:grid;gap:5px;font-size:12px;color:var(--subtle)}
.ai-grid input,.ai-grid select{background:var(--card);border:1px solid var(--hair-s);border-radius:var(--r-input);
  padding:9px 11px;font-size:13px;color:var(--ink)}
.ai-grid input:focus,.ai-grid select:focus{outline:none;border-color:var(--primary);box-shadow:0 0 0 3px ${rgba(p.primary, 0.16)}}

/* ---- callout + totals ---- */
.callout{display:flex;justify-content:space-between;gap:18px;align-items:center;
  border-top:1px solid var(--hair);padding-top:18px;margin-top:4px}
.callout strong{display:block;color:var(--ink);font-size:14px;font-weight:700}
.callout p{font-size:12.5px;color:var(--subtle);margin-top:4px;max-width:62ch}
.total{display:flex;justify-content:space-between;align-items:center;gap:16px;margin:18px 0;padding:18px 22px;
  background:var(--primary);color:var(--on-primary);border-radius:var(--r-card)}
.total span{font-size:13.5px;font-weight:600}
.total b{font-family:"${p.dispThai}","${p.dispLatin}",sans-serif;font-size:${Math.round(p.dSize * 0.6)}px;
  font-weight:${p.dW};letter-spacing:-.6px;font-variant-numeric:tabular-nums}

/* ---- sidebar ---- */
.side .card{padding:20px}
.side h3{font-size:15px;font-weight:700;margin-bottom:12px}
.stat{display:flex;justify-content:space-between;align-items:baseline;padding:10px 0;border-bottom:1px solid var(--hair)}
.stat:last-child{border-bottom:0}
.stat span{font-size:13px;color:var(--subtle)}
.stat b{font-family:"${p.dispThai}","${p.dispLatin}",sans-serif;font-size:18px;font-weight:700;
  color:var(--num);font-variant-numeric:tabular-nums}
.rail{list-style:none;display:grid;gap:12px}
.rail li{display:flex;gap:10px;font-size:12.5px;color:var(--subtle);line-height:1.45}
.rail li>span{width:24px;height:24px;flex:0 0 auto;display:grid;place-items:center;border-radius:50%;
  background:var(--s2);color:var(--accent-text);font-size:11px;font-weight:700}
.rail b{display:block;color:var(--ink);font-size:13px;font-weight:600}
.blockers{list-style:none;display:grid;gap:7px;font-size:12.5px;margin:10px 0 14px}
.blockers li{display:flex;gap:8px;color:var(--muted)}
.blockers li::before{content:"•";color:var(--accent)}
.alert{background:${mix(p.card, p.accent, p.dark ? 0.16 : 0.1)};border-left:3px solid var(--accent)}
.footer{border-top:1px solid var(--hair);padding:26px;text-align:center;font-size:12px;color:var(--subtle)}
@media(max-width:1080px){.grid{grid-template-columns:1fr}.head{flex-direction:column}
  .steps{grid-template-columns:repeat(2,1fr)}.ai-grid{grid-template-columns:1fr 1fr}}
</style>
</head>
<body>

<div class="ctxbar"><div>
  <span>โครงการ</span><b>อาคารสำนักงาน 3 ชั้น ทต.บ้านกลาง</b>
  <span>·</span><span>ปรับปรุงล่าสุด 23 ส.ค. 2569 09:41 น.</span>
  <span>·</span><span>สิทธิ์: ทดลองใช้ (เหลือ 3 วัน · 1 โครงการ · ปิด export/print)</span>
  <span>·</span><a>กลับหน้าโครงการ</a>
</div></div>

<header class="topnav">
  <div class="brand"><i></i> นายช่างหมู</div>
  <nav><a>โครงการ</a><a class="on">ESTIMETR</a><a>ราคากลาง</a><a>เอกสาร</a></nav>
  <div class="sp"></div>
  <span class="chip chip-warn">ทดลองใช้ · เหลือ 3 วัน</span>
  <button class="btn btn-secondary">คู่มือ</button>
  <button class="btn btn-primary">บันทึกรอบ</button>
</header>

<div class="wrap">
  <div class="crumbs"><span>ESTIMETR</span><span>/</span><span>อาคารสำนักงาน 3 ชั้น ทต.บ้านกลาง</span><span>/</span><span>ถอดปริมาณ</span></div>

  <div class="head">
    <div>
      <p class="eyebrow">03 · Manual take-off</p>
      <h1>ถอดปริมาณด้วยมือ พร้อมหลักฐานอ้างอิง</h1>
      <p class="lead">ทุกปริมาณต้องบอกได้ทั้งว่าวัดมาจากไหนและคิดมาอย่างไร ปริมาณมาจากการรวมรายการคำนวณ ไม่ใช่ตัวเลขที่พิมพ์เข้าไป รายการจะยืนยันได้เมื่อมีทั้งรายการคำนวณและหลักฐานอ้างอิงแล้วเท่านั้น</p>
    </div>
    <div class="progress"><span>Workflow</span><strong class="num">3/4</strong><small>ถอดปริมาณ</small></div>
  </div>

  <p class="notice"><b>เหลือ 3 วันสุดท้ายของการทดลองใช้:</b> เมื่อหมดอายุ ข้อมูลเดิมจะยังเปิดดูได้ แต่จะปิดการสร้าง แก้ไข วิเคราะห์ด้วย AI export และ print ทั้งหมด</p>

  <div class="steps">
    <div class="step is-done"><span class="n">✓</span><small>ขั้นที่ 1</small><b>ข้อมูลโครงการ</b><em>ชื่อ ที่ตั้ง ประเภทอาคาร ปีราคา</em></div>
    <div class="step is-done"><span class="n">✓</span><small>ขั้นที่ 2</small><b>ตรวจความครบของข้อมูล</b><em>แบบครบ 24 แผ่น · ผ่านการตรวจ</em></div>
    <div class="step is-active"><span class="n">3</span><small>ขั้นที่ 3</small><b>ถอดปริมาณ</b><em>ยืนยันแล้ว 7 จาก 12 รายการ</em></div>
    <div class="step is-locked"><span class="n">4</span><small>ขั้นที่ 4</small><b>ราคาและผลลัพธ์</b><em>ปลดล็อกเมื่อปิดรอบถอดปริมาณ</em></div>
  </div>

  <div class="grid">
    <div>
      <section class="card">
        <div class="card-head">
          <div><p class="eyebrow" style="margin-bottom:5px">Take-off run</p><h2>รอบที่กำลังทำงาน</h2></div>
          <span class="chip chip-ok">12 รายการ · ยืนยันแล้ว 7</span>
        </div>
        <p class="note">เปิดรอบเมื่อ 23 ส.ค. 2569 09:41 น. · หนึ่งโครงการมีรอบที่เปิดอยู่ได้ครั้งละหนึ่งรอบ เพื่อไม่ให้ปริมาณสองชุดถูกใช้พร้อมกัน</p>

        <div class="tw">
          <table>
            <thead><tr>
              <th>หมวดงาน</th><th>รายละเอียด</th><th class="right">ปริมาณ</th><th>หน่วย</th>
              <th>รายการคำนวณ</th><th>หลักฐานอ้างอิง</th><th>สถานะ</th><th>จัดการ</th>
            </tr></thead>
            <tbody>
${rows}
            </tbody>
          </table>
        </div>

        <div class="additem">
          <p class="mf-title">เพิ่มรายการปริมาณ</p>
          <div class="ai-grid">
            <label>หมวดงาน<select>${CATS.map((c) => `<option>${c}</option>`).join('')}</select></label>
            <label>รายละเอียด<input value="" placeholder="เช่น คอนกรีตโครงสร้างคาน B1 ชั้น 2"></label>
            <label>หน่วย<select>${UNITS.map((c) => `<option>${c}</option>`).join('')}</select></label>
            <button class="btn btn-primary">เพิ่มรายการ</button>
          </div>
        </div>

        <div class="callout">
          <div>
            <strong>ยอดรวมของปริมาณที่ยืนยันแล้ว</strong>
            <p>รวมแยกตามหน่วยและไม่ปัดค่า หน่วยต่างชนิดไม่ถูกนำมารวมกัน แม้จะวัดสิ่งเดียวกัน เช่น ตัน กับ กก. จะแสดงแยกกัน</p>
          </div>
          <button class="btn btn-accent">ปิดรอบและบันทึกลายนิ้วมือข้อมูล</button>
        </div>

        <div class="tw tw--narrow" style="margin-top:18px">
          <table>
            <thead><tr><th>หน่วย</th><th class="right">ยอดรวมที่ยืนยันแล้ว</th><th class="right">จำนวนรายการ</th></tr></thead>
            <tbody>
              <tr><td class="k">ลบ.ม.</td><td class="right num q">7.070</td><td class="right num">3</td></tr>
              <tr><td class="k">กก.</td><td class="right num q">181.79</td><td class="right num">1</td></tr>
              <tr><td class="k">ตร.ม.</td><td class="right num q">28.200</td><td class="right num">2</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="card">
        <div class="card-head">
          <div><p class="eyebrow" style="margin-bottom:5px">Measurement breakdown</p><h2>เสา C1 ชั้น 2 — ที่มาของปริมาณ</h2></div>
          <button class="btn btn-secondary">+ เพิ่มรายการคำนวณ</button>
        </div>
        <div class="dbody" style="margin-top:16px">
          <ul class="mlist">
            <li><b>ปริมาตรเสาสี่เหลี่ยม · เสา C1 ต้นที่ 1–8</b><span class="work">8 × 0.30 × 0.30 × 3.20 = 2.304 ลบ.ม.</span><em>กว้าง × ยาว × สูง × จำนวนต้น</em></li>
            <li><b>เผื่อสูญเสีย (Waste) 3.0%</b><span class="work">2.304 × 1.03 = +0.069 ลบ.ม.</span><em>ที่มา: หลักเกณฑ์การเผื่อวัสดุมวลรวม งานคอนกรีตหล่อในที่ 3%</em></li>
          </ul>
        </div>
        <div class="total"><span>ปริมาณสุทธิที่นำไปคิดราคา</span><b>2.373 ลบ.ม.</b></div>
        <div class="callout" style="border:0;padding-top:0">
          <div><strong>รายการนี้ยืนยันแล้ว</strong><p>ยืนยันเมื่อ 23 ส.ค. 2569 10:12 น. โดย สมชาย ก. · แก้ไขบรรทัดการวัดไม่ได้จนกว่าจะยกเลิกการยืนยัน</p></div>
          <button class="btn btn-secondary">ยกเลิกการยืนยัน</button>
        </div>
      </section>

      <section class="card">
        <div class="card-head">
          <div><p class="eyebrow" style="margin-bottom:5px">Run history</p><h2>รอบการถอดปริมาณของโครงการนี้</h2></div>
          <span class="chip">3 รอบ</span>
        </div>
        <div class="tw" style="margin-top:16px">
          <table style="min-width:560px">
            <thead><tr><th>เปิดรอบเมื่อ</th><th>ผู้ถอดปริมาณ</th><th>สถานะ</th><th>ลายนิ้วมือข้อมูล</th></tr></thead>
            <tbody>
              <tr><td class="k">23 ส.ค. 2569 09:41 น.</td><td>กรอกด้วยมือ</td><td><span class="chip chip-warn">กำลังถอดปริมาณ</span></td><td><code>ยังไม่ปิดรอบ</code></td></tr>
              <tr><td class="k">19 ส.ค. 2569 14:02 น.</td><td>กรอกด้วยมือ</td><td><span class="chip chip-ok">ปิดรอบแล้ว</span></td><td><code>a3f19c02b7d4</code></td></tr>
              <tr><td class="k">12 ส.ค. 2569 10:15 น.</td><td>กรอกด้วยมือ</td><td><span class="chip">ยกเลิก</span></td><td><code>—</code></td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <aside class="side">
      <section class="card">
        <h3>ยอดรวมตามหน่วย</h3>
        <div class="stat"><span>ลบ.ม.</span><b>7.070</b></div>
        <div class="stat"><span>กก.</span><b>181.79</b></div>
        <div class="stat"><span>ตร.ม.</span><b>28.200</b></div>
        <p class="src">รวมเฉพาะรายการที่ยืนยันแล้ว 7 รายการ</p>
      </section>

      <section class="card">
        <h3>ลำดับการตรวจ</h3>
        <ol class="rail">
          <li><span>1</span><div><b>มีบรรทัดการวัด</b>ปริมาณต้องมาจากการรวมบรรทัด ไม่ใช่พิมพ์เข้าไปเอง</div></li>
          <li><span>2</span><div><b>มีหลักฐานอ้างอิง</b>ระบุแบบและหน้าที่วัดมา</div></li>
          <li><span>3</span><div><b>ค่าเผื่อมีที่มา</b>อ้างหลักเกณฑ์ ไม่ใช่ตัวเลขลอย</div></li>
          <li><span>4</span><div><b>ยืนยันรายการ</b>เมื่อยืนยันแล้วจะล็อกและนับเข้ายอดรวม</div></li>
        </ol>
      </section>

      <section class="card">
        <h3>หลักฐานที่แนบไว้</h3>
        <div class="stat"><span>S-04 · หน้า 12</span><b style="font-size:13px">2</b></div>
        <div class="stat"><span>S-05 · หน้า 13</span><b style="font-size:13px">1</b></div>
        <div class="stat"><span>S-07 · หน้า 15</span><b style="font-size:13px">1</b></div>
        <div class="stat"><span>A-11 · หน้า 24</span><b style="font-size:13px">2</b></div>
      </section>

      <section class="card alert">
        <h3>เงื่อนไขก่อนปิดรอบ</h3>
        <ul class="blockers">
          <li>โครงหลังคาเหล็ก ช่วง A–B — ยังไม่มีบรรทัดการวัด</li>
          <li>โครงหลังคาเหล็ก ช่วง A–B — ยังไม่มีหลักฐาน</li>
          <li>อีก 4 รายการยังไม่ได้ยืนยัน</li>
        </ul>
        <button class="btn btn-accent" style="width:100%">ตรวจรายการที่ค้าง</button>
      </section>
    </aside>
  </div>
</div>

<div class="footer">${p.name} · ${p.category} · ${p.dark ? 'โทนมืด' : 'โทนสว่าง'} · primary ${p.primary} · accent ${p.accent}</div>
</body>
</html>
`;
}
