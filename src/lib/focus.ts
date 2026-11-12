export function focusFirstInvalid(container: HTMLElement | null) {
  window.requestAnimationFrame(() =>
    container?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
  );
}
