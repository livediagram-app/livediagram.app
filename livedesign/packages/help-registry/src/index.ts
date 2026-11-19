// livedesign's help catalogue, as the one help centre holds it (liveworkspace/docs/specs/016-help/help-centre.md): the
// categories and articles live in @liveworkspace/help-registry (src/catalogue/livedesign.ts and src/catalogue/shared/),
// and this package binds this app's slice of them under the names the help editor, CLI and MCP have always imported.

export {
  articleHref,
  categoryHref,
  topCategorySlug,
  type Article,
  type Category,
} from '@liveworkspace/help-registry';

export {
  articles,
  categories,
  featureCategories,
  getArticlesByCategory,
  getCategoryGroups,
  getSubArticles,
  searchArticles,
} from '@liveworkspace/help-registry/slice/livedesign';
