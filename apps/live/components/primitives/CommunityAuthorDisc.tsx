import type { CommunityAuthor } from '@livediagram/api-schema';
import { initialsOf } from '@/lib/identity';
import { IDENTITY_FILL, identityVars } from '@/lib/identity-fill';
import { PictureDisc } from './PictureDisc';

// A Community post's author as a disc (docs/specs/025-community/community.md "Author"): their picture
// when they publish one, else their initial in their colour. Decorative: every surface names the author
// beside it.
export function CommunityAuthorDisc({
  author,
  size = 20,
}: {
  author: CommunityAuthor;
  size?: number;
}) {
  return (
    <PictureDisc
      as="span"
      pictureUrl={author.picture}
      size={size}
      aria-hidden="true"
      style={{ ...identityVars(author.color), fontSize: Math.round(size * 0.45) }}
      className={`font-semibold text-white ${IDENTITY_FILL}`}
    >
      {initialsOf(author.name)}
    </PictureDisc>
  );
}
