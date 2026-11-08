-- Whether the account's time zone (0016) was picked by hand in Settings › Profile › Time Zone
-- (liveworkspace/docs/specs/003-accounts/accounts.md "The send window"): null is Automatic, so every existing row
-- reads as Automatic and the browser's zone keeps being noted; 1 is picked, and no automatic sighting overwrites the
-- zone while it stands. Read only beside the user's primary key, so it needs no index. Written by hand, like 0002.
ALTER TABLE "user" ADD COLUMN timeZoneChosen INTEGER CHECK (timeZoneChosen IS NULL OR timeZoneChosen = 1);
