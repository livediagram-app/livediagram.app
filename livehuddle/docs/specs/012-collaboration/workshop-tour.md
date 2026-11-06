# Workshop tour ("Start Workshop Tour")

> **Gone from livehuddle** (Work Tracker #423, part 3): not part of livehuddle's meeting product ([Not in livehuddle](../002-project-scope/not-in-livehuddle.md)). livediagram keeps it, and [its spec there](../../../../livediagram/docs/specs/012-collaboration/workshop-tour.md) is the one to read and change.

livehuddle has no Workshop tour: the [Avatar tour](../008-canvas/avatar-tour.md) is the one guided tour of a Space
([The meeting board](workshop-mode.md#help)). Part 3 removed its host, its steps, its Settings row and its help
article; `/help/canvas/workshop-mode/workshop-tour/` redirects to the Avatar tour's article.

- The stored `workshopTourSeen` preference is kept as it is: nothing reads or writes it, and no migration runs
  ([User preferences](../007-editor/user-preferences.md)).
- `ActiveTour` no longer has `'workshop'`.
