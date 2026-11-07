import { editorArticles } from '../model/EditorArticles';
import { effectiveArticles, primaryArticle } from '../model/ArticleAssignments';
import { catalogKey } from '../model/CatalogRecord';
import type { PlacedComponent, Project } from '../model/types';
import { escapeSvg as esc } from '../model/ImportedDrawing';
import { t } from '../i18n';
export function componentArticleKey(component: PlacedComponent, project?: Project) {
  const current = primaryArticle(effectiveArticles(component, project));
  return current ? catalogKey(current) : '';
}
export function editorArticleOptions(selected = '') {
  return `<option value="">${esc(t('selectPartPlaceholder'))}</option>` + editorArticles().map(({article}) => {
    const key = catalogKey(article);
    return `<option value="${esc(key)}" ${key === selected ? 'selected' : ''}>${esc([article.manufacturer,article.articleNumber,article.variant].filter(Boolean).join(' · '))} — ${esc(article.description)}</option>`;
  }).join('');
}
export function refreshEditorArticleSelectors(root: ParentNode = document) {
  for (const select of root.querySelectorAll<HTMLSelectElement>('select[data-editor-article-select]')) {
    const key = select.value;
    select.innerHTML = editorArticleOptions(key);
  }
}
