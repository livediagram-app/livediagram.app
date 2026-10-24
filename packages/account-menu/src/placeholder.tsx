// The account menu's footprint while its code or its name is on the way: the avatar's disc, in the place the
// trigger will take, so the bar doesn't jump when it arrives. Its own entry point (`/placeholder`), so a header can
// show it without loading the menu.
export function AccountMenuPlaceholder() {
  return (
    <span aria-hidden className="inline-flex shrink-0 items-center py-1 pr-2.5 pl-1">
      <span className="size-7 rounded-full bg-slate-200 dark:bg-slate-800" />
    </span>
  );
}
