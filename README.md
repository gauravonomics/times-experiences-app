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

## Testing

```bash
npm test          # run once
npm run test:watch  # watch mode
```

Tests live in `src/__tests__/`. The agent evaluation suite (`agent-eval.test.ts`) verifies tool definitions, view routing, type contracts, and configuration without requiring a running server.

## Production Deployment

### Supabase Production Project

1. Create a new Supabase project at https://supabase.com/dashboard
2. Note the Project URL, anon key, and service role key
3. Run database migrations:
   ```bash
   # Install Supabase CLI if not already
   npx supabase login
   npx supabase link --project-ref your-project-ref
   npx supabase db push
   ```
4. Verify RLS policies are active:
   - `events`: Public read for published/cancelled events, admin write
   - `rsvps`: Users can read own RSVPs, admin full access
   - `brands`: Public read, admin write
   - `templates`: Admin only
   - `accounts`: Admin only
   - `agent_conversations`: Owner read/write
   - `function_call_logs`: Admin only
5. Create an admin user:
   ```sql
   -- In Supabase SQL Editor, after creating a user via Auth
   INSERT INTO accounts (id, email, name, role)
   VALUES ('user-uuid-from-auth', 'admin@example.com', 'Admin Name', 'admin');
   ```
6. Set up Supabase Storage bucket `images` with public access for event cover images and brand logos

### Vercel Deployment

1. Connect the GitHub repo to Vercel
2. Set environment variables in Vercel Dashboard > Settings > Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `OPENAI_API_KEY`
   - `RESEND_API_KEY`
   - `NEXT_PUBLIC_SITE_URL`
3. Deploy:
   ```bash
   git push origin main
   ```
4. (Optional) Set up custom domain `experiences.timesgroup.com` in Vercel Dashboard > Domains

### Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous/public API key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (server-side only) |
| `OPENAI_API_KEY` | Yes | OpenAI API key for the AI agent chat |
| `RESEND_API_KEY` | Yes | Resend API key for transactional emails |
| `NEXT_PUBLIC_SITE_URL` | Yes | Public site URL for links in emails and calendar files |
