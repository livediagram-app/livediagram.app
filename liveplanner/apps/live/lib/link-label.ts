import type { ElementLink } from '@liveplanner/project';

// Human-readable destination for a link, shown in the hover card on a
// link badge so a user can see WHERE a link goes before clicking it.
// `tabs` (id + name of this project's tabs) lets tab / element links
// name their target tab instead of a generic phrase; pass it wherever
// the tab list is on hand. The URL + project name cases stand alone.
export function describeLink(link: ElementLink, tabs?: { id: string; name: string }[]): string {
  switch (link.kind) {
    case 'url':
      return link.url;
    case 'project':
      return `Project: ${link.name}`;
    case 'tab':
    case 'element': {
      const name = tabs?.find((t) => t.id === link.tabId)?.name?.trim();
      const where = name ? `tab "${name}"` : 'a tab in this project';
      return link.kind === 'element' ? `An element on ${where}` : `Goes to ${where}`;
    }
  }
}
