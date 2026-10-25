-- The Google Drive mirror's flag (liveworkspace/docs/drive.md "Contracts > The index"): one row per person whose
-- work is mirrored, set and cleared by the service with its key (`/app/people/:id/drive`), and gone when the
-- person is purged. After a write, the index reads it by primary key for the people the write touched, and
-- signals only those, so no one connected costs nothing.
CREATE TABLE drive_people (
  person_id TEXT    PRIMARY KEY,
  -- When it was first set.
  since     INTEGER NOT NULL
);
