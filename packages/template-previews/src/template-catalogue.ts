// A product's template library as the agent front doors list it (the MCP's list_templates, the api's GET
// /api/templates, each product's docs/specs/015-api/blueprints/cli.md "Catalogue routes"): the categories and one
// entry a template. A template's category is its primary (docs/specs/008-canvas/canvas-and-palette.md "Template
// categories"); the blanks, in no category in the picker, are listed under `blanks` so an agent still finds them.
// Each product binds it to its catalogue with `createTemplateCatalogue`.

/** A category as the catalogue lists it. */
export type CatalogueCategory<Id extends string = string> = {
  id: Id;
  label: string;
  description: string;
};

export type TemplateCatalogue<Kind extends string = string, Category extends string = string> = {
  categories: CatalogueCategory<Category | 'blanks'>[];
  templates: {
    kind: Kind;
    title: string;
    description: string;
    category: Category | 'blanks';
  }[];
};

/** A product's `templateCatalogue`: its listed templates (the hidden onboarding ones already left out), its
 *  categories in order, each template's primary category (null for a blank) and how its Blanks category reads. */
export function createTemplateCatalogue<Kind extends string, Category extends string>(catalogue: {
  templates: readonly { kind: Kind; title: string; description: string }[];
  categories: readonly CatalogueCategory<Category>[];
  categoryOf: (kind: Kind) => Category | null;
  blanksDescription: string;
}): () => TemplateCatalogue<Kind, Category> {
  const blanks = {
    id: 'blanks',
    label: 'Blanks',
    description: catalogue.blanksDescription,
  } as const;
  return () => {
    const templates: TemplateCatalogue<Kind, Category>['templates'] = catalogue.templates.map((t) => ({
      kind: t.kind,
      title: t.title,
      description: t.description,
      category: catalogue.categoryOf(t.kind) ?? 'blanks',
    }));
    // Only the categories something is listed in, so an agent is never offered an empty category.
    const used = new Set<string>(templates.map((t) => t.category));
    return {
      categories: [...catalogue.categories, blanks].filter((c) => used.has(c.id)),
      templates,
    };
  };
}
