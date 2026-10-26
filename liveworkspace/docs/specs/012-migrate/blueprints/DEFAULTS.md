# Migrate blueprint defaults

One row per default applied where a spec is silent or qualitative. Rows that name a constant are read from the code: the spec gives no value, the code's is the default.

| #   | Blueprint | Spec silence                                      | Default applied                                                                  |
| --- | --------- | ------------------------------------------------- | -------------------------------------------------------------------------------- |
| D1  | migrate   | No value given for `SHARE_PASSWORD_ITERATIONS`    | `100_000` (`ids.ts`)                                                             |
| D2  | migrate   | No value given for `DAY_MS`                       | `86_400_000` (`context.ts`)                                                      |
| D3  | migrate   | No value given for `BUNDLE_FORMAT`                | `1` (`index.ts`)                                                                 |
| D4  | migrate   | No value given for `KV_MIN_TTL_SECONDS`           | `60` (`kv.ts`)                                                                   |
| D5  | migrate   | No value given for `DBS`                          | `['accounts', 'index', 'media', 'community']` (`sql.ts`)                         |
| D6  | migrate   | No value given for `EMPTY_LEDGER`                 | `{ version: () => undefined }` (`sql.ts`)                                        |
| D7  | migrate   | No value given for `BATCH_ROWS`                   | `100` (`sql.ts`)                                                                 |
| D8  | migrate   | No value given for `BATCH_BYTES`                  | `90_000` (`sql.ts`)                                                              |
| D9  | migrate   | No value given for `CHUNK_STATEMENTS`             | `5_000` (`sql.ts`)                                                               |
| D10 | migrate   | No value given for `CHUNK_BYTES`                  | `6_000_000` (`sql.ts`)                                                           |
| D11 | migrate   | No value given for `REPO_ROOT`                    | `resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')` (`targets.ts`) |
| D12 | migrate   | No value given for `OLD_IMAGES_BUCKET`            | `'livediagram-images'` (`targets.ts`)                                            |
| D13 | migrate   | No value given for `MCP_CONFIG`                   | `join('livediagram', 'apps', 'mcp', 'wrangler.toml')` (`targets.ts`)             |
| D14 | migrate   | No value given for `TARGET_ACCOUNT_ID`            | `'851be7d244b76a6557bcbe6c4ded80f5'` (`targets.ts`)                              |
| D15 | migrate   | No value given for `SOURCE_ACCOUNT_VAR`           | `'MIGRATE_SOURCE_ACCOUNT_ID'` (`targets.ts`)                                     |
| D16 | migrate   | No value given for `SOURCE_TOKEN_VAR`             | `'MIGRATE_SOURCE_API_TOKEN'` (`targets.ts`)                                      |
| D17 | migrate   | No value given for `TARGET_TOKEN_VAR`             | `'MIGRATE_TARGET_API_TOKEN'` (`targets.ts`)                                      |
| D18 | migrate   | No value given for `LEGACY_GUEST_SIGNING_LIVE_AT` | `1790337600000` (`contract.ts`)                                                  |
| D19 | migrate   | No value given for `OLD_ITEM_PERSON_PREFIX`       | `'livediagram-item-person:'` (`person-ids.ts`)                                   |
| D20 | migrate   | No value given for `PLANNER_ITEM_PERSON_PREFIX`   | `'liveplanner-item-person:'` (`person-ids.ts`)                                   |
| D21 | migrate   | No value given for `OWNER`                        | `'user_ali'` (`split-fixtures.ts`)                                               |
| D22 | migrate   | No value given for `NEW_OWNER`                    | `'acct_ali'` (`split-fixtures.ts`)                                               |
