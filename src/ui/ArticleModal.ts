/** Keep editor shortcuts and keyboard focus inside article dialogs. */
export function bindArticleModalKeys(el: HTMLElement, onEscape: () => void) {
  el.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      const menu=el.querySelector<HTMLDetailsElement>('.eng-tools-menu[open]');
      if(menu){menu.open=false;menu.querySelector<HTMLElement>('summary')?.focus();return;}
      onEscape();
    }
    if (e.key === 'Tab') {
      const controls = [
        ...el.querySelectorAll<HTMLElement>(
          'button:not(:disabled):not([tabindex="-1"]),input:not(:disabled):not([type=hidden]),select:not(:disabled),textarea:not(:disabled),summary,[tabindex="0"]',
        ),
      ].filter((c) => c.getClientRects().length);
      const first = controls[0],
        last = controls.at(-1);
      if (!first) {
        e.preventDefault();
        return;
      }
      if (
        e.shiftKey &&
        (document.activeElement === first ||
          !controls.includes(document.activeElement as HTMLElement))
      ) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });
}
export function focusArticleModal(el: HTMLElement) {
  const section = el.querySelector<HTMLElement>('section');
  if (section) {
    section.tabIndex = -1;
    if (!el.contains(document.activeElement)) section.focus();
  }
}
