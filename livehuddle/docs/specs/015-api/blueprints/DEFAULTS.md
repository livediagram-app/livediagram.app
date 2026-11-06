# API blueprint defaults

One row per default applied where a spec is silent or qualitative.

| #   | Blueprint | Spec silence | Default applied |
| --- | --------- | ------------ | --------------- |

| #    | Blueprint        | Spec silence                                 | Default applied                                                                                                                                      |
| ---- | ---------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| REO1 | room-element-ops | How the sender hears that its op was refused | An `op-refused` frame to its socket alone, echoing the op's `ref`; no resync, which would re-read the stored tab and drop the sender's unsaved edits |
| REO2 | room-element-ops | Which fields the room "cannot judge"         | Every field the product's validator does not name; a named field is judged by this build's rule                                                      |
| REO3 | room-element-ops | Where a refusal is logged                    | A console line, bounded per room, not a telemetry event: an event is a network send per refusal, which a looping client would multiply               |
| REO4 | room-element-ops | Whether the room relays the migrated element | No: it judges the migrated copy and relays the op as sent, since every receiver runs the same migrations                                             |
