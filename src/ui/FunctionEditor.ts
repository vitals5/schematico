import type { CatalogArticle } from '../model/ArticleTypes';
import { knownFunctionTypes } from '../model/FunctionDefinitions';
import { escapeSvg as esc } from '../model/ImportedDrawing';
import { t } from '../i18n';
export class FunctionEditor {
  private rows: NonNullable<CatalogArticle['functions']>;
  constructor(
    private el: HTMLElement,
    functions: CatalogArticle['functions'],
  ) {
    this.rows = structuredClone(functions ?? []);
    this.render();
  }
  value() {
    this.collect();
    return this.rows.length ? structuredClone(this.rows) : undefined;
  }
  private collect() {
    for (const input of this.el.querySelectorAll<HTMLInputElement>(
      '[data-function-row]',
    )) {
      const row = this.rows[Number(input.dataset.functionRow)],
        key = input.dataset.functionField!;
      (row as any)[key] =
        key === 'required'
          ? input.checked
          : key === 'pins'
            ? input.value
                .split(/[,;\n]/)
                .map((s) => s.trim())
                .filter(Boolean)
            : input.value;
    }
  }
  private render() {
    this.el.innerHTML = `<table style="width:100%;text-align:left"><tr><th>${t('functionSlot')}</th><th>${t('articlesFunctionType')}</th><th>${t('functionPins')}</th><th>${t('functionRequired')}</th><th></th></tr>${this.rows.map((f, i) => `<tr>${(['id', 'type', 'pins'] as const).map((k) => `<td><input class="form-input" data-function-row="${i}" data-function-field="${k}" ${k === 'type' ? 'list="knownFunctions"' : ''} value="${esc(k === 'pins' ? f.pins.join(', ') : f[k])}"></td>`).join('')}<td><input type="checkbox" data-function-row="${i}" data-function-field="required" ${f.required ? 'checked' : ''}></td><td><button class="btn" data-remove-function="${i}">${t('articlesRemove')}</button></td></tr>`).join('')}</table><datalist id="knownFunctions">${knownFunctionTypes()
      .map((s) => `<option value="${esc(s)}">`)
      .join(
        '',
      )}</datalist><button class="btn" data-add-function>${t('functionAdd')}</button>`;
    this.el
      .querySelector('[data-add-function]')
      ?.addEventListener('click', () => {
        this.collect();
        this.rows.push({ id: '', type: '', pins: [] });
        this.render();
      });
    for (const b of this.el.querySelectorAll<HTMLElement>(
      '[data-remove-function]',
    ))
      b.addEventListener('click', () => {
        this.collect();
        this.rows.splice(Number(b.dataset.removeFunction), 1);
        this.render();
      });
  }
}
