# StayBeldi — Guest-Services Platform for Vacation Rentals in Morocco

LUXE HAVEN is a full-stack hospitality web application designed for Moroccan riads, villas, and coastal apartments. Guests open a property-specific link (`/stay/[slug]`) via an NFC card or QR code, browse curated extra services in English or French, and prepare structured service requests handed off via WhatsApp (`https://wa.me/...`).

Organization administrators and property managers manage properties, select services from a reusable 12-item global starter catalogue, create custom organization-scoped services, use AI-assisted service recommendations, customize pricing and schedules per property, and assign service-specific or default WhatsApp recipients.

---

## Technology Stack

- **Framework**: Next.js 15 App Router with TypeScript
- **Styling & UI**: Tailwind CSS, Radix UI / shadcn-style primitives, Lucide icons, Framer Motion animations
- **Database, Auth & Storage**: Supabase (PostgreSQL, Row-Level Security, Supabase Auth, Supabase Storage `staybeldi-media`) + built-in persistent local JSON repository fallback (`.data/staybeldi-db.json`) pre-seeded with Moroccan demo data so the application runs immediately out of the box
- **Validation**: Server-side Zod validation + `Africa/Casablanca` timezone-aware scheduling and price calculation
- **AI Integration**: Server-side AI service suggestion engine (`src/lib/ai-suggestions.ts`) with automatic rule-based fallback when `AI_API_KEY` is omitted or unreachable
- **QR Generation**: Server-side downloadable PNG & SVG QR code generator (`/api/admin/properties/[id]/qrcode`)

---

## Quick Local Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional for instant local evaluation (uses persistent local store in .data/staybeldi-db.json when blank)
# Required for production Supabase PostgreSQL + Auth + Storage deployment:
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET=staybeldi-media

# Optional Server-Side AI Configuration for Service Suggestions
# Falls back to clearly labelled rule-based suggestions when omitted
AI_API_KEY=
AI_MODEL=gpt-4o-mini
AI_BASE_URL=https://api.openai.com/v1
```

### 3. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000):
- **Home & Demo Directory**: `http://localhost:3000`
- **Public Guest Pages**:
  - Agadir Apartment: `http://localhost:3000/stay/islan-apartment`
  - Marrakech Villa: `http://localhost:3000/stay/marrakech-villa`
  - Tamraght Coastal Apartment: `http://localhost:3000/stay/tamraght-coastal-apartment`
- **Admin & Property Manager Dashboard**: `http://localhost:3000/admin`
- **Role Switcher & Sign-In**: `http://localhost:3000/login`

---

## Database Setup & Migrations (Supabase)

All database schema definitions, constraints, indexes, Row-Level Security (RLS) policies, safe public views (`public_properties_view` and `public_property_services_view`), and storage policies are located in:

1. [`supabase/migrations/20261018000001_initial_schema.sql`](supabase/migrations/20261018000001_initial_schema.sql)
2. [`supabase/seed.sql`](supabase/seed.sql)

### Applying Migrations to Supabase

Using the Supabase CLI:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

Or paste the contents of `supabase/migrations/20261018000001_initial_schema.sql` followed by `supabase/seed.sql` directly into the **Supabase SQL Editor** and click **Run**.

---

## Creating the First Organization Admin in Supabase

1. Sign up or create a user in **Supabase Dashboard → Authentication → Users** (e.g., `admin@yourdomain.ma`).
2. Copy the new user's `UUID` (`id`) from `auth.users`.
3. Run the following SQL in the **Supabase SQL Editor** to create their profile, organization, and `admin` membership:

```sql
-- 1. Create or upsert the user's profile
INSERT INTO public.profiles (id, email, full_name, preferred_language)
VALUES (
  'YOUR-AUTH-USER-UUID',
  'admin@yourdomain.ma',
  'Primary Organization Admin',
  'en'
)
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

-- 2. Create your organization (or attach to the seeded Atlas & Coast organization: '20000000-0000-4000-8000-000000000001')
INSERT INTO public.organizations (id, name, slug, default_currency, default_timezone, default_language, contact_email)
VALUES (
  '20000000-0000-4000-8000-000000000001',
  'Atlas & Coast Hospitality Morocco',
  'atlas-coast-morocco',
  'MAD',
  'Africa/Casablanca',
  'en',
  'admin@yourdomain.ma'
)
ON CONFLICT (id) DO NOTHING;

-- 3. Grant Organization Admin membership
INSERT INTO public.organization_members (organization_id, user_id, role, invited_email, is_active)
VALUES (
  '20000000-0000-4000-8000-000000000001',
  'YOUR-AUTH-USER-UUID',
  'admin',
  'admin@yourdomain.ma',
  true
)
ON CONFLICT (organization_id, user_id) DO UPDATE SET role = 'admin', is_active = true;
```

For local evaluation without a remote Supabase instance, use the built-in **Role & Organization Switcher** in the `/admin` top header or on `/login` to switch instantaneously between:
- **Karim El Fassi** (`Organization Admin` — Atlas & Coast Hospitality Morocco, access to all 3 properties)
- **Salma Benali** (`Property Manager` — assigned only to Agadir & Tamraght; Marrakech Villa is forbidden)
- **Omar Tazi** (`Organization Admin` — Medina Heritage Collection, isolated organization)

---

## Deploying to Vercel

1. Push this repository to GitHub / GitLab / Bitbucket.
2. Import the project in [Vercel](https://vercel.com/new).
3. Add the environment variables from `.env.example` (`NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and optionally `AI_API_KEY`).
4. Click **Deploy**.

---

## Remaining Configuration Requirements for Production

Before launching with live guests:
1. **Replace Demo WhatsApp Numbers**: The seeded demo properties use placeholder Moroccan phone numbers (`+212600000001`, etc.) with `is_demo_contact = true`, which intentionally disables external WhatsApp redirection so test clicks never message invented phone numbers. In `/admin`, update each property’s **Default Host WhatsApp Number** (and any service-level overrides) to your real international WhatsApp numbers and uncheck the demo contact flag.
2. **Connect Production Supabase Credentials**: Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` in your Vercel environment variables and run the SQL migration & seed files.
3. **Optional Live LLM Key**: Set `AI_API_KEY` on the server if you want live LLM-generated service suggestions instead of the deterministic rule-based hospitality engine.
