-- The account's time zone, for the send window (liveworkspace/docs/specs/003-accounts/accounts.md "The send window"):
-- the IANA name liveworkspace.app's pages send on a session read, checked by src/send-window.ts parseTimeZone. Null
-- until one is seen, and the sweeps then time the account by the default zone (Europe/London). Read only beside the
-- user's primary key or unique address, so it needs no index. Written by hand, like 0002.
ALTER TABLE "user" ADD COLUMN timeZone TEXT;
