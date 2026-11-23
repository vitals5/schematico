# Betriebsmittel-, Klemmen- und Kabelwerkzeuge

## Funktionen und Anschlüsse

Der lokale Artikelkatalog bietet für Funktionsspezifikationen eine Tabelle mit **Funktionsplatz**, **Funktionstyp** und **Anschlüssen**. Funktionen können einzeln hinzugefügt und entfernt werden. Anschlussbezeichnungen werden mit Komma getrennt eingegeben. CSV-/JSON-Austausch bleibt möglich; für gewöhnliche Bearbeitung ist keine JSON-Eingabe erforderlich.

Die anwendungseigene Symbolbibliothek benennt ihre Funktionen eindeutig. Übliche Funktionen wie Spule, Öffner und Schließer besitzen gemeinsame Typkennungen; weitere Bibliotheksfunktionen verwenden stabile, spezifische Typen. Bereits gespeicherte Standarddefinitionen ohne diese Metadaten werden nur bei übereinstimmender Kennung und Anschlussdefinition erkannt. Importierte Symbole erhalten keine aus ihrer Grafik erratenen Funktionstypen. Explizite Platzierungsvorgaben bleiben vorrangig.

## Betriebsmittelnavigator

**Projekt → Betriebsmittelnavigator…** zeigt bestätigte physische Geräte mit Haupt-/Nebendarstellungen, einzelne Platzierungen und noch nicht platzierte Geräte. Suche und Seitenwechsel erlauben das Bearbeiten großer Projekte. Die Sprungschaltflächen nennen das Blatt; die Artikelaktion öffnet die zugehörigen Darstellungen gemeinsam im Artikelwerkzeug.

**Betriebsmittel vorplanen** legt ein noch nicht platziertes Gerät mit Anlage, Ort, BMK, Beschreibung und Artikelliste an. Artikel und Zubehör werden aus dem Katalog mit ihren Projekt-Snapshots übernommen. Die Vorplanung ist in der Projektdatei gespeichert und kann geändert oder gelöscht werden. Noch nicht platzierte Geräte sind nicht Teil der bisherigen Stückliste für platzierte Betriebsmittel.

Eine gespeicherte Vorplanung kann einem ausdrücklich ausgewählten, bereits gezeichneten Symbol zugeordnet werden. Die Vorschau zeigt die bisherige und künftige Kennzeichnung sowie die zu übernehmenden Artikel. Der Befehl setzt keine automatische Gerätekonstruktion voraus und verschiebt das Symbol nicht. Bereits gebundene Geräte und widersprüchliche vollständige BMK werden abgelehnt. Änderungen an einer Vorplanung sind vor der Zuordnung zu speichern. Fehlt eine frühere Platzierung, wird dies im Navigator sichtbar und die Vorplanung kann erneut zugeordnet werden.

Jede Projektübernahme ist ein Rückgängig-Schritt. Zwischenzeitliche Projektänderungen blockieren eine veraltete Vorschau.

## Grafischer Klemmen-/Kabelarbeitsbereich

**Projekt → Klemmen und Kabel…** startet mit einer grafischen Übersicht und Kennzahlen zum eingelesenen Projektbestand. Die Register **Klemmen** und **Kabel / Adern** unterstützen auch Pfeiltasten sowie Home/End. Suche, Gruppenfilter und **Nur mit Hinweisen** begrenzen die Ansicht. **Grafik / Liste** wechselt die Darstellung, ohne offene Eingaben oder eine geprüfte Vorschau zu verlieren. Auch der Registerwechsel erhält vorhandene Formulareingaben.

- **Klemmen:** Klemmenkarten und Brückenbearbeitung führen zum gemeinsamen [Klemmeneditor](terminal-editor.md). Jede Leiste erscheint als schematische Reihe mit Nummer/Etage sowie internen und externen Zielen aus dem bestehenden Klemmenbericht. Aus der Darstellung oder Reihenfolge abgeleitete Nummern und die bisherige Anschlussseitenregel werden ausdrücklich gekennzeichnet. Die Grafik ist keine maßstäbliche Montagezeichnung. **Gespeicherte Brücken** zeigt ausschließlich die tatsächlich gespeicherten Anschlussverbindungen. Benachbarte Klemmen werden nicht automatisch verbunden.
- **Kabel / Adern:** Kabelkarten zeigen Typ, Querschnitt und definierte/deklarierte Aderzahl. Einzelne Adern zeigen ihre gespeicherte Farbe, Kennung, Ziele und den Zuordnungs-/Reservestatus. Eine größere deklarierte Aderzahl erzeugt keine zusätzlichen Adergrafiken. Fehlende Adern werden erst über den geprüften Reserve-Befehl angelegt. Hinweise bleiben auch bei einer gespeicherten Reservekennzeichnung sichtbar, wenn diese widersprüchlich ist.

Klemme, Kabel oder Ader anklicken, um rechts die passenden Eigenschaften zu öffnen; mobil erscheint das Panel darunter. Das Panel zeigt auch die vollständigen Ziele. Änderungen durchlaufen weiterhin **Vorschau → Übernehmen** und unterstützen Rückgängig/Wiederholen. Eine andere Datensatzauswahl verwirft offene Eingaben. **Aktualisieren** liest das Projekt erneut ein und verwirft offene Eingaben/Vorschauen; ein veralteter Stand kann neuere Projektdaten nicht überschreiben.

Die Grafik zeigt sechs Leisten bzw. Kabel pro Seite. Klemmenkarten sind auf 64 je Leiste und insgesamt 192 begrenzt; Kabelkarten auf 24 Adern je Kabel und insgesamt 96. Weitere Datensätze bleiben über Suche, Gruppenfilter, **Weiter** und die Liste erreichbar. Die Liste zeigt 100 Positionen/Adern pro Seite. In der grafischen Brückenübersicht werden bis zu 40 Verbindungen je Leiste angezeigt; die Brückenbearbeitung enthält die vollständigen gespeicherten Brücken.

**Daten & Berichte** bündelt die Kabel-Reparaturvorschläge, das Aktualisieren und den bisherigen Export aller drei Fertigungslisten. Der Export umfasst stets den gesamten eingelesenen Projektbestand und wird durch die Anzeigefilter nicht eingeschränkt. Die elektrische Auswertung wird für diesen Stand einmal berechnet und beim Suchen/Ansichtswechsel wiederverwendet.

## Klemmenleisten konfigurieren

**Leiste konfigurieren** öffnet den zentralen [Klemmeneditor](terminal-editor.md) für die jeweilige Leiste: Bestückungsreihenfolge, ausdrückliche Etagenzuordnung, gemeinsamer Artikel und eigenständige Zubehörpositionen mit Stücklistenauswertung. Zeichnung und elektrische Brücken bleiben davon getrennt.

## Klemmen und Brücken

**Projekt → Klemmeneditor…**, eine Klemmenkarte oder die Aktion eines entsprechenden Prüfbefunds öffnet denselben zentralen Editor. Die Klemmenansicht enthält die aus dem gemeinsamen elektrischen Modell ermittelten internen und externen Ziele.

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

## Geführte Bereinigung

[Reparaturvorschläge und Potenzialdefinitionen](engineering-assistants.md) ergänzen den manuellen Dialog: eindeutige Kabelkreuzungen mit Netzprüfung, ausdrücklich bestätigte Reserve- und Aderzahländerungen sowie kontrollierte Übernahme von Leiterattributen. Bestätigte Haupt-/Nebendarstellungen bestimmen außerdem Verweisziele und Kontaktspiegel.
