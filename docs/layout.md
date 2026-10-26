# Automatische Schaltplan-Anordnung

Die KI beschreibt Bibliothekselemente, Anschlüsse und Funktionsgruppen. Die Anwendung berechnet die Geometrie: Die KI muss keine vollständigen Schaltungen durch einzelne Koordinatenaufrufe zeichnen.

## Vorschau und Übernahme

Die Layout-Schaltfläche im KI-Fenster und die Werkzeuge `optimize_schematic_layout` und `distribute_sheet_layout` öffnen eine Vorschau. **Vorher zeigen** wechselt zur Ausgangszeichnung. Die Varianten bevorzugen Lesbarkeit, Kompaktheit oder geringe Veränderung. Die Tabelle zeigt Kollisionen, Blattüberschreitungen, Leitungskreuzungen, Knicke und Leitungslängen in Millimetern.

Objekte oder Gruppen lassen sich in der Vorschau fixieren. **Nur aktuelle Auswahl** begrenzt die Bearbeitung auf die Auswahl; zusammengehörige Gruppen werden gemeinsam behandelt. Bilder und freie Texte bleiben außerhalb bewegter Gruppen fest. Importierte grafische Gruppen behalten ihre inneren Abstände und Formen; sie werden als Einheit verschoben. Nach einer Änderung der Fixierungen **Neu berechnen** wählen.

**Übernehmen** ist eine Benutzeraktion und erzeugt einen rückgängig machbaren Schritt. Abbrechen verändert das Projekt nicht. Wurde das Projekt zwischenzeitlich bearbeitet, ist die Vorschau veraltet und muss neu berechnet werden.

Die Prüfung berücksichtigt Symbolkörper, sichtbare Texte, gedrehte Anschlüsse, Gruppen, Hindernisse und den tatsächlichen Zeichenbereich oberhalb des Schriftfeldes. Symbole und Schriftgrößen werden nicht verkleinert. Anschlussgraph und elektrische Eigenschaften bleiben erhalten. Automatische Verbindungen werden bei Übernahme explizite Leitungen, damit eine spätere geometrische Autoconnect-Neuberechnung sie nicht entfernt.

## Fehlgeschlagene Vorschläge

Wenn eine Gruppe nicht platziert werden kann, endet die Platzierungsprüfung an dieser Stelle. Nicht platzierte Entwurfsobjekte werden nicht anschließend als vermeintliche Routing- oder Kollisionsfehler ausgewertet. Die Vorschau zeigt bei einem fehlgeschlagenen Entwurf den unveränderten Blattbestand. **Entwurf exportieren** speichert das vollständige Projekt einschließlich des noch nicht übernommenen Entwurfs, der Layoutoptionen und der Meldungen lokal als JSON für eine reproduzierbare Diagnose.

Die Layout-Engine berechnet Funktionsgruppen getrennt, verwendet für unverbundene Abbruchstellen eine kompakte Anordnung und probiert für serielle Pfade eine Rang-Anordnung. Die Blattpackung nutzt freie Rechtecke und berücksichtigt fixierte Hindernisse. Ein Platzierungsfehler beschreibt eine gescheiterte Variante, keinen mathematischen Beweis, dass die Schaltung grundsätzlich nicht passt.

## KI- und MCP-Werkzeuge

- `duplicate_schematic_page`: exakte zusätzliche Darstellung einer bestehenden Stromlaufplanseite mit neuen Objekt-IDs. Bibliothekssymbole, Anschlüsse, BMK, Beschriftungen, Gruppen, Kabel und Positionen bleiben erhalten. Bestehende Layoutbefunde werden dabei nicht repariert; eine erneute Anordnung ist ein gesonderter Schritt. Dieses Werkzeug ist für „diese Schaltung auf einer neuen Seite nachbauen“ vorgesehen.
- `validate_schematic_layout`: unabhängiger Prüfbericht mit Fehlerarten, Objekt-IDs, Bereichen und Kennzahlen. Keine Änderung der Zeichnung.
- `optimize_schematic_layout`: Kandidaten für `pageId`, optional `lockedIds`, `selectedIds` und explizite Kastenzuordnungen `containers: [{id, members}]`. Eine erfolgreiche Antwort bedeutet eine geprüfte **Vorschau**, keine Übernahme. Nach Zeichenaktionen prüft der Assistent das Layout unabhängig von seiner Modellantwort. Bei Fehlern wird eine optimistische Abschlussmeldung durch den Prüfbericht ersetzt.
- `create_schematic_draft`: vollständiger Entwurf mit `components`, `connections` und optional `groups`. Komponenten enthalten lokale eindeutige IDs und reale `symbolId`-Werte. Verbindungen enthalten `from`/`to` mit `componentId` und `pinId` sowie `potential`. Gruppen verwenden `id`, optional `name` und `members`. Koordinaten sind nicht nötig. Der Entwurf bleibt bis zur Bestätigung außerhalb des Projekts.
- `distribute_sheet_layout`: kompatibler Name für die Vorschau. Frühere feste Spaltenkoordinaten und das sofortige Verschieben werden nicht mehr verwendet.

Bestehende Einzelwerkzeuge behalten Projekt-Zeichnungseinheiten als Koordinatenformat. `get_canvas_state.geometry.unitsPerMm` und `usableAreaMm` geben die Umrechnung und den verfügbaren Bereich an. Symbolbreiten in Zeichnungseinheiten dürfen nicht als Millimeter interpretiert werden.

## Grenzen

Die Optimierung gilt für Stromlaufplanseiten, nicht für Grundrisse, Berichtseiten oder flache Altzeichnungen ohne bearbeitbare Objekte. Bibliothekssymbole müssen vorhanden sein. Individuell skalierte Symbole mit nicht eindeutig skalierter Anschlussgeometrie werden ausdrücklich abgewiesen. Mehrdeutige Kastenzuordnungen, beschädigte Gruppen und fehlende Anschlüsse werden gemeldet.

Es wird kein mathematisch globales Optimum zugesagt. Die Berechnung im Hintergrund wird nach 15 Sekunden abgebrochen. Bei nicht erfüllbaren Bedingungen bleibt das Projekt unverändert; der Bericht schlägt eine Aufteilung anhand vorhandener Gruppen vor, einschließlich geschätzter Blattzuordnungen und der dafür benötigten blattübergreifenden Anschlussverweise. Jede vorgeschlagene Seite muss vor einer Umsetzung separat geprüft werden. Neue Blätter und blattübergreifende Verbindungen werden nicht automatisch erzeugt.

Die Browserprüfung misst Texte mit den verfügbaren Schriften. Kommandozeilenprüfungen ohne DOM verwenden konservative Schätzwerte und kennzeichnen das im Bericht. Schriftverfügbarkeit kann die berechnete Geometrie zwischen Betriebssystemen beeinflussen. Der Validator prüft geometrische und strukturelle Eigenschaften, ersetzt aber keine elektrotechnische Fachprüfung.

ELK dient der Graphanordnung; ein eigener orthogonaler Router berücksichtigt Hindernisse und Anschlussrichtungen. Der Layout-Worker und die Bibliothek werden bei Bedarf geladen. Lizenz und Quellbezug: [elkjs](../public/licenses/elkjs.txt).
