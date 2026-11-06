import type { PlacedComponent } from '../model/types';
import { escapeSvg as esc } from '../model/ImportedDrawing';
import { t } from '../i18n';
export function importedArticleFields(component: PlacedComponent): string {
    const refs = component.articleReferences;
    if (!refs?.length)
        return '';
    return `<details class="imported-article-references"><summary>${esc(t('importedArticles'))} (${refs.length})</summary><div style="font-size:11px">${esc(t('importedArticlesEvidence'))}</div>
    <table style="width:100%;font-size:11px;overflow-wrap:anywhere"><thead><tr><th>${esc(t('labelArticleNumber'))}</th><th>${esc(t('propManufacturer'))}</th><th>${esc(t('sourceArticleVariant'))}</th><th>${esc(t('sourceArticleQuantity'))}</th></tr></thead>
    <tbody>${refs.map(ref => `<tr><td>${esc(ref.articleNumber)}</td><td>${esc(ref.manufacturer ?? '?')}</td><td>${esc(ref.variant || '?')}</td><td>${ref.quantity === undefined ? '?' : esc(String(ref.quantity))}</td></tr>`).join('')}</tbody></table></details>`;
}
