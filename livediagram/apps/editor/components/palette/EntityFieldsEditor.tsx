import {
  ENTITY_MAX_FIELDS,
  ENTITY_MAX_TEXT,
  entityFieldView,
  removedFieldRemap,
  type EntityField,
  type FieldRemap,
} from '@livediagram/document';
import { useFollowingDraft } from '@liveworkspace/workbench/hooks/ui/useFollowingDraft';
import { useRowMotion } from '@liveworkspace/workbench/hooks/ui/useRowMotion';
import { EntityKeyPicker } from './EntityKeyPicker';
import { CloseIcon } from '@livediagram/ui';

// The Fields dialog's rows (docs/specs/009-elements/entity.md "The Fields dialog"): per field a key dropdown
// (EntityKeyPicker), the name, the type and a remove button, then Add Field. Typing changes a draft, leaving an
// input saves it, a key, a remove and an add save at once. Sized for a dialog: 36px controls, 14px text (16px
// on a phone, the app's anti-zoom rule), so a finger lands on each.
const CELL =
  'h-9 min-w-0 rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';
const SQUARE =
  'flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500';
export function EntityFieldsEditor({
  fields,
  onChange,
}: {
  fields: EntityField[];
  onChange: (fields: EntityField[], remap?: FieldRemap) => void;
}) {
  // Fields written before keys existed read with their key (entityFieldView), and save that way.
  const [rows, setRows] = useFollowingDraft(fields, (f) => f.map(entityFieldView));
  // Rows slide in and out (docs/specs/004-interface-design/motion.md "Rows that come and go").
  const motion = useRowMotion();
  return (
    <div>
      {rows.length === 0 ? (
        <p className="pb-3 text-sm text-slate-500 dark:text-slate-400">
          No fields yet. Add the first one below.
        </p>
      ) : null}
      <div className="flex flex-col">
        {rows.map((f, i) => (
          // Its own bottom padding, not a gap on the list, so a row sliding out takes its spacing with it.
          <div key={i} {...motion.rowProps(i)}>
            <div className="flex items-center gap-2 pb-2">
              <EntityKeyPicker
                index={i}
                value={f.key}
                onPick={(key) =>
                  onChange(
                    rows.map((s, j) => {
                      if (j !== i) return s;
                      const { key: _old, ...rest } = s;
                      return key ? { ...rest, key } : rest;
                    }),
                  )
                }
              />
              <input
                className={`${CELL} flex-1`}
                value={f.name}
                placeholder="Name"
                aria-label={`Field ${i + 1} name`}
                maxLength={ENTITY_MAX_TEXT}
                onChange={(e) =>
                  setRows((r) => r.map((s, j) => (j === i ? { ...s, name: e.target.value } : s)))
                }
                onBlur={() => onChange(rows)}
              />
              <input
                className={`${CELL} w-28 font-mono sm:w-36`}
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
                aria-label={`Remove field ${i + 1}`}
                // A relationship pinned to this field lets go; ones on later fields follow them up.
                onClick={() =>
                  motion.leave(i, () =>
                    onChange(
                      rows.filter((_, j) => j !== i),
                      removedFieldRemap(i),
                    ),
                  )
                }
                className={`${SQUARE} text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200`}
              >
                <CloseIcon size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled={rows.length >= ENTITY_MAX_FIELDS}
        onClick={() => {
          motion.enter(rows.length);
          onChange([...rows, { name: '' }]);
        }}
        className="mt-1 inline-flex h-9 w-full items-center justify-center rounded-md border border-dashed border-slate-300 text-sm font-medium text-slate-600 transition enabled:cursor-pointer enabled:hover:border-brand-400 enabled:hover:bg-brand-50/50 enabled:hover:text-brand-700 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:enabled:hover:border-brand-500 dark:enabled:hover:bg-brand-500/10 dark:enabled:hover:text-brand-200"
      >
        Add Field
      </button>
    </div>
  );
}
