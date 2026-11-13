-- livehuddle's old Inbox rows (Work Tracker 736; liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Inbox",
-- blueprints/inbox.md "livehuddle's old rows"). livehuddle removed comments, actions and the Inbox (#1612) and pushes
-- none now, but the rows it pushed before stayed in the index until their canvas was deleted. This deletes them once.
--
-- Every row a collab push writes carries the pushing app in `app` (it is part of each table's key), so `app =
-- 'livehuddle'` selects livehuddle's rows and no other app's. Three plain deletes, people first; no compound select,
-- no bound parameter. A direct delete is not a push, so no event or webhook goes. collab_forms and collab_form_reads
-- are left alone: livehuddle never had forms. Running it again deletes nothing.
--
-- NOT a migration: no deploy runs it. The owner runs it once, locally first, then on production:
--   corepack pnpm --filter @liveworkspace/index-service exec wrangler d1 execute liveworkspace-index --local --file scripts/livehuddle-inbox-cleanup.sql
--   corepack pnpm --filter @liveworkspace/index-service exec wrangler d1 execute liveworkspace-index --remote --file scripts/livehuddle-inbox-cleanup.sql

DELETE FROM collab_thread_people WHERE app = 'livehuddle';
DELETE FROM collab_threads WHERE app = 'livehuddle';
DELETE FROM collab_actions WHERE app = 'livehuddle';
