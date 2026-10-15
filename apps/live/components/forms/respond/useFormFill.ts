'use client';

// Filling in a form (docs/specs/030-forms/forms.md "Filling in a form"): the answers, one section at a time, each
// field checked when it loses focus and again on Next or Submit, answers kept in session storage while filling in.
// Shared by the form link's page and the builder's Preview, which differ only in what Submit does.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { checkAnswer, checkResponse, type AnswerError, type PublicForm } from '@livediagram/forms';

export type FillState = { answers: Record<string, unknown>; other: Record<string, string> };

export type SubmitOutcome =
  | { kind: 'sent' }
  | { kind: 'invalid'; errors: Record<string, AnswerError> }
  | { kind: 'closed' }
  | { kind: 'failed'; message: string };

const EMPTY: FillState = { answers: {}, other: {} };

function readDraft(key: string | null): FillState {
  if (!key) return EMPTY;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as FillState;
    return parsed && typeof parsed === 'object' && parsed.answers ? parsed : EMPTY;
  } catch {
    return EMPTY;
  }
}

function writeDraft(key: string | null, state: FillState | null) {
  if (!key) return;
  try {
    if (state) sessionStorage.setItem(key, JSON.stringify(state));
    else sessionStorage.removeItem(key);
  } catch {
    // Private windows and blocked storage: the answers just are not kept across a reload.
  }
}

export function useFormFill(
  form: PublicForm,
  submit: (state: FillState) => Promise<SubmitOutcome>,
  draftKey: string | null,
) {
  const [state, setStateRaw] = useState<FillState>(() => readDraft(draftKey));
  // The answers as last set, read by the handlers below (events arrive one at a time).
  const stateRef = useRef(state);
  const setState = useCallback((next: FillState) => {
    stateRef.current = next;
    setStateRaw(next);
  }, []);
  const [section, setSection] = useState(0);
  const [errors, setErrors] = useState<Record<string, AnswerError>>({});
  // The questions an error summary is showing for (set on Next or Submit; cleared as they are fixed).
  const [summary, setSummary] = useState<string[]>([]);
  const [status, setStatus] = useState<'filling' | 'sending' | 'sent' | 'closed'>('filling');
  const [failure, setFailure] = useState<string | null>(null);
  const last = form.sections.length - 1;
  const current = form.sections[Math.min(section, last)]!;
  const byId = useMemo(
    () => new Map(form.sections.flatMap((s) => s.questions.map((q) => [q.id, q] as const))),
    [form],
  );

  useEffect(() => {
    if (status === 'filling') writeDraft(draftKey, state);
  }, [draftKey, state, status]);

  const recheck = useCallback(
    (id: string, next: FillState) => {
      const q = byId.get(id);
      if (!q) return;
      setErrors((prev) => {
        if (!(id in prev)) return prev;
        const r = checkAnswer(q, next.answers[id], next.other[id]);
        const copy = { ...prev };
        if (r.error) copy[id] = r.error;
        else delete copy[id];
        return copy;
      });
    },
    [byId],
  );

  const setAnswer = useCallback(
    (id: string, value: unknown) => {
      const prev = stateRef.current;
      const next = { ...prev, answers: { ...prev.answers, [id]: value } };
      setState(next);
      recheck(id, next);
    },
    [recheck, setState],
  );
  const setOther = useCallback(
    (id: string, text: string) => {
      const prev = stateRef.current;
      const next = { ...prev, other: { ...prev.other, [id]: text } };
      setState(next);
      recheck(id, next);
    },
    [recheck, setState],
  );

  // A field left: checked now, so a mistake shows before Next.
  const blur = useCallback(
    (id: string) => {
      const q = byId.get(id);
      if (!q) return;
      const prev = stateRef.current;
      const r = checkAnswer(q, prev.answers[id], prev.other[id]);
      // An empty field left alone is not an error until Next: a respondent tabbing through is not wrong yet.
      const empty = r.error === 'required' || r.error === 'must_tick';
      setErrors((e) => {
        if (r.error && !empty) return { ...e, [id]: r.error };
        if (!r.error && id in e) {
          const copy = { ...e };
          delete copy[id];
          return copy;
        }
        return e;
      });
    },
    [byId],
  );

  const checkSection = (): boolean => {
    const r = checkResponse(form, stateRef.current, current.questions);
    if (r.ok) return true;
    setErrors((e) => ({ ...e, ...r.errors }));
    setSummary(current.questions.filter((q) => r.errors[q.id]).map((q) => q.id));
    return false;
  };

  const next = () => {
    if (!checkSection()) return false;
    setSummary([]);
    setSection((s) => Math.min(s + 1, last));
    return true;
  };
  const back = () => {
    setSummary([]);
    setSection((s) => Math.max(0, s - 1));
  };

  const send = async () => {
    if (!checkSection()) return;
    setStatus('sending');
    setFailure(null);
    const outcome = await submit(stateRef.current);
    if (outcome.kind === 'sent') {
      writeDraft(draftKey, null);
      setStatus('sent');
      return;
    }
    if (outcome.kind === 'closed') {
      setStatus('closed');
      return;
    }
    setStatus('filling');
    if (outcome.kind === 'invalid') {
      setErrors(outcome.errors);
      // Back to the first section holding an error.
      const at = form.sections.findIndex((s) => s.questions.some((q) => outcome.errors[q.id]));
      if (at >= 0) setSection(at);
      const ids = (at >= 0 ? form.sections[at]!.questions : [])
        .filter((q) => outcome.errors[q.id])
        .map((q) => q.id);
      setSummary(ids);
      if (ids.length === 0)
        setFailure('Some answers could not be accepted. Check them and try again.');
      return;
    }
    setFailure(outcome.message);
  };

  const again = () => {
    setState(EMPTY);
    setErrors({});
    setSummary([]);
    setSection(0);
    setFailure(null);
    setStatus('filling');
  };

  return {
    state,
    section: Math.min(section, last),
    current,
    last,
    errors,
    summary: summary.filter((id) => errors[id]),
    status,
    failure,
    setAnswer,
    setOther,
    blur,
    next,
    back,
    send,
    again,
  };
}
