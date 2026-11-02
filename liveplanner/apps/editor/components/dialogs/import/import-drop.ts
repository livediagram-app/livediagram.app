// Where a file dropped on the Import dialog's list goes (docs/specs/026-plan/plan-tabs.md "The Import dialog"): the
// file says what it is. A liveplanner tab's JSON to the liveplanner Tab step, another tool's export to its preview,
// any other CSV into a Board or Sheet tab; anything none of them takes is said why. Each file is parsed once, by the
// import it goes to: a tab's JSON is told by the first lines of its envelope, a tool's CSV by its header row.
import { readTrackerText, isTrackerCsvHead, type TrackerFileRead } from '@/lib/tracker-file';
import type { IntoTab } from './into-tab';

export const DROP_UNKNOWN =
  "That file isn't a liveplanner tab or a Trello, Asana, Jira or Linear export.";
export const DROP_NOT_CSV = "That file isn't a CSV or a Trello, Asana, Jira or Linear export.";
export const DROP_TAB_JSON_HERE =
  'A liveplanner tab’s JSON imports into a Dashboard or Form tab. This tab takes a CSV.';
export const DROP_WANTS_CSV = 'This tab takes a CSV, and that file is JSON.';
export const DROP_WANTS_JSON = "That file isn't a liveplanner tab’s JSON.";

export type DropRoute =
  | { to: 'tab-json' }
  | { to: 'tab-csv' }
  | { to: 'tracker'; read: Extract<TrackerFileRead, { board: unknown }> }
  | { to: 'error'; error: string };

// A tab's export starts with its envelope (`tabToJsonText`): its kind sits in the first lines.
const TAB_KIND = /"kind"\s*:\s*"liveplanner\.tab"/;
const isTabJson = (text: string) => TAB_KIND.test(text.slice(0, 512));
const isJson = (text: string) => /^\s*[[{]/.test(text);

export function routeImportDrop(
  text: string,
  name: string,
  { intoTab, tools }: { intoTab: IntoTab; tools: boolean },
): DropRoute {
  const json = intoTab.kind === 'json';
  const fail = (error: string): DropRoute => ({ to: 'error', error });
  // A tool's export, read whole; undefined when it is no tool's, so the tab's own import may take it.
  const asTool = (): DropRoute | undefined => {
    if (!tools) return undefined;
    const read = readTrackerText(text, name);
    if ('board' in read) return { to: 'tracker', read };
    return read.refusal === 'unknown_source' ? undefined : fail(read.error);
  };

  if (isJson(text)) {
    if (isTabJson(text)) {
      if (!json) return fail(DROP_TAB_JSON_HERE);
      return intoTab.blocked ? fail(intoTab.blocked) : { to: 'tab-json' };
    }
    const tool = asTool();
    if (tool) return tool;
    if (tools) return fail(json ? DROP_UNKNOWN : DROP_NOT_CSV);
    // No tools to try: the tab's own import says what is wrong with it.
    if (json) return intoTab.blocked ? fail(intoTab.blocked) : { to: 'tab-json' };
    return fail(DROP_WANTS_CSV);
  }
  // Text: a tool's CSV when its header is one, read whole only then; else the tab's CSV, or nothing.
  if (tools && isTrackerCsvHead(text)) {
    const tool = asTool();
    if (tool) return tool;
  }
  if (!json) return intoTab.blocked ? fail(intoTab.blocked) : { to: 'tab-csv' };
  return fail(tools ? DROP_UNKNOWN : DROP_WANTS_JSON);
}
