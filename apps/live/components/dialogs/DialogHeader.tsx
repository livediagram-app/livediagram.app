import type { ReactNode } from 'react';

// The dialog title row: a title, an optional subtitle, and a right-aligned
// slot for the header actions (typically a HelpArticleLink beside a
// DialogCloseButton). Seven dialogs had this tree typed out inline, which is
// four class strings each to retype and get right.
//
// The padding here is the `pt-6` that five of those seven used. Share and
// ShareOfflineGate had drifted to `pt-5` and now sit 4px lower, matching the
// rest — they are the same row and should not have been different.
//
// The actions are a CHILDREN SLOT rather than props because the close button
// is not uniform: most dialogs mount the standard DialogCloseButton, but Code
// and Chart data use a larger round one. Which of those is right is a design
// question, so this component carries neither opinion and renders whatever it
// is handed.
//
// Headers that are a different shape keep their own markup on purpose: the
// delete-account confirm has no close button, the password gate leads with a
// lock icon, and the profile pane's is an avatar row.
//
// MoveToFolder / PaletteFavourites / TabOrganise share the same tree but a
// tighter `px-5 pb-3 pt-5`. All three agree with each other, so that reads as
// a deliberate compact size rather than drift, and folding them in here would
// silently reflow them. If it turns out to be accidental, they belong here
// too — but that is a design call, not a refactor.
export function DialogHeader({
  title,
  subtitle,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-6 pt-6 pb-4 dark:border-slate-800">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
        {subtitle ? (
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{subtitle}</p>
        ) : null}
      </div>
      {children ? <div className="flex shrink-0 items-center gap-0.5">{children}</div> : null}
    </div>
  );
}
