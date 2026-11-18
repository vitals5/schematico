# Verwaltungsoberfläche

Betriebsmittelnavigator, Artikelwerkzeug, Katalog, Klemmen-/Kabelwerkzeuge, Potenzialvorgaben und Projektprüfung verwenden einen gemeinsamen Fensteraufbau. Titel und Aktionen bleiben sichtbar; die Inhalte scrollen innerhalb des Fensters. Tabellen besitzen feste Spaltenköpfe, einheitliche Formulare, deutliche Auswahlzustände und zugängliche Fokusmarkierungen.

## Betriebsmittelnavigator

- Die linke Navigation filtert alle Einträge, bestätigte Geräte, Einzeldarstellungen und Vorplanungen. Die Zahlen bezeichnen Einträge, keine aus der Grafik geratene Anzahl physischer Geräte.
- Die Suche berücksichtigt BMK, Funktionstexte und Artikelnummern.
- Eine ausgewählte Zeile öffnet rechts ihre Eigenschaften, Artikel und Blattverweise. Die tatsächlichen Haupt-/Nebendarstellungen bleiben unterscheidbar.
- **Betriebsmittel vorplanen** öffnet den strukturierten Editor im Detailbereich. Vorschauen zeigen lesbare Angaben statt eines JSON-Dumps.
- Enter beziehungsweise Leertaste wählen eine Zeile aus, Pfeil nach oben/unten wechselt zwischen den angezeigten Einträgen. Blattverweise springen weiterhin zum konkreten Objekt.

Auf schmalen Ansichten wandern Filter und Detailbereich in eine gestapelte Anordnung. Breite Tabellen scrollen im Tabellenbereich; die Bestätigungsaktionen bleiben erreichbar.

## Weitere Werkzeuge

Im Artikelwerkzeug bündelt **Werkzeuge** den Katalog, die artikelweise Stammdatenpflege und die Funktionszuordnung. Der Katalog zeigt die Herkunft seiner Einträge und den Zustand des [gemeinsamen GitHub-Katalogs](github-catalog.md).

**Klemmen und Kabel…** zeigt grafische Leisten mit Innen-/Außenzielen und Kabelkarten mit anklickbaren Adern sowie eine vollständige Listenansicht. Die Eigenschaften öffnen sich kontextabhängig daneben. Klemmen-/Brückenbearbeitung und Kabeldaten sind durch Register getrennt. Die aktive Ansicht bleibt beim Bearbeiten erhalten. Beim Öffnen eines Kabelbefunds wird direkt das zugehörige Register angezeigt. Die Register unterstützen Pfeiltasten sowie Home/End.

Escape schließt ein geöffnetes Werkzeugmenü zuerst. Die Tabulatornavigation bleibt innerhalb des Dialogs. Die vorhandenen Vorschauen, Bestätigungen, Datenprüfungen und Rückgängig-Schritte bleiben erhalten.

## Fokuslinse für grafische Arbeitsbereiche

SPS-/Busprojektierung, Stecker, Verbindungen, Klemmen/Kabel und der Klemmenleisten-Konfigurator haben eine gemeinsame Navigationsleiste oberhalb der Grafik:

- **− / +, 100 %, Einpassen** verändern die Darstellung der Grafik. Eigenschaftenformulare behalten ihre Größe; Zeichnung, PDF und Projektkoordinaten bleiben erhalten. Der Zoom reicht von 55 bis 150 Prozent. Einpassen verkleinert bis zu dieser Lesbarkeitsgrenze; sehr große Ansichten bleiben scrollbar.
- Die **Miniübersicht** zeigt die angezeigten Objekte und den sichtbaren Ausschnitt. Ein Klick navigiert zum Objekt. Die Auswahlliste daneben bietet dieselbe Navigation per Tastatur, auch auf schmalen Bildschirmen ohne Miniübersicht.
- **Zusammenhänge** hebt die direkte gespeicherte Zuordnung zum fokussierten Objekt hervor und blendet andere Objekte ab. Zum Erkunden genügt das Überfahren mit der Maus oder Tastaturfokus. Die Auswahlliste, ein Klick auf die Miniübersicht oder das normale Anklicken eines Objekts hält den Fokus fest. **×** löst ihn.
- **Hinweise betonen** hebt die dargestellten Objekte mit vorhandenen Befunden hervor. **Nächster Hinweis** navigiert durch diese Objekte. Die Zahl zählt betroffene dargestellte Objekte, nicht sämtliche Prüfmeldungen des Projekts.

Navigation über Miniübersicht, Auswahlliste oder „Nächster Hinweis“ öffnet keine Eigenschaften und verändert das Projekt nicht. Das normale Anklicken der grafischen Objekte führt weiterhin zu ihren bisherigen Bearbeitungsaktionen. Zoom und Fokusmodi bleiben beim Neuzeichnen desselben Fensters erhalten; beim Schließen werden sie verworfen. Entwürfe in den Eigenschaften bleiben erhalten.

Die Hervorhebung verwendet konkrete Datensätze: CPU/Baugruppe/Kanal-Zuordnung, dokumentierte Busverbindungen und Schnittstellenzuordnungen, KNX-Objektzuordnung, eindeutig gespeicherte Gegenkontaktpaarungen, tatsächliche Netz-IDs, elektrische Klemmenbrücken, bestätigte gemeinsame Klemmenpositionen sowie Kabel-/Aderzuordnungen. Mechanische Paarungen, Baugruppenzugehörigkeit und Funkzuordnungen werden dadurch nicht zu elektrischen Verbindungen. Gleiche Namen oder Potenzialbeschriftungen erzeugen keine Beziehungen.

Die Fokuslinse arbeitet ausschließlich mit der aktuellen grafischen Auswahl nach Suche, Filter und Seitennavigation. Bereits bestehende Darstellungsgrenzen bleiben bestehen; die vollständigen Daten sind weiterhin in den Listen und über die Suche erreichbar. Ein leerer sichtbarer Hinweisbestand ist keine Freigabe des gesamten Projekts. Die Navigation berechnet keine Schaltung neu und führt keine Layoutoptimierung aus.

### Vom Objekt zur Zeichnung und zurück

**‹ / ›** blättern zyklisch durch die aktuell dargestellten Objekte. **Eigenschaften öffnen** führt die vorhandene Bearbeitungsaktion des fokussierten Objekts aus; gesperrte Aktionen bleiben gesperrt. Suche, Filter und die bestehende Seitennavigation bestimmen weiterhin den angezeigten Ausschnitt.

**Im Plan ansehen** erscheint bei einer eindeutigen gespeicherten Zeichnungszuordnung. Dazu gehören Anschlusszuordnungen von SPS-Kanälen und Steckerkontakten, gebundene Busteilnehmer, Klemmen, bestätigte Klemmenpositionen und die Endgeräte zugeordneter Kabeladern beziehungsweise Verbindungen. Bei mehreren Zielen wählt die Auswahlliste das gewünschte Gerät. Es werden bis zu 32 unterschiedliche Geräteziele angezeigt. Reserven, reine Zubehörpositionen oder Objekte ohne eindeutige Zuordnung erhalten kein erfundenes Ziel.

Beim Aufruf werden die Werkzeugfenster vorübergehend ausgeblendet und die vorhandene Zeichnungsnavigation fokussiert das Gerät. **Zurück zum Werkzeug** stellt dieselben Fenster mit ihren Entwürfen, Filtern, Zoom und Fokus wieder her. Escape am Zurück-Knopf führt ebenfalls zurück. Die Vorschau übernimmt keine Eigenschaftenänderungen. Falls das Projekt währenddessen bearbeitet wurde, gelten beim späteren Übernehmen weiterhin die vorhandenen Prüfungen auf einen veralteten Projektstand.
