import { fileURLToPath } from 'node:url';
import { describeArticleLinks } from '@/lib/testing/article-links';

// The links inside the pages livedocuments's help shows: every /help/... link lands on a real page, and every link into
// the product lands on a route of its editor app (lib/testing/article-links.ts).
describeArticleLinks({
  editorAppDir: fileURLToPath(new URL('../../../../../../livedocuments/apps/editor/app', import.meta.url)),
  helpLinkFloor: 150,
});
