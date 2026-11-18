# Fertigungsunterlagen und Berichtsdesigner

**Auswerten → Fertigungsunterlagen & Berichtsdesigner…** öffnet den gemeinsamen, tabellenbasierten Designer. Die bisherigen Einzelberichte bleiben verfügbar.

| Bericht | Datenquelle und Bedeutung |
|---|---|
| Klemmenplan | Vorhandener Klemmenbericht mit Innen-/Außenzielen, Ebenen und gespeicherter Montageposition. Die fachliche Reihenfolge ist die Vorgabe. |
| Kabelplan | Tatsächlich gespeicherte Kabeladern und ihre Zuordnungen. Ein Kabel ohne Adern erhält eine Zeile mit leeren Aderfeldern; keine Reserveadern werden erfunden. |
| Steckerplan | Vorhandene Kontaktpositionen, Belegung und ausdrücklich gespeicherte Gegenstückzuordnungen. |
| Verdrahtungsliste | Erfasste manuelle, automatische, logische und Brückenabschnitte aus dem gemeinsamen Verbindungsdienst. Reale Längen erscheinen nur, wenn sie ausdrücklich gespeichert wurden. |

## Vorlagen bearbeiten

Eine Vorlage legt Berichtstyp, Titel, A3/A4 im Querformat, Schriftgröße (6–12 pt), sichtbare Spalten, deren Überschriften, Reihenfolge und relative Breitengewichte (1–20) fest. Mindestbreiten halten Textspalten nutzbar; die restliche Blattbreite wird nach Gewichten verteilt. Ein Gewicht ist kein Millimetermaß. Sortierung ist optional. Ohne eigene Sortierung bleibt die fachliche Reihenfolge des jeweiligen Quelldienstes erhalten; eine eigene Sortierung verändert keine Klemmen- oder Geräteposition im Projekt.

Die Pfeile verschieben Spalten. Mindestens eine gültige Spalte muss sichtbar bleiben. Überschriften dürfen bis zu 80 Zeichen und der Berichtstitel bis zu 120 Zeichen enthalten. **Vorschau aktualisieren** berechnet Zeilenumbrüche und Seiten neu. Bis dahin sind PDF und CSV nach einer Einstellungsänderung gesperrt; die zuletzt berechnete Vorschau bleibt mit einem Hinweis sichtbar.

**Vorlage im Projekt speichern** übernimmt ausschließlich die Vorlage unter `manufacturingReportTemplates`. Die Speicherung ist ein Rückgängig-Schritt. Berichtszeilen und vorberechnete PDF-Seiten werden nicht mitgespeichert. **Als Kopie bearbeiten** erzeugt eine neue Vorlagenidentität. Eine gespeicherte Kopie kann entfernt werden. Beim Entfernen einer gespeicherten Anpassung einer Grundvorlage wird deren Standard wieder angeboten.

Vorlagen lassen sich als JSON im Format `schematico-report-template`, Version 1, exportieren und importieren. Der Import prüft Berichtstyp, eindeutige erlaubte Spalten, Größen und Breiten. Die Dateigröße ist auf 128 KiB begrenzt. Ein Import ersetzt im Projekt erst nach ausdrücklichem Speichern die Vorlage mit derselben ID. Fehlerhafte oder doppelte gespeicherte Vorlagen werden mit einer Anzahl gemeldet und nicht beliebig ausgewählt. Normale ältere Projekte benötigen keine Migration. Auch Hochformatvorlagen bleiben importierbar; Vorschau und PDF werden immer im Querformat berechnet. Erst beim ausdrücklichen Speichern der Vorlage wird deren Ausrichtung im Projekt auf Querformat gesetzt.

## Vorschau und Export

Vorschau und PDF benutzen dieselbe mit der Standardschrift gemessene Layoutstruktur: Spalten, Textzeilen, Kopfzeilen, Zeilenhöhen und Seitenumbrüche. Lange Zellen werden umbrochen. Passt eine Zeile nicht vollständig auf ein Blatt, wird ihr verbleibender Text auf der nächsten Seite fortgesetzt; Überschriften werden wiederholt. Die Blattwahl und Pfeile zeigen jeweils eine Vorschauseite, auch bei langen Berichten. Jede Vorschau- und PDF-Seite verwendet den Plankopf des Projekts; Tabellenzeilen und lokale Seitenzähler bleiben im freien Bereich darüber. Der gemeinsame Projekt-PDF-Export setzt die globale Blattnummer und Gesamtzahl ein.

CSV übernimmt dieselbe sichtbare Spaltenauswahl, Benennung, Reihenfolge, Filterung und Sortierung. Es enthält die vollständigen Originalzelltexte, einschließlich Zeilenumbrüchen. Formelartige Zellanfänge werden für den Tabellenimport als Text geschützt.

Die Vorschau ist eine interaktive Ansicht der aktuellen Berichtsdaten. Eine Zeile lässt sich per Klick oder Tastatur auswählen. Die Fokuslinse kann zu eindeutig gespeicherten Gerätezuordnungen im Plan springen und mit **Zurück zum Werkzeug** in denselben Designer zurückkehren. Unzugeordnete Kontakte oder Adern bekommen kein geratenes Sprungziel. Der PDF-Export ist ein eigenständiger Tabellenbericht; Zeichnungssprünge stehen in der Programmvorschau zur Verfügung.

## Projektstand und Grenzen

Ein Bericht verwendet den Projektstand beim Öffnen oder Neuladen. Die Suche berücksichtigt alle Quellfelder; der Zeichnungsseitenfilter verwendet gespeicherte Seitenbezüge. Nicht platzierte freie Kontakte erscheinen in der ungefilterten Übersicht und erhalten keine erfundene Blattzuordnung. Fehlende Werte bleiben leer beziehungsweise als Strich dargestellt.

Bei zwischenzeitlichen Projektänderungen werden Speichern, Neuberechnen und Export mit einem Hinweis auf den veralteten Stand abgelehnt. **Neu laden (Entwurf verwerfen)** übernimmt den aktuellen Projekt- und Vorlagenbestand. Quellen werden pro Berichtstyp zwischengespeichert; reine Formularänderungen bauen keinen elektrischen Netzbestand neu auf. Berichtsvorschau und Zeichnungsinspektion verändern keine Leitungswege oder Autoconnect-Verbindungen.

Dies ist ein Designer für Tabellenberichte, kein frei positionierbarer Formulareditor. Projektnamen werden im Berichtskopf auf 240 Zeichen begrenzt. Die bestehenden grafischen Klemmen-/Kabelwerkzeuge und bisherigen Exporte bleiben unabhängig nutzbar.
