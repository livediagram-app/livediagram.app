-- Explorer Home's opens, per docs/specs/013-workspace/explorer-home.md "Opens" and its blueprint
-- (docs/specs/013-workspace/blueprints/explorer-home.md "Data and persistence").
--
-- One row per person per document they have opened: how many UTC days they opened it on, and the
-- frecency key Jump back in ranks by (the instant the decayed open score falls to one, so the rank
-- index answers in order with no arithmetic). Owner-keyed like favourites: guests included, moved
-- on sign-up, deleted with the account. A purged document takes everyone's rows with it.
-- 0061 and 0062 are taken by open branches; if the merge order changes, this file takes the next
-- free number.

CREATE TABLE document_opens (
  owner_id        TEXT NOT NULL,
  document_id     TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  open_days       INTEGER NOT NULL,
  first_opened_at INTEGER NOT NULL,
  last_opened_at  INTEGER NOT NULL,
  last_open_day   TEXT NOT NULL,
  frecency_key    INTEGER NOT NULL,
  PRIMARY KEY (owner_id, document_id)
);

-- Jump back in: one person's rows, strongest first.
CREATE INDEX document_opens_rank_idx ON document_opens (owner_id, frecency_key DESC);
-- The daily retention sweep.
CREATE INDEX document_opens_last_idx ON document_opens (last_opened_at);

-- Home's Timeline reads a person's own events by actor, newest first; account deletion and the
-- sign-up migration match on actor_id too.
CREATE INDEX timeline_events_actor_idx ON timeline_events (actor_id, occurred_at DESC, id DESC);

-- Explorer Home seeds Jump back in once per person from their real edit days; the stamp rides the
-- user scope-state row, which account deletion and sign-up migration already handle.
ALTER TABLE timeline_scope_state ADD COLUMN frecency_seeded_at INTEGER;

-- The Timeline backfill reconstructs a document's last save as its owner's edit without knowing who
-- saved. It now says so (snapshot.backfilled); this marks the rows it wrote before that. A live edit
-- is stored within milliseconds of the time it claims (its occurred_at only walks forward), so an
-- edit stored more than a minute after its own time is a reconstruction.
UPDATE timeline_events
   SET snapshot = json_set(snapshot, '$.backfilled', json('true'))
 WHERE event_type = 'document_edited' AND created_at - occurred_at > 60000;
