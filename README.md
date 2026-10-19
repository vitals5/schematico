<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/branding/logo-dark.png">
    <img src="public/branding/logo.png" alt="Schematico" width="640">
  </picture>
</p>

# Schematico

Schematico ist ein Editor für Stromlaufpläne für **Windows und den Browser**. Projekte bestehen aus bearbeitbaren Bibliothekselementen, Verbindungen, Texten, Grafiken und Seitenformularen. Kennzeichnungsstruktur, Symbole und Schriftfelder orientieren sich an DIN EN 81346, IEC 60617 und DIN EN ISO 7200.

[Web-App öffnen](https://vitals5.github.io/schematico/) · [Windows-Downloads](https://github.com/vitals5/schematico/releases/latest) · [Windows-Builds](https://github.com/vitals5/schematico/actions/workflows/build-windows.yml)

Dieses Repository startet mit einem eigenständigen ersten Commit des aktuellen Schematico-Dateistands. Frühere Git-Historie und private Referenzarchive sind nicht enthalten.

## Funktionen

- **Zeichnen und verbinden:** Bibliothekselemente platzieren, verschieben und drehen; richtungsabhängige Anschlüsse, Rasterfang, Verbindungslinien, Knoten und automatisches Verbinden.
- **Bibliothek:** Generische Vorlagen für Schutzgeräte, Schaltgeräte, Klemmen, Versorgung und Messung, Sensorik, Automation, Antriebe, Installation und Schrankbau. Importierte Projekte verwenden ihre mitgelieferten Symboldefinitionen.
- **Beschriftungen:** BMK, Funktionstext, Gerätebezeichnung, technische Daten und Gravur; getrennte Positionen, Schriftgrößen, Ausrichtung, Textwinkel und Sichtbarkeit. Neue automatische Beschriftungen stehen links und rechtsbündig.
- **Auswahl und Gruppen:** Mit dem Mausrahmen mehrere Objekte auswählen und gemeinsam verschieben. Gemeinsame Eigenschaften bearbeiten, dauerhafte und verschachtelte Gruppen bilden oder auflösen. Gespeicherte native Gruppenzuordnungen werden für unterstützte Objekte importiert.
- **Gerätekästen und Bilder:** Gerätekästen als normale Elemente bearbeiten; variable Maße und Linienarten. Eigene Bilddateien einfügen, verschieben, skalieren und löschen.
- **Seiten und Titelseiten:** Bearbeitbare Projekt- und Kundendaten, Logos, Normblätter und Schriftfelder; importierte unterstützte Formulare bleiben erhalten.
- **Querverweise:** Gegenstellen im Editor anklicken und anspringen. Verweise und Kontaktspiegel aus den Projektobjekten berechnen.
- **Rückgängig/Wiederholen:** Änderungen an Objekten, Verdrahtung, Eigenschaften und Seiten innerhalb der Sitzung zurücknehmen oder wiederholen.
- **Makros:** `.ema`, `.ems`, Seitenmakros `.emp` und Konturen `.fp1` aus einer eigenen Ordnerbibliothek suchen, in der Vorschau betrachten und als Objekte auf der aktuellen Seite platzieren. Variablen vor dem Einfügen konfigurieren; Seitenmakros auch als neue Seiten hinzufügen. Eingebettete Bilder und gespeicherte 2D-Ansichten übernehmen. Eigene Makros erhalten Bibliothek, Beschriftungen, Verbindungen und Gruppen.
- **Auswertungen und PDF:** Projektprüfung, Klemmenplan und Artikelstückliste. Vektor-PDF in A3/A4 mit Farbe oder Schwarz-Weiß, anklickbaren Verweisen und optionalen Auswertungsseiten. Lange Stücklistentexte werden umgebrochen.
- **Touch-Bedienung:** Verschieben und Platzieren per Touch, Zoomen mit zwei Fingern und einklappbare Seitenleisten.

## Bedienung

Die obere Menüzeile enthält **Projekt**, **Bearbeiten**, **Einfügen**, **Ansicht**, **Auswerten** und **Hilfe**. Darunter stehen die häufigen Aktionen in einer kompakten Werkzeugleiste.

**Element** öffnet direkt die Bibliothek; der **Pfeil daneben** bietet Verbindungselemente, Gerätekästen, Kabelbeschriftungen, Bilder und Makros. Im **Rastermenü** werden Rasterfang und automatisches Verbinden eingestellt. Auf kleinen Bildschirmen bündelt **Menü** die Hauptmenüs.

| Aktion | Bedienung |
| --- | --- |
| Mehrfachauswahl | Mausrahmen; Strg-/Umschalt-Klick ergänzt die Auswahl |
| Alles auswählen | Strg+A |
| Gruppieren / äußere Gruppe auflösen | Strg+G / Strg+Umschalt+G |
| Rückgängig / Wiederholen | Strg+Z / Strg+Y oder Strg+Umschalt+Z |
| Eigenschaften | F2, Enter oder Doppelklick |
| Elementauswahl / Verdrahten | Einfg / D oder W |
| Drehen / Duplizieren / Löschen | R / Strg+D / Entf |
| Ganzes Blatt / Ansicht verschieben | F / Pfeiltasten |
| Rasterstufe | Alt+1, Alt+2, Alt+3, Alt+0; H schaltet Halb-/Vollraster um |
| Laufende Aktion abbrechen | Esc |

In Textfeldern bleibt die normale Textbearbeitung aktiv.

Weitere Anleitungen: [Menüs](docs/menues.md), [Gruppen](docs/gruppierung.md), [Gerätekästen](docs/geraetekaesten.md), [Elementbibliothek](docs/elementbibliothek.md), [Makrobibliothek](docs/makrobibliothek.md).

Logos, App-Icons und Hinweise zur Verwendung: [Branding](docs/branding/README.md).

## Dateiformate und Grenzen

Unter **Projekt → Projekt öffnen** lassen sich eigene JSON-Projekte, eigene Projekt-XML-Dateien und unterstützte Projektarchive (`.zw1`, `.zip`, zusammengehörige `.001`/`.002`-Teile) öffnen. Zusammengehörige Archivteile gemeinsam auswählen. `.edz` sowie `.ema`/`.ems`/`.emp`/`.fp1` werden für unterstützte Paket- und Makrostrukturen gelesen.

Die Erweiterung allein garantiert keine Importierbarkeit. Der native Import unterstützt die untersuchten Datenbanklayouts, Bibliotheken und XML-Objekttypen. Unbekannte Varianten und unauflösbare Daten werden gemeldet.

**Speichern** erzeugt ein eigenes bearbeitbares JSON-Projekt. Eigene XML-, Archiv- und Makroexporte erhalten die unterstützten Projektdaten; ein Rückschreiben fremder proprietärer Datenbanken wird nicht zugesagt. Ältere eigene Speicherstände und Makros werden beim Öffnen auf neutrale interne Kennungen migriert.

## Entwicklung

Voraussetzungen: **Node.js 22 oder neuer** und npm.

```bash
npm ci
npm run dev
```

Die Vorschau läuft unter `http://localhost:5173`. Für einen Test im lokalen Netzwerk die IP-Adresse des Entwicklungsrechners verwenden. **Hilfe → Auf dem Smartphone öffnen** zeigt die Verbindungsinformationen.

```bash
npm test          # Automatische Tests ohne private Projektarchive
npm run build    # Namensprüfung, TypeScript und Web-Build nach dist/
npm run preview  # Produktionsbuild lokal anzeigen
npm run check:branding  # Neutrale Produktverweise und Archivablage prüfen
```

Die Tests decken unter anderem Verlauf, Auswahl/Gruppen, Bibliotheken, Beschriftungen, Verdrahtung, Formulare, Makros, Dateiformate und PDF ab. Einige zusätzliche Regressionen benötigen eine vom Entwickler bereitgestellte private Quelldatei; ohne diese Daten werden nur diese Archivprüfungen ausdrücklich übersprungen.

Private Beispielprojekte und vollständige Quellarchive sind **nicht Bestandteil dieses Repositorys**. Für die ergänzenden Regressionen das erste Teilarchiv oder eine vollständige ZIP-Datei außerhalb des Repositorys bereitstellen:

```bash
SCHEMATICO_NATIVE_FIXTURE=/pfad/zu/house.zip.001 npm run test:native
```

Die historischen Archivregressionen erwarten das ursprünglich untersuchte Referenzprojekt. Für andere Projekte sind passende eigene Erwartungen erforderlich. Normale Tests und Builds benötigen dieses Referenzprojekt nicht.

## Windows und Veröffentlichung

```bash
npm run electron:dev   # Desktop mit Entwicklungsserver
npm run dist:win       # Windows-Installer und portable EXE
```

Für den Windows-Build wird ein Windows-System empfohlen. Die Ausgaben liegen in `release/` und tragen den Namen **Schematico**. Die GitHub-Actions-Workflows veröffentlichen bei Pushes auf `main` die Web-App und erstellen den Windows-Installer samt portabler EXE. Die EXE-Dateien stehen als Workflow-Artefakt **Schematico-Windows-x64** bereit; Versions-Tags `v*` können zusätzlich ein Release erzeugen.

## Lizenz

Die Paketmetadaten deklarieren MIT. Private Benutzerprojekte und externe Quelldateien werden nicht mitgeliefert und sind davon getrennt.
