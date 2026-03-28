-- 002_rls_policies.sql
-- Times Experiences: Row Level Security policies for all tables

-- =============================================================================
-- HELPER FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.accounts
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

-- =============================================================================
-- ENABLE RLS ON ALL TABLES
-- =============================================================================

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_conversations ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- BRANDS POLICIES
-- =============================================================================

-- Public can read all brands
CREATE POLICY "brands_select_public"
  ON public.brands
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Only admins can insert brands
CREATE POLICY "brands_insert_admin"
  ON public.brands
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Only admins can update brands
CREATE POLICY "brands_update_admin"
  ON public.brands
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Only admins can delete brands
CREATE POLICY "brands_delete_admin"
  ON public.brands
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- =============================================================================
-- TEMPLATES POLICIES
-- =============================================================================

-- Public can read all templates
CREATE POLICY "templates_select_public"
  ON public.templates
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Only admins can insert templates
CREATE POLICY "templates_insert_admin"
  ON public.templates
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Only admins can update templates
CREATE POLICY "templates_update_admin"
  ON public.templates
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Only admins can delete templates
CREATE POLICY "templates_delete_admin"
  ON public.templates
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- =============================================================================
-- ACCOUNTS POLICIES
-- =============================================================================

-- Users can read their own account
CREATE POLICY "accounts_select_own"
  ON public.accounts
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Admins can read all accounts
CREATE POLICY "accounts_select_admin"
  ON public.accounts
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Users can update their own account
CREATE POLICY "accounts_update_own"
  ON public.accounts
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- =============================================================================
-- EVENTS POLICIES
-- =============================================================================

-- Anon can read published events only
CREATE POLICY "events_select_public"
  ON public.events
  FOR SELECT
  TO anon
  USING (status = 'published');

-- Authenticated users can read all events (for admin panel)
CREATE POLICY "events_select_authenticated"
  ON public.events
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can insert events
CREATE POLICY "events_insert_admin"
  ON public.events
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Only admins can update events
CREATE POLICY "events_update_admin"
  ON public.events
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Only admins can delete events
CREATE POLICY "events_delete_admin"
  ON public.events
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- =============================================================================
-- RSVPS POLICIES
-- =============================================================================

-- Public can insert RSVPs on published events
CREATE POLICY "rsvps_insert_public"
  ON public.rsvps
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.events
      WHERE events.id = event_id
        AND events.status = 'published'
    )
  );

-- Authenticated users can read their own RSVPs (matched by account_id)
CREATE POLICY "rsvps_select_own"
  ON public.rsvps
  FOR SELECT
  TO authenticated
  USING (account_id = auth.uid());

-- Admins can read all RSVPs
CREATE POLICY "rsvps_select_admin"
  ON public.rsvps
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Admins can update all RSVPs
CREATE POLICY "rsvps_update_admin"
  ON public.rsvps
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Admins can delete all RSVPs
CREATE POLICY "rsvps_delete_admin"
  ON public.rsvps
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- =============================================================================
-- AGENT_CONVERSATIONS POLICIES
-- =============================================================================

-- Users can read their own conversations
CREATE POLICY "agent_conversations_select_own"
  ON public.agent_conversations
  FOR SELECT
  TO authenticated
  USING (account_id = auth.uid());

-- Users can insert their own conversations
CREATE POLICY "agent_conversations_insert_own"
  ON public.agent_conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (account_id = auth.uid());

-- Users can update their own conversations
CREATE POLICY "agent_conversations_update_own"
  ON public.agent_conversations
  FOR UPDATE
  TO authenticated
  USING (account_id = auth.uid())
  WITH CHECK (account_id = auth.uid());

-- Admins can read all conversations
CREATE POLICY "agent_conversations_select_admin"
  ON public.agent_conversations
  FOR SELECT
  TO authenticated
  USING (public.is_admin());
