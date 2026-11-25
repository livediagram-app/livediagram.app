-- Connect as tabs (liveworkspace/docs/specs/004-index/connected-tabs.md "Linked from a Send to", blueprint
-- connected-tabs.md, Work Tracker 1429): a connection made after a Send to, with no pass. A linked row opens only to
-- a reader's own access, and removing it removes its pair. Every row made before is a Connect File one (0).
ALTER TABLE connections ADD COLUMN linked INTEGER NOT NULL DEFAULT 0;
