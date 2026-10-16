-- Form links (docs/specs/030-forms/forms.md "Publishing and the form link"). A Form tab's public address: the
-- code a respondent opens, whether the form takes responses, and its running response number. The form itself
-- stays on its tab; a link only names it, so a copy of the document is never published.
--
-- One live (unsuspended) link per Form tab. A suspended link is kept, so its code never answers again and the
-- document's suspensions can be counted.
CREATE TABLE form_links (
  code TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
  tab_id TEXT NOT NULL,
  open INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  -- The response number last given (blueprint §11: never reused).
  responses INTEGER NOT NULL DEFAULT 0,
  -- When the last response arrived (the Inbox's row time).
  last_response_at INTEGER,
  -- The per-form hourly cap's window and count.
  hour_start INTEGER NOT NULL DEFAULT 0,
  hour_count INTEGER NOT NULL DEFAULT 0,
  suspended_at INTEGER,
  -- The new-response email's throttle: when one last went, and how many arrived since.
  last_email_at INTEGER,
  held_emails INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX form_links_live_tab ON form_links (document_id, tab_id) WHERE suspended_at IS NULL;
CREATE INDEX form_links_document ON form_links (document_id);

-- Reports from respondents (docs/specs/030-forms/forms.md "Report This Form"): one per browser per link.
CREATE TABLE form_reports (
  code TEXT NOT NULL REFERENCES form_links (code) ON DELETE CASCADE,
  browser TEXT NOT NULL,
  network TEXT NOT NULL,
  reason TEXT NOT NULL,
  note TEXT,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (code, browser)
);

-- What each reader has seen of a form's responses (docs/specs/030-forms/forms.md "Hearing about responses"):
-- the last response number, so unseen = responses - seen_number with no row per card.
CREATE TABLE form_reads (
  code TEXT NOT NULL REFERENCES form_links (code) ON DELETE CASCADE,
  owner_id TEXT NOT NULL,
  seen_number INTEGER NOT NULL,
  PRIMARY KEY (code, owner_id)
);
CREATE INDEX form_reads_owner ON form_reads (owner_id);
