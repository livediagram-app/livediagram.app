-- Which app a sign-up came through (liveworkspace/docs/specs/003-accounts/accounts.md "Onboarding emails"): the app of the
-- OAuth client whose authorize request the account was made in, or liveworkspace.app for a sign-up on
-- the site itself. The onboarding emails speak for it, and the team emails a person sends are counted
-- under it. Null for an account made before it was recorded. Written by hand, like 0002.
ALTER TABLE email_lifecycle ADD COLUMN signup_app TEXT
  CHECK (signup_app IN ('livediagram.app', 'liveplanner.app', 'livedocuments.app', 'livedesign.app', 'liveworkspace.app'));
