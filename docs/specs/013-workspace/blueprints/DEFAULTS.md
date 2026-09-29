# Workspace blueprint defaults

One row per default applied where a spec is silent or qualitative.

| #   | Blueprint              | Spec silence                                           | Default applied                                                                              |
| --- | ---------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| D1  | trash                  | Which migration number                                 | 0051; 0050 is the image reference index's, and the two are independent                       |
| D2  | trash                  | Which rooms hear that a document was trashed           | Only a document with a room (shareable or in a team), the rule every other room call follows |
| D3  | trash                  | How many documents one purge batch names               | 100 ids, one `json_each` list, flat statement count                                          |
| D4  | trash                  | How the view orders groups and rows                    | Your documents, then teams A to Z, then this browser; rows newest deleted first              |
| D5  | trash                  | Whether Restore asks for confirmation                  | No: it destroys nothing                                                                      |
| D6  | trash                  | What the deleted card offers someone who can't restore | "Go to Explorer" only, and that the link works again if it is restored                       |
| D7  | empty-document-cleanup | What rows already in the Trash carry as their reason   | NULL (a person deleted them); no backfill                                                    |
| D8  | empty-document-cleanup | How the wire spells "deleted by a person"              | `'deleted'`, mapped from NULL, so the wire never carries a null reason                       |
| D9  | empty-document-cleanup | Whether an unreadable tab counts as content            | Yes: invalid JSON keeps the document, failing safe                                           |
| D10 | empty-document-cleanup | How many documents one sweep statement moves           | 500, at most 4 statements a run                                                              |
