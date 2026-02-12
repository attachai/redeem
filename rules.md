# RULES.md — Redeem Points System (Next.js 16 + Supabase + Vercel + Tailwind + DataTable + LIFF Portal)

## 0) Objective
สร้าง Web Application สำหรับ "สะสมแต้ม/แลกแต้ม" จากการใช้จ่ายตามประเภทบริการ (โรงแรม/ร้านอาหาร/ร้านกาแฟ) โดย:
- Backoffice (Admin/Staff): ตั้งค่าบริการและกติกา, จัดการลูกค้า, บันทึกยอดใช้จ่ายเพื่อรับแต้ม, redeem, รายงาน, จัดการผู้ใช้ระบบ
- Customer Portal (LIFF ผ่าน LINE OA): ลูกค้าเข้าดูแต้ม/ประวัติ/แต้มใกล้หมดอายุ 3 เดือน โดยผูกบัญชีด้วย LINE UUID + ยืนยัน phone + birth_date (ครั้งแรกเท่านั้น)

Tech:
- Next.js v16 (App Router) + TypeScript
- TailwindCSS v4
- Supabase (Postgres + RLS + RPC) และ `@supabase/supabase-js`
- Deploy Vercel
- Portal auth ผ่าน LIFF + verify LINE id_token บน server

แต้ม:
- ได้แต้มจากยอดใช้จ่ายตาม rule ต่อบริการ (เช่น 100 บาท = 1 แต้ม, 150 บาท = 1 แต้ม)
- แต้มมีอายุ 1 ปี (365 วัน) นับจากวันที่ได้รับ
- Redeem ตัดแต้มจากล็อตที่ใกล้หมดอายุก่อน (FIFO)

---

## 1) Core Concepts / Terms
- Organization (org): หน่วยงาน/เจ้าของระบบ (รองรับ multi-tenant)
- Service: บริการ/กิจการ (HOTEL/RESTAURANT/CAFE)
- Earning Rule: กติกาได้แต้มของบริการ (versioned by date)
- Transaction: รายการใช้จ่ายลูกค้าเพื่อรับแต้ม
- Ledger: บัญชีแต้ม (+ ได้แต้ม, - redeem, - expire, +/- adjust/reversal) สำหรับ audit
- Redeem: รายการใช้แต้มแลกของ/สิทธิ์
- Allocation: แตกการ redeem ไปตัดจาก "ล็อตแต้ม" (earn-ledger) เพื่อ FIFO
- Portal Session: session cookie ฝั่ง server สำหรับ customer portal
- User: ผู้ใช้ระบบ backoffice (login ด้วย username/password)

---

## 2) Roles & Permissions
### 2.1 Backoffice Authentication
- ใช้ Supabase Auth (email/password) โดย email format = `{username}@redeem.local`
- Login ด้วย username + password (ไม่ใช่ email โดยตรง)
- Password เข้ารหัสโดย Supabase Auth (bcrypt) ไม่เก็บ plain text ในฐานข้อมูล

### 2.2 Backoffice Roles
- **ADMIN**: จัดการทุกอย่าง + CRUD ผู้ใช้ระบบ + ดู logs/link attempts + reset LINE UUID ลูกค้า
- **STAFF**: บันทึก earn/redeem + ดูรายงาน (ตาม org)

### 2.3 User Management (Admin only)
- หน้า `/users` สำหรับ Admin เท่านั้น
- สร้างผู้ใช้ใหม่ (username, password, display_name, role)
- แก้ไขผู้ใช้ (display_name, role, reset password)
- ลบผู้ใช้ (ไม่สามารถลบตัวเองได้)
- API: `/api/users` (GET, POST) + `/api/users/[id]` (PUT, DELETE)

### 2.4 Customer Portal
- ลูกค้าไม่ใช้ Supabase Auth แต่ใช้ LIFF + server session
- ทุก portal endpoint "ห้ามรับ customer_id จาก client" ต้อง derive จาก session เท่านั้น

---

## 3) Non-Functional Requirements
- Auditability: ทุกแต้ม trace ได้ (ต้องมี ledger, source reference, และ created_by ระบุผู้บันทึก)
- No destructive edits: ห้ามแก้ transaction/ledger เดิมเพื่อ "ย้อนเวลา" (แก้ด้วย REVERSAL/ADJUST)
- Security:
  - Backoffice ใช้ Supabase Auth (username/password) + RLS
  - Portal ใช้ LIFF verify id_token บน server + signed httpOnly cookie
  - Rate limit + logging สำหรับการ link lineId
  - Password เข้ารหัส (bcrypt via Supabase Auth)
- Performance: query reports แบบ server-side pagination; ใช้ views/RPC ช่วยคำนวณยอดคงเหลือ
- UX: Tailwind + DataTable + Filters (มาตรฐานทุกหน้า list/report)
- Tracking: ทุก earn/redeem เก็บ created_by (user_id) เพื่อติดตามว่าใครบันทึก

---

## 4) Data Model (Supabase / Postgres)
### 4.1 organizations
- id uuid pk
- name text
- created_at timestamptz

### 4.2 profiles (เชื่อม auth.users)
- user_id uuid pk (ref auth.users.id)
- org_id uuid (ref organizations.id)
- role text ('ADMIN'|'STAFF')
- display_name text
- created_at

Auth user format:
- email = `{username}@redeem.local`
- password = hashed by Supabase Auth (bcrypt)

### 4.3 customers
- id uuid pk
- org_id uuid
- customer_code text (unique per org)
- full_name text
- phone text (raw)
- phone_normalized text (normalized digits; TH: 0xxxxxxxxx -> 66xxxxxxxxx)
- birth_date date (required for line link)
- email text nullable
- notes text nullable
- line_id text nullable (LINE userId / UUID)
- line_linked_at timestamptz nullable
- created_at, updated_at

Constraints/Indexes:
- unique(org_id, customer_code)
- unique(org_id, phone_normalized, birth_date) where both not null
- unique(org_id, line_id) where line_id not null

### 4.4 services
- id uuid pk
- org_id uuid
- name text
- category text ('HOTEL'|'RESTAURANT'|'CAFE')
- is_active boolean
- created_at, updated_at

### 4.5 earning_rules (versioned)
- id uuid pk
- org_id uuid
- service_id uuid
- spend_amount numeric > 0
- earn_points int >= 0
- rounding text ('FLOOR'|'ROUND'|'CEIL') default FLOOR
- min_spend numeric nullable
- valid_from date
- valid_to date nullable
- created_at

Rule selection:
- valid_from <= tx_date AND (valid_to is null OR tx_date <= valid_to)
- ถ้าซ้อนกัน เลือก valid_from ล่าสุด

### 4.6 point_transactions (snapshot)
- id uuid pk
- org_id uuid
- customer_id uuid
- service_id uuid
- tx_datetime timestamptz
- spend_amount numeric >= 0
- rule_id uuid
- points_earned int >= 0 (snapshot)
- expires_at timestamptz (= tx_datetime + 365 days)
- reference_no text nullable
- note text nullable
- created_by uuid (ref profiles.user_id — ผู้บันทึกรายการ)
- created_at

### 4.7 point_ledger (audit)
- id uuid pk
- org_id uuid
- customer_id uuid
- service_id uuid nullable
- source_type text ('EARN'|'REDEEM'|'EXPIRE'|'ADJUST'|'REVERSAL')
- source_id uuid nullable (ref tx/redeem)
- points_delta int (+: add, -: subtract)
- occurs_at timestamptz
- expires_at timestamptz nullable (only for + lots)
- meta jsonb (details)
- created_by uuid (ref profiles.user_id — ผู้บันทึกรายการ)
- created_at

FK: point_ledger_created_by_fkey → profiles(user_id)

### 4.8 redeems
- id uuid pk
- org_id uuid
- customer_id uuid
- redeem_datetime timestamptz
- points_redeemed int > 0
- reward_name text nullable
- note text nullable
- created_by uuid (ref profiles.user_id — ผู้ทำรายการแลกแต้ม)
- created_at

FK: redeems_created_by_profiles_fkey → profiles(user_id)

### 4.9 redeem_allocations (FIFO)
- id uuid pk
- org_id uuid
- redeem_id uuid
- ledger_earn_id uuid (ref point_ledger id where points_delta > 0)
- points_used int > 0
- created_at

### 4.10 line_link_attempts (security log)
- id uuid pk
- org_id uuid
- line_id text
- phone_normalized text
- birth_date date
- success boolean
- reason text
- created_at

---

## 5) Business Logic
### 5.1 Earn points calculation
Inputs: customer_id, service_id, spend_amount, tx_datetime, **created_by** (user who records)
Steps:
1) load earning_rule (by date range)
2) raw = (spend_amount / spend_amount_rule) * earn_points_rule
3) apply rounding (FLOOR default)
4) points_earned = max(int(raw), 0)
5) expires_at = tx_datetime + 365 days
6) write:
   - insert point_transactions (snapshot, created_by = current user)
   - insert point_ledger (+points_earned, source_type=EARN, expires_at set, created_by = current user)
7) no destructive edit; corrections via REVERSAL/ADJUST

### 5.2 Redeem (FIFO)
Inputs: customer_id, points_to_redeem, redeem_datetime, reward(optional), **created_by**
Rules:
- points_to_redeem > 0
- available_points must be >= requested (available = sum remaining of unexpired lots)
- allocate from earn lots by earliest expires_at first
Write:
- insert redeems (created_by = current user)
- insert point_ledger (-points_to_redeem, source_type=REDEEM, created_by = current user)
- insert redeem_allocations rows (mapping to earn-ledger lots)

### 5.3 Expiration
Two approaches:
A) Query-based (recommended early):
- Available points computed from remaining lots where expires_at > now()
- Expiring 3 months computed from remaining lots where now() < expires_at <= now()+3 months
B) Scheduled expiry ledger (optional later):
- nightly job inserts EXPIRE ledger rows for expired remainder (for easier sum-only reporting)

### 5.4 Corrections
- Never update old tx/ledger rows to change points
- Use:
  - REVERSAL: negate wrong earn/redeem
  - ADJUST: bonus/compensation (+/-) with proper meta & audit reason

---

## 6) Canonical "Remaining Points" Computation
Define view `v_earn_remaining`:
- Earn lots = point_ledger rows where points_delta > 0 and source_type in ('EARN','ADJUST') and expires_at not null
- Used per lot = SUM(redeem_allocations.points_used) grouped by ledger_earn_id
- remaining = earn_points - used
- available_points = SUM(remaining where expires_at > now)
- expiring_3m_points = SUM(remaining where now < expires_at <= now+3 months)

---

## 7) Required RPC (Database Functions)
### 7.1 rpc_link_line_to_customer(org_id, line_id, phone, birth_date) -> customer_id
- normalize phone
- find customer by (org_id, phone_normalized, birth_date)
- if not found: log attempt + error
- if customer.line_id is null: set line_id + line_linked_at
- if exists and != line_id: log + error LINE_ID_MISMATCH
- else return customer_id (ALREADY_LINKED)

### 7.2 rpc_check_line_uid(org_id, line_id) -> json
- ค้นหาลูกค้าจาก line_id (LINE UUID)
- ถ้าพบ: return `{ found: true, customer_id, full_name, customer_code }`
- ถ้าไม่พบ: return `{ found: false }`
- ใช้สำหรับ auto-login เมื่อ LINE UUID มีในระบบแล้ว

### 7.3 rpc_get_customer_portal_summary(org_id, customer_id) -> json
- available_points (unexpired remaining)
- expiring_3m_points (remaining expiring in 3 months)

### 7.4 rpc_create_transaction_earn(...)
Atomic earn:
- select rule, compute points, insert tx + ledger (with created_by), return summary/balance

### 7.5 rpc_redeem_points(...)
Atomic redeem:
- check available, allocate FIFO, insert redeem + ledger + allocations (with created_by), return summary/balance

---

## 8) RLS Policies (Backoffice)
- All business tables include org_id and enforce same org via profiles (auth.uid)
- is_staff() for ADMIN/STAFF
- line_link_attempts: readable ADMIN only
- Portal uses service role on server endpoints (not via anon) and does not rely on RLS for customer reads

---

## 9) UI Standards (Tailwind + DataTable + Filters)
### 9.1 Tailwind
- Use Tailwind for all UI; avoid inline styles
- Standard layout:
  - `container mx-auto px-4`
  - cards: `rounded-2xl border bg-white shadow-sm`
  - inputs: `rounded-xl border px-3 py-2`
  - buttons: `rounded-xl px-4 py-2`

### 9.2 DataTable (Required)
Shared component features:
- server-side pagination (page/pageSize)
- sorting (sortBy/sortDir)
- debounced search
- row actions (view/edit)
- loading/empty states
- sync filter state to URL query params (shareable links)

### 9.3 Filters (Required)
Standard filter bar:
- search
- date range
- service filter (single + ALL)
- customer filter (typeahead)
- reset filters
Rules:
- changing filters resets page to 1

---

## 10) Backoffice Pages (Minimum)
1) **Login** (`/login`)
   - Username + password login (ใช้ Supabase Auth ภายใน)
   - แปลง username เป็น email format `{username}@redeem.local`
2) **Dashboard** (`/dashboard`)
   - summary cards (today/month): earned, redeemed, expiring, net
3) **Services** (`/services`)
   - list/create/edit
   - setup earning_rules (valid_from/valid_to) (`/services/earning-rules`)
4) **Customers** (`/customers`)
   - list/create/edit
   - customer detail (`/customers/[id]`): balance + expiring 3 months + history + ผู้บันทึก
   - Admin สามารถ reset LINE UUID (ยกเลิกเชื่อม) เพื่อบังคับยืนยันตัวตนใหม่
5) **Earn** (`/earn`)
   - select customer, select service, input spend_amount
   - preview points + expires_at
   - เก็บ created_by (ผู้บันทึก) ทุกครั้ง
6) **Redeem** (`/redeem`)
   - select customer, input points, preview available
   - เก็บ created_by (ผู้บันทึก) ทุกครั้ง
7) **Reports** (`/reports`)
   - filters: customer, service/all, date range
   - table detail + summary cards + คอลัมน์ "ผู้บันทึก"
   - export CSV (with ผู้บันทึก)
8) **User Management** (`/users`) — Admin only
   - list ผู้ใช้ทั้งหมดใน org
   - สร้างผู้ใช้ใหม่ (username, password, display_name, role)
   - แก้ไข (display_name, role, reset password)
   - ลบผู้ใช้ (ไม่สามารถลบตัวเอง)

---

## 11) Customer Portal via LIFF (LINE OA) — Required
### 11.1 Flow
- เปิดผ่าน LIFF (LINE OA)
- Client obtains `idToken` from LIFF
- Server verifies `idToken` with LINE verify endpoint
- **Auto-login**: ถ้า LINE UUID มีในฐานข้อมูลลูกค้าแล้ว → สร้าง session และเข้าใช้งานได้เลย (ไม่ต้องยืนยันตัวตน)
- **First time**: ถ้า LINE UUID ยังไม่มี → ลูกค้าต้องกรอก phone + birth_date เพื่อยืนยันตัวตน
- Server sets signed httpOnly cookie (portal_session) containing orgId, customerId, lineId
- Portal uses server endpoints reading session cookie only
- **Admin Reset**: Admin สามารถลบ LINE UUID ของลูกค้าได้ เพื่อบังคับให้ยืนยันตัวตนใหม่

### 11.2 LINE Verification
Server MUST verify LIFF ID token via:
- POST `https://api.line.me/oauth2/v2.1/verify`
- send `id_token` + `client_id` (LINE_CHANNEL_ID)
- use returned `sub` as `lineId` (LINE userId)

### 11.3 Portal Pages
- `/portal/link`:
  - LIFF init + login
  - **Auto-check**: POST `/api/portal/check-line` → ถ้า LINE UUID มีแล้ว → สร้าง session + redirect `/portal`
  - ถ้ายังไม่มี → แสดงฟอร์ม phone + birth_date → POST `/api/portal/link`
- `/portal`:
  - show available_points
  - show expiring_3m_points
  - latest history summary (optional)
- `/portal/history`:
  - filters: date range + service
  - ledger list

### 11.4 Portal Session Rules
- Use signed JWT cookie:
  - httpOnly, secure, sameSite=lax, maxAge=7d
- All portal API derive customerId from cookie, never from request payload

### 11.5 Mapping Rules (critical)
- Link only if phone_normalized + birth_date matches existing customer in org
- If customer already linked to a different lineId -> deny and ask contact admin
- Admin can reset LINE link (set line_id = null) to force re-verification

---

## 12) Environment Variables (Vercel)
Backoffice:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY

LIFF/Portal:
- NEXT_PUBLIC_LIFF_ID
- LINE_CHANNEL_ID
- PORTAL_ORG_ID
- PORTAL_SESSION_SECRET (32+ chars)

---

## 13) Code Architecture (Next.js 16 App Router)
Folders:
- `src/app/(backoffice)/*` — backoffice pages (auth required)
  - `dashboard/`, `services/`, `customers/`, `earn/`, `redeem/`, `reports/`, `users/`
- `src/app/portal/*` — customer portal pages
  - `link/`, `history/`, `page.tsx`
- `src/app/api/portal/*` — portal API route handlers
  - `link/`, `check-line/`, `summary/`, `history/`
- `src/app/api/users/*` — user management API (Admin only)
  - `route.ts` (GET, POST), `[id]/route.ts` (PUT, DELETE)
- `src/app/login/` — login page
- `src/components/data-table/*` — DataTable + FilterBar
- `src/components/layout/*` — BackofficeLayout (sidebar with role-based menu)
- `src/lib/supabase/{browser,server,admin,middleware}.ts`
- `src/lib/line/verifyIdToken.ts`
- `src/lib/portal/session.ts`
- `src/lib/points/*` (calc + redeem helper)
- `src/lib/validators/*` (zod schemas)

Write rules:
- All writes via Server Actions or Route Handlers (server-side)
- Portal endpoints use service role only (server side)
- Always validate inputs with zod
- Never expose service role key to client
- เก็บ created_by ทุกครั้งที่มีการ earn/redeem เพื่อ audit trail

---

## 14) Recommended Enhancements (Feature Ideas)
Implement as milestones:
1) Branches/Outlets + filter
2) Customer Tier multiplier
3) Promotions using rule versions
4) Bonus points (ADJUST + expires)
5) Rewards catalog + stock
6) Idempotency key for earn/redeem
7) Audit logs table (who did what)
8) Materialized views for performance
9) Fraud checks (duplicate receipt, daily limits)
10) Notifications via LINE OA (expiring soon)

---

## 15) Deliverables Expected from AI (Implementation Checklist)
AI MUST generate:
1) Supabase SQL migrations:
   - tables + indexes + updated_at triggers + FK constraints (created_by → profiles)
   - normalize_th_phone function
   - v_earn_remaining view
   - rpc_link_line_to_customer
   - rpc_check_line_uid (auto-login by LINE UUID)
   - rpc_get_customer_portal_summary
   - rpc_create_transaction_earn, rpc_redeem_points
   - RLS policies for backoffice tables
2) Next.js 16 app:
   - Tailwind setup
   - DataTable + FilterBar components
   - Login page (username/password)
   - Backoffice pages (Dashboard/Services/Rules/Customers/Earn/Redeem/Reports/Users)
   - User management (Admin CRUD via API routes)
   - Portal pages (link with auto-login/home/history)
   - API routes: /api/portal/link, /api/portal/check-line, /api/portal/summary, /api/portal/history
   - API routes: /api/users (CRUD)
   - LINE id_token verification helper
   - portal_session cookie helper
   - BackofficeLayout with role-based navigation
3) Seed data:
   - sample org, sample services, rules, customers
   - test users: admin/admin123 (ADMIN), staff/staff123 (STAFF)

END OF RULES
