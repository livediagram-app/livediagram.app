-- Favourites were removed (liveworkspace/docs/specs/004-index/one-explorer.md "Favourites removed", Work Tracker 1155)
-- and their table has been read by nothing since, and written only by an account's close. This drops it, its rows
-- and its two indexes (Work Tracker 1199). Nothing references it, so no other table changes; old `favourited` events
-- in `events` stay until they age out. 0001 and 0009, which made it, stay as they were.
DROP INDEX IF EXISTS favourites_person_created;
DROP INDEX IF EXISTS favourites_item;
DROP TABLE IF EXISTS favourites;
