# BOQ Workflow Reference — 2026-08-22

## Source

- FlowAccount, [BOQ คืออะไร รู้จักใบประมาณราคาในงานก่อสร้าง](https://flowaccount.com/blog/what-is-bills-of-quantities/), accessed 2026-08-22.

## Extracted Principles for ESTIMETR

The reference describes BOQ as a detailed account of construction work quantities and prices, including material quantity, unit price, labor and the total cost. It presents the core calculation as:

> ปริมาณงาน × ราคาต่อหน่วย (วัสดุ + ค่าแรง) = ค่าใช้จ่ายของรายการนั้น

The source frames the user journey as reading drawings, extracting quantities, applying unit costs and then compiling totals with operational cost, contractor profit and VAT as applicable. It also emphasizes that BOQ should serve as evidence for budget control, comparison and variation review.

## Product Translation

| Stage | ESTIMETR behavior | Evidence / gate |
|---|---|---|
| 1. Review drawings | Register drawings, discipline, specification notes and missing/conflicting information | Drawing review checklist must be acknowledged |
| 2. Quantity take-off | Create categorized take-off rows with unit, formula, quantity and drawing evidence | Quantity row needs source/evidence status |
| 3. Unit cost estimation | Separate material and labor unit costs; identify price source, province/month and manual override | Price source must be reviewed before document readiness |
| 4. BOQ compilation | Group direct costs, display OH&P / VAT treatment by mode and prepare document outputs | Export/print stays locked until QA gates pass |

## Scope Boundary

This reference informs only generic BOQ workflow and explanatory copy. ESTIMETR retains its separate government path: price sources, public works documents (ปร.4/ปร.5/ปร.6), Factor F and project price snapshots remain governed by the product requirements already approved for this project.

## Cross-check: Quantity Take-off Discipline

RIB and Autodesk describe QTO as a drawing/specification-based measurement process that precedes a formal BOQ. QTO therefore remains traceable back to drawings and captures work as well as materials and labor; BOQ then organizes the result into description, unit, quantity, unit rate and cost.[^rib][^autodesk]

For ESTIMETR, this confirms the following UX constraints:

1. **Review first.** A drawing/specification checklist must precede quantity entry, with conflicts and missing information visible rather than silently ignored.
2. **Measure with an appropriate unit.** The workspace must show whether an item is a count, linear length, area, weight or volume—and not represent all take-off as generic “items.”
3. **Keep evidence separable from price.** Quantity evidence, material cost, labor cost and adjustment/review status must be independently inspectable.
4. **Compile only after review.** BOQ readiness must be a downstream state, not a generic dashboard total.

[^rib]: RIB Software, [Everything You Need to Know to Take Your Quantity Takeoff to the Next Level](https://www.rib-software.com/en/blogs/quantity-take-off-methods), accessed 2026-08-22.
[^autodesk]: Autodesk, [What Is a Quantity Takeoff in Construction?](https://www.autodesk.com/blogs/construction/quantity-takeoffs/), updated 2026-03-24 and accessed 2026-08-22.
