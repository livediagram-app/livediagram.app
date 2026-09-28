# Workspace blueprint defaults

One row per default applied where a spec is silent or qualitative.

| #   | Blueprint | Spec silence                                           | Default applied                                                                             |
| --- | --------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| D1  | trash     | Which migration number                                 | 0051; 0050 is the image reference index's, and the two are independent                      |
| D2  | trash     | Which rooms hear that a diagram was trashed            | Only a diagram with a room (shareable or in a team), the rule every other room call follows |
| D3  | trash     | How many diagrams one purge batch names                | 100 ids, one `json_each` list, flat statement count                                         |
| D4  | trash     | How the view orders groups and rows                    | Your diagrams, then teams A to Z, then this browser; rows newest deleted first              |
| D5  | trash     | Whether Restore asks for confirmation                  | No: it destroys nothing                                                                     |
| D6  | trash     | What the deleted card offers someone who can't restore | "Go to Explorer" only, and that the link works again if it is restored                      |
