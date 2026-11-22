// What an import may put on a tab: one copy for every product, @liveworkspace/element-model/savable, bound to this
// model's validator and tab cap.
import { savableElementsOf } from '@liveworkspace/element-model/savable';
import { isValidElement, MAX_ELEMENTS_PER_TAB } from './validate';
import type { Element } from './index';

export function savableElements(elements: readonly unknown[]): {
  elements: Element[];
  dropped: number;
} {
  return savableElementsOf(elements, isValidElement, MAX_ELEMENTS_PER_TAB);
}
