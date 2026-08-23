# Concise Landing Copy Validation — 2026-08-22

## Public Landing check

The Landing now uses the title แอปงานโยธา ใช้งานง่าย, a short supporting sentence and a direct “ดูแอปทั้งหมด” action. It does not expose the previous public paragraph about filters, trial capability matrix, AI Takeoff, BOQ editing, export/print limits, PostgreSQL/OAuth readiness or detailed Hermes pilot authority.

The visible first category is หมวดประมาณราคา. ESTIMETR uses the exact public label **ฟรี ทดลองใช้งาน 5 วัน**. The land-acquisition category context is **ภารกิจจัดกรรมสิทธิ์ที่ดิน กรมทางหลวง**.

## ESTIMETR check

The entitlement panel is rendered inside `/apps/estimeter`, before the strict workflow rail. It retains the project/trial and feature-status information for users who have entered the app, while removing that information from the public Landing.

## Automated check

The release quality gate passed eslint, 5 Vitest files / 13 tests, TypeScript typecheck, credential-less Vercel production build, security preflight, roadmap validation and diff hygiene.
