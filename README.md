<p align="center">
  <a href="https://vitals5.github.io/schematico/">
    <img src="public/branding/schematico-banner.png" alt="Schematico Logo" width="620">
  </a>
</p>

<p align="center">
  <strong>Professionelle Stromlaufpläne &amp; Gebäude-Elektroinstallation für Windows und moderne Webbrowser</strong>
</p>

<p align="center">
  <a href="https://github.com/vitals5/schematico/releases/latest"><img src="https://img.shields.io/github/v/release/vitals5/schematico?color=3182ce&label=Release&logo=github" alt="Release Version"></a>
  <a href="https://vitals5.github.io/schematico/"><img src="https://img.shields.io/badge/Web%20App-Live%20Demo-68d391?logo=googlechrome&logoColor=white" alt="Live Web App"></a>
  <a href="https://github.com/vitals5/schematico/actions/workflows/build-windows.yml"><img src="https://img.shields.io/github/actions/workflow/status/vitals5/schematico/build-windows.yml?branch=main&label=Windows%20Build&logo=windows" alt="Windows Build Status"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="MIT License"></a>
  <a href="#unterst%C3%BCtzte-normen--standards"><img src="https://img.shields.io/badge/Standards-DIN%20EN%2081346%20%7C%20IEC%2060617%20%7C%20DIN%20EN%2060617--11-f6ad55" alt="Engineering Standards"></a>
</p>

<p align="center">
  <a href="https://vitals5.github.io/schematico/"><strong>🚀 Web-App im Browser starten</strong></a> •
  <a href="https://github.com/vitals5/schematico/releases/latest"><strong>💾 Windows Download (.exe)</strong></a> •
  <a href="https://vitals5.github.io/schematico/landing.html"><strong>🌐 Interaktive Landingpage</strong></a> •
  <a href="#highlights--features"><strong>✨ Feature-Übersicht</strong></a>
</p>

---

## Über Schematico

**Schematico** ist eine freie, quelloffene CAE- und CAD-Suite für Elektroingenieure, Schaltschrankbauer, Elektromeister und Gebäudeautomatisierer. 

Die Software vereint zwei Arbeitsbereiche in einer gemeinsamen, modernen Benutzeroberfläche:
1. **Industrielle Stromlaufpläne:** Mehrseitige Stromlauf- und Steuerungspläne nach internationalen Normen mit Leitungs-Autoconnect, dynamischen Kontaktspiegeln und Querverweisen.
2. **Architektonische Elektroinstallation:** Maßstabsgetreue Grundrissplanung mit Wänden, Fenstern, Türen, über 66 standardisierten Installationssymbolen und geschwungenen Bogenleitungen (*arcWires*).

### Unterstützte Normen &amp; Standards
- **DIN EN 81346-1 / DIN EN 81346-2:** Strukturierungsprinzipien und Betriebsmittelkennzeichnung (BMK: `=Anlage +Ort -Betriebsmittel:Anschluss`).
- **IEC 60617 / DIN EN 60617:** Grafische Symbole für Schaltpläne (Schaltgeräte, Motoren, Schütze, Transformatoren, Schutzorgane, SPS).
- **DIN EN 60617-11:** Installationsschaltpläne für Gebäude und Haustechnik (Schalter, Steckdosen, Taster, Smart-Home-Sensoren, Verteiler).
- **DIN EN ISO 7200:** Genormte Schriftfelder und zentrale Projektdaten-Synchronisation.

---

## Screenshot-Galerie

<!-- ======================================================================= -->
<!-- SCREENSHOT 1: Haupt-Editor (Industrieller Stromlaufplan)                 -->
<!-- Ersetzen durch: <img src="docs/screenshots/01-schematic-editor.png" ... />-->
<!-- ======================================================================= -->
<div align="center">
  <div style="border: 1px solid #30363d; border-radius: 10px; background: #0d1117; padding: 16px; margin: 20px 0; max-width: 960px;">
    <div style="display: flex; align-items: center; padding-bottom: 10px; margin-bottom: 12px; border-bottom: 1px solid #21262d;">
      <span style="color: #ff5f56; font-size: 13px; margin-right: 6px;">●</span>
      <span style="color: #ffbd2e; font-size: 13px; margin-right: 6px;">●</span>
      <span style="color: #27c93f; font-size: 13px; margin-right: 12px;">●</span>
      <span style="color: #8b949e; font-size: 12px; font-family: monospace;">schematico — stromlaufplan_drehstrom_motor.sch</span>
    </div>
    <div style="border: 2px dashed #30363d; border-radius: 8px; padding: 50px 20px; background: rgba(22, 27, 34, 0.6); text-align: center;">
      <p style="font-size: 32px; margin: 0 0 10px 0;">⚡</p>
      <h3 style="color: #58a6ff; margin: 0 0 8px 0;">Haupt-Editor: Industrieller Stromlaufplan mit Autoconnect &amp; Kontaktspiegeln</h3>
      <p style="color: #8b949e; font-size: 14px; max-width: 640px; margin: 0 auto;">
        Übersichtliche Multi-Page CAD-Arbeitsfläche mit automatischer Leitungsführung, Kontaktspiegeln unter Leistungsschützen (-K1: /2.1, /2.4), Abbruchstellen mit Zielblattverweisen und Klemmenleisten.
      </p>
      <p style="color: #6e7681; font-size: 11px; margin-top: 14px; font-family: monospace;">[ Platzhalter für Screenshot: 01-schematic-editor.png ]</p>
    </div>
  </div>
</div>

---

## Highlights &amp; Features

### 1. Industrielle Stromlaufpläne &amp; Leitungsführung
- **Komponenten-Platzierung &amp; Raster:** Bauteile bewegen, rotieren und platzieren im Standard-8-mm-Raster mit optionaler 4-mm-Halbraster-Auflösung.
- **Direktionale Anschlüsse &amp; Autoconnect:** Bauteil-Pins verfügen über direktionale Anschlussvektoren (`top`, `bottom`, `left`, `right`). Fluchtende Anschlüsse verbinden sich beim Platzieren automatisch. Orthogonale Leitungsführungen errechnen saubere Umfahrungen mit normgerechten Mindestabständen.
- **Knotenpunkte &amp; Brücken:** Automatische T-Knotenpunkte bei Leitungsabzweigen und optische Kreuzungsbrücken zur Vermeidung von Fehlverbindungen.
- **Kabeldefinitionen &amp; Adernfarben:** Zuweisung von Mantelleitungen (z.&nbsp;B. `NYM-J 5x1.5`, `ÖLFLEX 4G2.5`) über Kreuzungslinien hinweg mit individuellen Aderfarben und Schirmdarstellung.
- **Ortskästen (+S1 / +ET1):** Räumliche und funktionale Gruppierung von Betriebsmitteln in Schaltschränke, Vor-Ort-Gehäuse oder Steuerpulte mit anpassbaren Rahmenlinien.

<!-- ======================================================================= -->
<!-- SCREENSHOT 2: Gebäude- und Elektroinstallationsplan                     -->
<!-- Ersetzen durch: <img src="docs/screenshots/02-installation-plan.png" .../>-->
<!-- ======================================================================= -->
<div align="center">
  <div style="border: 1px solid #30363d; border-radius: 10px; background: #0d1117; padding: 16px; margin: 20px 0; max-width: 960px;">
    <div style="display: flex; align-items: center; padding-bottom: 10px; margin-bottom: 12px; border-bottom: 1px solid #21262d;">
      <span style="color: #ff5f56; font-size: 13px; margin-right: 6px;">●</span>
      <span style="color: #ffbd2e; font-size: 13px; margin-right: 6px;">●</span>
      <span style="color: #27c93f; font-size: 13px; margin-right: 12px;">●</span>
      <span style="color: #8b949e; font-size: 12px; font-family: monospace;">schematico — grundriss_erdgeschoss_installation.sch</span>
    </div>
    <div style="border: 2px dashed #30363d; border-radius: 8px; padding: 50px 20px; background: rgba(22, 27, 34, 0.6); text-align: center;">
      <p style="font-size: 32px; margin: 0 0 10px 0;">🏡</p>
      <h3 style="color: #58a6ff; margin: 0 0 8px 0;">Gebäude- &amp; Elektroinstallation nach DIN EN 60617-11</h3>
      <p style="color: #8b949e; font-size: 14px; max-width: 640px; margin: 0 auto;">
        Architektonischer Grundriss mit Wandstärken, Türen mit DIN-Links/Rechts-Anschlag, Fenstern, 3-fach-Steckdosen, Smart-Home-Tastsensoren und geschwungenen Bogenleitungen (arcWires).
      </p>
      <p style="color: #6e7681; font-size: 11px; margin-top: 14px; font-family: monospace;">[ Platzhalter für Screenshot: 02-installation-plan.png ]</p>
    </div>
  </div>
</div>

### 2. Gebäude- &amp; Elektroinstallationspläne (DIN EN 60617-11)
Schematico bietet einen vollwertigen **Installationsplan-Seitentyp** für Wohn-, Gewerbe- und Zweckbauten:
- **Grundriss-Import &amp; 2-Klick-Kalibrierung:** Lade Grundrissskizzen, Baupläne oder Architektenzeichnungen (`PNG`, `JPEG`, `PDF`) auf das Zeichenblatt. Kalibriere den Maßstab sekundenschnell: Klicke zwei Referenzpunkte (z.&nbsp;B. eine Außenwand), gib die reale Distanz in Metern ein oder wähle gängige Architekturmaßstäbe (1:50, 1:75, 1:100 für DIN A3).
- **Verzerrungsfreie Maßstabs-Umskalierung:** Wechsle den Maßstab jederzeit (z.&nbsp;B. von 1:75 auf 1:50). Wände, Öffnungen, Symbole und Bemaßungen passen sich automatisch proportional an.
- **Wände, Türen &amp; Fenster:**
  - **Wände:** Zeichnen mit praxisgerechten Wandstärken (11.5&nbsp;cm, 17.5&nbsp;cm, 24&nbsp;cm, 36.5&nbsp;cm) inklusive orthogonalem Fang und Eck-Verschmelzung.
  - **Türen:** Konfigurierbare Türen mit Wandaussparung, Zargenticks, Türblatt und Öffnungsbogen nach DIN Links / DIN Rechts (`left_in`, `right_in`, `left_out`, `right_out`, Schiebetür).
  - **Fenster:** Zweischeiben-Fensterdarstellung mit Zargenbegrenzung.
  - **Sektionaltore:** Garagentore mit Lamellen und Deckenführungsschienen.
- **Über 66 Installationssymbole nach DIN EN 60617-11:**
  - **Steckdosen:** 1-fach, 2-fach, 3-fach, 4-fach und 5-fach horizontal und vertikal kombiniert. Inklusive IP44 Feuchtraum, schaltbar und USB.
  - **Schalter:** Ausschalter, Wechselschalter, Kreuzschalter, Serienschalter, Taster und Dimmer.
  - **Smart Home &amp; Gebäudeautomation:** Neutrale Bussymbole für 2-fach und 4-fach Tastsensoren, Raumtemperaturregler (RTR mit LCD-Symbol), Touchpanels, 360°-Deckenpräsenzmelder, Bus-UP-Aktoren und Magnet-Fensterkontakte. Kompatibel mit KNX, Loxone, DALI, Modbus u.v.m.
  - **Beleuchtung &amp; Kraft:** Deckenleuchten, Wandleuchten, Downlights, LED-Bänder, Notleuchten, CEE 16A/32A Kraftsteckdosen, Unterverteiler und Zählerschränke.
  - **Telekommunikation &amp; Sicherheit:** Netzwerkdosen (RJ45 Cat.6a/Cat.7), Antennendosen (TV/Radio/SAT), Sprechanlagen, Rauchwarnmelder und Hauptpotentialausgleichsschienen (PAS).
- **Wand-Fang &amp; Mehrfach-Kombinationen:** Installationsgeräte rasten magnetisch an der nächsten Wandoberfläche ein und richten sich automatisch parallel oder rechtwinklig aus.
- **Geschwungene Bogenleitungen (`arcWires`):** Verbinde Schalter, Dosen und Leuchten mit eleganten Bézier-Bögen. Weise Stromkreis (`F1 / W1`), Phase (`L1`, `L2`, `L3`), Kabeltyp und Leitungsfarbe zu.

<!-- ======================================================================= -->
<!-- SCREENSHOT 3: Intelligente Querverweise & Kontaktspiegel                 -->
<!-- Ersetzen durch: <img src="docs/screenshots/03-cross-references.png" .../>-->
<!-- ======================================================================= -->
<div align="center">
  <div style="border: 1px solid #30363d; border-radius: 10px; background: #0d1117; padding: 16px; margin: 20px 0; max-width: 960px;">
    <div style="display: flex; align-items: center; padding-bottom: 10px; margin-bottom: 12px; border-bottom: 1px solid #21262d;">
      <span style="color: #ff5f56; font-size: 13px; margin-right: 6px;">●</span>
      <span style="color: #ffbd2e; font-size: 13px; margin-right: 6px;">●</span>
      <span style="color: #27c93f; font-size: 13px; margin-right: 12px;">●</span>
      <span style="color: #8b949e; font-size: 12px; font-family: monospace;">schematico — querverweise_kontaktspiegel.sch</span>
    </div>
    <div style="border: 2px dashed #30363d; border-radius: 8px; padding: 50px 20px; background: rgba(22, 27, 34, 0.6); text-align: center;">
      <p style="font-size: 32px; margin: 0 0 10px 0;">🔗</p>
      <h3 style="color: #58a6ff; margin: 0 0 8px 0;">Intelligente Querverweise &amp; Kontaktspiegel</h3>
      <p style="color: #8b949e; font-size: 14px; max-width: 640px; margin: 0 auto;">
        Spulen und Kontakte referenzieren sich automatisch sheet-übergreifend. Mit Strg+Klick springt man direkt zum Partner – im PDF-Export als klickbare Vektor-Links integriert.
      </p>
      <p style="color: #6e7681; font-size: 11px; margin-top: 14px; font-family: monospace;">[ Platzhalter für Screenshot: 03-cross-references.png ]</p>
    </div>
  </div>
</div>

### 3. Bidirektionale Querverweise &amp; Navigation
- **Direktsprung per Strg + Klick:** Halte `Strg` gedrückt und klicke auf ein Schaltsymbol (Schützspule, Hilfskontakt, Abbruchstelle oder Installationskomponente), um sofort zum zugehörigen Partner auf einer beliebigen Projektseite zu springen.
- **Inspektor-Schnellnavigation:** Der Eigenschaften-Inspektor listet alle Verweisziele mit bequemen Sprungtasten auf.
- **Interaktive PDF-Hyperlinks:** Im Vektor-PDF-Export sind alle Querverweise als echte PDF-Hyperlinks hinterlegt. Ein Klick im PDF-Viewer (Adobe Acrobat, Chrome, Mac Vorschau) springt direkt auf das Zielblatt.

<!-- ======================================================================= -->
<!-- SCREENSHOT 4: Makro-Browser & Projektverwaltung                         -->
<!-- Ersetzen durch: <img src="docs/screenshots/04-macro-library.png" .../>   -->
<!-- ======================================================================= -->
<div align="center">
  <div style="border: 1px solid #30363d; border-radius: 10px; background: #0d1117; padding: 16px; margin: 20px 0; max-width: 960px;">
    <div style="display: flex; align-items: center; padding-bottom: 10px; margin-bottom: 12px; border-bottom: 1px solid #21262d;">
      <span style="color: #ff5f56; font-size: 13px; margin-right: 6px;">●</span>
      <span style="color: #ffbd2e; font-size: 13px; margin-right: 6px;">●</span>
      <span style="color: #27c93f; font-size: 13px; margin-right: 12px;">●</span>
      <span style="color: #8b949e; font-size: 12px; font-family: monospace;">schematico — makro_bibliothek_browser.sch</span>
    </div>
    <div style="border: 2px dashed #30363d; border-radius: 8px; padding: 50px 20px; background: rgba(22, 27, 34, 0.6); text-align: center;">
      <p style="font-size: 32px; margin: 0 0 10px 0;">📦</p>
      <h3 style="color: #58a6ff; margin: 0 0 8px 0;">High-Capacity Makro-Bibliothek &amp; Bauteilkatalog</h3>
      <p style="color: #8b949e; font-size: 14px; max-width: 640px; margin: 0 auto;">
        Schnelle Vorschau und Platzierung von Fenstermakros (.ema), Seitenmakros (.ems) und 2D-Schaltschrankkonturen (.fp1) aus lokalen Archiven mit über 100.000 Dateien.
      </p>
      <p style="color: #6e7681; font-size: 11px; margin-top: 14px; font-family: monospace;">[ Platzhalter für Screenshot: 04-macro-library.png ]</p>
    </div>
  </div>
</div>

### 4. High-Capacity Makro-Bibliothek (100.000+ Dateien)
- Binde lokale Ordner mit Makro-Beständen ohne Performance-Einbußen an.
- Vorschau, Suchfilter und Platzierung von:
  - Fenstermakros (`.ema`)
  - Seitenmakros (`.ems`)
  - Bauteilpaketen (`.edz`)
  - 2D-Schaltschrank- und Montagekonturen (`.fp1`)
- Parametrisierbare Makro-Variablen vor der Platzierung anpassen.

### 5. Mehrseitige Projektverwaltung &amp; Titelblock-Synchronisation
- Strukturiere Projekte aus Deckblättern, Stromlaufplänen, Installationsplänen und Stücklisten.
- **Automatische Metadaten-Synchronisation:** Projektdaten (Projektname, Kommission, Anlage, Ort, Zeichner, Datum, Revision) synchronisieren sich live über alle genormten Schriftfelder (DIN EN ISO 7200) und Deckblätter (z.&nbsp;B. Standard-Form F01).
- Blatt-Reihenfolge per Pfeiltasten verschieben mit automatischer Neunummerierung.
- Export und Import einzelner Installations- oder Schaltplanseiten als JSON-Datei zur Wiederverwendung.

### 6. Druckreife Vektor-PDF-Exporte &amp; Stücklisten (BOM)
- Erstelle druckreife Vektor-PDFs in DIN A3 und DIN A4 (Quer- oder Hochformat).
- Wahlweise vollfarbig oder kontrastoptimiert monochrom.
- Vollständig verlinkte Querverweise für interaktives Blättern.
- Automatische Stücklisten-Generierung (Bill of Materials) mit Artikelnummern, Herstellerangaben, technischen Daten und Mengensummierung.

### 7. PWA, Tablet- &amp; Touch-Optimierung
- **Offline-fähig &amp; installierbar:** Als Progressive Web App (PWA) direkt auf Tablets (iPad, Android, Surface) installierbar.
- **Gestensteuerung:** Flüssiges Verschieben mit Touch-Gesten, zentriertes Zoomen mit zwei Fingern.
- **Lupen-Vorschau (HUD):** Beim Bewegen von Bauteilen oder Türen/Fenstern blendet sich in der gegenüberliegenden Bildschirmecke automatisch eine vergrößerte Lupe ein.

---

## Vergleich: Schematico vs. Alternativen

| Funktion / Eigenschaft | Schematico | Reine Zeichen-Tools (Visio, Draw.io) | Schwerfällige Enterprise-CAE |
| :--- | :---: | :---: | :---: |
| **Elektro-Logik &amp; Autoconnect** | **✓ Ja** (Direktionale Vektoren) | ✗ Nein (Rein grafische Linien) | ✓ Ja |
| **Kontaktspiegel &amp; Querverweise** | **✓ Ja** (Automatisch &amp; interaktiv) | ✗ Manuell einzutippen | ✓ Ja |
| **Gebäude-Installation (DIN EN 60617-11)** | **✓ Voll integriert** | ▲ Nur unvollständige Stempel | ▲ Teures Zusatzmodul |
| **Bogenleitungen (arcWires)** | **✓ Ja** (Intuitiv &amp; beschriftbar) | ✗ Umständlich | ▲ Eingeschränkt |
| **Makro-Kompatibilität (.ema, .ems)** | **✓ Ja** (100.000+ Dateien) | ✗ Nein | ✓ Ja |
| **Plattformen** | **Windows Desktop &amp; Web (PWA)** | Meist nur Web | Meist nur Windows Desktop |
| **Offline &amp; Datenschutz** | **100% lokal** (Keine Cloud-Pflicht) | ▲ Cloud-Speicherung | 100% lokal |
| **Lizenz &amp; Kosten** | **Kostenlos &amp; Open-Source (MIT)** | Freemium / Monats-Abo | Sehr teure 5-stellige Lizenzen |

---

## Tastatur-Kurzbefehle

| Tastenkombination | Bereich | Funktion |
| :--- | :--- | :--- |
| **Strg + Klick** | Canvas | Direkt zum Querverweis-Partner auf anderer Seite springen |
| **Strg + A** | Canvas | Alle Elemente der aktiven Seite markieren |
| **Strg + G** / **Strg + Umschalt + G** | Canvas | Permanente Gruppe erstellen / Gruppe auflösen |
| **Strg + C** / **Strg + X** / **Strg + V** | Canvas | Kopieren / Ausschneiden / Einfügen |
| **Strg + D** | Canvas | Auswahl duplizieren mit automatischer BMK-Hochzählung |
| **Strg + Z** / **Strg + Y** | Canvas | Schritt zurück (Undo) / Schritt vor (Redo) |
| **Entf** / **Rücktaste** | Canvas | Ausgewählte Bauteile, Leitungen, Wände oder Texte löschen |
| **F2** / **Enter** | Canvas | Eigenschaften-Modal öffnen bzw. Inspektor fokussieren |
| **R** | Canvas | Markiertes Element um 90° im Uhrzeigersinn drehen |
| **D** / **W** | Canvas | In den Leitungszeichnungs-Modus wechseln |
| **Einfg** | Canvas | Symbol-Katalog öffnen |
| **F** | Canvas | Zeichenblatt bildschirmfüllend einpassen (Fit to Screen) |
| **H** | Canvas | Umschalten zwischen Vollraster (8 mm) und Halbraster (4 mm) |
| **Mitteltaste + Ziehen** | Canvas | Zeichenfläche verschieben (Pan) |
| **Mausrad** | Canvas | Stufenlos zoomen relativ zum Mauszeiger |
| **Esc** | Canvas | Aktives Werkzeug abbrechen / Auswahl aufheben |

---

## Unterstützte Dateiformate

### Import
- **Schematico Projekte:** Natives JSON-Format (`.json`).
- **Standard-Archivpakete:** Entpacken von `.zw1`, `.zip` und Split-Archiven (`.001`, `.002`) direkt im Browser über integriertes WebAssembly-7-Zip.
- **Makros &amp; Bauteile:** Fenstermakros (`.ema`), Seitenmakros (`.ems`), Bauteildaten (`.edz`) und 2D-Schaltschrankkonturen (`.fp1`).
- **Grundrisse &amp; Pläne:** Architektonische Vorlagen (`PNG`, `JPEG`, `WebP`, `PDF`).

### Export
- **Druckreifes Vektor-PDF:** Hochauflösende DIN A3/A4 PDFs mit klickbaren Querverweis-Hyperlinks.
- **Natives JSON-Projekt:** Vollständige, verlustfreie Projektdateien inklusive Symbolbibliotheken und Netzen.
- **Stückliste / BOM:** Detaillierte Bauteillisten als Tabellen und PDF-Auswertungen.
- **Makro-Export:** Exportiere markierte Schaltungsteile als `.ema` oder ganze Seiten als `.ems`.

---

## Entwicklung &amp; Build

### Voraussetzungen
- **Node.js 22 oder neuer**
- **npm**

### Schnellstart

```bash
# Repository klonen
git clone https://github.com/vitals5/schematico.git
cd schematico

# Abhängigkeiten installieren
npm ci

# Lokalen Entwicklungsserver mit Hot Reload starten
npm run dev
```

Die Anwendung startet lokal unter `http://localhost:5173`.

### Testen &amp; Kompilieren

```bash
# Umfassende automatisierte Testsuite ausführen
npm test

# Produktions-Webbundle erstellen (Vite + TypeScript)
npm run build

# Lokalen Produktions-Build testen
npm run preview

# Windows-Installer & portable Exe kompilieren
npm run dist:win
```

---

## Desktop-Anwendung (Windows)

Schematico kann als native Windows-Anwendung ausgeführt und kompiliert werden:
- **`Schematico-Setup-<version>.exe`**: Geführter Windows-Installer mit Startmenü- und Desktop-Verknüpfung.
- **`Schematico-<version>.exe`**: Standalone portable Version ohne Administratorrechte ausführbar.

Automatische Releases werden über GitHub Actions bei jedem Tag-Push (`v*`) kompiliert und bereitgestellt.

---

## Lizenz

Schematico ist Open-Source-Software unter der [MIT-Lizenz](LICENSE).  
Die integrierte WebAssembly-7-Zip-Dekomprimierungsbibliothek unterliegt der LGPL (siehe [public/licenses/7zip-wasm.txt](public/licenses/7zip-wasm.txt)).
