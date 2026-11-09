-- livediagram's Virtual Spaces category went to livehuddle with its Spaces templates (liveworkspace/docs/specs/
-- 007-community/community.md "Moving to the template categories"): its stored `spaces` posts move to `other`
-- (Something Else), which is how they already read. Safe to run twice.
UPDATE posts SET category = 'other' WHERE app = 'livediagram.app' AND category = 'spaces';
