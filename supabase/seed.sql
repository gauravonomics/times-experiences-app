-- seed.sql
-- Times Experiences: seed data for development

-- =============================================================================
-- BRANDS
-- =============================================================================

-- Note: Times Tribes is a platform, Times Lit Fest is an event — neither are brands.
-- Only actual BCCL brands that host events should be seeded here.
INSERT INTO public.brands (name, slug, logo_url, primary_color) VALUES
  ('Economic Times', 'economic-times', '/logos/economic-times.svg', '#1A1A2E');

-- =============================================================================
-- TEMPLATES
-- =============================================================================

INSERT INTO public.templates (name, type, default_capacity, description_prompt, default_metadata) VALUES
  (
    'Awards',
    'awards',
    150,
    'Formal ceremony celebrating excellence. Include the award categories, selection criteria, and past honorees if applicable. Use prestigious, celebratory language.',
    '{"dress_code": "formal", "format": "ceremony"}'
  ),
  (
    'Summit',
    'summit',
    300,
    'Large-format conference with keynote speakers and panel discussions. Highlight the theme, confirmed speakers, and key topics. Use authoritative, forward-looking language.',
    '{"format": "conference", "has_panels": true}'
  ),
  (
    'Roundtable',
    'roundtable',
    15,
    'Intimate, closed-door discussion with senior leaders. Emphasize exclusivity, the caliber of participants, and the specific topic being explored. Use understated, premium language.',
    '{"format": "discussion", "invite_only": true}'
  );
