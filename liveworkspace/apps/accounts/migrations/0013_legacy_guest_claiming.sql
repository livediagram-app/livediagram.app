-- A claim of a returning guest of the old livediagram.app holds the row while it merges (src/legacy-guests.ts,
-- liveworkspace/docs/specs/003-accounts/accounts.md "Returning guests of the old livediagram.app"): `claimingBy` is who is merging it in,
-- `claimingUntil` (epoch ms) when that hold lapses if the claim never finished. Taken in one conditional update before
-- the merge, so two claims at once can't both merge. Null when no claim is under way.
-- Written by hand, like 0002 and 0011.
ALTER TABLE legacy_guest ADD COLUMN claimingBy TEXT;
ALTER TABLE legacy_guest ADD COLUMN claimingUntil INTEGER;
