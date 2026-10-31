import { version } from '../../package.json';
import { getUiLanguage } from '../i18n';

export class AboutDialog {
  public static show(): void {
    if (document.getElementById('aboutDialog')) return;
    const isEn = getUiLanguage() === 'en';
    const previousFocus = document.activeElement;
    const dialog = document.createElement('dialog');
    dialog.id = 'aboutDialog';
    dialog.className = 'about-dialog modal-backdrop';
    dialog.setAttribute('aria-labelledby', 'about-title');
    dialog.innerHTML = `
      <div class="about-heading">
        <h2 id="about-title">${isEn ? 'About Schematico' : 'Über Schematico'}</h2>
        <button type="button" class="btn" id="about-close" aria-label="${isEn ? 'Close' : 'Schließen'}" autofocus>×</button>
      </div>
      <div class="about-body">
        <img class="about-logo" src="${import.meta.env.BASE_URL}branding/logo-dark.png" alt="Schematico" width="1200" height="361" />
        <p class="about-version">Version ${version} · Windows, Linux &amp; Web</p>
        <p>${isEn ? 'Create and edit electrical schematics.' : 'Stromlaufpläne erstellen und bearbeiten.'}</p>
        <ul>
          <li>${isEn ? 'Symbol library, connections, and cross-references' : 'Elementbibliothek, Verbindungen und Querverweise'}</li>
          <li>${isEn ? 'Groups, device boxes, images, and macros' : 'Gruppen, Gerätekästen, Bilder und Makros'}</li>
          <li>${isEn ? 'Cover sheets, PDF export, terminal diagrams, and bill of materials' : 'Titelseiten, PDF-Export, Klemmenplan und Stückliste'}</li>
        </ul>
        <p class="about-standards">${isEn ? 'Reference designation structured to DIN EN 81346 and symbols according to IEC 60617. Supported project archives, XML, and macro files can be imported as editable objects.' : 'Kennzeichnungsstruktur nach DIN EN 81346 und Schaltzeichen nach IEC 60617. Unterstützte Projektarchive, XML- und Makrodateien lassen sich als bearbeitbare Objekte importieren.'}</p>
      </div>`;
    document.body.appendChild(dialog);
    dialog.querySelector('#about-close')!.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
      const rect = dialog.getBoundingClientRect();
      if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right
        || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
    });
    dialog.addEventListener('close', () => {
      dialog.remove();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    }, { once: true });
    dialog.showModal();
  }
}
