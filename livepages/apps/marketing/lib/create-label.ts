import { indefiniteArticle } from '@livepages/ui';

// The words a template link's name starts with, "Create a" or "Create an" (WCAG 2.5.3: the visible title is part of
// the name), so "Create an Org Chart" never reads "Create a Org Chart".
export const createLabelPrefix = (title: string): string => `Create ${indefiniteArticle(title)} `;
