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
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !open) return;
    const trigger = document.activeElement;
    dialog.showModal();
    const first = initialFocus === 'input' ? dialog.querySelector<HTMLElement>('input, select, textarea') : null;
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
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <h2 id={titleId}>{title}</h2>
      <Button data-cancel onClick={onClose}>
        취소
      </Button>
      {children}
    </dialog>
  );
}
