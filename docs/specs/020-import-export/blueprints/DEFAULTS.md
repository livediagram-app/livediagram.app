# Import and export blueprint defaults

One row per default applied where a spec is silent or qualitative.

| #   | Blueprint         | Spec silence                                            | Default applied                                                                       |
| --- | ----------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| D40 | whiteboard-import | The tab name when the file name is empty                | `Whiteboard`                                                                          |
| D41 | whiteboard-import | Effect pens (galaxy, rainbow) whose colour is a pattern | Black at the path's opacity, counted `effect-pen`                                     |
| D42 | whiteboard-import | A stroke width halfway between two presets              | The thinner preset                                                                    |
| D43 | whiteboard-import | A white board background                                | Left unset, so the tab keeps its own background (the whiteboard look)                 |
| D44 | whiteboard-import | The colour of an imported comment's author              | `#64748b` (slate 500), the same for every imported author                             |
| D45 | whiteboard-import | Where parsing runs                                      | The main thread, yielding between items; a Worker only if real boards show long tasks |
