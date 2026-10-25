// The public catalogues the api serves (docs/specs/015-api/blueprints/cli.md "Catalogue routes"): the template
// library, icon search and the element format. No identity needed, like capabilities.

// GET /api/templates: list_templates' shape.
export type TemplateCatalogueResponse = {
  categories: { id: string; label: string; description: string }[];
  templates: { kind: string; title: string; description: string; category: string }[];
};

// GET /api/icons?query=&limit=: the best icons for the query, and how many more matched.
export type IconSearchResponse = {
  icons: { id: string; label: string; set: 'line' | 'technology' }[];
  more: number;
};
