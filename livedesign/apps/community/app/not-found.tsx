import { PageNotFound } from '@livedesign/ui';

// An address under /community with no page (docs/specs/016-platform/router-app.md "Not found"); a missing post has
// its own friendly card on the post page (docs/specs/025-community/community.md).
export default function NotFound() {
  return <PageNotFound inMain homeHref="/community/" homeLabel="Back to Community" />;
}
