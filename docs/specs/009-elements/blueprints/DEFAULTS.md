# Elements blueprint defaults

One row per default applied where a spec is silent or qualitative.

| #   | Blueprint             | Spec silence                                  | Default applied                                                                   |
| --- | --------------------- | --------------------------------------------- | --------------------------------------------------------------------------------- |
| D1  | image-reference-index | How the migration stamps `created_at`         | `CAST(strftime('%s', 'now') AS INTEGER) * 1000`, portable to every SQLite D1 runs |
| D2  | image-reference-index | How often a worker asks whether it's complete | Until it first reads complete; then memoised for the isolate's life               |
| D3  | image-reference-index | Order of the usage map's diagram lists        | Diagram name, then id, so the response is deterministic                           |
