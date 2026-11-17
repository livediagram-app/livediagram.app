-- Screen recordings and public links (liveworkspace/docs/specs/006-media/walkthroughs.md "Screen recordings"): whether a
-- walkthrough is a video of the screen, and its public link's code while the link is on (null when off). The code is
-- unique where set, and looked up by the public door.
ALTER TABLE walkthroughs ADD COLUMN screen INTEGER NOT NULL DEFAULT 0;
ALTER TABLE walkthroughs ADD COLUMN share_code TEXT;
CREATE UNIQUE INDEX walkthroughs_share_idx ON walkthroughs (share_code) WHERE share_code IS NOT NULL;
