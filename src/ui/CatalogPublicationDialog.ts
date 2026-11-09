import type { CatalogArticle } from '../model/ArticleTypes';
import type { SymbolDefinition } from '../model/types';
import {
  sharedCatalogState,
  submitSharedArticle,
} from '../model/GitHubCatalog';
import { validatePublicArticle } from '../shared/catalog-publication.mjs';
import {
  finishEngineeringDialog,
  formatCatalogSummary,
} from './EngineeringDialog';
import { bindArticleModalKeys, focusArticleModal } from './ArticleModal';
import { articleError } from './ArticleCatalogDialog';
import { escapeSvg as esc } from '../model/ImportedDrawing';
import { t } from '../i18n';
interface ChallengeApi {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
  reset: (id: string) => void;
}
let challengeReady: Promise<ChallengeApi> | undefined;
function challengeApi(): Promise<ChallengeApi> {
  const api = (window as unknown as { turnstile?: ChallengeApi }).turnstile;
  if (api) return Promise.resolve(api);
  if (!challengeReady)
    challengeReady = new Promise<ChallengeApi>((resolve, reject) => {
      const script = document.createElement('script');
      script.src =
        'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.onload = () => {
        const api = (window as unknown as { turnstile?: ChallengeApi })
          .turnstile;
        api ? resolve(api) : reject(new Error('githubCatalogChallenge'));
      };
      script.onerror = () => reject(new Error('githubCatalogChallenge'));
      document.head.append(script);
    }).catch((error) => {
      challengeReady = undefined;
      throw error;
    });
  return challengeReady!;
}
export class CatalogPublicationDialog {
  private el = document.createElement('div');
  private restore =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : undefined;
  private article: CatalogArticle;
  private symbol?: SymbolDefinition;
  private busy = false;
  private sent = false;
  private token = '';
  private widget?: string;
  private api?: ChallengeApi;
  constructor(
    article: CatalogArticle,
    private onDone: () => void = () => {},
    private onClose?: () => void,
    symbol?: SymbolDefinition,
  ) {
    this.article = validatePublicArticle(article);
    this.symbol = symbol;
  }
  show() {
    if (document.getElementById('catalogPublicationDialog')) return;
    const config = sharedCatalogState().submission;
    if (!config) throw new Error('githubCatalogNotConfigured');
    this.el.id = 'catalogPublicationDialog';
    this.el.className = 'modal-backdrop';
    this.el.style.cssText =
      'position:fixed;inset:0;z-index:4700;display:flex;align-items:center;justify-content:center';
    this.el.innerHTML = `<section role="dialog" aria-modal="true"><h2>${t('githubCatalogPublish')}</h2><p>${t('githubCatalogPublicHint')}</p><fieldset><legend>${t('articlesPreview')}</legend><pre style="white-space:pre-wrap">${esc(formatCatalogSummary(this.article))}</pre></fieldset><div data-challenge></div><p data-status role="status">${t('githubCatalogChallengeLoading')}</p><div role="alert" data-error></div><footer><button class="btn" data-close>${t('close')}</button><button class="btn eng-primary" data-submit disabled>${t('githubCatalogSubmit')}</button></footer></section>`;
    document.body.append(this.el);
    bindArticleModalKeys(this.el, () => {
      if (!this.busy) this.close();
    });
    this.el.querySelector('[data-close]')!.addEventListener('click', () => {
      if (!this.busy) this.close();
    });
    this.el
      .querySelector('[data-submit]')!
      .addEventListener('click', () => void this.submit());
    finishEngineeringDialog(this.el, {
      kind: 'catalog',
      description: t('githubCatalogPublicationHint'),
    });
    focusArticleModal(this.el);
    void challengeApi()
      .then((api) => {
        if (!this.el.isConnected) return;
        this.api = api;
        this.widget = api.render(this.el.querySelector('[data-challenge]')!, {
          sitekey: config.siteKey,
          theme: 'dark',
          action: 'catalog-submit',
          callback: (token: string) => {
            this.token = token;
            this.status('');
            this.update();
          },
          'expired-callback': () => {
            this.token = '';
            this.update();
          },
          'error-callback': () => {
            this.token = '';
            this.error(t('githubCatalogChallenge'));
            this.update();
          },
        });
      })
      .catch(() => this.error(t('githubCatalogChallenge')));
  }
  private status(message: string) {
    const el = this.el.querySelector<HTMLElement>('[data-status]');
    if (el) el.textContent = message;
  }
  private error(message: string) {
    const el = this.el.querySelector<HTMLElement>('[data-error]');
    if (el) el.textContent = message;
  }
  private update() {
    const submit = this.el.querySelector<HTMLButtonElement>('[data-submit]');
    if (submit) submit.disabled = this.busy || this.sent || !this.token;
    for (const button of this.el.querySelectorAll<HTMLButtonElement>(
      '[data-close],.eng-close',
    ))
      button.disabled = this.busy;
  }
  private async submit() {
    if (this.busy || this.sent || !this.token) return;
    this.busy = true;
    this.update();
    this.error('');
    this.status(t('githubCatalogSubmitting'));
    try {
      await submitSharedArticle(this.article, this.token, undefined, this.symbol);
      this.sent = true;
      this.status(t('githubCatalogSubmitted'));
      this.onDone();
    } catch (error) {
      this.error(articleError(error));
      this.status('');
      this.token = '';
      if (this.widget) this.api?.reset(this.widget);
    } finally {
      this.busy = false;
      this.update();
    }
  }
  private close() {
    if (this.widget) this.api?.remove(this.widget);
    this.el.remove();
    this.onClose?.();
    if (this.restore?.isConnected) this.restore.focus({ preventScroll: true });
  }
}
export async function openCatalogPublication(
  article: CatalogArticle,
  onDone: () => void,
  symbol?: SymbolDefinition,
) {
  const normalized = validatePublicArticle(article);
  if (!sharedCatalogState().submission)
    throw new Error('githubCatalogNotConfigured');
  const desktop = (
    window as unknown as {
      electronAPI?: {
        catalog?: {
          openPublication: (json: string) => Promise<boolean>;
          copyAndOpenPublication: (json: string) => Promise<boolean>;
        };
      };
    }
  ).electronAPI?.catalog;
  if (desktop) {
    const serialized = JSON.stringify({
      article: normalized,
      ...(symbol ? { symbol } : {}),
    });
    if (new TextEncoder().encode(serialized).length > 1350) {
      if (document.getElementById('catalogDesktopTransfer')) return;
      const restore =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : undefined;
      const root = document.createElement('div');
      root.id = 'catalogDesktopTransfer';
      root.className = 'modal-backdrop';
      root.style.cssText =
        'position:fixed;inset:0;z-index:4700;display:flex;align-items:center;justify-content:center';
      root.innerHTML = `<section role="dialog" aria-modal="true"><h2>${t('githubCatalogPublish')}</h2><p>${t('githubCatalogTransferHint')}</p><fieldset><legend>${t('articlesPreview')}</legend><pre style="white-space:pre-wrap">${esc(formatCatalogSummary(normalized))}</pre></fieldset><div role="alert"></div><footer><button class="btn" data-close>${t('close')}</button><button class="btn eng-primary" data-copy>${t('githubCatalogCopyAndOpen')}</button></footer></section>`;
      let busy = false;
      const close = () => {
        if (!busy) {
          root.remove();
          if (restore?.isConnected) restore.focus({ preventScroll: true });
        }
      };
      document.body.append(root);
      bindArticleModalKeys(root, close);
      root.querySelector('[data-close]')!.addEventListener('click', close);
      root.querySelector('[data-copy]')!.addEventListener('click', () => {
        if (busy) return;
        busy = true;
        void Promise.resolve()
          .then(() => desktop.copyAndOpenPublication(serialized))
          .then(() => {
            root.remove();
            if (restore?.isConnected) restore.focus({ preventScroll: true });
          })
          .catch((error) => {
            root.querySelector('[role=alert]')!.textContent =
              articleError(error);
          })
          .finally(() => {
            busy = false;
          });
      });
      finishEngineeringDialog(root, {
        kind: 'catalog',
        description: t('githubCatalogPublicationHint'),
      });
      focusArticleModal(root);
      return;
    }
    if (!(await desktop.openPublication(serialized)))
      throw new Error('githubCatalogSubmitFailed');
    return;
  }
  if (!import.meta.env.DEV && location.origin !== 'https://vitals5.github.io') {
    const payloadObject = symbol ? { article: normalized, symbol } : normalized;
    const bytes = new TextEncoder().encode(JSON.stringify(payloadObject));
    const payload = btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    window.open(
      'https://vitals5.github.io/schematico/catalog-submit.html#article=' +
        payload,
      '_blank',
      'noopener,noreferrer',
    );
    return;
  }
  let submitted = false;
  new CatalogPublicationDialog(
    normalized,
    () => {
      submitted = true;
    },
    () => {
      if (submitted) onDone();
    },
    symbol,
  ).show();
}
