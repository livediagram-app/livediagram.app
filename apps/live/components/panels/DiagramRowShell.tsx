// The list item a diagram row sits in, across every list in the Explorer
// panel: the sidebar tree's folders, the synthetic Unsorted and Offline
// buckets, the current-diagram row, and the Recent sections.
//
// It exists for one behaviour that all five had written out longhand — a row
// being deleted plays out rather than vanishing. `useExplorerRowDelete` keeps
// the id in `exitingDiagramIds` for the length of the animation, and the row
// swaps its enter class for the exit one while that lasts.
//
// `overflow-hidden` is on both branches deliberately: the slide keyframes
// animate the row's height, so without it the row's own content spills past
// the collapsing box for the duration.
//
// The rows themselves are not shared, only their shell. Three of the five pass
// DiagramRow the same props and two do not (the current-diagram row and the
// Recent sections each have their own verbs), so hoisting the row as well
// would mean a component with two shapes pretending to be one.
export function DiagramRowShell({
  exiting,
  indent,
  children,
}: {
  exiting: boolean;
  // Left padding in px, for the trees that indent by depth. Omitted where the
  // list is flat.
  indent?: number;
  children: React.ReactNode;
}) {
  return (
    <li
      style={indent === undefined ? undefined : { paddingLeft: indent }}
      className={
        exiting ? 'animate-slide-row-out overflow-hidden' : 'animate-slide-row-in overflow-hidden'
      }
    >
      {children}
    </li>
  );
}
