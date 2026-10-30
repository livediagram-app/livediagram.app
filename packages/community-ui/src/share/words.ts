import type { CommunityApp } from '@liveworkspace/community';
import type { CommunityWords } from './host';

// Each app's words for the Share dialog's Community tab (liveworkspace/docs/specs/007-community/community.md "The
// Share dialog's Community tab"), one place for the app's editor and every Explorer to say them the same.
export const COMMUNITY_APP_WORDS: Record<CommunityApp, CommunityWords> = {
  'livediagram.app': {
    product: 'livediagram',
    noun: 'canvas',
    nouns: 'canvases',
    showcase: 'board',
    showcases: 'boards',
  },
  'liveplanner.app': {
    product: 'liveplanner',
    noun: 'plan',
    nouns: 'plans',
    showcase: 'plan',
    showcases: 'plans',
  },
  'livedocuments.app': {
    product: 'livedocuments',
    noun: 'document',
    nouns: 'documents',
    showcase: 'document',
    showcases: 'documents',
  },
  'livedesign.app': {
    product: 'livedesign',
    noun: 'design',
    nouns: 'designs',
    showcase: 'design',
    showcases: 'designs',
  },
};
