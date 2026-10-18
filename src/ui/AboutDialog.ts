import { version } from '../../package.json';

export class AboutDialog {
  public static show(): void {
    if (document.getElementById('aboutDialog')) return;
    const previousFocus = document.activeElement;
    const dialog = document.createElement('dialog');
    dialog.id = 'aboutDialog';
    dialog.className = 'about-dialog modal-backdrop';
    dialog.setAttribute('aria-labelledby', 'about-title');
    dialog.innerHTML = `
      <div class="about-heading">
        <h2 id="about-title">Über Schematico</h2>
        <button type="button" class="btn" id="about-close" aria-label="Schließen" autofocus>×</button>
      </div>
      <div class="about-body">
        <img class="about-logo" src="${import.meta.env.BASE_URL}branding/logo-dark.png" alt="Schematico" width="1200" height="361" />
        <p class="about-version">Version ${version} · Windows &amp; Web</p>
        <p>Stromlaufpläne erstellen und bearbeiten.</p>
        <ul>
          <li>Elementbibliothek, Verbindungen und Querverweise</li>
          <li>Gruppen, Gerätekästen, Bilder und Makros</li>
          <li>Titelseiten, PDF-Export, Klemmenplan und Stückliste</li>
        </ul>
        <p class="about-standards">Kennzeichnungsstruktur nach DIN EN 81346 und Schaltzeichen nach IEC 60617. Unterstützte Projektarchive, XML- und Makrodateien lassen sich als bearbeitbare Objekte importieren.</p>
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
