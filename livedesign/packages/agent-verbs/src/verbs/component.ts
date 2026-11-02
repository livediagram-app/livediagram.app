// The component verbs (docs/specs/015-api/cli.md "Commands", docs/specs/009-elements/components.md "Exports,
// thumbnails and agents"): `component ls` (the components view), `component make` (elements become a main, stored,
// then swapped for one instance as a changeset) and `component set` (a main changed element by element). Placing an
// instance and its overrides are ordinary element edits; `element detach` makes one plain elements again.
import { z } from 'zod';
import type { ComponentPatch, DesignComponent } from '@livedesign/design';
import { readPlainTab, recordCopy } from '../copies';
import { defineVerb, VerbRefusal, type Verb, type VerbContext } from '../define';
import { writeFlags, submitChangeset } from '../write';
import {
  componentSummary,
  patchComponent,
  prepareMakeComponent,
  readLibrary,
  storedButNotPlaced,
  type ComponentRefused,
} from '../components';
import { designOf, tabOf } from './shared';

const docArg = z.string().describe('A name, id prefix or livedesign URL');
const tabFlag = z
  .string()
  .optional()
  .describe('A tab name or id prefix; the first tab when omitted');
const LS_HINT = 'list the components with: livedesign component ls <doc>';

const summaryOutput = z.object({
  id: z.string(),
  name: z.string(),
  width: z.number(),
  height: z.number(),
  archived: z.boolean(),
  elements: z.number(),
});
const summaryLine = (c: z.infer<typeof summaryOutput>) =>
  `component ${c.id} ${JSON.stringify(c.name)} ${Math.round(c.width)}x${Math.round(c.height)}${c.archived ? ' archived' : ''} · ${c.elements} element${c.elements === 1 ? '' : 's'}`;

const refusal = (r: ComponentRefused, status = 400) =>
  new VerbRefusal({ status, code: r.code, message: r.message, hint: r.hint ?? LS_HINT });

export const componentLs = defineVerb({
  id: 'component.ls',
  summary: "The design's components",
  description:
    "Prints the components view: each main's id, name and frame, and its elements with the ids an instance's componentOverrides is keyed by and the fields each takes.",
  behaviour: 'read',
  input: z.object({
    doc: docArg,
    budget: z.coerce.number().int().min(1).optional().describe('Fit it to about this many tokens'),
    json: z.boolean().optional().describe('The view as JSON'),
  }),
  output: z.object({ text: z.string().optional(), json: z.unknown().optional() }),
  run: async (ctx, input) => {
    const design = await designOf(ctx, input.doc);
    const query = new URLSearchParams({ view: 'components', door: 'cli' });
    if (input.budget) query.set('budget', String(input.budget));
    if (input.json) query.set('json', '1');
    const { body } = await ctx.api.text(
      `/designs/${encodeURIComponent(design.id)}?${query.toString()}`,
    );
    return input.json ? { json: JSON.parse(body) as unknown } : { text: body };
  },
  text: ({ text, json }) => [text ?? JSON.stringify(json)],
  json: (output) => output.json ?? { text: output.text },
  cli: {
    positionals: ['doc'],
    examples: ['livedesign component ls "Shop"', 'livedesign component ls 3f9c --json'],
    prints: 'the components view as the api serves it',
  },
});

// The write flags a make takes: a make stores its main before the tab changes, so it has no dry run, and it is
// always based on the tab it read.
const { dryRun: _dryRun, base: _base, ...makeFlags } = writeFlags;

export const componentMake = defineVerb({
  id: 'component.make',
  summary: 'Make a component of elements',
  description:
    'The elements named (refs) become a new main in the design’s library, and one instance of it takes their place on the tab, as one changeset. Refused for a locked element, an image, video, link card or tab window, or over 200 elements.',
  behaviour: 'write',
  input: z.object({
    doc: docArg,
    tab: tabFlag,
    refs: z.array(z.string()).min(1).describe('The elements, by ref'),
    name: z.string().optional().describe('The component’s name; Component <n> when omitted'),
    ...makeFlags,
  }),
  output: z.object({
    component: summaryOutput,
    instance: z.string(),
    text: z.string(),
    changeset: z.object({ id: z.string(), rev: z.number() }).nullable(),
  }),
  run: async (ctx, input) => {
    const { design, tab } = await tabOf(ctx, input.doc, input.tab);
    // Kept as a read copy, so the changeset's base carries every element's fingerprint.
    const read =
      (await recordCopy(ctx, design.id, tab.id)) ?? (await readPlainTab(ctx, design.id, tab.id));
    if (!read) throw new Error('the tab read carried no revision');
    const prepared = await prepareMakeComponent(
      ctx.api,
      design.id,
      { ...read.tab, rev: read.rev },
      { refs: input.refs, ...(input.name ? { name: input.name } : {}), now: ctx.now() },
    );
    if (!prepared.ok) throw refusal(prepared);
    const target = { designId: design.id, tabId: tab.id, tabName: tab.name, doc: input.doc };
    let response;
    try {
      response = await submitChangeset(
        ctx,
        target,
        { operations: prepared.plan.operations },
        { ...input, base: read.rev },
      );
    } catch (err) {
      ctx.notice(storedButNotPlaced(prepared.component));
      throw err;
    }
    return {
      component: componentSummary(prepared.component),
      instance: prepared.plan.instanceId,
      text: response.text,
      changeset: response.changeset && {
        id: response.changeset.id,
        rev: response.changeset.rev,
      },
    };
  },
  text: ({ component, text }) => [summaryLine(component), text],
  quiet: ({ component }) => [component.id],
  cli: {
    positionals: ['doc', '...refs'],
    examples: [
      'livedesign component make "Shop" logo menu cart --name "Nav bar"',
      'livedesign component make 3f9c --tab Home header',
    ],
    prints: 'the new main, then the changeset’s result lines and footer',
  },
});

// The main a word names in the library: its id, a unique id prefix, or its name (case-insensitive).
function mainNamed(library: readonly DesignComponent[], word: string): DesignComponent {
  const exact = library.find((c) => c.id === word);
  if (exact) return exact;
  const lower = word.toLowerCase();
  const matches = library.filter((c) => c.id.startsWith(word) || c.name.toLowerCase() === lower);
  if (matches.length === 1) return matches[0]!;
  throw new VerbRefusal({
    status: matches.length ? 400 : 404,
    code: matches.length ? 'target_ambiguous' : 'target_not_found',
    message: matches.length
      ? `"${word}" names ${matches.length} components`
      : `no component "${word}"`,
    lines: (matches.length ? matches : library).map((c) => `${c.id} ${JSON.stringify(c.name)}`),
    hint: LS_HINT,
  });
}

async function patchFrom(ctx: VerbContext, source: string): Promise<ComponentPatch> {
  try {
    const parsed: unknown = JSON.parse(await ctx.readInput(source));
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) return parsed;
  } catch {
    /* refused below */
  }
  throw new VerbRefusal({
    status: 400,
    code: 'invalid_value',
    message: '--patch is not a JSON object',
    hint: 'a patch is {"name"?, "archived"?, "upsert"?: [elements], "remove"?: [ids], "order"?: [ids]}',
  });
}

export const componentSet = defineVerb({
  id: 'component.set',
  summary: 'Change a component: name, archived, elements',
  description:
    'Changes one main, element by element, and every instance redraws: --name renames it, --archived takes it out of the palette (--restore puts it back), --patch takes a JSON patch (a file, or - for stdin) of upsert (elements by id), remove (ids) and order (ids).',
  behaviour: 'destructive',
  input: z.object({
    doc: docArg,
    component: z.string().describe('The component: its id, an id prefix or its name'),
    name: z.string().optional().describe('Rename it'),
    archived: z.boolean().optional().describe('Take it out of the palette'),
    restore: z.boolean().optional().describe('Put an archived component back'),
    patch: z.string().optional().describe('A JSON patch file, or - for stdin'),
  }),
  output: summaryOutput,
  run: async (ctx, input) => {
    const design = await designOf(ctx, input.doc);
    const main = mainNamed(await readLibrary(ctx.api, design.id), input.component);
    const patch: ComponentPatch = {
      ...(input.patch !== undefined ? await patchFrom(ctx, input.patch) : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.archived ? { archived: true } : {}),
      ...(input.restore ? { archived: false } : {}),
    };
    if (Object.keys(patch).length === 0)
      throw new VerbRefusal({
        status: 400,
        code: 'invalid_value',
        message: 'say what to change: --name, --archived, --restore or --patch <file>',
        hint: 'see the flags with: livedesign help component set',
      });
    const done = await patchComponent(ctx.api, design.id, main.id, patch);
    if (!done.ok) throw refusal(done, done.code === 'not_found' ? 404 : 400);
    return componentSummary(done.component);
  },
  text: (c) => [summaryLine(c)],
  quiet: (c) => [c.id],
  cli: {
    positionals: ['doc', 'component'],
    examples: [
      'livedesign component set "Shop" nav-bar --name "Top bar"',
      'livedesign component set 3f9c nav-bar --patch patch.json',
    ],
    prints: 'the main as stored: id, name, frame, element count',
  },
});

export const componentVerbs: readonly Verb[] = [componentLs, componentMake, componentSet] as Verb[];
