# ESTIMETR Workspace Validation — 2026-08-22

## Interactive smoke test

| Check | Result | Evidence |
| --- | --- | --- |
| Route renders within the shared app shell | Pass | `/apps/estimeter` displays platform navigation, app context, workspace and platform footer. |
| Stage 1 state is clear | Pass | Drawing review is initially active; stages 2–4 are visibly locked. |
| Review gate unlocks the next stage | Pass | Selecting **ยืนยันการตรวจแบบ** changes workflow progress from `1 / 4` to `2 / 4`, marks stage 1 complete and opens the quantity take-off panel. |
| Evidence and demo-data boundary | Pass | The page labels the workspace as a demo and shows the evidence ledger alongside every stage. |
| Take-off gate unlocks cost estimation | Pass | Selecting **ยืนยันปริมาณงาน** changes workflow progress from `2 / 4` to `3 / 4`, displays the table with units/quantities/evidence, then opens the unit-cost stage. |
| Unit-cost state avoids fabricated prices | Pass | The panel displays pending province/month, material and labor reference states instead of representing the demo as an actual price source. |
| Final BOQ gate handler | Pass | Direct browser event execution found the enabled **ยืนยันการประมาณราคา** button and invoked its handler successfully. The prior indexed click did not change state because the target was at the edge of the automated viewport, not because of a UI logic failure. |
| BOQ compilation display | Pass | Workflow reaches `4 / 4`; it separates direct cost, private OH&P/profit, VAT review and government document workflow without implying that an export is available. |
| Browser runtime | Pass | Browser console contains only normal development/HMR messages and no runtime errors during the complete stage progression. |
| Mobile viewport (375 × 812) | Pass | Header switches to a stacked layout, workflow progress remains readable, the step rail becomes horizontally scrollable, and the workspace avoids horizontal page overflow. |

Further checks pending: release governance and final credential-less production quality gate.
