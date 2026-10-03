// People on Home (docs/specs/013-workspace/explorer-home.md "What happened"): an initials disc in
// the person's colour, with their picture over it once it loads, and no presence ring (Home says
// what people did, not whether they are here). Decorative: every entry names its people in words.

import type { HomePerson } from '@livediagram/api-schema';
import { initialsOf } from '@/lib/identity';
import { IDENTITY_FILL, identityVars } from '@/lib/identity-fill';
import { PictureDisc } from '@/components/primitives/PictureDisc';
import { personName } from '@/app/explorer/home/home-copy';
import { PAGE_RING } from './home-styles';

/** A colour for someone the api knows no colour for. */
const FALLBACK_COLOUR = '#64748b';

/** A summary overlaps at most this many avatars, then a `+N` disc. */
export const AVATAR_STACK_MAX = 3;

export function HomeAvatar({ person, size }: { person: HomePerson | undefined; size: number }) {
  return (
    <PictureDisc
      as="span"
      aria-hidden
      pictureUrl={person?.pictureUrl ?? null}
      size={size}
      style={{
        ...identityVars(person?.color ?? FALLBACK_COLOUR),
        fontSize: Math.round(size * 0.4),
      }}
      className={`font-semibold text-white ${IDENTITY_FILL}`}
    >
      {initialsOf(personName(person))}
    </PictureDisc>
  );
}

const STACK_RING = `rounded-full ${PAGE_RING}`;

export function AvatarStack({ people, size }: { people: HomePerson[]; size: number }) {
  const shown = people.slice(0, AVATAR_STACK_MAX);
  const rest = people.length - shown.length;
  return (
    <span aria-hidden className="flex shrink-0 items-center">
      {shown.map((p, i) => (
        <span key={p.id} className={`${STACK_RING} ${i > 0 ? '-ml-2' : ''}`}>
          <HomeAvatar person={p} size={size} />
        </span>
      ))}
      {rest > 0 ? (
        <span
          style={{ width: size, height: size }}
          className={`${STACK_RING} -ml-2 flex items-center justify-center bg-slate-200 text-[10px] font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200`}
        >
          +{rest}
        </span>
      ) : null}
    </span>
  );
}
