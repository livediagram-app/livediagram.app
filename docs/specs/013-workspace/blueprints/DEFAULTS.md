# Workspace blueprint defaults

One row per default applied where a spec is silent or qualitative.

| #   | Blueprint          | Spec silence                                                 | Default applied                                                                              |
| --- | ------------------ | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| D1  | trash              | Which migration number                                       | 0051; 0050 is the image reference index's, and the two are independent                       |
| D2  | trash              | Which rooms hear that a document was trashed                 | Only a document with a room (shareable or in a team), the rule every other room call follows |
| D3  | trash              | How many documents one purge batch names                     | 100 ids, one `json_each` list, flat statement count                                          |
| D4  | trash              | How the view orders groups and rows                          | Your documents, then teams A to Z, then this browser; rows newest deleted first              |
| D5  | trash              | Whether Restore asks for confirmation                        | No: it destroys nothing                                                                      |
| D6  | trash              | What the deleted card offers someone who can't restore       | "Go to Explorer" only, and that the link works again if it is restored                       |
| D7  | shape-libraries    | Which migration number                                       | 0060; 0059 is reserved by an open pull request (spec "Storage")                              |
| D8  | shape-libraries    | Whether name clashes compare case                            | Trimmed and case-insensitive: "UML" and "uml" read as the same name                          |
| D9  | shape-libraries    | How long an item id may be                                   | 64 characters; the client mints UUIDs (36)                                                   |
| D10 | shape-libraries    | How large one item may be                                    | Each side in (0, 100 000] px                                                                 |
| D11 | shape-libraries    | Whether sign-up may carry an account past the library cap    | Yes: the cap applies to creates; a migration never drops a guest's library                   |
| D12 | shape-libraries    | Order of an import holding diagrams and libraries            | Diagrams first, then libraries, one progress count over both                                 |
| D13 | shape-libraries    | Whether deleting one shape asks first                        | No: one shape is small; the library's delete asks                                            |
| D14 | shape-libraries    | Whether an empty library shows in My shapes                  | No: it shows only in the Explorer, where it can be deleted                                   |
| D15 | document-placement | Whether an empty-string `teamId` / `folderId` means "none"   | No: `placement_invalid`; only absent or null means the space or its root                     |
| D16 | document-placement | Where "Choose another place" leads                           | `/new` without `folder`, `team` and the bypass params; every other param kept                |
| D17 | default-folders    | Which migration number                                       | 0061, the next free number after 0060                                                        |
| D18 | default-folders    | How a key with a colon travels in the path                   | Either raw (`mode:draw`) or percent-encoded (`mode%3Adraw`); the route decodes the segment   |
| D19 | default-folders    | What a successful PUT answers                                | 204 with no body, as `PUT /api/favourites/:id` does                                          |
| D20 | default-folders    | The order GET lists defaults in                              | The order of `PLACEMENT_DEFAULT_KEYS`                                                        |
| D21 | default-folders    | Whether setting a key that has a default asks first          | No: the new folder replaces the old, `updated_at` restamped                                  |
| D22 | default-folders    | Whether an intent with fields beyond `mode` and `kind` fails | No: only `mode` and `kind` are read; other fields are ignored                                |
| D23 | default-folders    | How a personal default no longer the caller's is logged      | Its own skip reason, `folder_not_visible`, apart from `folder_missing`                       |
| D24 | default-folders    | What MCP reports when it cannot read the default's name      | "your default folder", with a `[mcp]` warning                                                |
| D25 | default-folders    | Whether an empty-string or unparsable PUT body is a folder   | No: `default_folder_invalid`, as for a missing `folderId`                                    |
