'use client';

import { useRef, useState } from 'react';
import {
  COMMUNITY_INPUT_FIELDS,
  COMMUNITY_TITLE_MAX,
  type CommunityCategory,
  type CommunityInputField,
  type CommunityOwnPost,
} from '@livediagram/api-schema';
import { prefersReducedMotion } from '@/lib/motion-preference';
import {
  publishFieldErrors,
  publishServerFieldError,
  type PublishFieldErrors,
} from './publish-field-errors';

// The publish dialog's form state (docs/specs/025-community/community.md "Publishing"): the four
// fields, and their validation. Nothing is marked until the first submit; from then each field's message
// follows what is typed, so it clears the moment the field is fixed. A failed submit scrolls to the
// first field with a problem and puts focus in it, wherever the dialog was scrolled to.
export function usePublishForm(post: CommunityOwnPost | null, documentName: string) {
  const [title, setTitle] = useState(() =>
    (post?.title ?? documentName).slice(0, COMMUNITY_TITLE_MAX),
  );
  const [description, setDescription] = useState(post?.description ?? '');
  const [category, setCategory] = useState<CommunityCategory | null>(post?.category ?? null);
  const [tags, setTags] = useState<string[]>(post?.tags ?? []);
  const [attempted, setAttempted] = useState(false);
  // A worker refusal about one field, shown on that field until it changes.
  const [serverError, setServerError] = useState<{
    field: CommunityInputField;
    message: string;
  } | null>(null);
  const fieldRefs = useRef<Partial<Record<CommunityInputField, HTMLElement | null>>>({});

  const draft = { title, description, category, tags };
  const errors: PublishFieldErrors = attempted ? publishFieldErrors(draft) : {};
  if (serverError && !errors[serverError.field]) errors[serverError.field] = serverError.message;

  const clearServer = (field: CommunityInputField) => {
    if (serverError?.field === field) setServerError(null);
  };

  const focusField = (field: CommunityInputField) => {
    const wrapper = fieldRefs.current[field];
    if (!wrapper) return;
    wrapper.scrollIntoView({
      block: 'center',
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
    const target =
      wrapper.querySelector<HTMLElement>('[aria-checked="true"]') ??
      wrapper.querySelector<HTMLElement>('input, textarea, [role="radio"], button');
    target?.focus({ preventScroll: true });
  };

  // True when the draft can be sent; otherwise marks every field and takes the person to the first.
  const check = (): boolean => {
    setAttempted(true);
    const found = publishFieldErrors(draft);
    const first = COMMUNITY_INPUT_FIELDS.find((f) => found[f]);
    if (first) {
      focusField(first);
      return false;
    }
    return true;
  };

  // A worker refusal: a field one goes on its field (and is focused); returns false for anything else.
  const showServerError = (code: string | null | undefined): boolean => {
    const fieldError = publishServerFieldError(code, draft);
    if (!fieldError) return false;
    setServerError(fieldError);
    focusField(fieldError.field);
    return true;
  };

  const register = (field: CommunityInputField) => (el: HTMLElement | null) => {
    fieldRefs.current[field] = el;
  };

  return {
    draft,
    errors,
    register,
    check,
    showServerError,
    setTitle: (v: string) => {
      setTitle(v);
      clearServer('title');
    },
    setDescription: (v: string) => {
      setDescription(v);
      clearServer('description');
    },
    setCategory: (v: CommunityCategory) => {
      setCategory(v);
      clearServer('category');
    },
    setTags: (v: string[]) => {
      setTags(v);
      clearServer('tags');
    },
  };
}
