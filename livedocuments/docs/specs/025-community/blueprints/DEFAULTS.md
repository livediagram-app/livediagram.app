# Community blueprint defaults

One row per default applied where a spec is silent or qualitative.

| #   | Blueprint | Spec silence                                         | Default applied                                                                                         |
| --- | --------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| D1  | community | Port for local development                           | None of its own: the page is liveworkspace's site (3000), reached through livedocuments's router (3300) |
| D2  | community | How the editor learns a link is a Community one      | `GET /api/share/<code>`, in parallel with the document read, only for a view grant over every tab       |
| D3  | community | When an Explorer asks whether the Community is on    | For an account only; liveworkspace.app's asks an app the first time one of its items is shared, once    |
| D4  | community | What the Public badge does before the answer         | The Community is assumed on until `GET /api/capabilities` answers, as everywhere else                   |
| D5  | community | What a refused publish says in livedocuments's words | `COMMUNITY_APP_WORDS['livedocuments.app']`: "document", and the card picture is the "first page"        |
