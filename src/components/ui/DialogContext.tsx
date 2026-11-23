import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { Modal } from './Modal';

export type ToastTone = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ConfirmOptions {
  title?: string;
  okLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
}

interface PromptOptions {
  title?: string;
  message?: string;
  defaultValue?: string;
  placeholder?: string;
  minLength?: number;
  okLabel?: string;
}

interface DialogContextValue {
  toast: (message: string, tone?: ToastTone) => void;
  confirm: (message: string, options?: ConfirmOptions) => Promise<boolean>;
  prompt: (options: PromptOptions) => Promise<string | null>;
}

const DialogContext = createContext<DialogContextValue | null>(null);

export const DialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastIdRef = useRef(1);

  const [confirmState, setConfirmState] = useState<{
    message: string;
    options: ConfirmOptions;
    resolve: (ok: boolean) => void;
  } | null>(null);

  const [promptState, setPromptState] = useState<{
    options: PromptOptions;
    value: string;
    error: string;
    resolve: (val: string | null) => void;
  } | null>(null);

  const toast = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = toastIdRef.current++;
    setToasts((prev) => [...prev.slice(-3), { id, message, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3600);
  }, []);

  const confirm = useCallback((message: string, options: ConfirmOptions = {}) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({ message, options, resolve });
    });
  }, []);

  const prompt = useCallback((options: PromptOptions) => {
    return new Promise<string | null>((resolve) => {
      setPromptState({
        options,
        value: options.defaultValue || '',
        error: '',
        resolve,
      });
    });
  }, []);

  const closeConfirm = (result: boolean) => {
    confirmState?.resolve(result);
    setConfirmState(null);
  };

  const submitPrompt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptState) return;
    const min = promptState.options.minLength || 0;
    const trimmed = promptState.value.trim();
    if (min > 0 && trimmed.length < min) {
      setPromptState({ ...promptState, error: `Please enter at least ${min} characters.` });
      return;
    }
    promptState.resolve(trimmed);
    setPromptState(null);
  };

  const cancelPrompt = () => {
    promptState?.resolve(null);
    setPromptState(null);
  };

  return (
    <DialogContext.Provider value={{ toast, confirm, prompt }}>
      {children}

      {/* Toast stack */}
      <div
        className="pointer-events-none fixed right-4 bottom-4 z-[70] flex w-full max-w-sm flex-col gap-2"
        aria-live="polite"
      >
        {toasts.map((item) => {
          const styles: Record<ToastTone, string> = {
            success: 'border-emerald-200 bg-white text-emerald-900 dark:border-emerald-800 dark:bg-slate-900 dark:text-emerald-200',
            error: 'border-red-200 bg-white text-red-900 dark:border-red-900 dark:bg-slate-900 dark:text-red-200',
            warning: 'border-amber-200 bg-white text-amber-900 dark:border-amber-800 dark:bg-slate-900 dark:text-amber-200',
            info: 'border-blue-200 bg-white text-slate-900 dark:border-blue-800 dark:bg-slate-900 dark:text-slate-100',
          };
          const Icon = item.tone === 'error' || item.tone === 'warning' ? AlertTriangle : item.tone === 'info' ? Info : CheckCircle2;
          return (
            <div
              key={item.id}
              className={`pointer-events-auto flex items-start gap-2.5 rounded-xl border px-4 py-3 text-xs font-medium shadow-md ${styles[item.tone]}`}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="flex-1 leading-relaxed">{item.message}</span>
              <button
                type="button"
                onClick={() => setToasts((prev) => prev.filter((t) => t.id !== item.id))}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                aria-label="Dismiss notification"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Confirm modal */}
      <Modal
        open={Boolean(confirmState)}
        onClose={() => closeConfirm(false)}
        title={confirmState?.options.title || 'Confirm Action'}
        maxWidthClass="max-w-md"
        footer={
          <>
            <button
              type="button"
              onClick={() => closeConfirm(false)}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              {confirmState?.options.cancelLabel || 'Cancel'}
            </button>
            <button
              type="button"
              onClick={() => closeConfirm(true)}
              className={`rounded-lg px-4 py-2 text-xs font-semibold text-white ${
                confirmState?.options.tone === 'primary'
                  ? 'bg-blue-700 hover:bg-blue-800'
                  : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {confirmState?.options.okLabel || 'Confirm'}
            </button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{confirmState?.message}</p>
      </Modal>

      {/* Prompt modal */}
      <Modal
        open={Boolean(promptState)}
        onClose={cancelPrompt}
        title={promptState?.options.title || 'Enter Details'}
        maxWidthClass="max-w-md"
      >
        <form onSubmit={submitPrompt} className="space-y-4">
          {promptState?.options.message && (
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {promptState.options.message}
            </p>
          )}
          <div>
            <input
              type="text"
              autoFocus
              value={promptState?.value || ''}
              placeholder={promptState?.options.placeholder || ''}
              onChange={(e) =>
                promptState && setPromptState({ ...promptState, value: e.target.value, error: '' })
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
            {promptState?.error && <p className="mt-1.5 text-xs font-medium text-red-600">{promptState.error}</p>}
          </div>
          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={cancelPrompt}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800"
            >
              {promptState?.options.okLabel || 'Submit'}
            </button>
          </div>
        </form>
      </Modal>
    </DialogContext.Provider>
  );
};

export function useDialog(): DialogContextValue {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog must be used inside DialogProvider');
  return ctx;
}
