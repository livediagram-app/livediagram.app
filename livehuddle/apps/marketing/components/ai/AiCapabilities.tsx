import {
  lucideBuilding2,
  lucideSearch,
  lucideShare2,
  lucideStickyNote,
  lucideUndo2,
  lucideTrash2,
} from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@livehuddle/ui';

// What it can do (docs/specs/019-marketing/build-with-ai.md "The page" 5): the MCP's tools in plain words. Every
// card maps to a shipped tool (docs/specs/015-api/mcp-server.md §4); a new tool earns a card here only once it ships.
const CAPABILITIES = [
  {
    icon: lucideGlyph(lucideBuilding2, 20),
    title: 'Spaces from a sentence',
    body: 'A Team Pod for the stand-up, a Virtual Office with a floor for each team, an All-Hands Hall for Friday: each from the Space templates, furnished and ready to walk into.',
  },
  {
    icon: lucideGlyph(lucideStickyNote, 20),
    title: 'Notes on the walls',
    body: 'Sticky notes, titles and labels in the rooms, written from your words, in a theme that fits the team.',
  },
  {
    icon: lucideGlyph(lucideTrash2, 20),
    title: 'Tidy up',
    body: 'Renames Spaces, moves the ones you no longer need to the Trash, and restores them again if you change your mind.',
  },
  {
    icon: lucideGlyph(lucideSearch, 20),
    title: 'Find and read',
    body: 'Searches your Spaces and your teams’, and reads any tab back as an outline and a picture.',
  },
  {
    icon: lucideGlyph(lucideShare2, 20),
    title: 'Share links',
    body: 'Turns a Space into a link for your team, as a Participant link unless you ask for another role.',
  },
  {
    icon: lucideGlyph(lucideUndo2, 20),
    title: 'Live, and undoable',
    body: 'Changes land on an open Space as they happen, outlined so you can see them, with Undo one click away. Your agent shows as its own avatar on the tab it is working on.',
  },
];

export function AiCapabilities() {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {CAPABILITIES.map(({ icon: Icon, title, body }) => (
        <li
          key={title}
          className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900"
        >
          <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
            <Icon aria-hidden />
          </span>
          <h3 className="mt-4 font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {body}
          </p>
        </li>
      ))}
    </ul>
  );
}
