# Betriebsmittel-, Klemmen- und Kabelwerkzeuge

## Funktionen und Anschlüsse

Der lokale Artikelkatalog bietet für Funktionsspezifikationen eine Tabelle mit **Funktionsplatz**, **Funktionstyp** und **Anschlüssen**. Funktionen können einzeln hinzugefügt und entfernt werden. Anschlussbezeichnungen werden mit Komma getrennt eingegeben. CSV-/JSON-Austausch bleibt möglich; für gewöhnliche Bearbeitung ist keine JSON-Eingabe erforderlich.

Die anwendungseigene Symbolbibliothek benennt ihre Funktionen eindeutig. Übliche Funktionen wie Spule, Öffner und Schließer besitzen gemeinsame Typkennungen; weitere Bibliotheksfunktionen verwenden stabile, spezifische Typen. Bereits gespeicherte Standarddefinitionen ohne diese Metadaten werden nur bei übereinstimmender Kennung und Anschlussdefinition erkannt. Importierte Symbole erhalten keine aus ihrer Grafik erratenen Funktionstypen. Explizite Platzierungsvorgaben bleiben vorrangig.

## Betriebsmittelnavigator

**Projekt → Betriebsmittelnavigator…** zeigt bestätigte physische Geräte mit Haupt-/Nebendarstellungen, einzelne Platzierungen und noch nicht platzierte Geräte. Suche und Seitenwechsel erlauben das Bearbeiten großer Projekte. Die Sprungschaltflächen nennen das Blatt; die Artikelaktion öffnet die zugehörigen Darstellungen gemeinsam im Artikelwerkzeug.

**Betriebsmittel vorplanen** legt ein noch nicht platziertes Gerät mit Anlage, Ort, BMK, Beschreibung und Artikelliste an. Artikel und Zubehör werden aus dem Katalog mit ihren Projekt-Snapshots übernommen. Die Vorplanung ist in der Projektdatei gespeichert und kann geändert oder gelöscht werden. Noch nicht platzierte Geräte sind nicht Teil der bisherigen Stückliste für platzierte Betriebsmittel.

Eine gespeicherte Vorplanung kann einem ausdrücklich ausgewählten, bereits gezeichneten Symbol zugeordnet werden. Die Vorschau zeigt die bisherige und künftige Kennzeichnung sowie die zu übernehmenden Artikel. Der Befehl setzt keine automatische Gerätekonstruktion voraus und verschiebt das Symbol nicht. Bereits gebundene Geräte und widersprüchliche vollständige BMK werden abgelehnt. Änderungen an einer Vorplanung sind vor der Zuordnung zu speichern. Fehlt eine frühere Platzierung, wird dies im Navigator sichtbar und die Vorplanung kann erneut zugeordnet werden.

Jede Projektübernahme ist ein Rückgängig-Schritt. Zwischenzeitliche Projektänderungen blockieren eine veraltete Vorschau.

## Klemmen und Brücken

**Projekt → Klemmen und Kabel…** beziehungsweise die Aktion eines entsprechenden Prüfbefunds öffnet den Bearbeitungsdialog. Die Klemmenansicht enthält die aus dem gemeinsamen elektrischen Modell ermittelten internen und externen Ziele.

Für eine Klemme lassen sich Leiste, Nummer, Etage und die Anschlussseiten ausdrücklich festlegen. Unterschiedliche Etagen bleiben unterscheidbar. Neue doppelte Nummer-/Etagenkombinationen innerhalb desselben Anlagen-/Orts-/Leistenkontexts werden abgelehnt. Bei älteren Projekten ohne ausdrückliche Anschlussseiten bleibt die bisherige Seitenregel erhalten; sie wird nicht als Herkunftsnachweis interpretiert.

Steck- und Drahtbrücken verbinden ausdrücklich ausgewählte, eindeutige Klemmenanschlüsse. Sie werden als elektrische Projektverbindungen gespeichert und stehen dem Netzdienst und den Berichten zur Verfügung. Die Prüfung lehnt bereits verbundene Anschlüsse, unauflösbare Ziele und widersprüchliche feste Potenziale ab. Die Brückenfunktion zeichnet keine zusätzliche Leitung über die Blattgrafik. Im Klemmenbericht erscheint der Brückenhinweis; eine gesonderte CSV enthält die exakten Brückenanschlüsse. Eine Brücke lässt sich gezielt entfernen, ohne andere Quellverbindungen zu löschen.

## Kabel und Adern

Kabeltyp, BMK, Querschnitt und deklarierte Aderzahl sind bearbeitbar. Für jede Ader werden Bezeichnung, Farbe, Querschnitt, Reservekennzeichnung und zugeordnete Leitungen gepflegt. Reserveadern dürfen keine aktive Leitungszuordnung besitzen. Fehlende oder mehrdeutige Leitungen und eine Leitung in mehreren Adern desselben Kabels werden erkannt. Neue doppelte Aderbezeichnungen werden nicht übernommen.

**Fehlende Adern als Reserve ergänzen** erzeugt ausdrücklich gekennzeichnete, unzugeordnete Reservepositionen bis zur deklarierten Aderzahl. Vorhandene Adern werden dabei nicht entfernt oder automatisch umverdrahtet. Eine unbekannte deklarierte Aderzahl muss zuerst geklärt werden.

Die Regeln `terminal_number_duplicate`, `cable_core_duplicate`, `cable_wire_missing`, `cable_wire_reused`, `cable_reserve_connected`, `cable_core_unassigned` und `cable_count_mismatch` sind im gemeinsamen Prüflauf, Importbericht und den KI-Abfragen enthalten. Ein unzugeordneter Leiter wird nicht eigenmächtig zur Reserve erklärt. Abweichende deklarierte/definierte Aderzahlen zeigen einen Klärungsbedarf, keine allein daraus nachgewiesene elektrische Fehlfunktion.

**Fertigungslisten als CSV exportieren** erzeugt Klemmen-, Kabel-/Ader- und Brückenlisten mit Zielen, Seitenbezug und Reservekennzeichnung. Der vorhandene PDF-Klemmenplan verwendet dieselben Anschlussseiten und Brückeninformationen. Unbekannte Werte bleiben erkennbar; Leitungs- und Kabellängen werden aus diesen Angaben nicht erfunden.

## Prüfung am privaten Referenzprojekt

Die Prüfung mit 48 Seiten und 4.724 Platzierungen hat den Import, eine gleichwertige Sammelzuordnung, Stücklistenberechnung und Rückgängig-Funktion bestätigt. 134 Artikelpositionen bleiben bei dieser Sammelbearbeitung erhalten. Der Test speichert keine privaten Projektdateien im Repository.

Der Prüflauf findet in diesem Bestand unter anderem 351 Artikelzuordnungen ohne strukturierte Funktionsspezifikation, 102 Adern ohne aktive Zuordnung oder ausdrückliche Reservekennzeichnung und 21 Kabel mit unterschiedlichen deklarierten und definierten Aderzahlen. Diese Hinweise werden durch die neuen Werkzeuge bearbeitbar; sie wurden im Referenzprojekt nicht automatisch beseitigt. Fehlende Artikelmeldungen müssen zunächst nach Importnachweis und Symbolrolle eingeordnet werden und entsprechen nicht unmittelbar einer Zahl fehlender physischer Geräte. Die nächste fachliche Arbeit ist daher die Klärung der Ader-/Reservedaten und der erfassten Artikel-Funktionsdaten.
