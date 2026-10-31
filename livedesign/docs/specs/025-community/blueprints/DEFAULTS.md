# Community blueprint defaults

One row per default applied where a spec is silent or qualitative.

| #   | Blueprint | Spec silence                                      | Default applied                                                                                                            |
| --- | --------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| D1  | community | Port for local development                        | 3405 (livedesign's block, 3400 onward); the router's local `COMMUNITY_ORIGIN`                                              |
| D2  | community | How the live app learns a link is a Community one | `GET /api/share/<code>`, in parallel with the design read, only for a view grant over every tab                            |
| D3  | community | When an Explorer asks whether the Community is on | For an account only; liveworkspace.app's asks an app the first time one of its items is shared, once                       |
| D4  | community | What the Public badge does before the answer      | The Community is assumed on until `GET /api/capabilities` answers, as everywhere else                                      |
| D5  | community | What a refused publish says in livedesign's words | `COMMUNITY_APP_WORDS['livedesign.app']`: "design", and the card picture is the "first page"                                |
| D6  | community | What "a photo" on the first page means            | A photo page whose picture holds at least one layer (`photosOf(tab)[pageId].layers`), counted from the stored body         |
| D7  | community | Which photo doors a community link reads through  | The photo blob read (`GET .../photo-blobs/<blobId>`) alone: the pixels are content; uploads, adoption and `held` stay shut |
