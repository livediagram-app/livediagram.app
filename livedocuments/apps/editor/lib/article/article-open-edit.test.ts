// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { commitOpenEdit, registerOpenEdit } from '@liveworkspace/workbench/lib/open-edit';
import { commitWritingOnLeave } from './article-open-edit';

// docs/specs/007-editor/article-pages.md "Commits": a reload or a closed tab commits what the writing still holds.
afterEach(() => document.body.replaceChildren());

function writing() {
  const mount = document.createElement('div');
  const field = document.createElement('span');
  field.tabIndex = 0;
  mount.append(field);
  document.body.append(mount);
  return { mount, field };
}

describe('commitWritingOnLeave', () => {
  it('commits nothing until the focus has come into the writing', () => {
    const { mount } = writing();
    const commit = vi.fn();
    const stop = commitWritingOnLeave(mount, commit);
    commitOpenEdit();
    expect(commit).not.toHaveBeenCalled();
    stop();
  });

  it('is the open edit the unload flush commits once the focus comes in, and stays so after a blur', () => {
    const { mount, field } = writing();
    const commit = vi.fn();
    const stop = commitWritingOnLeave(mount, commit);
    field.focus();
    commitOpenEdit();
    expect(commit).toHaveBeenCalledTimes(1);
    field.blur();
    commitOpenEdit();
    expect(commit).toHaveBeenCalledTimes(2);
    stop();
  });

  it('gives way to another edit opened after it, and clears only its own on cleanup', () => {
    const { mount, field } = writing();
    const commit = vi.fn();
    const stop = commitWritingOnLeave(mount, commit);
    field.focus();
    const other = vi.fn();
    const unregisterOther = registerOpenEdit(other);
    stop();
    commitOpenEdit();
    expect(other).toHaveBeenCalledTimes(1);
    expect(commit).not.toHaveBeenCalled();
    unregisterOther();
  });

  it('stops listening on cleanup', () => {
    const { mount, field } = writing();
    const commit = vi.fn();
    commitWritingOnLeave(mount, commit)();
    field.focus();
    commitOpenEdit();
    expect(commit).not.toHaveBeenCalled();
  });
});
