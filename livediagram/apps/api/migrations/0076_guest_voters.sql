-- Guest voters per network per document (docs/specs/012-collaboration/vote-integrity.md).
--
-- A guest id costs nothing to make, so a guest's vote is admitted against a cap of distinct guest voters per network
-- per document. One row per guest voter per network: `network_tag` is a SHA-256 of the document id and the caller's
-- network key (IPv4 address or IPv6 /64), `person_tag` the per-document person tag of the guest's owner id. Neither
-- can be read back. The primary key serves both the count and the membership read. Removed with the document.
CREATE TABLE guest_voters (
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  network_tag TEXT NOT NULL,
  person_tag TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (document_id, network_tag, person_tag)
);
