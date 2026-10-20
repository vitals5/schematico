// src/ui/MobileConnectDialog.ts
// Dialog providing instructions and QR codes for testing Schematico on a smartphone

import { t } from '../i18n';

export class MobileConnectDialog {
  public static show(): void {
    const existing = document.getElementById('mobileConnectModal');
    if (existing) existing.remove();

    // Determine current host and URLs
    const currentHost = window.location.hostname || 'localhost';
    const currentPort = window.location.port ? `:${window.location.port}` : '';
    const currentProtocol = window.location.protocol || 'http:';
    const localUrl = `${currentProtocol}//${currentHost}${currentPort}/`;
    const githubPagesUrl = 'https://vitals5.github.io/schematico/';

    // Target URL for mobile testing
    const targetUrl = (window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')
      ? localUrl
      : githubPagesUrl;

    // QR code API with SVG/PNG
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(targetUrl)}`;

    const modal = document.createElement('div');
    modal.id = 'mobileConnectModal';
    modal.className = 'modal-backdrop';
    modal.style.position = 'fixed';
    modal.style.inset = '0';
    modal.style.backgroundColor = 'rgba(0,0,0,0.75)';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.zIndex = '2000';
    modal.style.padding = '16px';

    modal.innerHTML = `
      <div class="modal-card" style="
        background: #1a202c;
        border: 1px solid #3e4c63;
        border-radius: 8px;
        width: 100%;
        max-width: 520px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.6);
        color: #edf2f7;
        font-family: inherit;
        overflow: hidden;
      ">
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; border-bottom: 1px solid #2d3748; background: #1f2737;">
          <div style="display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 15px;">
            <span>📱</span> ${t('mobileTitle')}
          </div>
          <button id="btnCloseMobileModal" style="background: none; border: none; color: #a0aec0; font-size: 20px; cursor: pointer; line-height: 1;">&times;</button>
        </div>

        <div style="padding: 18px; max-height: 80vh; overflow-y: auto;">
          <p style="font-size: 13px; line-height: 1.5; color: #cbd5e0; margin-bottom: 14px;">
            ${t('mobileDesc')}
          </p>

          <!-- QR Code Section -->
          <div style="display: flex; flex-direction: column; align-items: center; background: #12161f; border: 1px solid #2d3748; border-radius: 6px; padding: 14px; margin-bottom: 16px;">
            <div style="background: white; padding: 8px; border-radius: 6px; margin-bottom: 10px;">
              <img src="${qrUrl}" alt="QR Code" style="width: 170px; height: 170px; display: block;" onerror="this.style.display='none'; document.getElementById('qrFallback').style.display='block';" />
              <div id="qrFallback" style="display: none; width: 170px; height: 170px; color: #1a202c; font-size: 11px; text-align: center; padding-top: 50px;">
                ${t('mobileQrFallback')}
              </div>
            </div>
            <div style="font-size: 11px; color: #a0aec0; text-align: center;">
              ${t('mobileQrScan')}
            </div>
          </div>

          <!-- Connection Options -->
          <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px;">
            <div style="background: #141a24; border: 1px solid #2d3748; border-radius: 6px; padding: 10px 12px;">
              <div style="font-size: 11px; font-weight: 600; color: #63b3ed; margin-bottom: 4px;">${t('mobileOptGithub')}</div>
              <div style="font-size: 12px; font-family: monospace; color: #edf2f7; word-break: break-all;">
                <a href="${githubPagesUrl}" target="_blank" style="color: #63b3ed; text-decoration: underline;">${githubPagesUrl}</a>
              </div>
            </div>

            <div style="background: #141a24; border: 1px solid #2d3748; border-radius: 6px; padding: 10px 12px;">
              <div style="font-size: 11px; font-weight: 600; color: #68d391; margin-bottom: 4px;">${t('mobileOptLocal')}</div>
              <div style="font-size: 12px; font-family: monospace; color: #edf2f7; word-break: break-all;">
                <code>${localUrl}</code>
              </div>
              <div style="font-size: 10px; color: #a0aec0; margin-top: 4px;">
                ${t('mobileSameWifi')}
              </div>
            </div>
          </div>

          <!-- Mobile Features -->
          <div style="border-top: 1px solid #2d3748; padding-top: 12px;">
            <div style="font-size: 12px; font-weight: 600; margin-bottom: 8px; color: #edf2f7;">${t('mobileGesturesHeading')}</div>
            <ul style="font-size: 11px; color: #cbd5e0; line-height: 1.6; padding-left: 18px; margin: 0;">
              <li>${t('mobileGesturePinch')}</li>
              <li>${t('mobileGesturePan')}</li>
              <li>${t('mobileGesturePlace')}</li>
              <li>${t('mobileGestureMove')}</li>
              <li>${t('mobileGestureFit')}</li>
              <li>${t('mobileGestureInstall')}</li>
            </ul>
          </div>
        </div>

        <div style="padding: 12px 18px; border-top: 1px solid #2d3748; background: #1f2737; display: flex; justify-content: flex-end;">
          <button id="btnConfirmMobileModal" class="btn btn-primary" style="padding: 6px 14px; font-size: 12px;">${t('close')}</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const closeModal = () => modal.remove();
    document.getElementById('btnCloseMobileModal')?.addEventListener('click', closeModal);
    document.getElementById('btnConfirmMobileModal')?.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }
}
