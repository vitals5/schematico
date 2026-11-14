# Zeichenleistung im Editor

Die Profilierung einer vorhandenen Projektseite mit 382 Komponenten, 17 Gruppen und 42 Leitungen zeigte zwei wesentliche Ursachen für stockende Bedienung:

- Jeder sichtbare Querverweis baute einen eigenen Index des gesamten Projekts auf, einschließlich Betriebsmittel- und Verbindungsinformationen.
- Verschieben, Zoomen und wechselnde Anschluss-Hervorhebungen erzeugten die komplette SVG-Zeichnung erneut. Dabei wurden auch unveränderte Symbole, Texte und Querverweise neu berechnet und die DOM-Knoten ersetzt.

## Umsetzung

`renderComponents` erstellt den Querverweisindex bei Bedarf einmal pro Aufruf und übergibt ihn an die Beschriftungen. Nach einer Änderung wird ein neuer Index verwendet; es gibt keinen dauerhaften Cache auf einem veränderlichen Projekt.

Maus-, Tastatur- und Touch-Navigation ändern den Transformationswert des vorhandenen Ansichtscontainers. Die Bildschirmgröße der Leitungsgriffe wird beim Zoomen angepasst. Hervorhebungen und Platzierungsvorschauen aktualisieren ihre eigenen Ebenen, einschließlich Autoconnect- und Kabelvorschau.

Die Anschluss-Suche verwendet bereits geladene Komponenten und Symbole weiter. Die Gruppensuche baut ihre lokalen Nachschlagetabellen einmal pro Anfrage auf und durchläuft die Mitgliedschaften ohne wiederholtes Normalisieren jeder Gruppe. Eine schon vollständige Gruppenauswahl löst keine erneuten Auswahlbenachrichtigungen aus. Beim Ziehen innerhalb derselben Rasterposition bleibt die Darstellung unverändert.

## Prüfung

Die reguläre Testsuite prüft zusätzlich:

- begrenzte Projektzugriffe beim Zeichnen vieler Querverweise und aktuelle Werte nach Änderungen;
- Navigation ohne Neuaufbau der Zeichnung und angepasste Leitungsgriffe;
- Anschluss-Hervorhebung ohne vollständiges Neuzeichnen;
- bestehende Gruppenauswahl, Bewegung, Querverweisnavigation, Autoconnect und Exportfunktionen.

Browserprüfungen kontrollieren die Identität der vorhandenen Zeichnungsknoten sowie bewegliche Symbol- und Kabelvorschauen. Laufzeitmessungen dienen zum Vorher-/Nachher-Vergleich in derselben Umgebung; die Regressionstests prüfen den vermiedenen Rechenaufwand statt hardwareabhängiger Zeitgrenzen.

## Vergleichsmessung

Lokaler Chromium-Test derselben Seite im Entwicklungsbuild, Median aus jeweils sechs Aufrufen. Gemessen wurde die synchrone JavaScript-Zeit; das anschließende Zeichnen durch den Browser ist darin nicht enthalten.

| Vorgang | Vorher | Nachher |
| --- | ---: | ---: |
| Vollständiger Zeichenlauf | 227.4 ms | 80.1 ms |
| Zeichenlauf mit ausgewählter Gruppe | 177.2 ms | 54.4 ms |
| Gruppenauswahl | 26.1 ms | 9.9 ms |

Beim Verschieben der Ansicht fällt der vollständige Zeichenlauf weg: Im Test benötigte das Aktualisieren der Transformation höchstens 0,2 ms statt etwa 197 ms für den vorherigen Neuaufbau.
