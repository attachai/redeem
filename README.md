# Redeem Points System

ระบบสะสมแต้ม/แลกแต้ม สำหรับธุรกิจโรงแรม ร้านอาหาร ร้านกาแฟ

## Tech Stack

- **Next.js 16** (App Router) + TypeScript
- **TailwindCSS v4**
- **Supabase** (Postgres + RLS + RPC)
- **LINE LIFF** (Customer Portal)
- **Vercel** (Deploy)

## Getting Started

### 1. Setup Environment Variables

Copy and configure environment variables:

```
# Supabase (Backoffice)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# LINE LIFF (Customer Portal)
NEXT_PUBLIC_LIFF_ID=your-liff-id
LINE_CHANNEL_ID=your-line-channel-id
PORTAL_ORG_ID=your-org-uuid
PORTAL_SESSION_SECRET=your-32-char-secret-key-here-min
```

### 2. Setup Database

Run the SQL migration in your Supabase SQL Editor:

```bash
# File: supabase/migrations/001_init.sql
```

Optionally run seed data:

```bash
# File: supabase/seed.sql
```

### 3. Run Development Server

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
├── app/
│   ├── (backoffice)/          # Backoffice pages (auth required)
│   │   ├── dashboard/         # Summary cards
│   │   ├── services/          # Services + Earning Rules
│   │   ├── customers/         # Customer list + detail
│   │   ├── earn/              # Record spending → earn points
│   │   ├── redeem/            # Redeem points (FIFO)
│   │   └── reports/           # Ledger reports + CSV export
│   ├── portal/                # Customer Portal (LIFF)
│   │   ├── link/              # Link LINE account
│   │   ├── history/           # Points history
│   │   └── page.tsx           # Points summary
│   ├── api/portal/            # Portal API routes
│   │   ├── link/              # POST: link LINE → customer
│   │   ├── summary/           # GET: points summary
│   │   └── history/           # GET: ledger history
│   └── login/                 # Backoffice login
├── components/
│   ├── data-table/            # DataTable + FilterBar
│   └── layout/                # BackofficeLayout (sidebar)
└── lib/
    ├── supabase/              # browser, server, admin clients
    ├── line/                  # LINE id_token verification
    ├── portal/                # JWT session cookie
    ├── points/                # Points calculation helper
    └── validators/            # Zod schemas
```

## Key Features

- **Multi-tenant**: Organization-based data isolation via RLS
- **FIFO Redeem**: Points deducted from earliest-expiring lots first
- **Audit Trail**: Full ledger with EARN/REDEEM/EXPIRE/ADJUST/REVERSAL
- **365-day Expiry**: Points expire 1 year from earn date
- **LIFF Portal**: Customers view points via LINE OA
- **Server-side Pagination**: DataTable with sort, search, filters

## Deploy to Vercel

```bash
vercel
```

Set all environment variables in Vercel dashboard.
