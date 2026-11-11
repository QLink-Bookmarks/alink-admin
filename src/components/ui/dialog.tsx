import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Button } from './button';

export function Dialog({
  open,
  title,
  children,
  onClose,
  initialFocus = 'input',
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  initialFocus?: 'input' | 'cancel';
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
      if (trigger instanceof HTMLElement) trigger.focus();
    };
  }, [open, initialFocus]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
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
      <Button data-cancel onClick={handleClose}>
        취소
      </Button>
      {children}
    </dialog>
  );
}
