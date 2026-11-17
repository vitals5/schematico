# KNX-Gruppenadressen per XML austauschen

Unter **Projekt → SPS- und Busprojektierung → KNX-Gruppenadressen** gibt es einen eigenen Bereich **KNX-Gruppenadress-XML**. Er ergänzt die Schematico-Bearbeitungs-CSV um einen Austausch im dokumentierten Gruppenadressformat von ETS.

## Import

1. Im KNX-Engineeringprogramm die gewünschten Gruppenadressen als **XML** exportieren. Unterstützt wird `GroupAddress-Export` mit dem Namensraum `http://knx.org/xml/ga-export/01`; entsprechende ältere Dateien ohne Namensraum werden ebenfalls gelesen. Dies ist ein Gruppenadressimport, kein vollständiger Projektimport.
2. In Schematico das **Zielnetz** eintragen oder ein bestehendes KNX-Netz wählen. Bei mehreren Netzen wird keines automatisch ausgewählt; die Datei selbst bestimmt kein Schematico-Netz.
3. **ETS-XML importieren** wählen. Namen, Beschreibung, Adresse und eindeutig ableitbarer DPT erscheinen in der Vorschau. Zweistufige und dreistufige Adressen werden numerisch abgeglichen; dezimale Werte einer freien Adressdarstellung werden intern dreistufig dargestellt.
4. Existiert dieselbe Adresse bereits im Zielnetz mit anderen Daten, bleibt die Übernahme zunächst gesperrt. Die Vorschau zeigt den Vergleich. Für eine Aktualisierung **Vorhandene Adressen aktualisieren** aktivieren und **Import erneut prüfen** wählen. Auch nach einer Änderung des Zielnetzes erneut prüfen.
5. Den vollständigen Importbericht bei Bedarf herunterladen. Er enthält Änderungen, Befunde, Hinweise und erhaltene XML-Quelldaten. Die Listen in der Oberfläche sind auf jeweils 100 Einträge begrenzt.
6. Erst **Übernehmen** speichert die gesamte geprüfte Änderung. Rückgängig/Wiederholen gilt für den gesamten Import. Zwischenzeitliche Projektänderungen verlangen eine Aktualisierung des Navigators.

Im selben Netz werden bestehende IDs erhalten. Bereits zugewiesene Kommunikationsobjekte bleiben dadurch mit der Gruppe verbunden. Adressen in anderen Netzen bleiben unabhängig; ausgelassene Adressen werden nicht gelöscht. Nicht angegebene Beschreibungen und nicht eindeutig angegebene DPTs leeren vorhandene Werte nicht. Eine ausdrücklich leere XML-Beschreibung leert die Beschreibung.

Ungültige oder doppelte Adressen, reservierte Adresse 0, ungültige Bereichsgrenzen und neue DPT-Widersprüche zu vorhandenen Kommunikationsobjekten blockieren die Übernahme. Die gemeinsame SPS-/Busprüfung wird auf den endgültigen Stand angewendet.

## DPTs und Quelldaten

Eine einzelne passende `DPST`-Angabe wird z. B. als `1.001` geführt. Eine Sequenz mehrerer verschiedener Typen oder ein Basistyp ohne Untertyp wird nicht zu einem erfundenen eindeutigen Typ verdichtet. Stattdessen bleiben die XML-Daten erhalten und der Bericht weist darauf hin. Ein vorhandener Typ im Projekt bleibt in diesem Fall bestehen.

Namen und Attribute der verwendeten Gruppenbereiche, Gruppenadressattribute einschließlich `Central`/`Unfiltered`, DPT-Sequenzen und untergeordnete XML-Inhalte werden als Quelldaten mit dem Projekt gespeichert. Unbekannte Inhalte bleiben Daten; daraus werden weder Geräte noch Kommunikationsobjekt-Zuordnungen oder Leitungen erzeugt. Zusätzliche Attribute der Export-Wurzel werden nicht übernommen und im Importhinweis genannt. Leere Bereiche ohne ausgewählte Gruppenadressen gehören nicht zum Export.

Beim Aktualisieren bleiben nicht erneut angegebene Gruppenadressattribute und Unterelemente erhalten. Eine ausdrücklich gelieferte Bereichshierarchie ersetzt die bisherige Zuordnung; eine flache Eingabedatei entfernt eine vorhandene Bereichszuordnung nicht. Die Quelldaten werden auch bei Bearbeitung per Schematico-CSV bewahrt; die optionale Gruppenbeschreibung wird im Eigenschaftseditor und im XML bearbeitet und in CSV/PDF-Berichten angezeigt. Die Spalten der bisherigen Bearbeitungs-CSV Version 1 bleiben unverändert.

## Export

**ETS-XML exportieren** exportiert das eingetragene Netz innerhalb des aktuellen Suchfilters. Namen, Beschreibungen und bearbeitete DPTs stammen aus dem aktuellen Modell. Unveränderte DPT-Sequenzen und weitere erhaltene Gruppenadressdaten bleiben im XML erhalten. Die Quelldatei wird nicht verändert.

**Bereiche beibehalten** stellt die verwendeten Bereichszuordnungen wieder her. Wurde eine Adresse außerhalb ihres alten Bereichs verschoben oder wurden Quellen mit sich überschneidenden Bereichen zusammengeführt, wird dies ausdrücklich gemeldet. Durch Ausschalten der Option kann eine flache Gruppenadressliste exportiert werden. Der Export nennt dann den Wegfall der Bereichshierarchie für diese Datei.

Wird der eindeutige DPT in Schematico bewusst geändert oder geleert, ersetzt bzw. entfernt der Export die entsprechende DPT-Sequenz und nennt dies im Hinweis. Es wird keine eigene DPT-Registry und keine Geräteprogrammierung ausgeführt.

## Grenzen und Quellen

Beim Einlesen werden UTF-8, UTF-16 (LE/BE) sowie vom Browser unterstützte deklarierte XML-Zeichenkodierungen berücksichtigt. Ungültige Bytefolgen führen zu einem Fehler. Der Export verwendet UTF-8.

Pro Datei gelten 4 MiB und 5.000 Gruppenadressen, höchstens 32 Bereichsebenen. DTD-/Entity-Deklarationen werden nicht verarbeitet. XML muss wohlgeformt sein; nicht unterstützte Strukturelemente und Namensräume werden gemeldet. Die Anwendung prüft das unterstützte Format und Projektkonsistenz, führt aber keine vollständige Hersteller-Schemavalidierung oder Inbetriebnahme aus.

Grundlage sind die offiziellen Beschreibungen der KNX Association zum [Gruppenadress-Export](https://support.knx.org/hc/en-us/articles/360022237580-Group-Address-Export) und [Gruppenadress-Import](https://support.knx.org/hc/en-us/articles/360022237500-Group-Address-Import). Der Namensraum und die Dateistruktur wurden zusätzlich an einem [öffentlich verfügbaren ETS5-Beispielexport](https://github.com/snowdd1/knx-ets5-ga-reader/blob/master/myETS5GroupAddressExport-sample.xml) geprüft. Die automatisierten Tests im Repository verwenden eigene synthetische Daten.

Vollständige `.knxproj`-Dateien, ETS-CSV-Varianten, Loxone-Config-Projekte und AutomationML sind nicht Teil dieser Schnittstelle.
