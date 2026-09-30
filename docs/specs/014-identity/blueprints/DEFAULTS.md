# Identity blueprint defaults

One row per default applied where a spec is silent or qualitative.

| #   | Blueprint       | Spec silence                            | Default applied                                                                           |
| --- | --------------- | --------------------------------------- | ----------------------------------------------------------------------------------------- |
| D1  | profile-picture | How the Clerk URL's source is read      | The first path segment as base64url JSON; any failure is `'unknown'`, never an upload     |
| D2  | profile-picture | When the published picture is written   | On change only, compared with the last value written on this page                         |
| D3  | profile-picture | A PUT before the participant row exists | 404 is accepted; the next change or page load writes it                                   |
| D4  | profile-picture | What a repeat hello does                | Replaces the presence and rebroadcasts; the join side effects run on the first hello only |
| D5  | profile-picture | How a cursor shows a picture            | A 14px disc leading the name pill, only when a picture exists                             |
| D6  | profile-picture | Several Google accounts linked          | The first in Clerk's `externalAccounts` order                                             |
| D7  | profile-picture | Whether a picture fades in              | No transition: a small swap reads as a flicker when faded                                 |
