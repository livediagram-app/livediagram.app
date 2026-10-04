// The one door the api and the CLI render a tab view through (docs/specs/024-agents/blueprints/
// document-views.md "Every view"): it builds the model once, resolves `ref` and `only`, and dispatches.
import {
  TARGET_AMBIGUOUS_ERROR,
  TARGET_NOT_FOUND_ERROR,
  type RefCandidate,
  type RefErrorBody,
  type TabViewName,
  type ViewDoor,
} from '@livediagram/api-schema';
import { resolveRef, type Element, type Tab } from '@livediagram/document';
import { commentsView } from './comments';
import { textField } from './fields';
import { findView } from './find';
import { graphView } from './graph';
import { layoutView } from './layout';
import { buildViewModel, type ViewContext, type ViewModel } from './model';
import { outlineView } from './outline';
import { showView } from './show';

export type ViewRequest = {
  view: TabViewName;
  budget?: number;
  door?: ViewDoor;
  // Ref inputs: a ref, any unique prefix, or a full id.
  only?: string;
  ref?: string;
  coarse?: boolean;
  style?: boolean;
  all?: boolean;
  q?: string;
};

export type ViewRefusal = RefErrorBody | { error: 'invalid_value'; message: string };

export type RenderedView =
  | { ok: true; view: TabViewName; text: string; json: unknown; elements: number }
  | { ok: false; refusal: ViewRefusal };

function candidate(model: ViewModel, el: Element): RefCandidate {
  return { ref: model.refs.refOf(el.id), kind: model.kindOf(el), label: textField(el, 'label') };
}

// The printed element `input` names, or why not.
function resolveElement(
  model: ViewModel,
  input: string,
): { el: Element } | { refusal: ViewRefusal } {
  const byId = new Map(model.tab.elements.map((el) => [el.id, el]));
  const resolution = resolveRef(input, model.refs);
  if (resolution.kind === 'ambiguous') {
    const candidates = resolution.candidates.map((id) => candidate(model, byId.get(id)!));
    const since = resolution.stale ? '; one was added since your read?' : '';
    return {
      refusal: {
        error: TARGET_AMBIGUOUS_ERROR,
        message: `"${input}" matches ${candidates.length} elements now${since}`,
        input,
        candidates,
        stale: resolution.stale,
      },
    };
  }
  if (resolution.kind === 'not-found') {
    const byRef = new Map(model.tab.elements.map((el) => [model.refs.refOf(el.id), el]));
    const candidates = resolution.nearest.map((ref) => candidate(model, byRef.get(ref)!));
    return {
      refusal: {
        error: TARGET_NOT_FOUND_ERROR,
        message: `no element "${input}"; deleted since your read? tab diff shows what changed`,
        input,
        candidates,
        stale: false,
      },
    };
  }
  const el = byId.get(resolution.id)!;
  if (!model.tree.nodes.has(el.id) && !model.edges.byArrow.has(el.id)) {
    return {
      refusal: {
        error: TARGET_NOT_FOUND_ERROR,
        message: `"${input}" is on a hidden layer`,
        input,
        candidates: [],
        stale: false,
      },
    };
  }
  return { el };
}

export function renderView(
  request: ViewRequest,
  tab: Tab,
  context: ViewContext = {},
): RenderedView {
  const model = buildViewModel(tab, context);
  const { budget, door } = request;
  const done = (result: { text: string; json: unknown }): RenderedView => ({
    ok: true,
    view: request.view,
    ...result,
    elements: model.printed.length,
  });

  let only: string | undefined;
  if (request.only !== undefined) {
    const resolved = resolveElement(model, request.only);
    if ('refusal' in resolved) return { ok: false, refusal: resolved.refusal };
    if (resolved.el.type === 'arrow') {
      return {
        ok: false,
        refusal: { error: 'invalid_value', message: 'only takes an element, not an arrow' },
      };
    }
    only = resolved.el.id;
  }

  switch (request.view) {
    case 'outline':
      return done(outlineView(model, { budget, door, only, style: request.style }));
    case 'graph':
      return done(graphView(model, { budget, door }));
    case 'layout':
      return done(layoutView(model, { budget, door, only, coarse: request.coarse }));
    case 'comments':
      return done(commentsView(model, { budget, door, all: request.all }));
    case 'show': {
      const resolved = resolveElement(model, request.ref ?? '');
      if ('refusal' in resolved) return { ok: false, refusal: resolved.refusal };
      return done(showView(model, resolved.el, { budget, door }));
    }
    case 'find':
      if (!request.q)
        return {
          ok: false,
          refusal: { error: 'invalid_value', message: 'find needs q, the text to look for' },
        };
      return done(findView(model, request.q, { budget, door }));
  }
}
