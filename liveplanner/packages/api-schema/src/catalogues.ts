// The public catalogues the api serves (docs/specs/015-api/blueprints/cli.md "Catalogue routes"): the template
// library and the element format. No identity needed, like capabilities.

// GET /api/templates: list_templates' shape.
export type TemplateCatalogueResponse = {
  categories: { id: string; label: string; description: string }[];
  templates: { kind: string; title: string; description: string; category: string }[];
};
