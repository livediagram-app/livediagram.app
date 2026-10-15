// The form verbs' calls (docs/specs/030-forms/forms.md "Agents", blueprint §15 "Engine flow"), shared by the MCP's
// read_form, add_form, change_form and share_form and the CLI's form commands. Each reads the document's plan once
// (its tabs, boards and sheets named without their bodies) and the Form tab's own body, builds the whole change on a
// draft, and writes only once every change has been checked: card types first, then the form (a new Form tab by a
// changeset, an existing form through its route), then the tabs its responses go to.
import type { ApiClient } from '@livediagram/api-client';
import {
  CLIENT_HEADER,
  type ChangesetRequest,
  type ChangesetResponse,
  type FormLinkResponse,
  type ItemTypesRequest,
} from '@livediagram/api-schema';
import type { Tab } from '@livediagram/document';
import {
  FORM_VERSION,
  STARTER_IDS,
  UNTITLED_FORM,
  buildStarter,
  changesBeyondSettings,
  formStarter,
  newFormPartId,
  readForm as readStoredForm,
  sheetHeaders,
  starterBaseType,
  type FormDefinition,
  type StarterId,
} from '@livediagram/forms';
import { ITEM_TYPE_CATALOGUE_VERSION, newItemTypeId } from '@livediagram/items';
import { apiRefusalOf } from '../plan/api-refusal';
import { changeBoard } from '../plan/change-board';
import { CARD_TYPES_SAVE_ATTEMPTS, isCardTypesStale, itemTypesPath } from '../plan/plan-state';
import { columnIndex, columnLetters } from '@livediagram/sheets';
import { changeSheet } from '../sheets/change-sheet';
import { readSheet } from '../sheets/read-sheet';
import type { SheetChange } from '../sheets/sheet-change-build';
import { tabPath } from '../verbs/shared';
import {
  addQuestionTo,
  applyFormChanges,
  type FormChange,
  type SectionRuleInput,
} from './form-changes';
import { draftOf, setRespondsTo, type FormDraft, type RespondsToInput } from './form-draft';
import { refuse, resolveFormTab, type FormRefusal } from './form-names';
import type { QuestionInput } from './form-question';
import { readFormOf, type FormReading } from './form-read';
import {
  formLinkPath,
  readFormLink,
  readFormTabBody,
  readFormWorld,
  type FormWorld,
} from './form-world';

type Client = 'mcp' | 'cli';
export type FormDone = {
  ok: true;
  documentId: string;
  reading: FormReading;
  lines: string[];
  made: string[];
};
export type FormCallResult = FormDone | FormRefusal;

export const FORM_CHANGES_MAX = 50;

const newId = (prefix: 'q' | 's') => newFormPartId(prefix);
const tabNamesOf = (world: FormWorld) => new Map(world.tabs.map((t) => [t.id, t.name]));

async function guarded(run: () => Promise<FormCallResult>): Promise<FormCallResult> {
  try {
    return await run();
  } catch (err) {
    const refusal = apiRefusalOf(err);
    if (!refusal) throw err;
    return { ok: false, ...refusal };
  }
}

// --- Reading ----------------------------------------------------------------------------------------------------

// The plan, the Form tab named (its body: the one tab read), its link, and the form as read_form answers it.
async function readingOf(api: ApiClient, documentId: string, tabRef: string | undefined) {
  const world = await readFormWorld(api, documentId);
  const found = resolveFormTab(world.tabs, tabRef);
  if (!found.ok) return found;
  const [tab, link] = await Promise.all([
    readFormTabBody(api, documentId, found.tab.id),
    readFormLink(api, documentId, found.tab.id),
  ]);
  const form = readStoredForm(tab.form);
  if (!form) return refuse('not_a_form_tab', `"${tab.name}" holds no form yet.`);
  const reading = readFormOf({
    tabId: tab.id,
    form,
    boards: world.boards,
    sheets: world.sheets,
    tabNames: tabNamesOf(world),
    types: world.types,
    link,
  });
  return { ok: true as const, world, tab, form, link, reading };
}

export async function readForm(
  api: ApiClient,
  documentId: string,
  tabRef?: string,
): Promise<FormCallResult> {
  return guarded(async () => {
    const read = await readingOf(api, documentId, tabRef);
    if (!read.ok) return read;
    return { ok: true, documentId, reading: read.reading, lines: [], made: [] };
  });
}

// The answer after a write, from what was written: the draft's form among the boards and sheets it leaves, and the
// link as it stands (a new form has none). No second read of the document.
function doneFrom(
  d: FormDraft,
  tabId: string,
  link: FormLinkResponse | null,
  made: string[],
): FormDone {
  const reading = readFormOf({
    tabId,
    form: d.form,
    boards: d.boards,
    sheets: d.sheets,
    tabNames: tabNamesOf(d.world),
    types: d.types,
    link,
  });
  return { ok: true, documentId: d.world.documentId, reading, lines: d.lines, made };
}

// --- Writing ----------------------------------------------------------------------------------------------------

async function postChangeset(
  api: ApiClient,
  documentId: string,
  tabId: string,
  body: ChangesetRequest,
  client: Client,
): Promise<ChangesetResponse> {
  return api.json<ChangesetResponse>(`${tabPath(documentId, tabId)}/changesets`, {
    method: 'POST',
    headers: { [CLIENT_HEADER]: client },
    body: JSON.stringify(body),
  });
}

// The card types as the draft left them, saved at the revision read. Another change landing first is a stale
// refusal: the caller builds again from a fresh read.
async function saveTypes(api: ApiClient, d: FormDraft): Promise<'saved' | 'stale'> {
  if (!d.typesChanged) return 'saved';
  const body: ItemTypesRequest = {
    itemTypes: { version: ITEM_TYPE_CATALOGUE_VERSION, types: d.types },
    expectedRev: d.world.itemTypesRev,
  };
  try {
    await api.json(itemTypesPath(d.world.documentId), {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    return 'saved';
  } catch (err) {
    if (isCardTypesStale(err)) return 'stale';
    throw err;
  }
}

// A sheet form's sheet holds a header for every question, as a response would leave it: the ones it lacks are
// written after its last header (bold), never over one, so the columns answers already fill keep their meaning. A new
// sheet also freezes its header row and takes its tab's name, so it reads as the form's before anyone answers.
async function syncSheetHeaders(
  api: ApiClient,
  d: FormDraft,
  sheetId: string,
  fresh: { title: string } | null,
  client: Client,
): Promise<void> {
  const read = fresh
    ? null
    : await readSheet(api, d.world.documentId, { sheet: sheetId, range: 'A1:ZZ1' });
  const cells = read && read.ok ? read.cells : [];
  const have = new Set(cells.map((c) => c.display.trim().toLowerCase()).filter(Boolean));
  const lastCol = cells.reduce((n, c) => Math.max(n, columnIndex(c.at.replace(/\d+$/, '')) + 1), 0);
  const missing = sheetHeaders(d.form)
    .map((h) => h.header)
    .filter((h) => !have.has(h.toLowerCase()));
  const changes: SheetChange[] = [];
  if (missing.length) {
    const from = columnLetters(lastCol);
    const to = columnLetters(lastCol + missing.length - 1);
    changes.push({ op: 'set', at: `${from}1`, rows: [missing] });
    changes.push({ op: 'format', range: `${from}1:${to}1`, format: { bold: true } });
    // Widths fitted to the headers, so a long question never runs over the column beside it.
    changes.push({ op: 'resize', cols: `${from}:${to}`, fit: true });
  }
  if (fresh) changes.push({ op: 'freeze', rows: 1 }, { op: 'rename', title: fresh.title });
  if (!changes.length) return;
  const done = await changeSheet(api, d.world.documentId, { sheet: sheetId, changes }, client);
  // The sheet engine answers a refusal rather than throwing: a miss all the same.
  if (done.refusal) throw new Error(done.refusal.message);
  if (missing.length && !fresh)
    d.lines.push(
      `added the sheet's column${missing.length === 1 ? '' : 's'} ${missing.map((m) => `"${m}"`).join(', ')}`,
    );
}

// The responses tabs a draft makes, after what the document holds (made already when a new document carried them),
// each new sheet given its headers; then the boards that now take the form's card type.
async function writeAround(
  api: ApiClient,
  d: FormDraft,
  client: Client,
  tabsMade: boolean,
  // The form as it was read, when it was changed: its sheet is synced only when a header is new to it.
  before: FormDefinition | null = null,
): Promise<string[]> {
  const made: string[] = [];
  for (const tab of d.newTabs) {
    if (!tabsMade)
      await postChangeset(
        api,
        d.world.documentId,
        tab.id,
        {
          replace: {
            elements: tab.elements as unknown[],
            kind: tab.kind === 'sheet' ? 'sheet' : 'board',
            name: tab.name,
            ...(tab.theme ? { theme: tab.theme } : {}),
            layout: 'preserve',
          },
          summary: `Add ${tab.name}`,
        },
        client,
      );
    made.push(`${tab.kind === 'sheet' ? 'Sheet' : 'Board'} tab "${tab.name}" (${tab.id})`);
    const sheet = d.sheets.find((s) => s.tabId === tab.id);
    // The headers are a head start: the first response writes any it finds missing, so a miss here is said, not fatal.
    if (sheet)
      await syncSheetHeaders(api, d, sheet.sheetId, { title: tab.name }, client).catch(() =>
        made.push(`its header row is written by the first response`),
      );
  }
  // A sheet form's existing sheet gains a column for each question it lacks one for, read only when the form now asks
  // for a header it did not (a sheet read loads the document's sheets).
  const target = d.form.sheet;
  const had = new Set(before ? sheetHeaders(before).map((h) => h.header.toLowerCase()) : []);
  const newHeader = sheetHeaders(d.form).some((h) => !had.has(h.header.toLowerCase()));
  const switched = before?.sheet?.sheetId !== target?.sheetId;
  if (target && (newHeader || switched) && !d.newTabs.some((t) => t.id === target.tabId))
    await syncSheetHeaders(api, d, target.sheetId, null, client).catch(() =>
      made.push(`the sheet's new columns are written by the first response`),
    );
  for (const board of d.changedBoards.values()) {
    const changed = await changeBoard(
      api,
      d.world.documentId,
      // A board is changed only when it confines its types, so it names them.
      { board: board.elementId, types: board.types! },
      client,
    );
    made.push(
      changed.ok
        ? `"${board.tabName}" now takes the form's card type`
        : `"${board.tabName}" could not take the form's card type: ${changed.message}`,
    );
  }
  return made;
}

// --- add_form ---------------------------------------------------------------------------------------------------

export interface AddFormInput {
  documentId?: string;
  name?: string;
  theme?: string;
  starter?: StarterId;
  description?: string;
  questions?: QuestionInput[];
  sections?: {
    title?: string;
    description?: string;
    showIf?: SectionRuleInput;
    questions: QuestionInput[];
  }[];
  respondsTo?: RespondsToInput;
  settings?: Omit<Extract<FormChange, { op: 'settings' }>, 'op'>;
}

function startFromStarter(
  world: FormWorld,
  input: AddFormInput,
  formTab: Pick<Tab, 'id' | 'name' | 'theme'>,
): FormDraft | FormRefusal {
  if (!(STARTER_IDS as readonly string[]).includes(input.starter!))
    return refuse(
      'starter_unknown',
      `No starter "${input.starter}". Starters: ${STARTER_IDS.filter((s) => s !== 'blank').join(', ')}.`,
    );
  if (input.questions || input.sections)
    return refuse(
      'starter_and_questions',
      'Give a starter or questions, not both: change a started form with change_form.',
    );
  const starter = formStarter(input.starter!);
  const base = starterBaseType(starter, world.types, newItemTypeId(starter.name, world.types));
  const built = buildStarter(starter, base, newId);
  const form: FormDefinition = { ...built.form, ...(input.name ? { heading: input.name } : {}) };
  const d = draftOf(world, { ...formTab, name: form.heading }, form, newId);
  const r = input.respondsTo ?? (starter.respondsTo ? { to: starter.respondsTo } : undefined);
  if (r) {
    // A starter's ready-made type: the document's own copy is untouched unless the starter gave it fields.
    const own = world.types.find((t) => t.id === built.type.id);
    if (r.to === 'board' && !r.cardType && own !== built.type) {
      d.types = own
        ? d.types.map((t) => (t.id === built.type.id ? built.type : t))
        : [...d.types, built.type];
      d.typesChanged = true;
    }
    const refused = setRespondsTo(d, r, r.to === 'board' && !r.cardType ? built.type : undefined);
    if (refused) return refused;
  }
  d.lines.unshift(`started from ${starter.name}`);
  return d;
}

function startFromQuestions(
  world: FormWorld,
  input: AddFormInput,
  formTab: Pick<Tab, 'id' | 'name' | 'theme'>,
): FormDraft | FormRefusal {
  const form: FormDefinition = {
    v: FORM_VERSION,
    heading: input.name?.trim() || UNTITLED_FORM,
    ...(input.description?.trim() ? { description: input.description.trim() } : {}),
    sections: [{ id: newId('s'), title: '', questions: [] }],
  };
  const d = draftOf(world, { ...formTab, name: form.heading }, form, newId);
  const asked = input.questions?.length || input.sections?.some((s) => s.questions.length);
  const r = input.respondsTo ?? (asked ? { to: 'board' as const } : undefined);
  if (r) {
    const refused = setRespondsTo(d, r);
    if (refused) return refused;
  }
  for (const q of input.questions ?? []) {
    const refused = addQuestionTo(d, q, {});
    if (refused) return refused;
  }
  for (const [i, s] of (input.sections ?? []).entries()) {
    // The first section given is the form's first when no questions came before it.
    const first = i === 0 && !input.questions?.length;
    // The first page's title and description are the form's heading and description.
    if (first && s.description?.trim()) {
      if (!d.form.description) d.form = { ...d.form, description: s.description.trim() };
      else if (s.description.trim() !== d.form.description)
        d.lines.push(`the first page shows the form's description, not its own description`);
    }
    if (first && s.title?.trim() && s.title.trim() !== d.form.heading)
      d.lines.push(
        `the first page shows the form's heading ("${d.form.heading}"), not its own title "${s.title.trim()}"`,
      );
    if (!first) {
      const refused = applyFormChanges(d, [
        {
          op: 'add_section',
          ...(s.title ? { title: s.title } : {}),
          ...(s.description ? { description: s.description } : {}),
        },
      ]);
      if (refused) return refused;
    }
    const section = d.form.sections.length;
    for (const q of s.questions) {
      const refused = addQuestionTo(d, q, { section });
      if (refused) return refused;
    }
    if (s.showIf && !first) {
      const refused = applyFormChanges(d, [{ op: 'set_section', section, showIf: s.showIf }]);
      if (refused) return refused;
    }
  }
  return d;
}

const NO_DOCUMENT: Omit<FormWorld, 'documentId'> = {
  tabs: [],
  boards: [],
  sheets: [],
  types: [],
  statuses: [],
  itemTypesRev: 0,
};

export async function addForm(
  api: ApiClient,
  input: AddFormInput,
  client: Client,
): Promise<FormCallResult> {
  return guarded(async () => {
    for (let attempt = 1; ; attempt += 1) {
      const world: FormWorld = input.documentId
        ? await readFormWorld(api, input.documentId)
        : { documentId: crypto.randomUUID(), ...NO_DOCUMENT };
      const tabId = crypto.randomUUID();
      const theme = input.theme ?? world.tabs[0]?.theme;
      const formTab = { id: tabId, name: input.name ?? '', ...(theme ? { theme } : {}) };
      const d = input.starter
        ? startFromStarter(world, input, formTab)
        : startFromQuestions(world, input, formTab);
      if ('ok' in d) return d;
      if (input.settings) {
        const refused = applyFormChanges(d, [{ op: 'settings', ...input.settings }]);
        if (refused) return refused;
      }
      const tabTheme = d.formTab.theme ?? theme;
      const tab: Tab = {
        id: tabId,
        name: d.form.heading,
        elements: [],
        defaultTextSize: 'sm',
        kind: 'form',
        opensIn: 'plan',
        form: d.form,
        ...(tabTheme ? { theme: tabTheme } : {}),
      };
      const documentId = world.documentId;
      if (!input.documentId) {
        // A document of its own: made whole in one request, the Form tab first and its responses after.
        await api.json('/documents', {
          method: 'POST',
          body: JSON.stringify({
            id: documentId,
            name: d.form.heading,
            tabs: [tab, ...d.newTabs],
            source: client,
            ...(d.typesChanged
              ? { itemTypes: { version: ITEM_TYPE_CATALOGUE_VERSION, types: d.types } }
              : {}),
          }),
        });
        const made = [
          `document "${d.form.heading}" (${documentId})`,
          ...(await writeAround(api, d, client, true)),
        ];
        return doneFrom(d, tabId, null, made);
      }
      if ((await saveTypes(api, d)) === 'stale' && attempt < CARD_TYPES_SAVE_ATTEMPTS) continue;
      await postChangeset(
        api,
        documentId,
        tabId,
        {
          replace: {
            form: d.form as unknown as Record<string, unknown>,
            name: d.form.heading,
            ...(tabTheme ? { theme: tabTheme } : {}),
          },
          summary: `Add the ${d.form.heading} form`,
        },
        client,
      );
      const made = [
        `Form tab "${d.form.heading}" (${tabId})`,
        ...(await writeAround(api, d, client, false)),
      ];
      return doneFrom(d, tabId, null, made);
    }
  });
}

// --- change_form ------------------------------------------------------------------------------------------------

export async function changeForm(
  api: ApiClient,
  documentId: string,
  tabRef: string | undefined,
  changes: readonly FormChange[],
  client: Client,
): Promise<FormCallResult> {
  // No change is a read: nothing is written.
  if (changes.length === 0) return readForm(api, documentId, tabRef);
  if (changes.length > FORM_CHANGES_MAX)
    return refuse('too_many_changes', `At most ${FORM_CHANGES_MAX} changes a call.`);
  return guarded(async () => {
    for (let attempt = 1; ; attempt += 1) {
      const read = await readingOf(api, documentId, tabRef);
      if (!read.ok) return read;
      const d = draftOf(read.world, read.tab, read.form, newId);
      const refused = applyFormChanges(d, changes);
      if (refused) return refused;
      // A form taking responses keeps everything but its settings (its route refuses the rest too).
      if (read.reading.state === 'accepting' && changesBeyondSettings(read.form, d.form))
        return refuse(
          'form_locked',
          'This form is taking responses, so only its settings can change. Close it with share_form (action "close") first: its link stays, and publish opens it again.',
        );
      if ((await saveTypes(api, d)) === 'stale' && attempt < CARD_TYPES_SAVE_ATTEMPTS) continue;
      await api.json(`${tabPath(documentId, read.tab.id)}/form`, {
        method: 'POST',
        headers: { [CLIENT_HEADER]: client },
        body: JSON.stringify({
          form: d.form,
          rev: read.tab.rev,
          ...(d.themeChanged && d.formTab.theme ? { theme: d.formTab.theme } : {}),
        }),
      });
      const made = await writeAround(api, d, client, false, read.form);
      return doneFrom(d, read.tab.id, read.link, made);
    }
  });
}

// --- share_form -------------------------------------------------------------------------------------------------

export type ShareAction = 'publish' | 'close' | 'delete_link';

export async function shareForm(
  api: ApiClient,
  documentId: string,
  tabRef: string | undefined,
  action: ShareAction,
): Promise<FormCallResult> {
  if (!['publish', 'close', 'delete_link'].includes(action))
    return refuse('action_unknown', 'action is publish, close or delete_link.');
  return guarded(async () => {
    const read = await readingOf(api, documentId, tabRef);
    if (!read.ok) return read;
    const path = formLinkPath(documentId, read.tab.id);
    const live = read.link?.link ?? null;
    const lines: string[] = [];
    if (action === 'publish') {
      if (read.reading.problems.length)
        return refuse(
          'form_not_ready',
          `Not ready to publish. Fix these with change_form: ${read.reading.problems.join(' ')}`,
        );
      if (!live) {
        await api.json<FormLinkResponse>(path, { method: 'POST' });
        lines.push('published: the form link takes responses');
      } else if (!live.open) {
        await api.json<FormLinkResponse>(path, {
          method: 'PUT',
          body: JSON.stringify({ open: true }),
        });
        lines.push('opened again: the same link takes responses');
      } else lines.push('already taking responses');
    } else if (action === 'close') {
      if (!live)
        return refuse('form_not_published', 'This form has no link yet: publish it first.');
      await api.json<FormLinkResponse>(path, {
        method: 'PUT',
        body: JSON.stringify({ open: false }),
      });
      lines.push('closed: its link stays, and shows the closed message');
    } else {
      if (!live) return refuse('form_not_published', 'This form has no link to delete.');
      await api.json<FormLinkResponse>(path, { method: 'DELETE' });
      lines.push('link deleted: publishing again makes a new one');
    }
    const link = await readFormLink(api, documentId, read.tab.id);
    const reading = readFormOf({
      tabId: read.tab.id,
      form: read.form,
      boards: read.world.boards,
      sheets: read.world.sheets,
      tabNames: tabNamesOf(read.world),
      types: read.world.types,
      link,
    });
    return { ok: true, documentId, reading, lines, made: [] };
  });
}
