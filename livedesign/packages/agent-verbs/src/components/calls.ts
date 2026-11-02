// An agent's component library calls (docs/specs/009-elements/components.md "Sharing, collaboration and storage",
// docs/specs/015-api/mcp-server.md §4.9e): read the mains, store a new one, patch one. The CLI's `component` verbs and
// the MCP's change_components both go through these, so they answer and refuse in the same words; each door writes
// the tab change itself, through its own changeset path.
import { ApiError, type ApiClient } from '@liveworkspace/api-client';
import type { ComponentResponse, ComponentsResponse } from '@livedesign/api-schema';
import {
  MAX_COMPONENTS,
  MAX_COMPONENT_BYTES,
  isValidDesignComponent,
  type ComponentPatch,
  type DesignComponent,
  type Tab,
} from '@livedesign/design';
import { apiRefusalOf } from '../api-refusal';
import { planMakeComponent, type ComponentRefused, type MakePlan } from './plan';

export type ComponentStored = { ok: true; component: DesignComponent };

const libraryPath = (designId: string) => `/designs/${encodeURIComponent(designId)}/components`;
const mainPath = (designId: string, componentId: string) =>
  `${libraryPath(designId)}/${encodeURIComponent(componentId)}`;

const LS_HINT =
  'the components view lists the mains and their elements: livedesign component ls <doc>';

// The api's own words for the component routes' refusals, before the generic ones.
const BY_CODE: Readonly<Record<string, string>> = {
  too_many_components: `the design holds the most components it may (${MAX_COMPONENTS})`,
};

// The message a 400 carries (`invalid component`, `invalid patch`), or null.
function messageOf(err: ApiError): string | null {
  try {
    const body = JSON.parse(err.body) as { message?: unknown };
    return typeof body.message === 'string' ? body.message : null;
  } catch {
    return null;
  }
}

// `main`: the call names one main, so its 404 is that main missing (the design was read to get here).
function refusedBy(err: unknown, main = false): ComponentRefused {
  if (err instanceof ApiError && err.status < 500) {
    const code = err.code ?? `http_${err.status}`;
    const known = BY_CODE[code];
    if (known) return { ok: false, code, message: known };
    if (err.status === 413)
      return {
        ok: false,
        code,
        message: `a component's JSON holds at most ${MAX_COMPONENT_BYTES / 1024} KB`,
      };
    if (err.status === 404 && main)
      return { ok: false, code, message: 'no such component in this design', hint: LS_HINT };
    const message = err.status === 400 ? messageOf(err) : null;
    if (message) return { ok: false, code, message, hint: LS_HINT };
  }
  const refusal = apiRefusalOf(err);
  if (!refusal) throw err;
  return { ok: false, ...refusal };
}

/** The design's mains (a tab-scoped reader's: those its tab uses); a main that does not validate is left out. */
export async function readLibrary(api: ApiClient, designId: string): Promise<DesignComponent[]> {
  const { components } = await api.json<ComponentsResponse>(libraryPath(designId));
  return components.filter(isValidDesignComponent);
}

/** Stores a main (`PUT`); answers it as stored. */
export async function storeComponent(
  api: ApiClient,
  designId: string,
  main: DesignComponent,
): Promise<ComponentStored | ComponentRefused> {
  try {
    const { component } = await api.json<ComponentResponse>(mainPath(designId, main.id), {
      method: 'PUT',
      body: JSON.stringify(main),
    });
    return { ok: true, component };
  } catch (err) {
    return refusedBy(err);
  }
}

/** Changes a main element by element (`PATCH`); answers it as stored. Every instance redraws. */
export async function patchComponent(
  api: ApiClient,
  designId: string,
  componentId: string,
  patch: ComponentPatch,
): Promise<ComponentStored | ComponentRefused> {
  try {
    const { component } = await api.json<ComponentResponse>(mainPath(designId, componentId), {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    return { ok: true, component };
  } catch (err) {
    return refusedBy(err, true);
  }
}

/** Make Component up to the tab write: the library read, the plan made on the tab as read, and the main stored. The
 *  door then sends `plan.operations` as a changeset at `plan.base`. */
export async function prepareMakeComponent(
  api: ApiClient,
  designId: string,
  tab: Tab & { rev: number },
  input: { refs: readonly string[]; name?: string; now: number },
): Promise<{ ok: true; plan: MakePlan; component: DesignComponent } | ComponentRefused> {
  let library: DesignComponent[];
  try {
    library = await readLibrary(api, designId);
  } catch (err) {
    return refusedBy(err);
  }
  const plan = planMakeComponent(tab, input.refs, library, input);
  if (!plan.ok) return plan;
  const stored = await storeComponent(api, designId, plan.component);
  if (!stored.ok) return stored;
  return { ok: true, plan, component: stored.component };
}

/** What a refused tab write after a stored main says: the main is in the library, the tab did not change. */
export const storedButNotPlaced = (component: DesignComponent) =>
  `The component ${component.id} ("${component.name}") was stored, but the tab did not change; place it with an add of shape instance, componentId ${component.id}.`;

/** A main as an answer names it: its id, name, frame, flag and how many elements it holds. */
export function componentSummary(c: DesignComponent) {
  return {
    id: c.id,
    name: c.name,
    width: c.width,
    height: c.height,
    archived: c.archived === true,
    elements: c.elements.length,
  };
}
export type ComponentSummary = ReturnType<typeof componentSummary>;
