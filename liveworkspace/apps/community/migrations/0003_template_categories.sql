-- Each app's Community categories became its Start With template categories (liveworkspace/docs/specs/007-community/
-- community.md "Categories", "Moving to the template categories"): every stored post moves to the closest new id of its
-- own app, or to `other` (Something Else). One statement per app; an id already in the app's new set stays, and any
-- other id (one retired before, like livehuddle's `workshops`) becomes `other`.

UPDATE posts SET category = CASE
    WHEN category IN ('architecture', 'data') THEN 'software'
    WHEN category = 'flows' THEN 'processes'
    WHEN category = 'workshops' THEN 'meetings'
    WHEN category = 'mindmaps' THEN 'ideas'
    WHEN category = 'design' THEN 'product'
    WHEN category IN ('ideas', 'decisions', 'goals', 'meetings', 'people', 'planning', 'processes', 'product',
                      'games', 'retros', 'software', 'strategy', 'learning', 'spaces') THEN category
    ELSE 'other'
  END
  WHERE app = 'livediagram.app';

UPDATE posts SET category = CASE
    WHEN category IN ('projects', 'roadmaps', 'workflows', 'trackers', 'dashboards') THEN 'planning'
    WHEN category = 'budgets' THEN 'finance'
    WHEN category IN ('support', 'education', 'events', 'finance', 'hiring', 'marketing', 'meetings', 'personal',
                      'product', 'planning', 'sales') THEN category
    ELSE 'other'
  END
  WHERE app = 'liveplanner.app';

UPDATE posts SET category = CASE
    WHEN category = 'articles' THEN 'reports'
    WHEN category = 'decks' THEN 'pitches'
    WHEN category = 'infographics' THEN 'marketing'
    WHEN category IN ('guides', 'newsletters') THEN 'team'
    WHEN category = 'proposals' THEN 'plans'
    WHEN category IN ('careers', 'events', 'home', 'learning', 'marketing', 'pitches', 'plans', 'reports', 'speeches',
                      'team') THEN category
    ELSE 'other'
  END
  WHERE app = 'livedocuments.app';

UPDATE posts SET category = CASE
    WHEN category IN ('logos', 'illustrations') THEN 'branding'
    WHEN category = 'wireframes' THEN 'websites'
    WHEN category IN ('branding', 'health', 'media', 'onboarding', 'photos', 'shopping', 'social', 'travel', 'websites',
                      'work') THEN category
    ELSE 'other'
  END
  WHERE app = 'livedesign.app';

UPDATE posts SET category = CASE
    WHEN category IN ('offices', 'meetings') THEN 'office'
    WHEN category IN ('socials', 'communities') THEN 'recreation'
    WHEN category = 'learning' THEN 'events'
    WHEN category IN ('campus', 'events', 'office', 'outdoor', 'recreation') THEN category
    ELSE 'other'
  END
  WHERE app = 'livehuddle.app';
