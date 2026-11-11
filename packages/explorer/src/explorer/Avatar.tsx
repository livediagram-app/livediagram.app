'use client';

import { PictureDisc } from '@liveworkspace/ui';
import { usePersonPicture } from '../data/usePeople';
import { initials } from '../library/person-name';
import { PersonalSpaceIcon } from '../ui/icons';
import { useExtras } from './extras';

/** A person's Google picture where they have one, over their initials on a quiet disc; the index keeps no names, so
 *  someone unnamed wears the person glyph. The picture comes with their name from the one people store. */
export function Avatar({
  person,
  size,
}: {
  person: { id: string; name: string } | undefined;
  size: number;
}) {
  const { people } = useExtras();
  const picture = usePersonPicture(people, person?.id);
  const letters = person ? initials(person.name) : null;
  return (
    <PictureDisc
      aria-hidden
      pictureUrl={picture}
      name={person?.name ?? ''}
      size={size}
      className="bg-brand-100 font-semibold text-brand-800 ring-2 ring-white dark:bg-brand-500/20 dark:text-brand-200 dark:ring-slate-800 [&_svg]:h-[60%] [&_svg]:w-[60%]"
      style={{ fontSize: Math.round(size * 0.4) }}
    >
      {letters ?? <PersonalSpaceIcon />}
    </PictureDisc>
  );
}
