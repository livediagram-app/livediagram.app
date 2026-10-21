# @livediagram/fake-google

An in-memory Google for tests: the Drive REST API v3 surface the Drive mirror
uses (files, folders, parents, the bin, `changes.list` with page tokens,
`appProperties`, `md5Checksum` / `headRevisionId`, multipart and resumable
uploads, `fields` and `q`) and the OAuth token and revoke endpoints
(`invalid_grant` included). See
[docs/specs/022-drive-mirror/blueprints/drive-mirror.md](../../docs/specs/022-drive-mirror/blueprints/drive-mirror.md).

- `new FakeGoogle()` then `fake.handle(request)` answers any Google request;
  pass `fake.fetch` wherever code takes a `fetch`.
- The `user*` methods act as the person in the Drive UI (rename, move, bin,
  restore, delete forever, create a folder livediagram cannot see, edit
  contents); `fail` injects 401 / 403 / 404 / 429 / 5xx.
- `@livediagram/fake-google/server` serves it over HTTP for the e2e stack.

It models `drive.file`: the app sees only files it created or was given
(Open with, the Picker). Where Google's behaviour is not yet verified
(research E-A1, E-A3), the model is a stated choice with a switch.
Test-only; never imported by an app bundle.
