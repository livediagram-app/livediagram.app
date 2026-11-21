-- A returning guest of the old livediagram.app from before signing, re-keyed (src/legacy-guest-rekey.ts,
-- liveworkspace/docs/specs/003-accounts/accounts.md "Re-keyed ids"): `rekeyedAt` (epoch ms) is when the row's `id`
-- moved from `guest_<old uuid>` to the id derived from the old uuid under LEGACY_GUEST_REKEY_SECRET. A claim takes a
-- marked row only by deriving its id, and never by the stored id itself. Null for an id still `guest_<old uuid>`.
-- Written by hand, like 0002, 0011 and 0013.
ALTER TABLE legacy_guest ADD COLUMN rekeyedAt INTEGER;
