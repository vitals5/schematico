import { t, getUiLanguage } from '../i18n';
import type { CatalogArticle } from '../model/ArticleTypes';

export type EngineeringIcon =
  | 'device'
  | 'articles'
  | 'wiring'
  | 'catalog'
  | 'potential'
  | 'inspection'
  | 'review'
  | 'team'
  | 'close'
  | 'search'
  | 'plus'
  | 'chevron'
  | 'link'
  | 'trash'
  | 'check';
const paths: Record<EngineeringIcon, string> = {
  device:
    '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 3v18M12 8h4M12 12h4M12 16h4"/>',
  articles: '<path d="M7 3h10l3 4v13H4V7zM4 7h16M9 3v4M9 12h6M9 16h6"/>',
  wiring:
    '<path d="M5 5v7h14v7M12 5v14"/><circle cx="5" cy="4" r="2"/><circle cx="12" cy="4" r="2"/><circle cx="19" cy="20" r="2"/><circle cx="12" cy="20" r="2"/>',
  catalog:
    '<path d="M4 4h6l2 2 2-2h6v16h-6l-2 2-2-2H4zM12 6v16M7 9h2M15 9h2M7 13h2M15 13h2"/>',
  potential: '<path d="M13 2 5 13h6l-1 9 9-13h-7z"/>',
  inspection:
    '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M9 10l2 2 4-4M9 16h6"/>',
  review: '<path d="M4 7h16M4 12h16M4 17h10M17 16l2 2 3-4"/>',
  team: '<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 5v2"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  link: '<path d="m10 13 4-4M8 16l-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0M16 8l1-1a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0" transform="translate(0 0) scale(.92)"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
};
export function engineeringIcon(icon: EngineeringIcon): string {
  return `<svg class="eng-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[icon]}</svg>`;
}
export function formatEngineeringDate(value: string | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return new Intl.DateTimeFormat(getUiLanguage() === 'de' ? 'de-DE' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}
export function formatArticleFunctions(functions: CatalogArticle['functions']) {
  return (
    functions
      ?.map(
        (f) =>
          `${f.id} · ${f.type}\n${f.pins.join(' / ')}${f.required ? ' · ' + t('functionRequired') : ''}`,
      )
      .join('\n\n') || '—'
  );
}
export function formatCatalogSummary(
  article: CatalogArticle | undefined | null,
) {
  if (!article) return '—';
  return (
    [article.manufacturer, article.articleNumber, article.variant]
      .filter(Boolean)
      .join(' · ') +
    '\n' +
    article.description +
    '\n\n' +
    formatArticleFunctions(article.functions) +
    '\n\n' +
    t(
      article.verification === 'user_checked'
        ? 'articlesChecked'
        : 'articlesUnverified',
    )
  );
}

/** Presentation only. Existing form controls, listeners and project transactions
 * stay in place when the shared shell is assembled after each render. */
export function finishEngineeringDialog(
  root: HTMLElement,
  options: {
    kind: EngineeringIcon;
    description: string;
    title?: string;
    wide?: boolean;
    closeSelector?: string;
  },
) {
  const active = root.contains(document.activeElement)
    ? (document.activeElement as HTMLElement)
    : undefined;
  const shell = root.querySelector<HTMLElement>('[role="dialog"]');
  if (!shell) return;
  root.classList.add('engineering-overlay');
  for (const property of ['background', 'background-color', 'padding'])
    root.style.removeProperty(property);
  shell.classList.add('eng-shell', `eng-shell--${options.kind}`);
  if (options.wide) shell.classList.add('eng-shell--wide');
  for (const property of [
    'background',
    'background-color',
    'color',
    'border',
    'border-radius',
    'padding',
    'width',
    'height',
    'max-height',
    'max-width',
    'overflow',
    'display',
    'flex-direction',
  ])
    shell.style.removeProperty(property);
  for (const style of root.querySelectorAll(
    ':scope > style, :scope > section > style',
  ))
    style.remove();
  const title =
    shell.querySelector<HTMLHeadingElement>(':scope > h2') ??
    document.createElement('h2');
  if (options.title) title.textContent = options.title;
  title.textContent = title.textContent?.replace(/…\s*$/, '') ?? '';
  title.id = root.id + '-title';
  const oldHeader = shell.querySelector<HTMLElement>(
    ':scope > .ecad-window-header',
  );
  const oldClose = oldHeader?.querySelector<HTMLButtonElement>('button');
  const footer =
    shell.querySelector<HTMLElement>(':scope > footer') ??
    shell.querySelector<HTMLElement>('#btnConfirmPlaus')?.parentElement;
  const closeTarget = root.querySelector<HTMLButtonElement>(
    options.closeSelector ?? '[data-close]',
  );
  const close = oldClose ?? document.createElement('button');
  close.type = 'button';
  close.className = 'eng-close';
  close.setAttribute('aria-label', t('close'));
  close.title = t('close');
  close.innerHTML = engineeringIcon('close');
  if (!oldClose) {
    close.disabled = !!closeTarget?.disabled;
    close.addEventListener('click', () => closeTarget?.click());
  }
  const header = document.createElement('header');
  header.className = 'eng-header';
  const mark = document.createElement('div');
  mark.className = 'eng-header-mark';
  mark.innerHTML = engineeringIcon(options.kind);
  const heading = document.createElement('div');
  heading.className = 'eng-heading';
  const eyebrow = document.createElement('span');
  eyebrow.className = 'eng-eyebrow';
  eyebrow.textContent = t('engineeringWorkspace');
  const description = document.createElement('p');
  description.id = root.id + '-description';
  description.textContent = options.description;
  heading.append(eyebrow, title, description);
  header.append(mark, heading, close);
  oldHeader?.remove();
  const body = document.createElement('div');
  body.className = 'eng-body';
  for (const child of [...shell.childNodes])
    if (child !== footer) body.append(child);
  shell.replaceChildren(header, body);
  if (footer) {
    footer.classList.add('eng-footer');
    footer.removeAttribute('style');
    shell.append(footer);
  }
  shell.setAttribute('aria-labelledby', title.id);
  shell.setAttribute('aria-describedby', description.id);
  for (const alert of body.querySelectorAll<HTMLElement>('[role="alert"]'))
    alert.classList.add('eng-alert');
  for (const label of body.querySelectorAll<HTMLLabelElement>('label')) {
    if (label.classList.contains('nav-search')) continue;
    label.classList.add(
      label.querySelector('[type="checkbox"],[type="radio"]')
        ? 'eng-check'
        : 'eng-field',
    );
  }
  for (const parent of body.querySelectorAll<HTMLElement>(
    'fieldset, [data-form-grid]',
  )) {
    let run: HTMLElement[] = [];
    const group = () => {
      if (run.length > 1) {
        const grid = document.createElement('div');
        grid.className = 'eng-fields';
        run[0].before(grid);
        run.forEach((label) => grid.append(label));
      }
      run = [];
    };
    for (const child of [...parent.children]) {
      if (child.matches('label.eng-field')) run.push(child as HTMLElement);
      else group();
    }
    group();
  }
  for (const table of body.querySelectorAll<HTMLTableElement>('table')) {
    const row = table.rows[0];
    if (
      row &&
      [...row.cells].every((cell) => cell.tagName === 'TH') &&
      !table.tHead
    )
      table.createTHead().append(row);
    if (table.parentElement?.children.length === 1)
      table.parentElement.classList.add('eng-table-wrap');
    for (const cell of table.querySelectorAll<HTMLTableCellElement>('td'))
      if (cell.querySelector('button')) cell.classList.add('eng-cell-actions');
  }
  for (const child of body.children)
    if (
      child instanceof HTMLElement &&
      child.tagName === 'DIV' &&
      child.style.display === 'flex' &&
      child.querySelector('input,select,button')
    )
      child.classList.add('eng-toolbar');
  for (const action of root.querySelectorAll<HTMLElement>(
    '[data-apply],[data-commit],[data-new]',
  ))
    action.classList.add('eng-primary');
  for (const action of root.querySelectorAll<HTMLElement>(
    '[data-delete],[data-remove],[data-remove-bridge]',
  ))
    action.classList.add('eng-danger');
  for (const button of root.querySelectorAll<HTMLButtonElement>(
    '[data-prev],[data-next]',
  ))
    button.setAttribute(
      'aria-label',
      t(button.hasAttribute('data-prev') ? 'reviewPrevious' : 'reviewNext'),
    );
  if (options.kind === 'articles') {
    const controls =
      body.querySelector<HTMLElement>('[data-catalog]')?.parentElement;
    if (controls) {
      controls.classList.add('eng-toolbar');
      const menu = document.createElement('details');
      menu.className = 'eng-tools-menu';
      const summary = document.createElement('summary');
      summary.textContent = t('engineeringTools');
      menu.append(summary);
      const items = document.createElement('div');
      items.className = 'eng-tools-items';
      for (const selector of [
        '[data-catalog]',
        '[data-maintenance]',
        '[data-functions]',
      ]) {
        const button = controls.querySelector(selector);
        if (button) items.append(button);
      }
      menu.append(items);
      controls.append(menu);
    }
  }
  if (options.kind === 'catalog' && body.querySelector('[data-team]')) {
    const bar = body.querySelector<HTMLElement>('[data-new]')?.parentElement;
    if (bar) {
      const search = body.querySelector<HTMLInputElement>(
        ':scope > input[data-search]',
      );
      if (search) {
        search.style.removeProperty('margin');
        bar.prepend(search);
      }
      const menu = document.createElement('details');
      menu.className = 'eng-tools-menu';
      const summary = document.createElement('summary');
      summary.textContent = t('engineeringTools');
      menu.append(summary);
      const items = document.createElement('div');
      items.className = 'eng-tools-items';
      for (const selector of [
        '[data-project]',
        '[data-json]',
        '[data-csv]',
        '[data-refresh]',
        '[data-team]',
      ]) {
        const button = bar.querySelector(selector);
        if (button) items.append(button);
      }
      menu.append(items);
      items.addEventListener('click', (event) => {
        if ((event.target as Element).closest('button')) menu.open = false;
      });
      bar.append(menu);
      const importer = bar.querySelector<HTMLButtonElement>('[data-import]');
      if (importer) {
        importer.title = t('manufacturerImport');
        importer.textContent = t('engineeringImportData');
      }
    }
  }
  if (options.kind === 'wiring') {
    const groups = [
      ...body.querySelectorAll<HTMLElement>(':scope > fieldset'),
    ].filter((panel) => panel.querySelector('[data-terminal],[data-cable]'));
    if (groups.length) {
      const tabs = document.createElement('div');
      tabs.className = 'eng-tabs';
      tabs.setAttribute('role', 'tablist');
      tabs.setAttribute('aria-label', t('wiringManage'));
      const initial = groups.findIndex(
        (panel) =>
          !!panel.querySelector<HTMLSelectElement>('[data-cable]')?.value,
      );
      const active = Math.min(
        Number(root.dataset.engineeringTab ?? Math.max(0, initial)),
        groups.length - 1,
      );
      const select = (index: number) => {
        root.dataset.engineeringTab = String(index);
        groups.forEach((panel, i) => {
          panel.hidden = i !== index;
          const tab = tabs.children[i] as HTMLButtonElement;
          tab.setAttribute('aria-selected', String(i === index));
          tab.tabIndex = i === index ? 0 : -1;
        });
      };
      groups.forEach((panel, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.id = root.id + '-tab-' + index;
        button.textContent = panel.querySelector('legend')?.textContent ?? '';
        button.setAttribute('role', 'tab');
        panel.id = root.id + '-panel-' + index;
        button.setAttribute('aria-controls', panel.id);
        panel.setAttribute('role', 'tabpanel');
        panel.setAttribute('aria-labelledby', button.id);
        button.addEventListener('click', () => select(index));
        button.addEventListener('keydown', (e) => {
          if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
            e.preventDefault();
            const next =
              e.key === 'Home'
                ? 0
                : e.key === 'End'
                  ? groups.length - 1
                  : (index + (e.key === 'ArrowRight' ? 1 : groups.length - 1)) %
                    groups.length;
            select(next);
            (tabs.children[next] as HTMLButtonElement).focus();
          }
        });
        tabs.append(button);
      });
      groups[0].before(tabs);
      select(active);
    }
  }
  if (active?.isConnected) active.focus({ preventScroll: true });
}
