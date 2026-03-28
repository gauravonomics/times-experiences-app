# Times Experiences

BCCL's agent-native event management platform. Luma-style event pages with RSVP, admin panel with AI chat sidebar.

## Tech Stack

- Next.js 16 (App Router, server components)
- React 19 + TypeScript (strict)
- Tailwind CSS v4
- shadcn/ui + Lucide icons
- Supabase (Postgres + RLS + Auth)

## Setup

### 1. Environment Variables

```bash
cp .env.example .env.local
```

Fill in your Supabase credentials:

| Variable | Where to Find |
|----------|--------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard > Settings > API > Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard > Settings > API > anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard > Settings > API > service_role key |

### 2. Database Setup

Run the migration files against your Supabase project:

```bash
# Option A: Supabase CLI
supabase db push

# Option B: Manual — paste these in the Supabase SQL Editor in order:
# 1. supabase/migrations/001_initial_schema.sql
# 2. supabase/migrations/002_rls_policies.sql
# 3. supabase/seed.sql
```

### 3. Create Admin User

In the Supabase Dashboard:

1. Go to Authentication > Users > Add User
2. Create a user with email + password
3. Run this SQL to make them an admin:

```sql
INSERT INTO public.accounts (id, email, name, role)
VALUES ('<user-uuid-from-step-2>', 'admin@example.com', 'Admin', 'admin');
```

### 4. Run Development Server

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Login at [http://localhost:3000/login](http://localhost:3000/login).

## Project Structure

```
src/
  app/
    admin/          # Admin routes (protected by middleware)
      events/       # Event CRUD routes
      analytics/    # Analytics view
      brands/       # Brand management
      templates/    # Template management
    auth/callback/  # Supabase auth callback
    events/[slug]/  # Public event pages
    login/          # Admin login (email + password)
  components/
    admin/          # AdminLayout, TopNav, ContextPanel, ChatDrawer
    ui/             # shadcn/ui components
  lib/
    supabase/       # Client utilities (server.ts, client.ts), types
supabase/
  migrations/       # SQL migration files (schema, RLS)
  seed.sql          # Seed data (3 brands, 3 templates)
```

## Database Schema

6 tables: `events`, `rsvps`, `brands`, `templates`, `accounts`, `agent_conversations`. See `supabase/migrations/001_initial_schema.sql` for full schema.

RLS policies enforce: public reads published events, public creates RSVPs on published events, admin-only for everything else.
