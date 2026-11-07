import { finishEngineeringDialog, formatCatalogSummary, formatEngineeringDate } from './EngineeringDialog';
import {
  TeamCatalogClient,
  TeamSyncPlan,
  type TeamSnapshot,
} from '../model/TeamCatalog';
import { ArticleCatalog } from '../model/ArticleCatalog';
import { bindArticleModalKeys, focusArticleModal } from './ArticleModal';
import { articleError, downloadArticleFile } from './ArticleCatalogDialog';
import { escapeSvg as esc } from '../model/ImportedDrawing';
import { t } from '../i18n';
export class TeamCatalogDialog {
  private el = document.createElement('div');
  private url = '';
  private token = '';
  private error = '';
  private busy = false;
  private client?: TeamCatalogClient;
  private snapshot?: TeamSnapshot;
  private plan?: TeamSyncPlan;
  private choices: Record<string, 'local' | 'remote'> = {};
  private pullOnly = false;
  private history: { revision: number; author: string; created: string }[] = [];
  private store = new ArticleCatalog();
  constructor(private onDone: () => void) {}
  show() {
    if (document.getElementById('teamCatalogDialog')) return;
    this.el.id = 'teamCatalogDialog';
    this.el.className = 'modal-backdrop';
    this.el.style.cssText =
      'position:fixed;inset:0;z-index:4600;background:#000b;display:flex;align-items:center;justify-content:center;padding:16px';
    document.body.append(this.el);
    bindArticleModalKeys(this.el, () => {
      if (!this.busy) this.close();
    });
    this.render();
  }
  private close() {
    this.token = '';
    this.client = undefined;
    this.el.remove();
  }
  private async work(fn: () => Promise<void>) {
    if (this.busy) return;
    this.busy = true;
    this.error = '';
    this.render();
    try {
      await fn();
    } catch (e) {
      this.error = articleError(e);
    } finally {
      this.busy = false;
      if (this.el.isConnected) this.render();
    }
  }
  private render() {
    const count =
      this.plan?.rows.filter((r) => r.conflict && !this.choices[r.key])
        .length ?? 0;
    this.el.innerHTML = `<section role="dialog" aria-modal="true" style="background:#17202d;color:#eee;border:1px solid #526170;border-radius:8px;padding:20px;width:min(1100px,100%);max-height:90vh;overflow:auto"><h2>${t('teamCatalog')}</h2><p>${t('teamHint')}</p><div role="alert" style="color:#fca5a5">${esc(this.error)}</div><label>${t('teamUrl')}<input class="form-input" data-url value="${esc(this.url)}"></label><label>${t('teamToken')}<input class="form-input" type="password" autocomplete="off" data-token></label><button class="btn" data-connect>${t('teamConnect')}</button>${this.snapshot ? `<p>${esc(this.snapshot.teamId)} · ${esc(this.snapshot.user.id)} (${esc(this.snapshot.user.role)}) · v${this.snapshot.revision}</p><label><input type="checkbox" data-pull ${this.pullOnly ? 'checked' : ''}> ${t('teamPullOnly')}</label>` : ''}
 ${this.plan ? `<div style="max-height:42vh;overflow:auto"><table style="width:100%;text-align:left"><tr><th>${t('teamLocal')}</th><th>${t('teamRemote')}</th><th></th></tr>${this.plan.rows.map((r, i) => `<tr><td style="white-space:pre-wrap">${esc(formatCatalogSummary(r.local))}</td><td style="white-space:pre-wrap">${esc(formatCatalogSummary(r.remote))}</td><td>${r.conflict ? `<select data-choice="${i}"><option value="">${t('teamChoose')}</option><option value="local" ${this.choices[r.key] === 'local' ? 'selected' : ''}>${t('teamLocal')}</option><option value="remote" ${this.choices[r.key] === 'remote' ? 'selected' : ''}>${t('teamRemote')}</option></select>` : ''}</td></tr>`).join('')}</table></div><details><summary>${t('teamHistory')}</summary>${this.history.map((r) => `<div>v${r.revision} · ${esc(r.author)} · ${esc(formatEngineeringDate(r.created))} <button class="btn" data-history="${r.revision}">${t('teamVersionDownload')}</button></div>`).join('')}</details>` : ''}
 <footer style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px"><button class="btn" data-close>${t('close')}</button><button class="btn" data-apply ${!this.plan || count ? 'disabled' : ''}>${t('articlesApply')}</button></footer></section>`;
    const token = this.el.querySelector<HTMLInputElement>('[data-token]')!;
    token.value = this.token;
    token.addEventListener('input', () => {
      this.token = token.value;
      this.plan = undefined;
      this.el.querySelector<HTMLButtonElement>('[data-apply]')!.disabled = true;
    });
    this.el
      .querySelector<HTMLInputElement>('[data-url]')
      ?.addEventListener('input', (e) => {
        this.url = (e.target as HTMLInputElement).value;
        this.plan = undefined;
        this.el.querySelector<HTMLButtonElement>('[data-apply]')!.disabled =
          true;
      });
    this.el
      .querySelector('[data-close]')
      ?.addEventListener('click', () => this.close());
    this.el.querySelector('[data-connect]')?.addEventListener(
      'click',
      () =>
        void this.work(async () => {
          this.plan = undefined;
          this.snapshot = undefined;
          this.choices = {};
          this.client = new TeamCatalogClient(this.url, this.token);
          const remote = await this.client.read(),
            local = await this.store.list(),
            state = await this.store.syncState(
              JSON.stringify([this.client.url,remote.teamId,remote.user.id]),
            );
          this.snapshot = remote;
          this.pullOnly = remote.user.role === 'reader';
          this.plan = new TeamSyncPlan(local, remote, state);
          this.history = (await this.client.history()).versions;
        }),
    );
    this.el
      .querySelector<HTMLInputElement>('[data-pull]')
      ?.addEventListener('change', (e) => {
        this.pullOnly = (e.target as HTMLInputElement).checked;
        if (this.snapshot?.user.role === 'reader') this.pullOnly = true;
        this.render();
      });
    for (const select of this.el.querySelectorAll<HTMLSelectElement>(
      '[data-choice]',
    ))
      select.addEventListener('change', () => {
        const key = this.plan!.rows[Number(select.dataset.choice)].key;
        if (select.value)
          this.choices[key] = select.value as 'local' | 'remote';
        else delete this.choices[key];
        this.render();
      });
    for (const button of this.el.querySelectorAll<HTMLElement>(
      '[data-history]',
    ))
      button.addEventListener(
        'click',
        () =>
          void this.work(async () => {
            const value = await this.client!.version(
              Number(button.dataset.history),
            );
            if (value.teamId !== this.snapshot!.teamId)
              throw new Error('teamInvalid');
            downloadArticleFile(
              JSON.stringify(
                {
                  schema: 'schematico-articles',
                  version: 1,
                  articles: value.articles,
                },
                null,
                2,
              ),
              'schematico-team-catalog-v' + value.revision + '.json',
              'application/json',
            );
          }),
      );
    this.el.querySelector('[data-apply]')?.addEventListener(
      'click',
      () =>
        void this.work(async () => {
          await this.plan!.apply(
            this.store,
            this.client!,
            this.choices,
            this.pullOnly,
          );
          this.onDone();
          this.close();
        }),
    );
    if (this.busy)
      for (const c of this.el.querySelectorAll<
        HTMLInputElement | HTMLButtonElement | HTMLSelectElement
      >('button,input,select'))
        c.disabled = true;
    finishEngineeringDialog(this.el, { kind: 'team', description: t('engineeringTeamHint'), wide: false });
    focusArticleModal(this.el);
  }
}
