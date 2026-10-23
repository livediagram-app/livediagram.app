// The list item a design row sits in, across every list in the Explorer
// panel: the sidebar tree's folders, My Work and This Browser
// rows, the current-design row, and the Recent sections.
//
// It exists for one behaviour that all five had written out longhand — a row
// being deleted plays out rather than vanishing. `useExplorerRowDelete` keeps
// the id in `exitingDesignIds` for the length of the animation, and the row
// swaps its enter class for the exit one while that lasts.
//
// `overflow-hidden` is on both branches deliberately: the slide keyframes
// animate the row's height, so without it the row's own content spills past
// the collapsing box for the duration.
//
// The rows themselves are not shared, only their shell. Three of the five pass
// DesignRow the same props and two do not (the current-design row and the
// Recent sections each have their own verbs), so hoisting the row as well
// would mean a component with two shapes pretending to be one.
export function DesignRowShell({
  exiting,
  indent,
  enter = true,
  children,
}: {
  exiting: boolean;
  // Slide in as it mounts (a row just added). The editor Explorer's Current Design card is there as the panel
  // opens, so it does not: replayed on each opening, its growing height shook everything under it.
  enter?: boolean;
  // Left padding in px, for the trees that indent by depth. Omitted where the
  // list is flat.
  indent?: number;
  children: React.ReactNode;
}) {
  return (
    <li
      style={indent === undefined ? undefined : { paddingLeft: indent }}
      className={
        exiting
          ? 'animate-slide-row-out overflow-hidden'
          : enter
            ? 'animate-slide-row-in overflow-hidden'
            : 'overflow-hidden'
      }
    >
      {children}
    </li>
  );
}
