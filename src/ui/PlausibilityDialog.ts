// src/ui/PlausibilityDialog.ts
// Plausibility Check & Message Management ("Prüflauf / Meldungsverwaltung")

import { Project } from '../model/types';
import { t } from '../i18n';
import { escapeSvg } from '../model/ImportedDrawing';

export type {PlausibilityMessage} from '../model/ProjectInspection';
import type {PlausibilityMessage} from '../model/ProjectInspection';
import {collectPlausibilityMessages} from '../model/ProjectInspection';

export class PlausibilityDialog {
  private project: Project;
  private onNavigate: (pageId: string, componentId?: string) => void;

  constructor(project: Project, onNavigateOrOptions: ((pageId: string, componentId?: string) => void) | { onNavigateToPage: (pageId: string, componentId?: string) => void }) {
    this.project = project;
    if (typeof onNavigateOrOptions === 'function') {
      this.onNavigate = onNavigateOrOptions;
    } else {
      this.onNavigate = onNavigateOrOptions.onNavigateToPage;
    }
  }

  public show(): void {
    const existing = document.getElementById('plausibilityModal');
    if (existing) existing.remove();

    const messages = this.runCheck();

    const modal = document.createElement('div');
    modal.id = 'plausibilityModal';
    modal.className = 'modal-backdrop';
    modal.style.position = 'fixed';
    modal.style.inset = '0';
    modal.style.backgroundColor = 'rgba(0,0,0,0.75)';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.zIndex = '2100';
    modal.style.padding = '12px';

    const errors = messages.filter(m => m.severity === 'error').length;
    const warnings = messages.filter(m => m.severity === 'warning').length;
    const infos = messages.filter(m => m.severity === 'info').length;

    modal.innerHTML = `
      <div class="modal-card ecad-window" style="
        background: #232731;
        border: 1px solid #4a5568;
        border-radius: 6px;
        width: 100%;
        max-width: 840px;
        height: 75vh;
        max-height: 600px;
        box-shadow: 0 16px 40px rgba(0,0,0,0.8);
        color: #edf2f7;
        font-family: inherit;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      ">
        <!-- Titlebar -->
        <div class="ecad-window-header" style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 14px;
          background: #2d323e;
          border-bottom: 1px solid #3e4656;
          user-select: none;
        ">
          <div style="display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 13px;">
            <span style="color: #68d391;">📋</span>
            <span>${t('plausModalTitle')}</span>
          </div>
          <button id="btnClosePlausModal" style="background: none; border: none; color: #a0aec0; font-size: 18px; cursor: pointer;">&times;</button>
        </div>

        <!-- Summary Bar -->
        <div style="
          padding: 8px 16px;
          background: #1c1f26;
          border-bottom: 1px solid #3e4656;
          display: flex;
          align-items: center;
          gap: 16px;
          font-size: 12px;
        ">
          <div>${t('plausStatusDone')}</div>
          <div style="display: flex; gap: 12px; margin-left: auto;">
            <span style="color: #fc8181;">❌ ${t('plausErrors', { count: errors })}</span>
            <span style="color: #f6ad55;">⚠️ ${t('plausWarnings', { count: warnings })}</span>
            <span style="color: #63b3ed;">ℹ️ ${t('plausInfos', { count: infos })}</span>
          </div>
        </div>

        <!-- Messages Table -->
        <div style="flex: 1; overflow-y: auto; padding: 10px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
            <thead>
              <tr style="background: #181b22; color: #a0aec0; text-align: left; border-bottom: 1px solid #3e4656;">
                <th style="padding: 6px 8px;">${t('plausColSeverity')}</th>
                <th style="padding: 6px 8px;">${t('plausColPage')}</th>
                <th style="padding: 6px 8px;">${t('plausColBmk')}</th>
                <th style="padding: 6px 8px;">${t('plausColMessage')}</th>
                <th style="padding: 6px 8px;">${t('plausColAction')}</th>
              </tr>
            </thead>
            <tbody>
              ${messages.length === 0 ? `
                <tr>
                  <td colspan="5" style="padding: 24px; text-align: center; color: #a0aec0;">
                    ${t('plausEmpty')}
                  </td>
                </tr>
              ` : messages.map(m => `
                <tr class="plaus-row" data-page-id="${escapeSvg(m.pageId)}" data-comp-id="${escapeSvg(m.componentId || '')}" style="border-bottom: 1px solid #2d3748; cursor: pointer;">
                  <td style="padding: 6px 8px; white-space: nowrap;">
                    ${m.severity === 'error' ? `❌ <span style="color:#fc8181;font-weight:600;">${t('plausSeverityError')}</span>` : 
                      (m.severity === 'warning' ? `⚠️ <span style="color:#f6ad55;font-weight:600;">${t('plausSeverityWarning')}</span>` : 
                      `ℹ️ <span style="color:#63b3ed;">${t('plausSeverityInfo')}</span>`)}
                  </td>
                  <td style="padding: 6px 8px; white-space: nowrap; font-family: monospace;">${t('sheet')} ${escapeSvg(m.pageNumber)}</td>
                  <td style="padding: 6px 8px; font-weight: bold; font-family: monospace; color: #f6e05e;">${escapeSvg(m.bmk || '-')}</td>
                  <td style="padding: 6px 8px;">
                    <div>${escapeSvg(m.message)}</div>
                    <div style="font-size: 10px; color: #a0aec0; margin-top: 2px;">${t('plausColRecommendation')}: ${escapeSvg(m.recommendation)}</div>
                  </td>
                  <td style="padding: 6px 8px; white-space: nowrap;">
                    <button class="btn btn-jump" style="padding: 2px 8px; font-size: 10px;">${t('plausBtnNavigate')} ➔</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Footer -->
        <div style="
          padding: 10px 16px;
          border-top: 1px solid #3e4656;
          background: #1c1f26;
          display: flex;
          justify-content: flex-end;
        ">
          <button id="btnConfirmPlaus" class="btn btn-primary" style="padding: 6px 16px; font-size: 12px;">${t('close')}</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const closeModal = () => modal.remove();
    modal.querySelector('#btnClosePlausModal')?.addEventListener('click', closeModal);
    modal.querySelector('#btnConfirmPlaus')?.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    modal.querySelectorAll('.plaus-row').forEach(row => {
      row.addEventListener('click', (e) => {
        const pageId = (e.currentTarget as HTMLElement).dataset.pageId!;
        const compId = (e.currentTarget as HTMLElement).dataset.compId;
        this.onNavigate(pageId, compId);
        closeModal();
      });
    });
  }

  private runCheck(): PlausibilityMessage[] {return collectPlausibilityMessages(this.project);}
}
