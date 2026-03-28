-- seed.sql
-- Times Experiences: seed data for development

-- =============================================================================
-- BRANDS
-- =============================================================================

-- BCCL Publishing brands that host events
INSERT INTO public.brands (name, slug, logo_url, primary_color) VALUES
  ('The Times of India', 'times-of-india', NULL, '#E31E24'),
  ('The Economic Times', 'economic-times', NULL, '#1A1A2E'),
  ('Navbharat Times', 'navbharat-times', NULL, '#FF6B00'),
  ('Maharashtra Times', 'maharashtra-times', NULL, '#0066B3'),
  ('Mumbai Mirror', 'mumbai-mirror', NULL, '#000000'),
  ('TIMS', 'tims', NULL, '#E91E63');

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
