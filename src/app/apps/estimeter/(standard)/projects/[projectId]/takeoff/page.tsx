import Link from "next/link";
import { notFound } from "next/navigation";
import { EstimeterEntryBlocked } from "@/components/estimeter/entry-blocked";
import { AddEvidenceForm } from "@/components/estimeter/takeoff/add-evidence-form";
import { AddItemForm } from "@/components/estimeter/takeoff/add-item-form";
import { AddMeasurementForm } from "@/components/estimeter/takeoff/add-measurement-form";
import { AddGroupForm, ItemGroupSelect } from "@/components/estimeter/takeoff/group-forms";
import { TakeoffActionButton } from "@/components/estimeter/takeoff/takeoff-action-button";
import { WasteForm } from "@/components/estimeter/takeoff/waste-form";
import { methodNeedsDisclosure, quantityMethodKind } from "@/lib/quantity-provenance";
import { itemConfirmationBlocker } from "@/lib/takeoff-item";
import { buildOutline, type OutlineNode } from "@/lib/takeoff-outline";
import { formatQuantity } from "@/lib/takeoff-quantity";
import { summarizeConfirmedQuantities } from "@/lib/takeoff-summary";
import { categoryLabel, unitLabel } from "@/lib/takeoff-units";
import { formatThaiDateTime } from "@/lib/thai-format";
import {
  closeTakeoffRun,
  confirmTakeoffItem,
  removeTakeoffGroup,
  removeTakeoffItem,
  removeTakeoffMeasurement,
  startManualTakeoff
} from "@/server/actions/estimeter-takeoff";
import { resolveEstimeterContext } from "@/server/estimeter/context";
import { getProject } from "@/server/estimeter/project-repository";
import {
  getOpenManualRun,
  listEvidenceForItems,
  listManualRuns,
  listMeasurementsForItems,
  listRunGroups,
  listRunItems
} from "@/server/estimeter/takeoff-repository";

const reviewStateLabel: Record<string, string> = {
  proposed: "ร่าง",
  review_required: "ต้องตรวจ",
  confirmed: "ยืนยันแล้ว",
  rejected: "ตีกลับ"
};

const runStateLabel: Record<string, string> = {
  running: "กำลังถอดปริมาณ",
  succeeded: "ปิดรอบแล้ว",
  cancelled: "ยกเลิก",
  failed: "ล้มเหลว",
  queued: "รอเริ่ม",
  dead_letter: "ค้างในระบบ"
};

export default async function ManualTakeoffPage({ params }: { params: Promise<{ projectId: string }> }) {
  const result = await resolveEstimeterContext();
  if (!result.ok) return <EstimeterEntryBlocked reason={result.reason} />;

  const { access } = result.context;
  const { projectId } = await params;
  const organizationId = access.organizationId;
  if (!organizationId) notFound();

  const project = await getProject(organizationId, projectId);
  if (!project) notFound();

  const canEdit = access.capabilities.edit && (project.state === "draft" || project.state === "active");
  const openRun = await getOpenManualRun(organizationId, projectId);
  const runs = await listManualRuns(organizationId, projectId);
  const items = openRun ? await listRunItems(organizationId, openRun.id) : [];
  const evidence = await listEvidenceForItems(items.map((item) => item.id));
  const measurements = await listMeasurementsForItems(items.map((item) => item.id));
  const groups = openRun ? await listRunGroups(organizationId, openRun.id) : [];
  const outline = buildOutline(groups);
  const topLevelGroups = outline.filter((node) => node.depth === 1);
  const filedGroupIds = new Set(outline.map((node) => node.id));

  // The sheet reads heading, then the lines filed under it, then the next heading. Anything not
  // filed yet is shown last rather than hidden, because an unfiled line is still measured work.
  type SheetRow = { kind: "heading"; node: OutlineNode } | { kind: "item"; item: (typeof items)[number] };
  const sheetRows: SheetRow[] = [];
  for (const node of outline) {
    sheetRows.push({ kind: "heading", node });
    for (const item of items) if (item.groupId === node.id) sheetRows.push({ kind: "item", item });
  }
  const unfiled = items.filter((item) => item.groupId === null || !filedGroupIds.has(item.groupId));
  if (unfiled.length > 0) {
    sheetRows.push({ kind: "heading", node: { id: "", parentId: null, title: "ยังไม่จัดหมวดงาน", number: "", depth: 1 } });
    for (const item of unfiled) sheetRows.push({ kind: "item", item });
  }
  const summary = summarizeConfirmedQuantities(items);
  const confirmedCount = items.filter((item) => item.reviewState === "confirmed").length;

  return (
    <section className="estimation-workspace">
      <div className="container">
        <header className="estimation-workspace__head">
          <div>
            <p className="eyebrow">03 · MANUAL TAKE-OFF · {project.name}</p>
            <h1>ถอดปริมาณด้วยมือ พร้อมหลักฐานอ้างอิง</h1>
            <p className="estimation-workspace__lead">
              ทุกปริมาณต้องบอกได้ทั้งว่าวัดมาจากไหนและคิดมาอย่างไร ปริมาณมาจากการรวมรายการคำนวณ ไม่ใช่ตัวเลขที่พิมพ์เข้าไป รายการจะยืนยันได้เมื่อมีทั้งรายการคำนวณและหลักฐานอ้างอิงแล้วเท่านั้น
            </p>
          </div>
          <div className="estimation-workspace__progress" aria-label="ความคืบหน้า 3 จาก 4 ขั้นตอน">
            <span>WORKFLOW</span><strong>3 / 4</strong><small>ถอดปริมาณ</small>
          </div>
        </header>

        {!canEdit ? (
          <p className="workspace-notice">
            <strong>อ่านอย่างเดียว:</strong>{" "}
            {access.capabilities.edit
              ? "โครงการนี้ถูกล็อกหรือเก็บถาวรแล้ว จึงแก้ไขปริมาณไม่ได้"
              : access.state === "not_activated"
                ? "บัญชีนี้ยังไม่ได้เริ่มทดลองใช้ กดเริ่มทดลองใช้ที่หน้า ESTIMETR ก่อนจึงจะบันทึกปริมาณได้"
                : "สิทธิ์ปัจจุบันเปิดดูข้อมูลเดิมได้ แต่บันทึกหรือยืนยันปริมาณไม่ได้"}
          </p>
        ) : null}

        <div className="workspace-panel">
          <div className="workspace-panel__title">
            <div>
              <p className="eyebrow">TAKE-OFF RUN</p>
              <h2>{openRun ? "รอบที่กำลังทำงาน" : "ยังไม่มีรอบที่เปิดอยู่"}</h2>
            </div>
            <span className={openRun ? "status-chip status-chip--ready" : "status-chip status-chip--attention"}>
              {openRun ? `${items.length} รายการ · ยืนยันแล้ว ${confirmedCount}` : "ต้องเปิดรอบก่อนบันทึก"}
            </span>
          </div>

          {openRun ? (
            <>
              <p className="form-note">
                เปิดรอบเมื่อ {formatThaiDateTime(openRun.createdAt)} · หนึ่งโครงการมีรอบที่เปิดอยู่ได้ครั้งละหนึ่งรอบ เพื่อไม่ให้ปริมาณสองชุดถูกใช้พร้อมกัน
              </p>

              <div className="takeoff-table-wrap">
                <table className="takeoff-table">
                  <thead>
                    <tr>
                      <th>หมวดงาน</th>
                      <th>รายละเอียด</th>
                      <th className="number-cell">ปริมาณ</th>
                      <th>หน่วย</th>
                      <th>รายการคำนวณ</th>
                      <th>หลักฐานอ้างอิง</th>
                      <th>สถานะ</th>
                      {canEdit ? <th>จัดการ</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={canEdit ? 8 : 7}>
                          ยังไม่มีรายการในรอบนี้ เริ่มจากเพิ่มรายการแรกจากแบบที่กำลังถอด
                        </td>
                      </tr>
                    ) : (
                      sheetRows.map((row) => {
                        if (row.kind === "heading") {
                          return (
                            <tr key={`heading-${row.node.id || "unfiled"}`} className="takeoff-heading-row">
                              <td colSpan={canEdit ? 8 : 7}>
                                <strong>
                                  {row.node.number ? `${row.node.number} ` : ""}
                                  {row.node.title}
                                </strong>
                                {canEdit && row.node.id ? (
                                  <TakeoffActionButton
                                    action={removeTakeoffGroup}
                                    fields={{ groupId: row.node.id }}
                                    label="ลบหมวด"
                                    pendingLabel="กำลังลบ..."
                                  />
                                ) : null}
                              </td>
                            </tr>
                          );
                        }

                        const item = row.item;
                        const itemEvidence = evidence.filter((entry) => entry.takeoffItemId === item.id);
                        const itemMeasurements = measurements.filter((entry) => entry.takeoffItemId === item.id);
                        const blocker = itemConfirmationBlocker({
                          reviewState: item.reviewState,
                          evidenceCount: itemEvidence.length,
                          measurementCount: itemMeasurements.length
                        });

                        return (
                          <tr key={item.id}>
                            <td>{categoryLabel(item.category)}</td>
                            <td>{item.description}</td>
                            <td className="number-cell">
                              {formatQuantity(item.quantity)}
                              {item.quantityGross === null ? (
                                <em className="quantity-note">กรอกมือ ไม่มีรายการคำนวณ</em>
                              ) : Number(item.wastePercent) > 0 ? (
                                <em className="quantity-note">
                                  วัดได้ {formatQuantity(item.quantityGross)} · เผื่อ {Number(item.wastePercent)}%
                                </em>
                              ) : null}
                            </td>
                            <td>{unitLabel(item.unit)}</td>
                            <td>
                              <details className="evidence-details">
                                <summary>
                                  {itemMeasurements.length === 0
                                    ? "ยังไม่ได้วัด"
                                    : `${itemMeasurements.length} บรรทัด`}
                                </summary>
                                {itemMeasurements.length > 0 ? (
                                  <ul className="measurement-list">
                                    {itemMeasurements.map((line) => (
                                      <li key={line.id}>
                                        <span className="measurement-list__label">{line.label}</span>
                                        {/* IP-234: ทุกบรรทัดบอกว่าได้มาอย่างไร ค่าที่โมเดลเสนอต้องเปิดเผยชัดกว่า (ADR 0024) */}
                                        <span
                                          className={
                                            methodNeedsDisclosure(line.method)
                                              ? "measurement-list__method measurement-list__method--disclosed"
                                              : "measurement-list__method"
                                          }
                                          title={quantityMethodKind(line.method).description}
                                        >
                                          {quantityMethodKind(line.method).label}
                                        </span>
                                        <span className="measurement-list__working">
                                          {[String(line.count), ...line.dimensions, line.conversionFactor]
                                            .filter((factor): factor is string => Boolean(factor))
                                            .join(" × ")}
                                          {" = "}
                                          {formatQuantity(line.subtotal)} {unitLabel(item.unit)}
                                        </span>
                                        {line.conversionNote ? <em>{line.conversionNote}</em> : null}
                                        {canEdit && item.reviewState !== "confirmed" ? (
                                          <TakeoffActionButton
                                            action={removeTakeoffMeasurement}
                                            fields={{ measurementId: line.id }}
                                            label="ลบบรรทัด"
                                            pendingLabel="กำลังลบ..."
                                          />
                                        ) : null}
                                      </li>
                                    ))}
                                  </ul>
                                ) : null}
                                {canEdit && item.reviewState !== "confirmed" ? (
                                  <>
                                    <AddMeasurementForm itemId={item.id} unitCode={item.unit} />
                                    <WasteForm
                                      itemId={item.id}
                                      percent={item.wastePercent}
                                      sourceNote={item.wasteSourceNote}
                                    />
                                  </>
                                ) : null}
                                {item.wasteSourceNote ? (
                                  <p className="form-note">ที่มาค่าเผื่อ: {item.wasteSourceNote}</p>
                                ) : null}
                              </details>
                            </td>
                            <td>
                              <details className="evidence-details">
                                <summary>
                                  {itemEvidence.length === 0
                                    ? "ยังไม่มีหลักฐาน"
                                    : `${itemEvidence.length} รายการ`}
                                </summary>
                                {itemEvidence.length > 0 ? (
                                  <ul className="evidence-list">
                                    {itemEvidence.map((entry) => (
                                      <li key={entry.id}>
                                        {entry.note}
                                        {entry.pageNumber ? <em> · หน้า {entry.pageNumber}</em> : null}
                                      </li>
                                    ))}
                                  </ul>
                                ) : null}
                                {canEdit && item.reviewState !== "confirmed" ? (
                                  <AddEvidenceForm itemId={item.id} />
                                ) : null}
                              </details>
                            </td>
                            <td>
                              <span
                                className={
                                  item.reviewState === "confirmed"
                                    ? "status-chip status-chip--ready"
                                    : "status-chip status-chip--attention"
                                }
                              >
                                {reviewStateLabel[item.reviewState] ?? item.reviewState}
                              </span>
                            </td>
                            {canEdit ? (
                              <td>
                                <div className="takeoff-row-actions">
                                  {item.reviewState === "confirmed" ? (
                                    <span className="form-note">ล็อกแล้ว</span>
                                  ) : (
                                    <>
                                      <TakeoffActionButton
                                        action={confirmTakeoffItem}
                                        fields={{ itemId: item.id }}
                                        label="ยืนยันปริมาณ"
                                        pendingLabel="กำลังยืนยัน..."
                                        disabledReason={blocker}
                                      />
                                      <TakeoffActionButton
                                        action={removeTakeoffItem}
                                        fields={{ itemId: item.id }}
                                        label="ลบ"
                                        pendingLabel="กำลังลบ..."
                                      />
                                      <ItemGroupSelect itemId={item.id} groupId={item.groupId} options={outline} />
                                    </>
                                  )}
                                </div>
                              </td>
                            ) : null}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {canEdit ? <AddGroupForm runId={openRun.id} parents={topLevelGroups} /> : null}
              {canEdit ? <AddItemForm runId={openRun.id} /> : null}

              <div className="workspace-callout">
                <div>
                  <strong>ยอดรวมของปริมาณที่ยืนยันแล้ว</strong>
                  <p>
                    รวมแยกตามหน่วยและไม่ปัดค่า หน่วยต่างชนิดไม่ถูกนำมารวมกัน แม้จะวัดสิ่งเดียวกัน เช่น ตัน กับ กก. จะแสดงแยกกัน
                  </p>
                </div>
                {canEdit ? (
                  <TakeoffActionButton
                    action={closeTakeoffRun}
                    fields={{ runId: openRun.id }}
                    label="ปิดรอบและบันทึกลายนิ้วมือข้อมูล"
                    pendingLabel="กำลังปิดรอบ..."
                    className="button button--orange micro-button"
                    disabledReason={confirmedCount === 0 ? "ต้องมีรายการที่ยืนยันแล้วอย่างน้อยหนึ่งรายการ" : null}
                  />
                ) : null}
              </div>

              {summary.length === 0 ? (
                <p className="form-note">ยังไม่มีรายการที่ยืนยันแล้ว จึงยังไม่มียอดรวม</p>
              ) : (
                <div className="takeoff-table-wrap">
                  <table className="takeoff-table">
                    <thead>
                      <tr>
                        <th>หน่วย</th>
                        <th className="number-cell">ยอดรวมที่ยืนยันแล้ว</th>
                        <th className="number-cell">จำนวนรายการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.map((row) => (
                        <tr key={row.unit}>
                          <td>{unitLabel(row.unit)}</td>
                          <td className="number-cell">{formatQuantity(row.total)}</td>
                          <td className="number-cell">{row.itemCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            <div className="workspace-callout">
              <div>
                <strong>เปิดรอบการถอดปริมาณด้วยมือ</strong>
                <p>
                  รอบคือชุดปริมาณที่ถอดในคราวเดียวกัน เมื่อปิดรอบ ระบบจะบันทึกลายนิ้วมือของรายการที่ยืนยันแล้ว เพื่อให้ตรวจย้อนได้ว่าราคาที่คิดมาจากปริมาณชุดใด
                </p>
              </div>
              {canEdit ? (
                <TakeoffActionButton
                  action={startManualTakeoff}
                  fields={{ projectId: project.id }}
                  label="เปิดรอบการถอดปริมาณ"
                  pendingLabel="กำลังเปิดรอบ..."
                  className="button button--orange micro-button"
                />
              ) : null}
            </div>
          )}
        </div>

        {runs.length > 0 ? (
          <div className="workspace-panel">
            <div className="workspace-panel__title">
              <div>
                <p className="eyebrow">RUN HISTORY</p>
                <h2>รอบการถอดปริมาณของโครงการนี้</h2>
              </div>
              <span className="status-chip">{runs.length} รอบ</span>
            </div>
            <div className="takeoff-table-wrap">
              <table className="takeoff-table">
                <thead>
                  <tr>
                    <th>เปิดรอบเมื่อ</th>
                    <th>ผู้ถอดปริมาณ</th>
                    <th>สถานะ</th>
                    <th>ลายนิ้วมือข้อมูล</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => (
                    <tr key={run.id}>
                      <td>{formatThaiDateTime(run.createdAt)}</td>
                      <td>{run.runner === "manual" ? "กรอกด้วยมือ" : run.runner}</td>
                      <td>{runStateLabel[run.state] ?? run.state}</td>
                      <td><code>{run.outputHash ? run.outputHash.slice(0, 12) : "ยังไม่ปิดรอบ"}</code></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        <div className="hero__actions">
          <Link className="button button--orange micro-button" href={`/apps/estimeter/projects/${project.id}`}>
            กลับหน้าโครงการ
          </Link>
        </div>
      </div>
    </section>
  );
}
