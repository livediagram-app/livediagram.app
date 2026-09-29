-- Comment mentions (docs/specs/012-collaboration/comment-mentions.md): the thread index records who a thread
-- @-tags, so the Activity page (docs/specs/013-workspace/activity-page.md) can list it for them even when they
-- never commented. A JSON array of user ids and team member ids, like
-- participant_ids beside it. Existing rows predate mentions, so '[]' is their
-- true value and no backfill is needed.

ALTER TABLE collab_threads ADD COLUMN mentioned_ids TEXT NOT NULL DEFAULT '[]';
