import type { CommunityOwnPost } from '@livediagram/api-schema';

// Which face the Share dialog's Community section shows (docs/specs/025-community/community.md
// "Publishing"; final copy in the blueprint §9). Pure, so the precedence is tested rather than read
// out of JSX:
//
//   1. guest:       not signed in. Publishing needs an account; nothing is fetched.
//   2. team:        a team library document is not one person's to give away.
//   3. loading:     the owner's post is being read.
//   4. error:       it couldn't be read; the section says so rather than offering to publish over a post
//                   that may exist.
//   5. hidden:      published, but taken out of the Community by reports, for good.
//   6. published:   published and listed.
//   7. unpublished: the invitation to share.
export type CommunitySectionState =
  'guest' | 'team' | 'loading' | 'error' | 'hidden' | 'published' | 'unpublished';

export function communitySectionState(input: {
  signedIn: boolean;
  teamDocument: boolean;
  loading: boolean;
  error: string | null;
  post: Pick<CommunityOwnPost, 'state'> | null;
}): CommunitySectionState {
  if (!input.signedIn) return 'guest';
  if (input.teamDocument) return 'team';
  if (input.loading) return 'loading';
  if (input.error) return 'error';
  if (input.post) return input.post.state === 'hidden' ? 'hidden' : 'published';
  return 'unpublished';
}
