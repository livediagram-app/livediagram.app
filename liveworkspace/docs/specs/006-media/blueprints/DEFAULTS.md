# Media blueprint defaults

One row per default applied where a spec is silent or qualitative. Rows that name a constant are read from the code: the spec gives no value, the code's is the default.

| #   | Blueprint | Spec silence                                       | Default applied                                               |
| --- | --------- | -------------------------------------------------- | ------------------------------------------------------------- |
| D1  | media     | No value given for `API_PATH`                      | `MEDIA_API_PATH` (`config.ts`)                                |
| D2  | media     | No value given for `PREVIEWS_PATH`                 | `PREVIEWS_API_PATH` (`config.ts`)                             |
| D3  | media     | No value given for `MAX_JSON_BYTES`                | `2 * 1024 * 1024` (`config.ts`)                               |
| D4  | media     | No value given for `UNUSED_IMAGE_AGE_MS`           | `30 * 24 * 60 * 60 * 1000` (`config.ts`)                      |
| D5  | media     | No value given for `SWEEP_TRIPWIRE_RATIO`          | `0.5` (`config.ts`)                                           |
| D6  | media     | No value given for `SWEEP_TRIPWIRE_MIN`            | `20` (`config.ts`)                                            |
| D7  | media     | No value given for `DOOR_TIMEOUT_MS`               | `15_000` (`door.ts`)                                          |
| D8  | media     | No value given for `SHARE_CARD_MARGIN`             | `48` (`share-card.ts`)                                        |
| D9  | media     | No value given for `SHARE_CARD_MAX_UPSCALE`        | `2` (`share-card.ts`)                                         |
| D10 | media     | No value given for `MAX_IMAGE_BYTES`               | `10 * 1024 * 1024` (`limits.ts`)                              |
| D11 | media     | No value given for `MAX_IMAGE_MB`                  | `MAX_IMAGE_BYTES / (1024 * 1024)` (`limits.ts`)               |
| D12 | media     | No value given for `SHARE_PREVIEW_DOORS`           | `['image.svg', 'image.png', 'card'] as const` (`previews.ts`) |
| D13 | media     | No value given for `SHARE_CARD_TIMEOUT_MS`         | `1500` (`share-page.ts`)                                      |
| D14 | media     | No value given for `GALLERY_USAGE_READS_IN_FLIGHT` | `8` (`usage.ts`)                                              |
| D15 | media     | No value given for `MEDIA_API_URL`                 | `https://liveworkspace.app${MEDIA_API_PATH}` (`wire.ts`)      |
