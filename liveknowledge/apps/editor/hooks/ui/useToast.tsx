'use client';

// The toast surface lives in the workbench (packages/workbench/src/hooks/ui/useToast.tsx); this path
// keeps the editor's many importers as they are.
export {
  ToastProvider,
  useToast,
  type ToastAction,
  type ToastActionSpec,
  type ToastOffer,
  type ToastTone,
} from '@liveworkspace/workbench/hooks/ui/useToast';
