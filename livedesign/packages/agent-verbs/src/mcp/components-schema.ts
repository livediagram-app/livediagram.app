// The components tool's input and output shapes (docs/specs/015-api/mcp-server.md §4.9e): change_components makes
// one change a call to the design's component library: make a main of elements, patch one, or detach an instance.
import { z } from 'zod';
import { COMPONENT_NAME_MAX, MAX_COMPONENT_ELEMENTS } from '@livedesign/design';

const tabId = z.string().optional().describe('The tab. Absent: the first tab.');
const ids = z.array(z.string().min(1));

export const changeComponentsShape = {
  designId: z.string().describe('The design (from find_designs).'),
  make: z
    .object({
      tabId,
      elementIds: ids
        .min(1)
        .max(MAX_COMPONENT_ELEMENTS)
        .describe(
          'The elements to make a component of: their ids, or the refs read_design prints.',
        ),
      name: z
        .string()
        .optional()
        .describe(
          `The component’s name, at most ${COMPONENT_NAME_MAX} characters; "Component <n>" when absent.`,
        ),
    })
    .optional()
    .describe(
      'The elements become a new main in the design’s library, and one instance of it takes their place on the ' +
        'tab. Refused for a locked element, an image, video, link card or tab window, or over ' +
        `${MAX_COMPONENT_ELEMENTS} elements.`,
    ),
  patch: z
    .object({
      componentId: z.string().describe('The main (an id read_design view "components" prints).'),
      name: z.string().optional().describe('Its new name.'),
      archived: z
        .boolean()
        .optional()
        .describe('true takes it out of the palette (its instances stay); false puts it back.'),
      upsert: z
        .array(z.record(z.string(), z.unknown()))
        .optional()
        .describe(
          'Elements of the main, whole, by id: one with a new id is added, one with an id it holds replaced.',
        ),
      remove: ids.optional().describe('Ids of the main’s elements to remove.'),
      order: ids.optional().describe('The main’s element ids, back to front.'),
    })
    .optional()
    .describe('Changes one main, element by element; every instance of it redraws.'),
  detach: z
    .object({
      tabId,
      instance: z.string().min(1).describe('The instance, by its id or ref.'),
    })
    .optional()
    .describe(
      'The instance becomes plain elements, as its main draws there with its overrides; they no longer follow the main.',
    ),
};

const summaryOut = z
  .object({
    id: z.string().describe('The main’s id: what an instance’s componentId takes.'),
    name: z.string().describe('Its name.'),
    width: z.number().describe('Its frame’s width.'),
    height: z.number().describe('Its frame’s height.'),
    archived: z.boolean().describe('Whether it is out of the palette.'),
    elements: z.number().describe('How many elements it holds.'),
  })
  .describe('The main as stored.');

export const changeComponentsOutput = {
  designId: z.string().describe('The design id.'),
  component: summaryOut.nullable().describe('The main made or changed; null for a detach.'),
  lines: z.array(z.string()).describe('What changed on the tab, one line each (none for a patch).'),
  rev: z.number().nullable().describe('The tab revision written; null for a patch.'),
  url: z.string().describe('Link that opens the design in the livedesign editor.'),
};
