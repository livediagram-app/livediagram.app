import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { APP_ORDER, appList, isAppId, type AppId, type HelpScope } from '@liveworkspace/help-registry';
import { appNoteStyle, NOTE_BOX_CLASS, NOTE_LABEL_CLASS, NOTE_TEXT_CLASS } from '../lib/app-palette';
import { AppMark, AppMarkRow } from './AppMarks';
import { ChevronDownIcon } from './chrome-icons';

// What is true for one app only, inside an article for several (liveworkspace/docs/specs/016-help/help-centre.md
// "App notes"): an accented box in that app's palette, its mark at the start and "In <app>" as its label. In an app's
// help that app's notes are open where the author put them and the other apps' fold into one closed row the article
// layout places at the end (AppNotesFold); under All Apps every note is open in place. The apps with no note are
// named in one quiet line (SameIn).

// How the article layout finds the notes in an article's body: the components the MDX renders carry this mark,
// whichever binding (createUseMdxComponents) made them.
export const APP_NOTE_MARK = 'helpAppNote';

export interface AppNoteProps {
  /** The app the note is about, or several as a comma list (`app="livediagram,liveplanner"`): each one of the
   *  article's apps (the layout fails the build otherwise). */
  app?: string;
  /** The same, as a list. */
  apps?: readonly AppId[];
  children: ReactNode;
}

/** The apps a note names, from `app` (one id or a comma list) and `apps`, in the order written, each once. Throws on
 *  a name that is not an app id, or on a note that names none. */
export function noteApps(props: { app?: unknown; apps?: unknown }): AppId[] {
  const names: unknown[] = [];
  if (typeof props.app === 'string') names.push(...props.app.split(',').map((n) => n.trim()));
  else if (props.app !== undefined) names.push(props.app);
  if (Array.isArray(props.apps)) names.push(...props.apps);
  const apps: AppId[] = [];
  for (const name of names) {
    if (!isAppId(name)) throw new Error(`[help] <AppNote app="${String(name)}">: not an app id`);
    if (!apps.includes(name)) apps.push(name);
  }
  if (apps.length === 0) throw new Error('[help] <AppNote> names no app');
  return apps;
}

/** The app whose palette a note takes: the scope's when the note names it, else the first it names. */
function paletteApp(apps: readonly AppId[], scope: HelpScope | undefined): AppId {
  return scope && scope !== 'all' && apps.includes(scope) ? scope : apps[0]!;
}

/** The note's box, open: each named app's mark in the label row, "In livediagram and liveplanner". */
function NoteBox({
  apps,
  scope,
  children,
}: {
  apps: readonly AppId[];
  scope: HelpScope | undefined;
  children: ReactNode;
}) {
  const label = `In ${appList(apps)}`;
  return (
    <aside
      data-app-note={apps.join(',')}
      aria-label={label}
      className={`my-5 rounded-xl border p-4 ${NOTE_BOX_CLASS}`}
      style={appNoteStyle(paletteApp(apps, scope))}
    >
      <p
        className={`mb-1.5 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-widest ${NOTE_LABEL_CLASS}`}
      >
        <span aria-hidden className="inline-flex items-center gap-1">
          {apps.map((a) => (
            <AppMark key={a} app={a} size={18} />
          ))}
        </span>
        <span>{label}</span>
      </p>
      <div
        className={`text-sm leading-relaxed ${NOTE_TEXT_CLASS} [&_li]:text-(--note-text) [&_p]:mb-2 [&_p]:text-sm [&_p]:text-(--note-text) [&_p:last-child]:mb-0 dark:[&_li]:text-(--note-text-dark) dark:[&_p]:text-(--note-text-dark)`}
      >
        {children}
      </div>
    </aside>
  );
}

/** Whether a note is open in place in `scope`: under All Apps, with no scope, or when it names the scope's app. */
export function noteOpenIn(apps: readonly AppId[], scope: HelpScope | undefined): boolean {
  return !scope || scope === 'all' || apps.includes(scope);
}

/**
 * The note as an article's MDX writes it (`<AppNote app="liveplanner">…</AppNote>`, or `app="livediagram,liveplanner"`
 * for several), bound to the help centre's scope by createUseMdxComponents: open when it names the scope's app and
 * under All Apps, nothing in place otherwise (the fold at the end shows it). A help centre with no scope shows every
 * note open.
 */
export function AppNote({ scope, children, ...props }: AppNoteProps & { scope?: HelpScope }) {
  const apps = noteApps(props);
  if (!noteOpenIn(apps, scope)) return null;
  return (
    <NoteBox apps={apps} scope={scope}>
      {children}
    </NoteBox>
  );
}
(AppNote as unknown as Record<string, boolean>)[APP_NOTE_MARK] = true;

/** One note found in an article's body. */
export interface FoundNote {
  apps: AppId[];
  children: ReactNode;
}

/**
 * Every AppNote in an article's body, in the order the author wrote them, looking through the elements' own children
 * (an MDX body is one tree of elements, each with its children in its props), so a note inside a list or a Step is
 * found too.
 */
export function findAppNotes(node: ReactNode): FoundNote[] {
  const found: FoundNote[] = [];
  const visit = (n: ReactNode): void => {
    if (Array.isArray(n)) {
      for (const child of n) visit(child);
      return;
    }
    if (!isValidElement(n)) return;
    const el = n as ReactElement<{ app?: unknown; apps?: unknown; children?: ReactNode }>;
    const type = el.type as unknown as Record<string, unknown> | string;
    if (typeof type !== 'string' && type?.[APP_NOTE_MARK] === true) {
      found.push({ apps: noteApps(el.props), children: el.props.children });
      return;
    }
    visit(el.props.children);
  };
  visit(node);
  return found;
}

/** Every app the notes name, in registry order. */
export function notedApps(notes: readonly FoundNote[]): AppId[] {
  const named = new Set(notes.flatMap((n) => n.apps));
  return APP_ORDER.filter((a) => named.has(a));
}

/**
 * The closed row "How this works in N other apps" (help-centre.md "App notes"), placed by the article layout in an
 * app's help: the other apps' notes, open inside it, in registry order. Nothing when there are none.
 */
export function AppNotesFold({ notes, scope }: { notes: readonly FoundNote[]; scope: AppId }) {
  const folded = notes.filter((n) => !noteOpenIn(n.apps, scope));
  if (folded.length === 0) return null;
  const apps = notedApps(folded);
  const label = `How this works in ${apps.length === 1 ? appList(apps) : `${apps.length} other apps`}`;
  return (
    <details
      data-app-notes-fold=""
      className="group my-8 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 transition-colors duration-micro hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-slate-200 dark:hover:bg-slate-800/60 [&::-webkit-details-marker]:hidden">
        <AppMarkRow apps={apps} scope={undefined} size={18} />
        <span className="flex-1">{label}</span>
        <ChevronDownIcon className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-micro group-open:rotate-180" />
      </summary>
      <div className="border-t border-slate-100 px-4 pb-1 pt-1 dark:border-slate-800">
        {byAppOrder(folded).map((note, i) => (
          <NoteBox key={`${note.apps.join(',')}-${i}`} apps={note.apps} scope={scope}>
            {note.children}
          </NoteBox>
        ))}
      </div>
    </details>
  );
}

// The notes in registry order of the first app each names, each app's in the order its author wrote them (the sort
// is stable).
function byAppOrder(notes: readonly FoundNote[]): FoundNote[] {
  const rank = (n: FoundNote) => Math.min(...n.apps.map((a) => APP_ORDER.indexOf(a)));
  return [...notes].sort((a, b) => rank(a) - rank(b));
}

/** "Works the same in livedocuments and livedesign": the apps an article applies to that have no note. */
export function SameIn({ apps }: { apps: readonly AppId[] }) {
  if (apps.length === 0) return null;
  return (
    <p
      data-same-in=""
      className="mt-6 flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400"
    >
      <AppMarkRow apps={apps} scope={undefined} size={16} />
      <span>{`Works the same in ${appList(apps)}.`}</span>
    </p>
  );
}
