-- Whether others see an account's Google profile picture (liveworkspace/docs/specs/003-accounts/accounts.md "Profile pictures"): the
-- Show My Google Picture switch in Settings › Profile. The picture itself is Google's `picture` claim, kept on the
-- account in Better Auth's own "user".image (0001), so it needs no column here. Null is on, the default, so every
-- existing row reads as on; 0 is off. Written by hand, like 0002.
ALTER TABLE profile ADD COLUMN show_picture INTEGER CHECK (show_picture IS NULL OR show_picture IN (0, 1));
