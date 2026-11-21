import { IDENTITY_FILL, PictureDisc, identityVars } from '@liveknowledge/ui';
import { initialsOf } from '@/lib/identity';
import type { PageEditor } from '@/lib/page-edit/page-edit-store';

// The faces of the people editing a page (docs/specs/030-knowledgebase/blueprints/editing.md "Presentation and UX"):
// up to three overlapping discs in each person's colour, quieter than the presence stack (no status ring). The group
// carries their names; each disc is decorative.
export function EditorDiscs({
  editors,
  size = 18,
  label,
}: {
  editors: readonly PageEditor[];
  size?: number;
  label: string;
}) {
  if (editors.length === 0) return null;
  const shown = editors.slice(0, 3);
  return (
    <span role="img" aria-label={label} className="inline-flex shrink-0 items-center">
      {shown.map((p, i) => (
        <PictureDisc
          key={p.id}
          as="span"
          pictureUrl={p.picture ?? null}
          name=""
          size={size}
          aria-hidden
          style={{
            ...identityVars(p.color),
            fontSize: Math.round(size * 0.42),
            zIndex: shown.length - i,
          }}
          className={`font-semibold text-white ring-2 ring-white dark:ring-slate-900 ${IDENTITY_FILL} ${i > 0 ? '-ml-1' : ''}`}
        >
          {initialsOf(p.name)}
        </PictureDisc>
      ))}
    </span>
  );
}
