import {
  ENTITY_KEY_LABELS,
  ENTITY_MAX_FIELDS,
  ENTITY_MAX_TEXT,
  entityFieldView,
  nextEntityKey,
  removedFieldRemap,
  type EntityField,
  type FieldRemap,
} from '@liveplanner/document';
import { useFollowingDraft } from '@/hooks/ui/useFollowingDraft';
import { EntityKeyGlyph } from '@/components/canvas/entity/EntityKeyGlyph';
import { MENU_ADD_ROW_BUTTON, MENU_CELL_INPUT } from './menu-editor-classes';

// The Fields section (docs/specs/009-elements/entity.md "The Fields menu"): per field a key button that
// cycles the key, the name, the type and a remove button, then Add Field. Mirrors the checklist's row
// editor: typing changes a draft, leaving an input saves it, a key, a remove and an add save at once.
export function EntityFieldsEditor({
  fields,
  onChange,
}: {
  fields: EntityField[];
  onChange: (fields: EntityField[], remap?: FieldRemap) => void;
}) {
  // Fields written before keys existed read with their key (entityFieldView), and save that way.
  const [rows, setRows] = useFollowingDraft(fields, (f) => f.map(entityFieldView));
  return (
    <div className="px-2 py-1.5">
      <div className="flex flex-col gap-1">
        {rows.map((f, i) => (
          <div key={i} className="flex items-center gap-1">
            <button
              type="button"
              aria-label={`Field ${i + 1} key: ${f.key ? ENTITY_KEY_LABELS[f.key] : 'None'}. Change key`}
              onClick={() => {
                const key = nextEntityKey(f.key);
                onChange(
                  rows.map((s, j) => {
                    if (j !== i) return s;
                    const { key: _old, ...rest } = s;
                    return key ? { ...rest, key } : rest;
                  }),
                );
              }}
              className={`flex h-5 w-7 shrink-0 cursor-pointer items-center justify-center rounded border text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800 ${
                f.key
                  ? 'border-slate-200 dark:border-slate-700'
                  : 'border-dashed border-slate-200 dark:border-slate-700'
              }`}
            >
              {f.key ? (
                <EntityKeyGlyph fieldKey={f.key} color="currentColor" />
              ) : (
                <span className="text-[9px] font-medium opacity-60">key</span>
              )}
            </button>
            <input
              className={`${MENU_CELL_INPUT} flex-1`}
              value={f.name}
              placeholder="name"
              aria-label={`Field ${i + 1} name`}
              maxLength={ENTITY_MAX_TEXT}
              onChange={(e) =>
                setRows((r) => r.map((s, j) => (j === i ? { ...s, name: e.target.value } : s)))
              }
              onBlur={() => onChange(rows)}
            />
            <input
              className={`${MENU_CELL_INPUT} w-[5.5rem] font-mono`}
              value={f.type ?? ''}
              placeholder="type"
              aria-label={`Field ${i + 1} type`}
              maxLength={ENTITY_MAX_TEXT}
              onChange={(e) =>
                setRows((r) =>
                  // Empty stores as undefined, so a row without a type
                  // round-trips identically to one that never had one.
                  r.map((s, j) => (j === i ? { ...s, type: e.target.value || undefined } : s)),
                )
              }
              onBlur={() => onChange(rows)}
            />
            <button
              type="button"
              aria-label="Remove field"
              // A relationship pinned to this field lets go; ones on later fields follow them up.
              onClick={() =>
                onChange(
                  rows.filter((_, j) => j !== i),
                  removedFieldRemap(i),
                )
              }
              className="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled={rows.length >= ENTITY_MAX_FIELDS}
        onClick={() => onChange([...rows, { name: '' }])}
        className={MENU_ADD_ROW_BUTTON}
      >
        Add Field
      </button>
    </div>
  );
}
