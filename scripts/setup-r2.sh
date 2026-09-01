#!/usr/bin/env bash
#
# พาตั้งที่เก็บไฟล์แบบก่อสร้างบน Cloudflare R2 ทีละขั้น
# สร้างด้วย /wizard skill
#
# ทุกอย่างเหนือเส้น STAGES คือไลบรารีของ wizard ห้ามแก้ด้วยมือ
# ยกเว้นข้อความที่แปลเป็นไทยแล้ว เพราะเจ้าของเครื่องอ่านไทยเป็นหลัก

set -euo pipefail

# ──────────────────────────────────────────────────────────────────────────
# ไลบรารีของ wizard
# ──────────────────────────────────────────────────────────────────────────

if [[ -t 1 ]] && command -v tput >/dev/null 2>&1 && [[ "$(tput colors 2>/dev/null || echo 0)" -ge 8 ]]; then
  BOLD=$(tput bold); DIM=$(tput dim); RESET=$(tput sgr0)
  BLUE=$(tput setaf 4); GREEN=$(tput setaf 2); YELLOW=$(tput setaf 3); RED=$(tput setaf 1)
else
  BOLD=""; DIM=""; RESET=""; BLUE=""; GREEN=""; YELLOW=""; RED=""
fi

TOTAL_STAGES=0

_STAGE_INDEX=0
ENV_FILE="${ENV_FILE:-.env}"
WRITTEN_ENV=()
WRITTEN_SECRET=()
SKIPPED=()

_clear() {
  [[ -t 1 ]] || return 0
  if command -v tput >/dev/null 2>&1; then tput clear; else printf '\033[2J\033[3J\033[H'; fi
}

banner() {
  _clear
  printf '\n%s%s  %s%s\n' "$BOLD" "$BLUE" "$1" "$RESET"
  printf '%s  ทั้งหมด %s ขั้น%s\n\n' "$DIM" "$TOTAL_STAGES" "$RESET"
  printf '%s  คุณเป็นคนกดในเบราว์เซอร์เอง สคริปต์นี้บอกว่าต้องกดอะไรตรงไหน\n' "$DIM"
  printf '  แล้วรับค่าที่คุณคัดลอกมาไปเก็บให้ หยุดกลางคันด้วย Ctrl-C ได้\n'
  printf '  แล้วค่อยรันใหม่ ค่าที่บันทึกไปแล้วจะยังอยู่%s\n' "$RESET"
  pause "พร้อมเริ่มหรือยัง กด Enter เพื่อไปต่อ"
}

stage() {
  _clear
  _STAGE_INDEX=$((_STAGE_INDEX + 1))
  printf '\n%s%s> ขั้นที่ %s/%s · %s%s\n' \
    "$BOLD" "$BLUE" "$_STAGE_INDEX" "$TOTAL_STAGES" "$1" "$RESET"
}

say()  { printf '  %s\n' "$1"; }
step() { printf '  %s-%s %s\n' "$BLUE" "$RESET" "$1"; }
note() { printf '  %s%s%s\n' "$DIM" "$1" "$RESET"; }
warn() { printf '  %sระวัง %s%s\n' "$YELLOW" "$1" "$RESET"; }

open_url() {
  local url="$1"
  printf '  %sกำลังเปิด%s %s\n' "$GREEN" "$RESET" "$url"
  { if   command -v wslview     >/dev/null 2>&1; then wslview "$url"
    elif command -v explorer.exe >/dev/null 2>&1; then explorer.exe "$url"
    elif command -v xdg-open    >/dev/null 2>&1; then xdg-open "$url"
    elif command -v open        >/dev/null 2>&1; then open "$url"
    else warn "เปิดเบราว์เซอร์ให้ไม่ได้ เปิดเองที่ $url"; fi
  } >/dev/null 2>&1 || warn "เปิดเบราว์เซอร์ให้ไม่ได้ เปิดเองที่ $url"
}

pause() {
  printf '  %s%s%s ' "$DIM" "${1:-กด Enter เพื่อไปต่อ}" "$RESET"
  read -r _ || true
}

confirm() {
  local reply=""
  printf '  %s? %s [y/N] ' "$YELLOW" "$1"
  read -r reply || true
  [[ "$reply" =~ ^[Yy] ]]
}

_existing() {
  [[ -f "$ENV_FILE" ]] || return 1
  local line; line=$(grep -E "^${1}=" "$ENV_FILE" | tail -n1) || return 1
  printf '%s' "${line#*=}"
}

ask() {
  local key="$1" prompt="$2" current input
  current=$(_existing "$key" || true)
  if [[ -n "$current" ]]; then
    printf '  %s%s%s %s[กด Enter เพื่อใช้ค่าเดิม]%s ' "$BOLD" "$prompt" "$RESET" "$DIM" "$RESET"
  else
    printf '  %s%s%s ' "$BOLD" "$prompt" "$RESET"
  fi
  read -r input || true
  [[ -z "$input" && -n "$current" ]] && input="$current"
  printf -v "$key" '%s' "$input"
}

ask_secret() {
  local key="$1" prompt="$2" current input
  current=$(_existing "$key" || true)
  if [[ -n "$current" ]]; then
    printf '  %s%s%s %s[กด Enter เพื่อใช้ค่าเดิม]%s ' "$BOLD" "$prompt" "$RESET" "$DIM" "$RESET"
  else
    printf '  %s%s%s ' "$BOLD" "$prompt" "$RESET"
  fi
  read -rs input || true
  printf '\n'
  [[ -z "$input" && -n "$current" ]] && input="$current"
  printf -v "$key" '%s' "$input"
}

write_env() {
  local key="$1" value="$2" tmp
  touch "$ENV_FILE"
  tmp=$(mktemp)
  grep -vE "^${key}=" "$ENV_FILE" > "$tmp" || true
  printf '%s=%s\n' "$key" "$value" >> "$tmp"
  mv "$tmp" "$ENV_FILE"
  WRITTEN_ENV+=("$key")
  printf '  %sบันทึกแล้ว%s %s ลงใน %s\n' "$GREEN" "$RESET" "$key" "$ENV_FILE"
}

set_secret() {
  local name="$1" value="$2"
  if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
    if printf '%s' "$value" | gh secret set "$name" >/dev/null 2>&1; then
      WRITTEN_SECRET+=("$name")
      printf '  %sตั้งแล้ว%s GitHub secret %s\n' "$GREEN" "$RESET" "$name"
      return
    fi
  fi
  SKIPPED+=("GitHub secret $name (ตั้งเองด้วย gh secret set $name)")
  warn "ข้าม GitHub secret $name เพราะ gh ยังไม่พร้อม ค่อยตั้งทีหลัง"
}

set_var() {
  local name="$1" value="$2"
  if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
    if gh variable set "$name" --body "$value" >/dev/null 2>&1; then
      printf '  %sตั้งแล้ว%s GitHub variable %s\n' "$GREEN" "$RESET" "$name"
      return
    fi
  fi
  SKIPPED+=("GitHub variable $name")
  warn "ข้าม GitHub variable $name เพราะ gh ยังไม่พร้อม ค่อยตั้งทีหลัง"
}

finish() {
  _clear
  printf '\n%s%s  ตั้งค่าเสร็จแล้ว%s\n' "$BOLD" "$GREEN" "$RESET"
  (( ${#WRITTEN_ENV[@]} ))    && note "บันทึก ${#WRITTEN_ENV[@]} ค่าลงใน $ENV_FILE: ${WRITTEN_ENV[*]}"
  (( ${#WRITTEN_SECRET[@]} )) && note "ตั้ง GitHub secret ${#WRITTEN_SECRET[@]} ค่า: ${WRITTEN_SECRET[*]}"
  if (( ${#SKIPPED[@]} )); then
    printf '\n'; warn "ยังเหลือให้ทำเองอีก"
    for s in "${SKIPPED[@]}"; do note "  - $s"; done
  fi
  printf '\n'
}

# ──────────────────────────────────────────────────────────────────────────
# STAGES
# ──────────────────────────────────────────────────────────────────────────

TOTAL_STAGES=5

banner "ตั้งที่เก็บไฟล์แบบก่อสร้างบน Cloudflare R2"

# ── ขั้นที่ 1 ──────────────────────────────────────────────────────────────
stage "หารหัสบัญชี Cloudflare"
say "รหัสบัญชีคือเลขประจำตัวของบัญชีคุณ ระบบใช้มันประกอบเป็นที่อยู่ของถังเก็บไฟล์"
open_url "https://dash.cloudflare.com/"
step "ล็อกอินเข้าบัญชี Cloudflare ของคุณเอง (ยังไม่มีบัญชี สมัครฟรีได้ที่หน้านี้)"
step "กดเมนู R2 Object Storage ที่แถบซ้าย"
step "มองกล่องทางขวาของหน้า จะมีหัวข้อ Account ID เป็นตัวอักษรปนตัวเลข 32 ตัว กดปุ่มคัดลอก"
note "รหัสบัญชีไม่ใช่ความลับ พิมพ์แล้วเห็นบนหน้าจอได้"
ask R2_ACCOUNT_ID "วางรหัสบัญชีตรงนี้:"
write_env R2_ACCOUNT_ID "$R2_ACCOUNT_ID"

# ── ขั้นที่ 2 ──────────────────────────────────────────────────────────────
stage "สร้างถังเก็บไฟล์แบบส่วนตัว"
say "ถัง (bucket) คือกล่องเก็บไฟล์หนึ่งใบ แบบก่อสร้างของลูกค้าทุกรายจะอยู่ในใบนี้"
open_url "https://dash.cloudflare.com/?to=/:account/r2/new"
step "ตั้งชื่อถัง แนะนำ naichangmoo-drawings — ชื่อนี้เปลี่ยนทีหลังไม่ได้"
step "ช่อง Location เลือก Asia-Pacific (APAC) เพื่อให้ใกล้ผู้ใช้ในไทยที่สุด"
step "กดปุ่ม Create bucket"
warn "ห้ามกด Allow Access หรือเปิด Public Development URL เด็ดขาด"
note "ถังนี้เก็บแบบก่อสร้างของลูกค้า ต้องปิดตลอด ตาม ADR 0002 ที่บอกว่าเข้าถึงได้ผ่านลิงก์"
note "ที่ระบบเซ็นให้เป็นครั้ง ๆ และหมดอายุเร็วเท่านั้น เปิดสาธารณะเมื่อไรคือแบบของลูกค้ารั่ว"
ask R2_BUCKET "พิมพ์ชื่อถังที่เพิ่งสร้าง:"
write_env R2_BUCKET "$R2_BUCKET"

# ── ขั้นที่ 3 ──────────────────────────────────────────────────────────────
stage "ออกกุญแจให้ระบบเข้าถึงถังใบนี้"
say "กุญแจคือรหัสผ่านของโปรแกรม ไม่ใช่ของคน ระบบใช้มันหยิบและวางไฟล์ในถัง"
open_url "https://dash.cloudflare.com/?to=/:account/r2/api-tokens"
step "กดปุ่ม Create API token"
step "หัวข้อ Permissions เลือก Object Read & Write"
step "หัวข้อ Specify bucket เลือกเฉพาะถังที่เพิ่งสร้าง อย่าให้สิทธิ์ทุกถัง"
step "กดปุ่ม Create API Token"
step "หน้าถัดไปจะขึ้น Access Key ID กับ Secret Access Key"
warn "สองค่านี้แสดงครั้งเดียว ปิดหน้าไปแล้วดูซ้ำไม่ได้ ต้องออกใหม่"
note "พิมพ์แล้วจะไม่มีตัวอักษรขึ้นบนหน้าจอ เป็นเรื่องปกติ พิมพ์ให้จบแล้วกด Enter"
ask_secret R2_ACCESS_KEY_ID "วาง Access Key ID:"
ask_secret R2_SECRET_ACCESS_KEY "วาง Secret Access Key:"
write_env R2_ACCESS_KEY_ID "$R2_ACCESS_KEY_ID"
write_env R2_SECRET_ACCESS_KEY "$R2_SECRET_ACCESS_KEY"
note "สองค่านี้อยู่ใน .env ซึ่ง .gitignore กันไม่ให้ขึ้น git อยู่แล้ว"

# ── ขั้นที่ 4 ──────────────────────────────────────────────────────────────
stage "เปิดทางให้เบราว์เซอร์ส่งไฟล์ขึ้นถังได้โดยตรง"
say "ไฟล์แบบก่อสร้างใหญ่เกินกว่าจะวิ่งผ่านเซิร์ฟเวอร์ของเรา เบราว์เซอร์จึงต้องส่งขึ้นถังตรง ๆ"
say "ซึ่ง Cloudflare ปิดกั้นไว้ก่อนเสมอ จนกว่าเราจะประกาศว่าเว็บของเราส่งได้"
ask APP_ORIGIN "ที่อยู่เว็บตอนใช้งานจริง เช่น https://naichangmoo.com (ยังไม่มีให้กด Enter ข้าม):"
if [[ -n "$APP_ORIGIN" ]]; then
  ORIGIN_LIST="\"http://localhost:3000\", \"$APP_ORIGIN\""
else
  ORIGIN_LIST="\"http://localhost:3000\""
  note "ข้ามที่อยู่จริงไปก่อน ตอนขึ้นเว็บจริงต้องกลับมาเติมที่นี่ ไม่งั้นอัปโหลดจะไม่ผ่าน"
fi
say ""
say "คัดลอกข้อความข้างล่างนี้ทั้งก้อน"
printf '\n'
cat <<JSON
[
  {
    "AllowedOrigins": [$ORIGIN_LIST],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["content-type", "content-md5"],
    "ExposeHeaders": ["etag"],
    "MaxAgeSeconds": 3600
  }
]
JSON
printf '\n'
open_url "https://dash.cloudflare.com/?to=/:account/r2/default/buckets/${R2_BUCKET}/settings"
step "เลื่อนหาหัวข้อ CORS Policy แล้วกด Add CORS policy"
step "ลบของเดิมในช่องให้หมด แล้ววางข้อความที่คัดลอกไว้ลงไป"
step "กด Save"
pause "วางและกด Save เรียบร้อยแล้ว กด Enter เพื่อไปต่อ"

# ── ขั้นที่ 5 ──────────────────────────────────────────────────────────────
stage "ตรวจว่าใช้ได้จริง"
say "ขั้นนี้ลองเขียนไฟล์ทดสอบขึ้นถัง อ่านกลับมา แล้วลบทิ้ง เพื่อพิสูจน์ว่ากุญแจใช้ได้จริง"
say "ไม่ใช่แค่ว่าพิมพ์ครบ"
printf '\n'
if ! command -v node >/dev/null 2>&1; then
  SKIPPED+=("ตรวจ R2 ด้วย node scripts/check-r2.mjs (เครื่องนี้ยังไม่มี node)")
  warn "ไม่พบ node บนเครื่อง ข้ามการตรวจไปก่อน"
else
  if R2_ACCOUNT_ID="$R2_ACCOUNT_ID" \
     R2_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
     R2_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
     R2_BUCKET="$R2_BUCKET" \
     node scripts/check-r2.mjs; then
    printf '\n'
    say "ที่เก็บไฟล์พร้อมใช้งานแล้ว"
  else
    printf '\n'
    warn "ยังไม่ผ่าน อ่านบรรทัดที่ขึ้นว่าไม่ผ่านข้างบน แล้วรันสคริปต์นี้ใหม่"
    warn "ค่าที่บันทึกไปแล้วยังอยู่ กด Enter ผ่านขั้นที่ไม่ต้องแก้ได้เลย"
    SKIPPED+=("แก้ปัญหาที่ทำให้ scripts/check-r2.mjs ไม่ผ่าน แล้วรัน bash scripts/setup-r2.sh ใหม่")
  fi
fi
pause "กด Enter เพื่อดูสรุป"

finish
