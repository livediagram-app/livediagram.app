# Community blueprint defaults

One row per default applied where a spec is silent or qualitative. Rows that name a constant are read from the code: the spec gives no value, the code's is the default.

| #   | Blueprint | Spec silence                                       | Default applied                                                                |
| --- | --------- | -------------------------------------------------- | ------------------------------------------------------------------------------ |
| D1  | community | No value given for `API_PATH`                      | `COMMUNITY_API_PATH` (`config.ts`)                                             |
| D2  | community | No value given for `LIST_MAX_AGE_S`                | `30` (`config.ts`)                                                             |
| D3  | community | No value given for `FEATURED_MAX_AGE_S`            | `60` (`config.ts`)                                                             |
| D4  | community | No value given for `SITEMAP_MAX_AGE_S`             | `3600` (`config.ts`)                                                           |
| D5  | community | No value given for `MAX_BODY_BYTES`                | `64 * 1024` (`config.ts`)                                                      |
| D6  | community | No value given for `POST_COLS`                     | ``p.id, p.app, p.document, p.share_code, p.owner, p.author_na…` (`rows.ts`)    |
| D7  | community | No value given for `PUBLIC_POST`                   | `p.app = ? AND p.state = 'listed' AND p.document_state = 'public'` (`rows.ts`) |
| D8  | community | No value given for `COMMUNITY_CATEGORY_TYPES`      | `COMMUNITY_CATEGORIES.map((c) => c.type)` (`post.ts`)                          |
| D9  | community | No value given for `COMMUNITY_TITLE_MIN`           | `3` (`post.ts`)                                                                |
| D10 | community | No value given for `COMMUNITY_TITLE_MAX`           | `80` (`post.ts`)                                                               |
| D11 | community | No value given for `COMMUNITY_DESCRIPTION_MIN`     | `20` (`post.ts`)                                                               |
| D12 | community | No value given for `COMMUNITY_TAGS_MAX`            | `5` (`post.ts`)                                                                |
| D13 | community | No value given for `COMMUNITY_TAG_MIN`             | `2` (`post.ts`)                                                                |
| D14 | community | No value given for `COMMUNITY_TAG_MAX`             | `24` (`post.ts`)                                                               |
| D15 | community | No value given for `COMMUNITY_POSTS_PER_AUTHOR`    | `50` (`post.ts`)                                                               |
| D16 | community | No value given for `COMMUNITY_PAGE_SIZE`           | `24` (`post.ts`)                                                               |
| D17 | community | No value given for `COMMUNITY_MAX_OFFSET`          | `2400` (`post.ts`)                                                             |
| D18 | community | No value given for `COMMUNITY_AUTO_HIDE_REPORTERS` | `3` (`post.ts`)                                                                |
| D19 | community | No value given for `COMMUNITY_COUNTED_PER_NETWORK` | `5` (`post.ts`)                                                                |
| D20 | community | No value given for `COMMUNITY_POPULAR_TAGS`        | `24` (`post.ts`)                                                               |
| D21 | community | No value given for `COMMUNITY_RELATED_POSTS`       | `6` (`post.ts`)                                                                |
| D22 | community | No value given for `COMMUNITY_SEARCH_TERMS_MAX`    | `5` (`post.ts`)                                                                |
| D23 | community | No value given for `COMMUNITY_SEARCH_MAX`          | `200` (`post.ts`)                                                              |
| D24 | community | No value given for `COMMUNITY_FEATURED_COUNT`      | `6` (`post.ts`)                                                                |
| D25 | community | No value given for `COMMUNITY_FEATURED_WINDOW_MS`  | `90 * 24 * 60 * 60 * 1000` (`post.ts`)                                         |
| D26 | community | No value given for `COMMUNITY_SEARCH_TERM_MAX`     | `40` (`post.ts`)                                                               |
| D27 | community | No value given for `COMMUNITY_INPUT_FIELDS`        | `['title', 'description', 'category', 'tags'] as const` (`post.ts`)            |
| D28 | community | No value given for `COMMUNITY_SITEMAP_MAX`         | `5000` (`post.ts`)                                                             |
| D29 | community | No value given for `COMMUNITY_API_URL`             | `https://www.liveworkspace.app${COMMUNITY_API_PATH}` (`service.ts`)            |
| D30 | community | No value given for `COMMUNITY_DOCUMENT_STATES`     | `['public', 'closed', 'away'] as const` (`service.ts`)                         |
