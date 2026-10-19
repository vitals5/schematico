import { escapeSvg } from '../model/ImportedDrawing';

const paths:Record<string,string>={
  bolt:'m13 2-9 12h7l-1 8 10-12h-7z',
  open:'M3 7h6l2 2h10l-3 11H3z M3 7V4h6l2 3h8v2',
  save:'M4 3h13l4 4v14H3V3z M7 3v6h10V3 M7 21v-8h10v8',
  undo:'M9 5 4 10l5 5 M4 10h10a6 6 0 0 1 0 12',
  redo:'m15 5 5 5-5 5 M20 10h-10a6 6 0 0 0 0 12',
  select:'m5 3 14 10-7 1-3 7z',
  wire:'M4 4v8h16v8 M2 2h4v4H2z M18 18h4v4h-4z',
  add:'M12 4v16 M4 12h16',
  chevron:'m7 10 5 5 5-5',
  rotate:'M4 10a8 8 0 1 1 2 9 M4 4v6h6',
  cut:'M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M8.12 8.12 20 20 M14.47 14.48 20 4 M8.12 15.88 12 12',
  copy:'M8 8h13v13H8z M16 8V3H3v13h5',
  paste:'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2 M9 2h6v4H9z',
  duplicate:'M9 9h11v11H9z M15 9V4H4v11h5',
  trash:'M3 6h18 M9 6V3h6v3 M6 6l1 15h10l1-15 M10 10v7 M14 10v7',
  fit:'M9 3H3v6 M15 3h6v6 M21 15v6h-6 M9 21H3v-6 M8 8h8v8H8z',
  grid:'M4 4h16v16H4z M4 12h16 M12 4v16',
  pdf:'M6 2h8l4 4v6 M14 2v5h5 M6 11V2 M5 21v-6h3a2 2 0 0 1 0 4H5 M12 15v6h1a3 3 0 0 0 0-6z M18 21v-6h4 M18 18h3',
  left:'M3 4h18v16H3z M9 4v16',
  right:'M3 4h18v16H3z M15 4v16',
  menu:'M4 6h16 M4 12h16 M4 18h16'
};
export const headerIcon=(name:string)=>`<svg class="header-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[name]??paths.add}"/></svg>`;
const opt=(id:string,label:string,key='',extra='')=>`<button type="button" class="menu-opt" id="${id}" ${extra}><span>${label}</span>${key?`<span class="opt-key">${key}</span>`:''}</button>`;
const heading=(text:string)=>`<div class="menu-section-label">${text}</div>`;
const separator='<div class="menu-sep" role="separator"></div>';
const menu=(id:string,label:string,content:string,classes='')=>`<div class="header-menu ${classes}" data-header-menu><button type="button" class="menu-trigger" id="${id}" aria-expanded="false" aria-controls="${id}Popup">${label}</button><div class="menu-dropdown" id="${id}Popup" aria-labelledby="${id}">${content}</div></div>`;
const tool=(id:string,label:string,icon:string,text='',classes='')=>`<button type="button" class="btn ${classes}" id="${id}" title="${label}" aria-label="${label}">${headerIcon(icon)}${text?`<span class="tool-label">${text}</span>`:''}</button>`;
const proxy=(id:string,label:string,key='')=>`<button type="button" class="menu-opt" data-header-command="${id}"><span>${label}</span>${key?`<span class="opt-key">${key}</span>`:''}</button>`;

export function renderAppHeader(projectName:string):string {
  return `<div class="app-chrome">
    <nav class="ecad-menubar" id="ecadMenubar" aria-label="Hauptmenü">
      <div class="brand-logo"><img class="brand-icon" src="${import.meta.env.BASE_URL}branding/icon-64.png" width="28" height="28" alt="" draggable="false" />Schematico</div>
      <button type="button" class="menu-trigger compact-menu-toggle" id="btnCompactMenu" aria-expanded="false" aria-controls="mainMenuList">${headerIcon('menu')} Menü</button>
      <div class="main-menu-list" id="mainMenuList">
        ${menu('menuProjectTrigger','Projekt',
          opt('menuNew','Neues Projekt…')+opt('menuOpen','Projekt öffnen…')+opt('menuSave','Speichern','Strg+S')+
          separator+heading('Export')+opt('menuExportPdf','PDF exportieren…','Strg+P')+opt('menuExportZw1','Projektarchiv (.zw1)…')+opt('menuExportXml','Projekt-XML…')+opt('menuExportPageMacro','Seite als Makro (.ems)…')+opt('menuPrint','Drucken…')+
          separator+opt('menuSettings','Einstellungen…'),'menu-item')}
        ${menu('menuEditTrigger','Bearbeiten',
          opt('menuUndo','Rückgängig','Strg+Z')+opt('menuRedo','Wiederholen','Strg+Y')+separator+
          opt('menuCut','Ausschneiden','Strg+X')+opt('menuCopy','Kopieren','Strg+C')+opt('menuPaste','Einfügen','Strg+V')+opt('menuDuplicate','Duplizieren','Strg+D')+separator+
          opt('menuRotate','Um 90° drehen','R')+opt('menuDelete','Löschen','Entf')+separator+
          opt('menuGroup','Gruppieren','Strg+G')+opt('menuUngroup','Gruppierung auflösen','Strg+Umschalt+G'),'menu-item')}
        ${menu('menuInsertTrigger','Einfügen',
          opt('menuInsertSym','Element…','Einfg')+opt('menuInsertConnections','Verbindungselement…')+opt('menuWire','Verbindungslinie','D')+opt('menuInsertCable','Kabelbeschriftung…')+opt('menuInsertBox','Gerätekasten zeichnen')+opt('menuInsertImage','Bilddatei…')+separator+
          heading('Makros')+opt('menuInsertMacro','Fenstermakro (.ema)…')+opt('menuInsertPageMacro','Makro platzieren (.ems)…')+separator+
          heading('Seiten')+opt('menuNewPage','Neue Seite…')+opt('menuNewCoverPage','Titelblatt…'),'menu-item')}
        ${menu('menuViewTrigger','Ansicht',
          opt('menuFit','Ganzes Blatt','F')+opt('menuZoom100','Originalgröße (100 %)')+opt('menuZoomIn','Vergrößern')+opt('menuZoomOut','Verkleinern')+separator+
          heading('Rasterfang')+opt('menuGridFull','Vollraster','Alt+1')+opt('menuGridHalf','Halbraster','H / Alt+2')+opt('menuGridFine','Feinraster','Alt+3')+opt('menuGridOff','Rasterfang aus','Alt+0')+separator+
          opt('menuToggleAutoconnect','Automatisch verbinden','', 'aria-pressed="true"')+separator+
          opt('menuToggleLeftPanel','Seiten & Bibliothek')+opt('menuToggleRightPanel','Eigenschaften'),'menu-item')}
        ${menu('menuDataTrigger','Auswerten',
          opt('menuPlausibility','Projekt prüfen…')+opt('menuRecalcCrossRef','Querverweise aktualisieren')+separator+
          opt('menuShowTerminals','Klemmenplan anzeigen')+opt('menuShowBom','Artikelstückliste anzeigen'),'menu-item')}
        ${menu('menuHelpTrigger','Hilfe',opt('menuShortcuts','Tastenkürzel…')+opt('menuMobile','Auf dem Smartphone öffnen…')+separator+opt('menuAbout','Über Schematico'),'menu-item')}
      </div>
      <span id="headerProjectName" class="header-project-name" title="${escapeSvg(projectName)}">${escapeSvg(projectName)}</span>
    </nav>
    <header class="app-header" aria-label="Werkzeugleiste">
      <div class="toolbar" role="toolbar" aria-label="Zeichnen und bearbeiten">
        <div class="toolbar-group panel-tools" role="group" aria-label="Seiten">${tool('btnToggleLeftSidebar','Seiten & Bibliothek ein-/ausblenden','left')}</div>
        <div class="toolbar-group file-tools" role="group" aria-label="Projekt">
          ${tool('btnOpenProject','Projekt öffnen','open')}${tool('btnSaveJson','Projekt speichern (Strg+S)','save')}
        </div>
        <div class="toolbar-group history-tools" role="group" aria-label="Verlauf">${tool('btnUndo','Rückgängig (Strg+Z)','undo')}${tool('btnRedo','Wiederholen (Strg+Y)','redo')}</div>
        <div class="toolbar-group draw-tools" role="group" aria-label="Zeichnen">
          ${tool('btnToolSelect','Auswählen','select','','active')}${tool('btnToolWire','Verbindungslinie zeichnen (D)','wire','Verdrahten')}
          <div class="insert-split">
            ${tool('btnOpenSymbolSelection','Element auswählen (Einfg)','add','Element','btn-primary')}
            ${menu('btnMoreInsert',`${headerIcon('chevron')}<span class="sr-only">Weitere Objekte einfügen</span>`,
              opt('btnOpenConnections','Verbindungselement…')+opt('btnDeviceBox','Gerätekasten zeichnen')+opt('btnCableDefinition','Kabelbeschriftung…')+opt('btnAddImage','Bilddatei…')+separator+
              proxy('menuInsertMacro','Fenstermakro (.ema)…')+proxy('menuInsertPageMacro','Makro platzieren (.ems)…'),'insert-menu')}
          </div>
        </div>
        <div class="toolbar-group selection-tools" role="group" aria-label="Auswahl bearbeiten">
          ${tool('btnToolRotate','Um 90° drehen (R)','rotate')}${tool('btnToolCopy','Kopieren (Strg+C)','copy')}${tool('btnToolPaste','Einfügen (Strg+V)','paste')}${tool('btnToolDuplicate','Duplizieren (Strg+D)','duplicate')}${tool('btnToolDelete','Löschen (Entf)','trash')}
        </div>
        <div class="toolbar-group view-tools" role="group" aria-label="Ansicht und Fang">
          ${tool('btnZoomFit','Ganzes Blatt (F)','fit')}
          ${menu('btnDrawingOptions',`${headerIcon('grid')}<span class="grid-label" id="headerGridLabel">Raster</span>${headerIcon('chevron')}`,
            heading('Rasterfang')+proxy('menuGridFull','Vollraster','Alt+1')+proxy('menuGridHalf','Halbraster','H / Alt+2')+proxy('menuGridFine','Feinraster','Alt+3')+proxy('menuGridOff','Rasterfang aus','Alt+0')+separator+
            proxy('menuToggleAutoconnect','Automatisch verbinden'),'drawing-options')}
        </div>
        <div class="toolbar-group output-tools" role="group" aria-label="Ausgabe">${tool('btnExportPdf','PDF exportieren (Strg+P)','pdf','PDF')}</div>
        <div class="toolbar-group inspector-tools" role="group" aria-label="Eigenschaften">${tool('btnToggleRightSidebar','Eigenschaften ein-/ausblenden','right')}</div>
      </div>
    </header>
    <input type="file" id="menuFileInput" accept=".zw1,.zip,.edz,.xml,.json,.elk,.001,.002,.003" multiple hidden>
    <input type="file" id="fileInput" accept=".zw1,.zip,.edz,.xml,.json,.elk,.001,.002,.003" multiple hidden>
    <input type="file" id="imageFileInput" accept="image/*,.svg,.bmp" hidden>
  </div>`;
}

/** One popup at a time, positioned within the viewport, with mouse/touch and
 * keyboard access. Dropdowns stay usable even on a short landscape screen. */
export function bindAppHeaderMenus():{close:()=>void} {
  const chrome=document.querySelector<HTMLElement>('.app-chrome')!;
  const menus=[...chrome.querySelectorAll<HTMLElement>('[data-header-menu]')];
  const compact=document.getElementById('btnCompactMenu')!;
  const trigger=(m:HTMLElement)=>m.querySelector<HTMLButtonElement>(':scope > .menu-trigger')!;
  const popup=(m:HTMLElement)=>m.querySelector<HTMLElement>(':scope > .menu-dropdown')!;
  const options=(m:HTMLElement)=>[...popup(m).querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
  let opened:HTMLElement|undefined;
  const closePopups=()=>{for(const m of menus){m.classList.remove('open');trigger(m).setAttribute('aria-expanded','false');}opened=undefined;};
  const focusReturn=()=>opened?.classList.contains('menu-item')&&chrome.classList.contains('compact-menu-open')?compact:opened?trigger(opened):compact;
  const close=()=>{const restore=opened&&popup(opened).contains(document.activeElement)?focusReturn():undefined;closePopups();chrome.classList.remove('compact-menu-open');compact.setAttribute('aria-expanded','false');restore?.focus();};
  const position=(m:HTMLElement)=>{
    const rect=trigger(m).getBoundingClientRect(),panel=popup(m),width=Math.min(320,window.innerWidth-16);
    panel.style.width=`${width}px`;panel.style.left=`${Math.max(8,Math.min(rect.left,window.innerWidth-width-8))}px`;
    panel.style.top=`${rect.bottom+4}px`;panel.style.maxHeight=`${Math.max(100,window.innerHeight-rect.bottom-12)}px`;
  };
  const open=(m:HTMLElement,focus=false,last=false)=>{if(!m.classList.contains('menu-item')){chrome.classList.remove('compact-menu-open');compact.setAttribute('aria-expanded','false');}closePopups();opened=m;m.classList.add('open');trigger(m).setAttribute('aria-expanded','true');position(m);if(focus){const all=options(m);(last?all.at(-1):all[0])?.focus();}};
  for(const m of menus){
    trigger(m).addEventListener('click',()=>{if(opened===m)closePopups();else open(m);});
    trigger(m).addEventListener('keydown',e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();e.stopPropagation();open(m,true,e.key==='ArrowUp');}});
    trigger(m).addEventListener('mouseenter',()=>{if(opened&&m.classList.contains('menu-item')&&opened.classList.contains('menu-item'))open(m);});
  }
  compact.addEventListener('click',()=>{const next=!chrome.classList.contains('compact-menu-open');close();chrome.classList.toggle('compact-menu-open',next);compact.setAttribute('aria-expanded',String(next));});
  chrome.addEventListener('click',event=>{
    const element=event.target as Element,command=element.closest<HTMLElement>('[data-header-command]');
    if(command){close();document.getElementById(command.dataset.headerCommand!)?.click();}
    else if(element.closest('.menu-opt'))close();
  });
  document.addEventListener('pointerdown',event=>{if(!chrome.contains(event.target as Node))close();});
  chrome.addEventListener('focusout',event=>{if(event.relatedTarget&&!chrome.contains(event.relatedTarget as Node))close();});
  chrome.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&(opened||chrome.classList.contains('compact-menu-open'))){const active=focusReturn();close();active.focus();event.preventDefault();event.stopPropagation();return;}
    if(!opened)return;
    const all=options(opened),at=all.indexOf(document.activeElement as HTMLButtonElement);
    if(at>=0&&['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
      event.preventDefault();const index=event.key==='Home'?0:event.key==='End'?all.length-1:(at+(event.key==='ArrowDown'?1:-1)+all.length)%all.length;all[index]?.focus();
    }else if(['ArrowLeft','ArrowRight'].includes(event.key)&&opened.classList.contains('menu-item')){
      event.preventDefault();const top=menus.filter(m=>m.classList.contains('menu-item')),i=top.indexOf(opened);open(top[(i+(event.key==='ArrowRight'?1:-1)+top.length)%top.length],true);
    }
    // Menu navigation (including Tab) must not rotate or edit the selected drawing.
    if(event.defaultPrevented||!event.ctrlKey&&!event.metaKey)event.stopPropagation();
  });
  window.addEventListener('resize',close);
  return {close};
}
