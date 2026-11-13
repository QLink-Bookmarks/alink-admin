import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Button } from './button';

export function Dialog({
  open,
  title,
  children,
  onClose,
  initialFocus = 'input',
  role,
  describedBy,
  action,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  initialFocus?: 'input' | 'cancel';
  role?: 'alertdialog';
  describedBy?: string;
  action?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const handleClose = () => {
    if (!ref.current?.querySelector('[aria-busy="true"]')) onClose();
  };
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !open) return;
    const trigger = document.activeElement;
    dialog.showModal();
    const first =
      initialFocus === 'input'
        ? dialog.querySelector<HTMLElement>('input, select, textarea')
        : null;
    (first ?? dialog.querySelector<HTMLElement>('[data-cancel]'))?.focus();
    return () => {
      dialog.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, [open, initialFocus]);
  const cancel = (
    <Button data-cancel onClick={handleClose}>
      취소
    </Button>
  );
  return (
    <dialog
      ref={ref}
      role={role}
      aria-labelledby={titleId}
      aria-describedby={describedBy}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const controls = [
          ...event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex="0"]',
          ),
        ].filter((element) => element.checkVisibility());
        const first = controls[0];
        const last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        handleClose();
      }}
    >
      <h2 id={titleId}>{title}</h2>
      {!action && cancel}
      {children}
      {action && (
        <div className="actions dialog-actions">
          {cancel}
          {action}
        </div>
      )}
    </dialog>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  actionLabel,
  pendingLabel,
  pending,
  error,
  destructive = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description: ReactNode;
  actionLabel: string;
  pendingLabel?: string;
  pending?: boolean;
  error?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const descriptionId = useId();
  const busyLabel = pendingLabel ?? '처리 중…';
  return (
    <Dialog
      open={open}
      title={title}
      role="alertdialog"
      describedBy={descriptionId}
      initialFocus="cancel"
      onClose={() => {
        if (!pending) onClose();
      }}
      action={
        <Button
          className={destructive ? 'destructive' : 'primary'}
          aria-disabled={pending}
          onClick={() => {
            if (!pending) onConfirm();
          }}
        >
          {pending ? busyLabel : actionLabel}
        </Button>
      }
    >
      <div id={descriptionId} className="dialog-description">
        {description}
      </div>
      <p role="status" aria-live="polite">
        {pending ? busyLabel : ''}
      </p>
      {error && <p role="alert">{error}</p>}
    </Dialog>
  );
}
