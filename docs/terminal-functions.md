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

Unter **Projekt → Klemmeneditor… → Funktion** lassen sich Klemmenleiste, Nummer, Etagenbezeichnungen, Funktionstexte je Etage und interne/externe Anschlussseiten bearbeiten. Eigenschaften und Klemmenübersicht führen ebenfalls in diesen gemeinsamen Editor. Etagenbezeichnungen innerhalb einer Klemme müssen eindeutig sein. Ein bloßes Öffnen der Eigenschaften speichert keine abgeleiteten Einstellungen.

Eine Mehrstockklemme ist ein physisches Betriebsmittel mit mehreren getrennten elektrischen Funktionen. Ihre Artikelzuordnung erfolgt am gemeinsamen Symbol. In der Stückliste wird die zugeordnete Stückzahl einmal gezählt. Klemmenübersicht, Klemmenplan, Fertigungsberichte und CSV-Ausgabe führen jede Etage separat mit ihren tatsächlichen Anschlusszielen auf. Die erste Etage ist als Hauptfunktion gekennzeichnet. Eine Klemme mit Nummer 7 kann beispielsweise die Berichtszeilen `7/L`, `7/N` und `7/PE` erhalten.

Etagenbezeichnungen im Stromlaufplan folgen der Sichtbarkeit der Anschlussbeschriftungen; eigene Etagenfunktionstexte folgen der Sichtbarkeit des Funktionstexts. Editor, Layoutprüfung und PDF verwenden dieselben Beschriftungsdaten. Leere Felder erzeugen keine Ersatztexte.

Explizite Steck- und Drahtbrücken können im Klemmenbereich zwischen gewählten Klemmstellen angelegt werden, auch zwischen zwei Etagen derselben Klemme. Ohne diese Zuordnung bleiben die Etagen getrennt. Eine neue N–PE-Verbindung wird zurückgewiesen. Das Anlegen oder Entfernen einer Brücke ändert keine Symbolgeometrie.

## Etagen getrennt platzieren

1. Den Klemmeneditor über **Projekt → Klemmeneditor…** oder **Eigenschaften → Schaltzeichen → Im Klemmeneditor bearbeiten…** öffnen. Unter **Funktion** Klemmenleiste und Klemmennummer eintragen, beispielsweise `-X1` und `7`, und vormerken.
2. Das Register **Aufbau** wählen. Derselbe Editor ist auch aus **Klemmen und Kabel** erreichbar.
3. Als Hauptetage die unterste oder oberste Etage wählen und **Etagen aufteilen** anklicken.
4. Die Änderung vormerken, **Änderungen prüfen** und **Übernehmen** wählen. Erst dann ändert sich das Projekt; Rückgängig/Wiederholen gilt für den gesamten Vorgang.

Die einzelnen Etagen sind anschließend normale, unabhängig verschiebbare Schaltzeichen. Sie gehören weiterhin zu einer physischen Montageposition. Anschlusspunkte bleiben beim Aufteilen exakt an ihren bisherigen Positionen, auch bei gedrehten oder skalierten Symbolen. Bestehende Leitungen werden auf die passende Etage umgebunden; ihre Wege bleiben erhalten. Ein unbekanntes oder nicht unterstütztes Anschlussbild wird zurückgewiesen, statt die Netze zu erraten.

Die **Hauptklemme** trägt Artikel und Zubehör. Nebenklemmen öffnen zur Artikelbearbeitung die Hauptklemme. Im Verwaltungsdialog kann eine andere äußere Etage zur Hauptklemme werden; die Artikelzuordnung wechselt mit und die Stückzahl bleibt unverändert. Alle Etagen bleiben im Klemmenplan einzeln sichtbar. Gleiche Bezeichnungen allein erzeugen weder ein gemeinsames Gerät noch eine elektrische Verbindung.

Bereits einzeln gezeichnete Etagen lassen sich weiterhin in der Klemmenleisten-Konfiguration ausdrücklich zu einer physischen Montageposition zusammenfassen. Die **Sortierkennung** wird in den Eigenschaften je Funktion gepflegt. **Nach Sortierkennung** sortiert vollständige Klemmenpositionen numerisch; Etagen einer Position bleiben zusammen und Zubehör behält seinen Platz.

## Teilklemmen auf mehreren Blättern

**Teilklemmen erstellen** zerlegt eine einzelne Durchgangs- oder PE-Klemmenfunktion in separat platzierbare Anschlusspunkte. Diese Teilplatzierungen repräsentieren weiterhin dieselbe logische Klemme. Ihre interne Verbindung ist ausdrücklich im Projekt gespeichert und folgt nicht aus einem identischen BMK. Die Artikelprüfung verwendet das vollständige Anschlussbild dieser Funktion und zählt ihre Funktionsschablone nur einmal. Der Klemmenplan fasst die Teilplatzierungen zu einer Klemmenfunktion mit den tatsächlichen Anschlusszielen zusammen.

Im Verwaltungsdialog lässt sich eine unverdrahtete Teilplatzierung auf ein anderes Stromlaufplanblatt verschieben. X/Y bezeichnet dabei den Einfügepunkt. Die Funktionen bleiben über die Blattgrenze zugeordnet; Anlage und Einbauort ändern sich dabei nicht. Bereits mit Leitungen verbundene Platzierungen werden nicht automatisch über Blattgrenzen getrennt. Ein Verschieben, das die elektrische Netzstruktur verändern würde, wird zurückgewiesen. Die Navigationsschaltflächen führen zu den zugehörigen Platzierungen.

Klemmennummer und Etage einer gemeinsamen Teilklemmenfunktion werden im Klemmenbereich gemeinsam geändert. Das Auflösen der Gerätezuordnung ist gesperrt, solange dadurch die elektrische Identität der Teilklemmen verloren ginge. Unvollständige, doppelte oder verwaiste Zuordnungen erscheinen im Prüflauf; sie werden nicht anhand der Beschriftung automatisch verbunden.

Die verteilten Zuordnungen werden mit dem Projekt gespeichert, einschließlich JSON- und Projektarchiv-Rundlauf. Einzelne Teilplatzierungen sind keine eigenständigen Makros: Eine Kopie ohne die vollständige logische Zuordnung ist keine gültige verteilte Klemmenfunktion und wird im Prüflauf gemeldet. Ungeteilte Klemmen behalten ihre bisherige Makro-Unterstützung.

Es handelt sich um generische Schaltzeichen; konkrete Herstellerdaten und Anschlussbezeichnungen sind dem gewählten Artikel zu entnehmen. Die Trennfunktion beschreibt den elektrischen Unterschied zwischen dauerhaften und schaltbaren Verbindungen; eine Simulation der Schalterstellung ist damit nicht verbunden.

Die vollständige Bedienung einschließlich Entwurf und gemeinsamer Artikel-/Brückenverwaltung beschreibt der [Klemmeneditor](terminal-editor.md).
