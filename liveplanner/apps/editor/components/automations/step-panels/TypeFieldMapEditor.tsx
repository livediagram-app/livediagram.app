'use client';

// Change Card Type's Map Fields (docs/specs/026-plan/item-types.md "Explicit mappings"): fields whose names differ,
// each a source field of any card type into a field of the new type or its Description. A row per mapping (From, To,
// Remove), then Add Mapping. To offers only the fields that can take From's kind (the type-change rules), each
// target once; a field the plan no longer has stays named, so the rule shows what it holds.

import {
  AUTOMATION_TYPE_MAPS_MAX,
  DESCRIPTION_AS_LONG_TEXT,
  DESCRIPTION_FIELD,
  canTakeValue,
  type CustomFieldDef,
  type ItemTypeDef,
  type TypeFieldMap,
} from '@liveplanner/items';
import { Button, CloseIcon, Tooltip } from '@liveplanner/ui';
import { PanelSelect } from './panel-parts';

// A source: a custom field of some type, with that type's name, for the From list's groups.
type Source = { type: ItemTypeDef; def: CustomFieldDef };

/** Every type's custom fields that can be a source, grouped by type, the new type's own left out. */
export function mapSources(types: readonly ItemTypeDef[], target: string): Source[] {
  const seen = new Set<string>();
  const out: Source[] = [];
  for (const type of types) {
    if (type.id === target) continue;
    for (const def of type.custom ?? []) {
      // One entry per id: two types sharing a field share its value.
      if (seen.has(def.id) || !type.fields.includes(def.id)) continue;
      seen.add(def.id);
      out.push({ type, def });
    }
  }
  return out;
}

/** The fields of `target` a value of `def` can go into: its custom fields, then the Description. */
export function mapTargets(target: ItemTypeDef | undefined, def: CustomFieldDef | undefined) {
  if (!target || !def) return [];
  return [
    ...(target.custom ?? []).filter((f) => target.fields.includes(f.id)),
    DESCRIPTION_AS_LONG_TEXT,
  ].filter((t) => canTakeValue(def, t));
}

// A first mapping to add: the first source with a target no row fills yet.
function nextMapping(
  sources: readonly Source[],
  target: ItemTypeDef | undefined,
  taken: ReadonlySet<string>,
): TypeFieldMap | null {
  for (const s of sources) {
    const to = mapTargets(target, s.def).find((t) => !taken.has(t.id));
    if (to) return { from: s.def.id, to: to.id };
  }
  return null;
}

export function TypeFieldMapEditor({
  map,
  target,
  types,
  onChange,
}: {
  map: readonly TypeFieldMap[];
  // The new type, by id.
  target: string;
  types: readonly ItemTypeDef[];
  onChange: (next: TypeFieldMap[]) => void;
}) {
  const type = types.find((t) => t.id === target);
  const sources = mapSources(types, target);
  const defOf = (id: string) => sources.find((s) => s.def.id === id)?.def;
  const taken = new Set(map.map((m) => m.to));
  const next = map.length < AUTOMATION_TYPE_MAPS_MAX ? nextMapping(sources, type, taken) : null;
  const set = (i: number, m: TypeFieldMap) => onChange(map.map((x, j) => (j === i ? m : x)));
  return (
    <fieldset className="flex flex-col gap-1.5" data-type-field-map="">
      <legend className="mb-1.5 text-[12px] font-semibold text-slate-700 dark:text-slate-200">
        Map Fields
      </legend>
      {map.length ? (
        <ol className="flex flex-col gap-2">
          {map.map((m, i) => {
            const def = defOf(m.from);
            const targets = mapTargets(type, def).filter((t) => t.id === m.to || !taken.has(t.id));
            const fromName = def?.label ?? 'a field no longer here';
            return (
              <li
                key={i}
                className="flex flex-col gap-1.5 rounded-lg border border-slate-200 p-2 dark:border-slate-700 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <PanelSelect
                    aria-label={`Mapping ${i + 1}: from`}
                    value={m.from}
                    onChange={(e) => {
                      const from = e.target.value;
                      const fits = mapTargets(type, defOf(from));
                      // Keep the target when it still takes the new source, else the first free one that does.
                      const to = fits.some((t) => t.id === m.to)
                        ? m.to
                        : (fits.find((t) => !taken.has(t.id))?.id ?? m.to);
                      set(i, { from, to });
                    }}
                  >
                    {def ? null : <option value={m.from}>A field no longer here</option>}
                    {groupedSources(sources).map(([typeLabel, list]) => (
                      <optgroup key={typeLabel} label={`From ${typeLabel}`}>
                        {list.map((s) => (
                          <option key={s.def.id} value={s.def.id}>
                            {s.def.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </PanelSelect>
                </div>
                <span
                  aria-hidden
                  className="shrink-0 self-center text-[12px] font-medium text-slate-500 dark:text-slate-400"
                >
                  into
                </span>
                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                  <div className="min-w-0 flex-1">
                    <PanelSelect
                      aria-label={`Mapping ${i + 1}: ${fromName} into`}
                      value={m.to}
                      onChange={(e) => set(i, { from: m.from, to: e.target.value })}
                    >
                      {targets.some((t) => t.id === m.to) ? null : (
                        <option value={m.to}>
                          {m.to === DESCRIPTION_FIELD
                            ? 'Description'
                            : 'A field that can’t take it'}
                        </option>
                      )}
                      {targets.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label}
                        </option>
                      ))}
                    </PanelSelect>
                  </div>
                  <Tooltip label="Remove Mapping">
                    <Button
                      variant="ghost"
                      size="xs"
                      className="size-8 shrink-0 px-0"
                      aria-label={`Remove Mapping ${i + 1}`}
                      onClick={() => onChange(map.filter((_, j) => j !== i))}
                    >
                      <CloseIcon size={14} aria-hidden />
                    </Button>
                  </Tooltip>
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}
      <Button
        variant="ghost"
        size="xs"
        className="self-start"
        disabled={!next}
        onClick={() => next && onChange([...map, next])}
      >
        + Add Mapping
      </Button>
      <p className="text-[12px] text-slate-500 dark:text-slate-400">
        Fields with the same name carry over on their own. Map one whose name differs, like an
        Idea’s Solution into the Description: it replaces what that field holds.
      </p>
    </fieldset>
  );
}

// The sources by the type they belong to, in catalogue order.
function groupedSources(sources: readonly Source[]): [string, Source[]][] {
  const groups = new Map<string, Source[]>();
  for (const s of sources) groups.set(s.type.label, [...(groups.get(s.type.label) ?? []), s]);
  return [...groups];
}
