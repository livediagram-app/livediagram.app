# Migrate blueprint defaults

One row per default applied where a spec is silent. Each code is cited in its blueprint's "Defaults ledger".

| #    | Blueprint | Default applied                                                                                                                |
| ---- | --------- | ------------------------------------------------------------------------------------------------------------------------------ |
| MIG1 | migrate   | a row with no time of its own (a favourite, a refs row) is only ever inserted; a later change to it is counted, never written. |
| MIG2 | migrate   | an MCP client registration with less than a minute to live is left out of the KV put rather than refused.                      |
| MIG3 | migrate   | of two share codes equal but for case, the older keeps it.                                                                     |
