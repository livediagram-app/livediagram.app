# Download your data

A signed-in person can download everything they own, from every app, as one zip: each diagram, plan, document and
design in its portable file, a picture of each tab, CSV for boards and sheets, the comments they wrote, their profile
and the images they uploaded. A team admin can download the same for everything the team owns. Exports today were
one item at a time; one download of everything answers a data-portability request, builds trust, and eases the fear
of lock-in that stops a team adopting a new tool.

```
liveworkspace/apps/accounts    the doors: Settings asks here, the admin check, the profile, the link, the email
liveworkspace/apps/export      the service Worker (@liveworkspace/export-service): one Durable Object per export
                               that builds the zip in chunks and writes it to R2
packages/app-doors             @liveworkspace/app-doors: the calls the platform makes on each app's internal doors
                               (the Drive mirror's and the export's), built once
```

## Who and what

- **Signed-in people only.** A guest owns nothing that outlives their browser. Every door is the accounts session's
  (`/api/account/data-export`), as API tokens are; an API token, a guest or no session is refused.
- **What I own, never what is shared with me.** A personal export holds the person's own items (the index's personal
  scope, in every app), the comments they wrote **inside those items**, their profile and the images they uploaded.
  An item someone else owns, shared with them through a link or a team, is never in it, and nor is a comment they
  wrote in one.
- **A team admin, for the team.** A team export holds every item the team owns and every comment in those items, and
  the team's name and id. It holds no one's profile and no images: an image belongs to whoever uploaded it, so each
  member's own export carries theirs. Only a team's admins may start one or download it, checked against accounts'
  own records (never a token's claim) when it starts and again at the download.
- **Live work.** Items in the Trash are left out. An item's folder is not kept: items are filed by app.

## What is in the zip

```
README.txt                          what each folder holds, and how to bring a file back
profile.json                        a personal export: the account, its profile, teams and settings
team.json                           a team export: the team's id and name
comments.json, comments.csv         the comments (personal: the ones I wrote; team: every one), with their item and tab
livediagram/<Name> (<id>)/          one folder per item, by app (liveplanner/, livedocuments/, livedesign/ alike)
  <Name>.livediagram                the item's whole file, JSON, exactly as the Drive mirror writes it
  01 <Tab>.png                      a picture of each tab, in order (up to EXPORT_TAB_PICTURES_MAX)
  <Board or Sheet>.csv              liveplanner only: each Board tab's cards and each Sheet's cells
images/<id> <name>                  a personal export: every image the person uploaded, in every app
```

- **The file** is the app's whole-item envelope ([drive.md "The file"](../005-drive/drive.md#the-file)), with the
  app's extension. Images stay references to the media service, as in Drive.
- **The pictures** are the app's `svg` export of each tab drawn as a PNG by the platform's shared renderer
  (`@liveworkspace/render-png`), at twice its size and at most `EXPORT_PICTURE_MAX_SIDE` on its long side. A tab with
  nothing to draw has none. There is no PDF: a PDF needs a server-side renderer the platform does not have.
- **The CSV** is the editor's own Download CSV, made on the server: a board's cards with their fields, a Sheet's cells
  as shown, no field written so a spreadsheet would run it as a formula.
- **Comments** are one list across every item: app, item, tab, thread, whether it is resolved, author, when and the
  text. The CSV carries the same rows, made safe for a spreadsheet.
- **Names** are the item's name made safe for every file system (no `/ \ : * ? " < > |`, no control characters, at
  most 80 characters), followed by the item's id, so two items of the same name never collide.
- **README.txt** says what each folder holds and how to bring an item back: its file is the same one the Google Drive
  mirror writes, so putting it in Google Drive and opening it with liveworkspace (**Import as a copy**) makes a new item
  from it.

## How it is built

The export never runs inside one request. Starting one makes a job in the export's Durable Object and answers at
once; the object's alarm does the work in chunks, each well inside a Worker invocation's limits, and carries on from
where it stopped.

1. **List.** The object reads the scope's items from the index, a page at a time, as the person or the team
   ([Contracts > The index](#the-index)), and the person's images from the media service.
2. **Items.** For each item it asks the item's app through its internal door
   ([Contracts > The apps](#the-apps)) for the file, then each tab's drawing, then (liveplanner) the CSV, then the
   comments; it draws the pictures and appends each file to the zip.
3. **Images.** Each image's bytes, from the media service.
4. **Finish.** The comments, the profile (or the team), the README and the zip's directory, then the upload is
   completed and accounts is told, which emails the link.

- **One export at a time per account.** A person may not start a second export, personal or a team's, while one they
  started is still being built (`409 export_running`). Starting a new one when an earlier one is ready replaces it.
- **A size cap.** An export stops adding files at `EXPORT_MAX_BYTES` (2 GiB), or at `EXPORT_MAX_ITEMS` items, and the
  README and Settings say how many items were left out. A single item whose file the app refuses or can't answer is
  left out and named in the README, and the export carries on.
- **Bounded memory.** The zip is written as it goes: each file is compressed (`deflate`, not for pictures or images,
  which are stored) and appended to a buffer that is uploaded to R2 as a multipart upload part whenever it reaches
  `EXPORT_PART_BYTES` (8 MiB). The object holds at most one part and one item's files at a time; what is left between
  chunks is kept in its storage. The zip's directory is kept in storage and written last.
- **Failures.** A door, the index or R2 failing is tried again with back-off; after `EXPORT_FAILURES_MAX` failures in
  a row the export fails, its upload is aborted and accounts emails to say so.

## The link

When an export is ready, accounts emails whoever started it a link to download it:
`<accounts>/api/account/data-export/download?key=<export key>&id=<export id>&exp=<ms>&sig=<hex>`.

- **Signed and expiring.** `sig` is an HMAC-SHA-256 over the person the link is for, the export's key and id, and the
  expiry, with a key only accounts holds (HKDF from its own secret, for this alone). The email's link is for whoever
  started it; Settings' **Download** is signed for whoever is looking, so any admin of a team may download its export. The link lapses `EXPORT_LINK_TTL_MS` (3 days) after the
  export is ready; so does the file, which the object deletes then (an R2 lifecycle rule deletes anything older than
  4 days, in case it can't).
- **And signed in as that account.** The download needs the accounts session of the person the link was made for.
  Signed out, it goes to the sign-in page and comes back; signed in as someone else, or with a link that has lapsed,
  been altered or been replaced, it goes to Settings, which says why. A team export also needs the person to still be
  the team's admin.
- **Streamed.** Accounts streams the zip from the export service as `liveworkspace-data-<date>.zip`; nothing is held
  in memory.

The email goes from accounts' sender with the platform's email layout: **Your liveworkspace data is ready** (or **Your
team's data is ready**, naming the team), the size, a Download button, and the line that the link works for 3 days
and only when signed in as that address. A failed export's email says so and points to Settings to try again.

## Settings

**Your Data** is a category in the Account section of Settings ([site.md "Settings"](../010-site/site.md#settings)),
beside API Tokens and Webhooks, for a signed-in person only.

- It opens with what a download holds, and each app it covers shown by its logo mark and wordmark.
- **Download All My Data** starts a personal export. While it is built the row shows its progress (items done of the
  total, then images, then finishing) and says the email will follow; Settings asks again every few seconds while it
  is open and the export is running, and not otherwise.
- Ready, the row shows the size, when it was made and when the link lapses, with **Download** (the same signed link)
  and **Make a New One**. Failed, it says so with **Try Again**. Capped, it says how many items were left out.
- **Your Teams** lists the teams the person is an admin of, each with the same row and **Download Team Data**.
- On an app's own address and in each editor, the category links to liveworkspace.app's Settings, as API Tokens do.
- Arriving from a refused link (`?settings=data&export=expired|other-account|missing`), the category opens and says
  why the link didn't work.

## The service

`liveworkspace/apps/export` (`liveworkspace-export`, `-staging`). It has no public route: only accounts reaches it,
through its `EXPORT` service binding, with `EXPORT_KEY_ACCOUNTS`; it calls accounts back the same way.

| Route                              | For                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------ |
| `POST /internal/exports`           | `{ key, scope, requestedBy, profile? }`: start an export, `202` with its state |
| `POST /internal/exports/status`    | `{ keys }`: each export's state, null for none                                 |
| `GET /internal/exports/<key>/file` | the zip, streamed from R2; `404` when there is none or it has lapsed           |
| `DELETE /internal/exports/<key>`   | stop it and delete its file (an account closing)                               |

`key` is `personal:<account id>` or `team:<team id>`; each names one SQLite Durable Object (`DataExport`) holding that
scope's latest export. The zip is the R2 object `exports/<key>/<export id>.zip` in the `liveworkspace-exports` bucket
(`-staging`).

Accounts' doors, for the signed-in person by their session:

| Route                                          | For                                                                           |
| ---------------------------------------------- | ----------------------------------------------------------------------------- |
| `GET /api/account/data-export`                 | `{ personal, teams: [{ id, name, export }] }`: the states Settings draws      |
| `POST /api/account/data-export`                | `{ team? }`: start the person's export, or a team's they run                  |
| `GET /api/account/data-export/download`        | the emailed link: checks it and the session, then streams the zip             |
| `POST /api/account/internal/data-export/ready` | the export service, `EXPORT_KEY_ACCOUNTS`: an export finished; send the email |

Closing an account deletes its personal export (`DELETE /internal/exports/personal:<id>`, after the answer, best
effort as Drive's disconnect is).

## Contracts

### The index

The service reads through its `INDEX` service binding, with `Authorization: Bearer <INDEX_KEY_EXPORT>`,
`X-Index-App: export` and `X-Index-Person: <account id>`, on `GET /api/index/items` alone (any other route answers
`404`). Lists are every app's, and narrowed to one scope: the person's personal items, or, when the request names a
team in `X-Index-Teams` (accounts checked the admin before the export started), that team's items. Nothing shared with
the person is ever in them. A guest id answers `403`, a wrong key `401`.

### The media service

`X-Media-App: export` with `Authorization: Bearer <MEDIA_KEY_EXPORT>` opens two routes alone: the owner's gallery
(`GET /api/media/app/images?owner=`) and an image's bytes (`GET /api/media/app/images/<id>/bytes`).

### The apps

Each app's export door (`@liveworkspace/index-app` `handleInternalItems`) takes the app's `DATA_EXPORT_KEY` (the
service's `DATA_EXPORT_KEY_<APP>`) on the export door alone, `GET /api/internal/items/:id/export`, in four formats:

- `format=file`: the whole-item envelope, as for the Drive mirror.
- `format=svg&tab=<id>`: one tab drawn, as for the previews; `204` when there is nothing to draw.
- `format=csv`: `{ tables: [{ name, kind, csv }] }`, each Board tab's cards and each Sheet's cells (liveplanner; the
  other apps answer `404`, having none).
- `format=comments`: `{ threads: ExportThread[] }`, every thread in the item (`id`, `tabId`, `tabName`, `on`,
  `resolved` and its `comments`, each `id`, `authorId`, `authorName`, `text`, `createdAt`), with each comment's real
  author, so the service can keep the person's own. In livediagram, livedocuments and livedesign a thread's `id` is
  `<tab id>:<element id>` and `on` is the element's id; in liveplanner `on` is the card's. An author who has been
  anonymised has a null `authorId`.

The `csv` and `comments` formats open to the index's key and the data export's alone, never the media or Drive key.
The platform calls every door through `@liveworkspace/app-doors`, which the Drive mirror uses too.

## Limits and cost

- **Per chunk:** an alarm works for at most `EXPORT_CHUNK_MS` (20 s) of wall time and `EXPORT_CHUNK_SUBREQUESTS`
  (400) requests, then sets the next alarm at once. The object's CPU limit is raised for the pictures (`cpu_ms`).
- **An export:** at most 2 GiB and 10,000 items, so the zip never needs Zip64 (under 4 GiB and 65,535 entries).
- **Requests:** about 3 to 3 + tabs per item (the file, the comments, each tab's drawing, and the CSV for a plan),
  one per image, and one per 8 MiB part. An account of 200 items with 3 tabs each is about 1,400 requests over a
  few chunks.
- **Storage:** one zip per scope, kept at most 3 days (4 with the lifecycle rule's slack).

## Privacy

An export passes the person's content through the platform: it reads each item from its app and keeps the zip in R2
until the link lapses, as the Drive mirror passes content through on its way to Google
([platform.md "Out of scope"](../001-platform-scope/platform.md#out-of-scope)). Nothing of the content is logged: the
service logs counts, sizes, ids and phases only.

## Before deploy

- Create the R2 buckets `liveworkspace-exports` and `liveworkspace-exports-staging`, each with a lifecycle rule that
  deletes objects 4 days after they are made.
- Set the secrets: `EXPORT_KEY_ACCOUNTS` (accounts and the export service, the same value), `INDEX_KEY_EXPORT` (index
  and service), `MEDIA_KEY_EXPORT` (media and service), and `DATA_EXPORT_KEY` on each app's api with the same value as
  the service's `DATA_EXPORT_KEY_<APP>`.
