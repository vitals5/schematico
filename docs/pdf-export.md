# PDF-Projektdokumentation

Die Schaltfläche **PDF** beziehungsweise **Projekt → PDF-Export** erstellt eine gemeinsame Vektordatei aus dem Projektstand beim Öffnen des Dialogs. Änderungen in anderen Werkzeugfenstern müssen vorher **übernommen** sein. Der Export verändert weder das Projekt noch Leitungen, Gerätezuordnungen oder Artikelmengen.

## Inhalte auswählen

- **Zeichnungsseiten:** alle Seiten oder nur die aktive Seite. Zeichnungsrahmen, Schriftfelder, Deckblätter, Bibliothekssymbole, Beschriftungen, Querverweise, Autoconnect und manuelle Leitungen, Gerätekästen, Kabeldefinitionen, Texte, eingebettete Bilder und Grundrisse verwenden die bestehenden Zeichnungsrenderer.
- **Schaltschrankaufbauten:** jede gespeicherte Montageplatte ist einzeln auswählbar. Platte, Tragschienen, Kanäle, Projektgeräte und Standardbauteile werden mit ihren gespeicherten Millimetermaßen und Drehungen gezeichnet. Die generischen Frontansichten stammen aus demselben Vektormodell wie im Designer und im Einzel-PDF. Aktuelle Bezeichnungen zugeordneter Projektgeräte werden aufgelöst. Körperdarstellungen bleiben mechanische Geometrie und erzeugen keine zusätzlichen Stücklistenartikel.
- **Fertigungsberichte:** Grundvorlagen und gespeicherte eigene Vorlagen für Klemmen, Kabel/Adern, Stecker/Kontakte und Verdrahtung sind einzeln auswählbar. Sichtbare Spalten, Überschriften, Reihenfolge, Breitengewichte, Schriftgröße, Sortierung, Papier und Ausrichtung der jeweiligen Vorlage bleiben erhalten. Vorschau, Einzel-PDF und gemeinsames PDF verwenden dasselbe gemessene Tabellenlayout einschließlich Zeilenumbrüchen und Fortsetzungen langer Zeilen.
- **SPS, Bus und Gebäudeautomation:** eine vollständige tabellarische Übersicht erfasst CPUs, Baugruppen, I/O-Kanäle und deren Anschlüsse/Reserven, Busknoten, dokumentierte Segmente, KNX-Gruppen und Kommunikationsobjekte sowie Loxone-Schnittstellen und -Zuordnungen. Vorhandene Längen und ungeklärte Angaben werden aus dem Projektdatendienst übernommen; es werden keine Hardwareparameter, Funkwege oder Leitungsstrecken erfunden.
- **Stückliste:** der gemeinsame Artikeldienst berücksichtigt weiterhin bestätigte Geräteidentitäten, Artikelvarianten, Mengen und Zubehör. Der bisherige klassische Klemmenplan ist zusätzlich wählbar und standardmäßig ausgeschaltet, damit der neue Klemmenbericht nicht automatisch doppelt angehängt wird.

**Alle auswählen / Keine** betrifft die projektweiten Zusatzabschnitte. Zeichnungsseiten und Stückliste haben eigene Schalter. Berichte ohne Daten entfallen. Unterschiedliche gespeicherte Vorlagen desselben Typs sind eigenständige auswählbare Berichte und können bewusst denselben Bestand anders darstellen.

Die Auswahl **Nur aktive Zeichnungsseite** filtert ausschließlich die Zeichnungen. Zusatzabschnitte enthalten den gesamten Projektbestand; sie übernehmen keine flüchtigen Such- oder Seitenfilter offener Navigatorfenster. Für gefilterte Einzelausgaben bleiben deren vorhandene PDF-Schaltflächen verfügbar. Wer ausschließlich Aufbauten oder Berichte exportieren möchte, schaltet Zeichnungen und gegebenenfalls Stückliste aus.

## Formate und Navigation

Die allgemeine Papierwahl A3/A4 gilt für Zeichnungen und Montageplatten. Zeichnungen bleiben im Querformat. Montageplatten wählen Hoch- oder Querformat passend zu ihrer gespeicherten Form; sie werden mit ihrem benannten realen Maß und einem Zeichnungsfaktor auf das Blatt eingepasst. Das ist kein automatischer 1:1-Ausdruck. Berichtsvorlagen behalten ihr eigenes Format und ihre eigene Ausrichtung; die SPS-/Busübersicht verwendet das gewählte allgemeine Format im Querformat.

Farbe beziehungsweise Schwarz-Weiß/Graustufen wird auch auf die neuen Vektorabschnitte angewendet. Eingebettete Rasterbilder und Logos bleiben die vorhandenen Bilddaten.

Lesezeichen führen zu Zeichnungsseiten und zum Beginn jedes gewählten Zusatzabschnitts. Zusätzliche Seiten tragen ihre globale PDF-Position; die lokalen Berichtsseitenzahlen bleiben daneben erhalten. Schriftfelder und das berechnete Seitenanzahlfeld des Deckblatts verwenden die Gesamtzahl der ausgegebenen Seiten, einschließlich aller Fortsetzungen und Zusatzabschnitte.

Interaktive Querverweise bleiben nutzbar. Zugeordnete Projektgeräte im Aufbau erhalten Links zu ihrer tatsächlich ausgegebenen Zeichnungsseite. Berichtszeilen führen zur Zeichnungsseite des ersten eindeutig zugeordneten, im PDF enthaltenen Planobjekts ihrer Zielmenge. Es werden keine Links zu nicht exportierten Seiten, freien Standardbauteilen oder unzugeordneten Kontakten erzeugt.

## Prüfungen

Fehlerhafte oder doppelte gespeicherte Aufbau-/Vorlagendatensätze werden im Dialog sichtbar und sind nicht vorausgewählt. Ein ausgewählter Aufbau mit Maßfehlern, Kollisionen oder fehlenden Gerätebezügen blockiert den Export mit seinem Namen; korrigieren oder ausdrücklich abwählen. Eine vollständig leere Auswahl erzeugt eine Fehlermeldung statt einer Leerseite. Der Dialog bleibt bei einem Fehler geöffnet, die Auswahl bleibt erhalten.

Programmgesteuert erweitert `PdfExportOptions` die vorhandene Schnittstelle um `includeDrawings` und `additionalSections`. Letzteres enthält die stabilen IDs aus `projectPdfChoices(project)`: ohne Angabe werden alle Abschnitte berücksichtigt; `[]` schließt sie ausdrücklich aus. Unbekannte oder ungültige Abschnitte werden nicht stillschweigend ersetzt.
