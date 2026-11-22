# Klemmentypen und Etagenfunktionen

Neue Reihenklemmen haben einen **leeren Funktionstext**. Vorhandene Projekttexte bleiben erhalten. Funktionstexte können unter Eigenschaften ausdrücklich eingetragen und unter Anzeige ausgeblendet werden.

## Grundtypen in der Bibliothek

In **Bibliothek → Klemmen & Verbindungstechnik** sind kompakte Grundsymbole auswählbar:

| Typ | Klemmstellen und interne Verbindung |
|---|---|
| Reihenklemme | Zwei fest verbundene Klemmstellen |
| 3-Leiter-Durchgangsklemme | Eine Funktion, drei fest verbundene Klemmstellen a/b/c |
| 4-Leiter-Durchgangsklemme | Eine Funktion, vier fest verbundene Klemmstellen a/b/c/d |
| Doppelstockklemme | Zwei elektrisch getrennte Etagen mit je zwei Klemmstellen |
| Dreistockklemme | Drei elektrisch getrennte Etagen mit je zwei Klemmstellen |
| Installationsetagenklemme L/N/PE | Drei getrennte Etagen mit Außenleiter-, Neutralleiter- und Schutzleiterrolle |
| Installationsetagenklemme L/L/PE | Zwei getrennte Außenleiteretagen und eine Schutzleiteretage |
| Installationsetagenklemme mit N-Trennung | L und PE durchverbunden; der trennbare N-Pfad ist keine dauerhafte elektrische Verbindung |

Die gestrichelte Verbindung zwischen Etagen zeigt das gemeinsame Gehäuse. Sie ist keine elektrische Brücke. Außenanschlüsse sind gerichtet und lassen sich durch Drehen und Ausrichten auf dem Halbraster für Autoconnect nutzen. Die Leiteranzahl einer Durchgangsklemme ist unabhängig von der Anzahl ihrer Etagen.

Die vorhandenen größeren Katalogvarianten für Federzug, Schraube und Push-in behalten ihre Anschlussgeometrie. Auch diese Varianten enthalten jetzt getrennte Etagenfunktionen; Doppel- und Dreistockvarianten werden entsprechend bezeichnet. Die neuen kompakten Grundsymbole besitzen eigene IDs.

## Eigenschaften und Auswertung

Unter **Eigenschaften → Schaltzeichen → Klemmenfunktionen** lassen sich Klemmenleiste, Nummer, Etagenbezeichnungen, Funktionstexte je Etage und interne/externe Anschlussseiten bearbeiten. Dieselben Etagenfelder stehen in **Projekt → Klemmen und Kabel** zur Verfügung. Etagenbezeichnungen innerhalb einer Klemme müssen eindeutig sein. Ein bloßes Öffnen der Eigenschaften speichert keine abgeleiteten Einstellungen.

Eine Mehrstockklemme ist ein physisches Betriebsmittel mit mehreren getrennten elektrischen Funktionen. Ihre Artikelzuordnung erfolgt am gemeinsamen Symbol. In der Stückliste wird die zugeordnete Stückzahl einmal gezählt. Klemmenübersicht, Klemmenplan, Fertigungsberichte und CSV-Ausgabe führen jede Etage separat mit ihren tatsächlichen Anschlusszielen auf. Die erste Etage ist als Hauptfunktion gekennzeichnet. Eine Klemme mit Nummer 7 kann beispielsweise die Berichtszeilen `7/L`, `7/N` und `7/PE` erhalten.

Etagenbezeichnungen im Stromlaufplan folgen der Sichtbarkeit der Anschlussbeschriftungen; eigene Etagenfunktionstexte folgen der Sichtbarkeit des Funktionstexts. Editor, Layoutprüfung und PDF verwenden dieselben Beschriftungsdaten. Leere Felder erzeugen keine Ersatztexte.

Explizite Steck- und Drahtbrücken können im Klemmenbereich zwischen gewählten Klemmstellen angelegt werden, auch zwischen zwei Etagen derselben Klemme. Ohne diese Zuordnung bleiben die Etagen getrennt. Eine neue N–PE-Verbindung wird zurückgewiesen. Das Anlegen oder Entfernen einer Brücke ändert keine Symbolgeometrie.

Für verteilte Darstellungen bleibt die vorhandene Klemmenleisten-Konfiguration verfügbar: Einzelne Klemmenfunktionen können dort mit Etageninformationen zu einer physischen Montageposition zusammengefasst und einem gemeinsamen Artikel zugeordnet werden. Das geschieht ausdrücklich; gleiche Bezeichnungen allein verbinden keine Etagen und fassen keine Artikel zusammen.

Die Etagenzuordnung und Anschlusslogik werden mit Projekt und Makro gespeichert. Es handelt sich um generische Schaltzeichen; konkrete Herstellerdaten und Anschlussbezeichnungen sind dem gewählten Artikel zu entnehmen.
