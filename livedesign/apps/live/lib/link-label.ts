import { describeScreenLink, type ElementLink, type Page } from '@livedesign/design';

// Human-readable destination for a link, shown in the hover card on a
// link badge so a user can see WHERE a link goes before clicking it.
// `tabs` (id + name of this design's tabs) lets tab / element links
// name their target tab instead of a generic phrase; pass it wherever
// the tab list is on hand. The URL + design name cases stand alone.
// `pages` (the tab's pages) lets a screen link name its screen, or read as broken when its page
// is gone (docs/specs/007-editor/wireframe-pages.md "A link to a deleted page").
export function describeLink(
  link: ElementLink,
  tabs?: { id: string; name: string }[],
  pages?: readonly Page[],
): string {
  switch (link.kind) {
    case 'page':
    case 'back':
      return pages ? describeScreenLink(link, pages) : 'Goes to a screen on this tab';
    case 'url':
      return link.url;
    case 'design':
      return `Design: ${link.name}`;
    case 'tab':
    case 'element': {
      const name = tabs?.find((t) => t.id === link.tabId)?.name?.trim();
      const where = name ? `tab "${name}"` : 'a tab in this design';
      return link.kind === 'element' ? `An element on ${where}` : `Goes to ${where}`;
    }
  }
}
