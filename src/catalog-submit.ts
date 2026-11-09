import './style.css';
import { refreshSharedCatalog } from './model/GitHubCatalog';
import {
  validatePublicArticle,
  MAX_SUBMISSION_BYTES,
} from './shared/catalog-publication.mjs';
import { CatalogPublicationDialog } from './ui/CatalogPublicationDialog';
import { finishEngineeringDialog } from './ui/EngineeringDialog';
import { bindArticleModalKeys, focusArticleModal } from './ui/ArticleModal';
import { t } from './i18n';
window.addEventListener('DOMContentLoaded', () => {
  const app = document.getElementById('app')!;
  const message = (text: string) => {
    app.replaceChildren();
    const box = document.createElement('div');
    box.className = 'catalog-standalone-message';
    const img = document.createElement('img');
    img.src = './branding/icon-64.png';
    img.alt = 'Schematico';
    const heading = document.createElement('h1');
    heading.textContent = 'Schematico';
    const paragraph = document.createElement('p');
    paragraph.textContent = text;
    box.append(img, heading, paragraph);
    app.append(box);
  };
  message(t('githubCatalogLoading'));
  const parameters = new URLSearchParams(location.hash.slice(1));
  history.replaceState(null, '', location.pathname);
  const catalog = refreshSharedCatalog();
  const present = async (text: string) => {
    if (new TextEncoder().encode(text).length > MAX_SUBMISSION_BYTES * 2)
      throw new Error('githubCatalogInvalid');
    const parsed = JSON.parse(text);
    const rawArticle = parsed?.article ?? parsed;
    const rawSymbol = parsed?.symbol;
    const article = validatePublicArticle(rawArticle);
    await catalog;
    new CatalogPublicationDialog(
      article,
      () => {},
      () => message(t('githubCatalogClosePage')),
      rawSymbol,
    ).show();
  };
  if (parameters.get('paste') === '1') {
    const root = document.createElement('div');
    root.id = 'catalogPasteDialog';
    root.className = 'modal-backdrop';
    root.style.cssText =
      'position:fixed;inset:0;z-index:4600;display:flex;align-items:center;justify-content:center';
    root.innerHTML = `<section role="dialog" aria-modal="true"><h2>${t('githubCatalogPasteTitle')}</h2><p>${t('githubCatalogPasteHint')}</p><button class="btn eng-primary" data-read>${t('githubCatalogReadClipboard')}</button><details><summary>${t('githubCatalogManualPaste')}</summary><label>${t('githubCatalogPasteData')}<textarea rows="10" data-json spellcheck="false"></textarea></label></details><div role="alert"></div><footer><button class="btn" data-close>${t('close')}</button><button class="btn eng-primary" data-preview>${t('articlesPreview')}</button></footer></section>`;
    document.body.append(root);
    const input = root.querySelector<HTMLTextAreaElement>('[data-json]')!,
      error = root.querySelector<HTMLElement>('[role=alert]')!;
    const preview = async () => {
      try {
        await present(input.value);
        root.remove();
      } catch (problem) {
        error.textContent = t(
          problem instanceof Error &&
            problem.message === 'githubCatalogNotConfigured'
            ? 'githubCatalogNotConfigured'
            : 'githubCatalogInvalid',
        );
      }
    };
    root.querySelector('[data-read]')!.addEventListener('click', () => {
      void Promise.resolve()
        .then(() => navigator.clipboard.readText())
        .then((text) => {
          input.value = text;
          return preview();
        })
        .catch(() => {
          root.querySelector('details')!.open = true;
          error.textContent = t('githubCatalogManualPasteHint');
          input.focus();
        });
    });
    root
      .querySelector('[data-preview]')!
      .addEventListener('click', () => void preview());
    const close = () => {
      root.remove();
      message(t('githubCatalogClosePage'));
    };
    root.querySelector('[data-close]')!.addEventListener('click', close);
    bindArticleModalKeys(root, close);
    finishEngineeringDialog(root, {
      kind: 'catalog',
      description: t('githubCatalogPublicationHint'),
    });
    focusArticleModal(root);
    return;
  }
  void (async () => {
    try {
      const encoded = parameters.get('article');
      if (
        !encoded ||
        encoded.length > MAX_SUBMISSION_BYTES * 1.5 ||
        !/^[\w-]+$/.test(encoded)
      )
        throw new Error('githubCatalogInvalid');
      const bytes = Uint8Array.from(
        atob(encoded.replace(/-/g, '+').replace(/_/g, '/')),
        (c) => c.charCodeAt(0),
      );
      if (bytes.length > MAX_SUBMISSION_BYTES)
        throw new Error('githubCatalogInvalid');
      await present(new TextDecoder().decode(bytes));
    } catch (error) {
      message(
        error instanceof Error && error.message === 'githubCatalogNotConfigured'
          ? t('githubCatalogNotConfigured')
          : t('githubCatalogInvalid'),
      );
    }
  })();
});
