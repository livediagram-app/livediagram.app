// Runtime validation of a main and of a patch to one (docs/specs/009-elements/blueprints/components.md "Interfaces and
// contracts"): what the api accepts on a component write, and what a paste or a share brings in.
import { isRecord } from '@liveworkspace/model-core/is-record';
import { isNonEmptyStr, isNum } from '@liveworkspace/model-core/validate-primitives';
import {
  COMPONENT_NAME_MAX,
  MAX_COMPONENT_BYTES,
  MAX_COMPONENT_ELEMENTS,
  mayGoInComponent,
  type DesignComponent,
} from './components';
import { isComponentId } from './component-fields';
import type { ComponentPatch } from './component-patch';
import type { Element } from './index';
import { isValidElement } from './validate';

const isName = (v: unknown) =>
  typeof v === 'string' && v.trim().length > 0 && v.length <= COMPONENT_NAME_MAX;

// Elements a main may hold: valid, allowed, ids unique, none an edit session's member.
function validMainElements(v: unknown): v is Element[] {
  if (!Array.isArray(v) || v.length > MAX_COMPONENT_ELEMENTS) return false;
  const ids = new Set<string>();
  for (const el of v) {
    if (!isValidElement(el) || !mayGoInComponent(el) || el.componentMember) return false;
    if (ids.has(el.id)) return false;
    ids.add(el.id);
  }
  return true;
}

/** Whether a value is a storable main. */
export function isValidDesignComponent(v: unknown): v is DesignComponent {
  if (!isRecord(v)) return false;
  if (!isComponentId(v.id) || !isName(v.name)) return false;
  if (!isNum(v.width) || v.width <= 0 || !isNum(v.height) || v.height <= 0) return false;
  if (!isNum(v.updatedAt)) return false;
  if (v.archived !== undefined && typeof v.archived !== 'boolean') return false;
  return validMainElements(v.elements);
}

/** Whether a main's JSON fits the byte cap. */
export function componentWithinBytes(main: DesignComponent): boolean {
  return new TextEncoder().encode(JSON.stringify(main)).length <= MAX_COMPONENT_BYTES;
}

const isIdList = (v: unknown) =>
  Array.isArray(v) && v.length <= MAX_COMPONENT_ELEMENTS && v.every(isNonEmptyStr);

/** Whether a value is a well-formed patch (its result is checked again with isValidDesignComponent). */
export function isValidComponentPatch(v: unknown): v is ComponentPatch {
  if (!isRecord(v)) return false;
  for (const k of Object.keys(v))
    if (!['name', 'archived', 'upsert', 'remove', 'order'].includes(k)) return false;
  if (v.name !== undefined && !isName(v.name)) return false;
  if (v.archived !== undefined && typeof v.archived !== 'boolean') return false;
  if (v.upsert !== undefined && !validMainElements(v.upsert)) return false;
  if (v.remove !== undefined && !isIdList(v.remove)) return false;
  if (v.order !== undefined && !isIdList(v.order)) return false;
  return true;
}
