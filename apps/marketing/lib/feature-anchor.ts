// A feature's anchor on its category page (docs/specs/019-marketing/marketing-site.md): the landing page's
// badge for a feature links to the matching card on /features/<id>, so a
// visitor jumps straight to the one they care about. The id is the card's
// title kebab-cased; titles are unique within a section (the grid keys on
// them), and the test pins that the anchors stay unique too.

export function featureAnchor(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function featureHref(sectionId: string, title: string): string {
  return `/features/${sectionId}#${featureAnchor(title)}`;
}
