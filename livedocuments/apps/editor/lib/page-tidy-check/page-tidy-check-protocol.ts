// The messages between the page and the Tidy check's worker (docs/specs/007-editor/pages-mode.md "Tidy"; lib/page-tidy-check/
// page-tidy-checker.ts): a page's elements and its Tidy input in, whether a Tidy would change it out.
import type { Element } from '@livedocuments/document';
import type { PageTidyInput } from '../page-tidy';

export type PageTidyCheckRequest = { id: number; elements: Element[]; input: PageTidyInput };
export type PageTidyCheckResponse = { id: number; can: boolean };
