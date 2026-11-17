# Vorlagenbasierter SPS-Datenaustausch mit AutomationML

**Projekt → SPS- und Busprojektierung → AutomationML…** öffnet den nativen SPS-Datenaustausch. Grundlage ist eine aus dem SPS-Werkzeug exportierte `.aml`-Vorlage nach **AutomationML Application Recommendation Automation Project Configuration (AR APC)**.

Schematico liest die unterstützten Steuerungen, Baugruppen und E/A-Kanäle in sein Projektmodell ein. Beim Rückexport wird die ursprüngliche XML-Datei aktualisiert: Hersteller-/Hardwaretypen, Firmware, Buskonfiguration, Bibliotheken und unbekannte Zusatzdaten werden nicht neu erfunden oder aus dem vereinfachten Schematico-Modell rekonstruiert. Die vollständige Vorlage und ihre Identitätszuordnungen werden im Projekt gespeichert; dadurch wird die Projektdatei entsprechend größer.

## Ablauf

1. Im SPS-Werkzeug eine AutomationML-APC-Datei exportieren. In Schematico **AutomationML… → AML-Vorlage öffnen** wählen.
2. Änderungen und Hinweise prüfen. Der herunterladbare Prüfbericht enthält alle Datensatz-/Feldänderungen sowie Fehler mit nativen Kennungen; die Bildschirmlisten sind begrenzt.
3. **Import übernehmen** speichert die geprüften Daten und die Vorlage gemeinsam. Vorhandene zugeordnete Daten werden nur mit aktivierter Option **Vorhandene zugeordnete SPS-Daten aktualisieren** geändert. Die Datei kann über **Import erneut prüfen** nochmals abgeglichen werden.
4. Unter E/A-Kanäle Adresse, symbolischen SPS-Namen, Signaltext und unterstützten Datentyp bearbeiten. Die normale SPS-/Busprüfung und die Zuordnung echter Zeichnungsanschlüsse bleiben verfügbar.
5. **AutomationML… → AML-Rückexport prüfen** wählen. Der Dialog nennt nicht exportierte lokale Datensätze, unmodellierte Inhalte und blockierende Änderungen.
6. Nur bei erfolgreicher Prüfung lässt sich **Geprüfte AML herunterladen** verwenden. Das Ergebnis wird vor Freigabe nochmals eingelesen und mit den beabsichtigten Kanalwerten verglichen.
7. Die Datei im SPS-Werkzeug importieren und dort dessen Geräte-/Hardwareprüfung ausführen. Nach Änderungen dort erneut in Schematico einlesen.

Rückgängig/Wiederholen umfasst den gesamten Import. Exportieren ändert das Projekt nicht. Wird das Projekt zwischen Vorschau und Übernehmen oder Herunterladen verändert, verlangt der Dialog eine Aktualisierung und erneute Prüfung. Auch eine ausschließlich geänderte native Vorlage, etwa neue unmodellierte Busdaten ohne Änderungen der eingelesenen Kanäle, kann ausdrücklich übernommen werden.

## Unterstütztes Profil

- CAEX `SchemaVersion="2.15"` und `3.0`; bei Verwendung eines XML-Namensraums `http://www.dke.de/CAEX`.
- APC-Rollen `Device`, `DeviceItem` und `TagTable`; CPU-Erkennung über den standardisierten `DeviceItemType=CPU`, nicht über Produktnamen.
- Materialisierte `Channel`-/`Tag`-Schnittstellen mit APC-Klassenreferenzen. Lokal vorhandene, auflösbare Klassenableitungen und einfache SystemUnitClass-Attributvererbung werden berücksichtigt. Externe Bibliotheken werden nicht nachgeladen; geerbte, nicht auf Instanzebene materialisierte Kanäle werden gemeldet.
- Kanaltyp aus `Type=Digital/Analog` und `IoType=Input/Output`, numerische Kanalnummer sowie explizite Tag-Verknüpfungen über `InternalLink`. CAEX-Klammerung und Escaping der Endpunktnamen werden beim Rückexport berücksichtigt.
- CPU-Zuordnung über verknüpfte Tags bzw. explizite `ModuleAssignment`-Verbindungen; bei einer eindeutigen CPU im Device oder einer einzigen CPU insgesamt ist auch eine eindeutige implizite Zuordnung möglich. Mehrdeutige bzw. mehrere CPU-Zuordnungen eines Moduls werden nicht auf eine geraten.
- Ein Kanal verwendet höchstens einen zugeordneten Tag. Unzugeordnete Kanäle und nicht in das Modell übernommene Tags bleiben in der Vorlage erhalten. Kanalnummern sind innerhalb einer Baugruppe **je Kanaltyp** eindeutig; etwa DI 0 und DO 0 sind unabhängig.
- Vollständige E/A-Adressen sowie richtungslose Bit-, Byte-, Wort- und Doppelwortadressen, soweit Typ und Datenbreite eindeutig sind. Symbolische/andere Herstelleradressen bleiben Text; daraus wird keine universelle Speicherinterpretation abgeleitet.

Native Instanz-IDs sowie Baugruppen-ID, Kanalnummer, Kanaltyp und Richtung dienen zur Wiedererkennung. Eine bloße Umbenennung einer CAEX-Schnittstelle erzeugt keinen neuen Kanal. Veränderte physische Kanalidentitäten werden entsprechend getrennt behandelt. Vorhandene Schematico-Zeichnungsbindungen bleiben bei Updates derselben Identität erhalten. Fehlen frühere Datensätze in einer neu eingelesenen Datei, werden sie nicht automatisch gelöscht; der Bericht nennt sie. Falls solche Altdaten beispielsweise Adresskonflikte erzeugen, müssen sie gezielt im Navigator bereinigt werden.

## Rückexport und Grenzen

Der Rückexport umfasst ausschließlich die **zugeordneten Datensätze der gespeicherten Vorlage**, unabhängig von Suchfiltern des Navigators. Zusätzliche lokale Steuerungen/Baugruppen/Kanäle außerhalb dieser Vorlage werden gezählt und nicht in eine erfundene Hardwarestruktur übersetzt. Für einen neuen Hardwarestand zuerst im SPS-Werkzeug eine neue Vorlage erzeugen und erneut einlesen.

Unterstützte Änderungen sind BMK/Strukturkennzeichen und einfache Kommentare, symbolische Tagnamen, E/A-Adressen sowie kompatible IEC-Datentypänderungen. Unterstützte neue Typwerte sind BOOL, BYTE, WORD, DWORD, INT, UINT, DINT, UDINT und REAL. Änderungen mit abweichender oder unbekannter Kanalbreite werden blockiert. Bestehende herstellerspezifische Typinformationen bleiben unverändert in der Vorlage erhalten. Mehrsprachig/strukturiert modellierte Kommentare werden nicht durch eine einzelne Zeichenkette überschrieben.

Rack-/Steckplatz-/CPU-Wechsel, Änderungen an Baugruppen-/Kanalidentitäten, fehlende zugeordnete Datensätze und neue Tag-Zuordnungen ohne vorhandenen Tag erfordern eine Aktualisierung im SPS-Werkzeug. Unvollständige oder widersprüchliche Konfigurationen erzeugen keine teilweise ausgegebene Datei. Die Reservekennzeichnung kann als ausdrücklich benanntes **Schematico.Reserve**-Metadatum in `CustomAttributes` mitgeführt werden; sie ist keine herstellerübergreifende Hardwareprogrammierung.

Die native Bus-/Netzstruktur bleibt in der XML-Vorlage erhalten und wird noch nicht in den Schematico-Busnavigator übersetzt. ComplexTag-/Strukturvariablen werden nicht abgeflacht. `.amlx`-Container, vollständige PLC-Programme und das Erstellen einer herstellerspezifischen Hardwarekonfiguration aus einem leeren Schematico-Projekt sind nicht enthalten. Externe Referenzdateien müssen beim empfangenden Werkzeug weiterhin verfügbar sein. Es gibt keine Online-Geräteprogrammierung und keine vollständige Hersteller-/Schemavalidierung.

Die bestehenden Bearbeitungs-CSVs Version 1 behalten ihre Spalten. Symbolischer Name und SPS-Datentyp sind im Eigenschaftseditor bearbeitbar und in Berichten sichtbar; nicht als CSV-Spalte dargestellte Werte und die AML-Vorlage bleiben bei CSV-Bearbeitung erhalten.

Es gelten höchstens 4 MiB XML und 5.000 Kanäle je Vorlage. DTD-/Entity-Deklarationen werden nicht verarbeitet. XML-Bytekodierungen werden geprüft dekodiert. Die Vorlage wird nur beim ausdrücklichen Datenaustausch analysiert, nicht während des Zeichnens oder beim Verschieben der Ansicht.

## Quellen und Validierung

Grundlage sind das offizielle [AutomationML-Spezifikationsverzeichnis](https://www.automationml.org/about-automationml/specifications/) und das dort verlinkte [AR-APC-Paket Version 1.4.0](https://www.automationml.org/wp-content/uploads/2023/07/AR-APC-V1.4.0.zip). Ausgewertet wurden die Rollen-/Schnittstellendefinitionen, Tag-/Kanalverknüpfungen, Namens-Escaping und Identitätsregeln des Roundtrips. Der vorlagenbasierte Ansatz folgt dem beschriebenen Einstieg mit einem initialen SPS-Projekt.

Die offiziellen Dokumente und Bibliotheken wurden zur Prüfung herangezogen und nicht in das Repository kopiert. Automatische Tests verwenden eigene synthetische Instanzen, einschließlich Klassenableitungen, gemischter I/O-Nummerierung, ModuleAssignment, nativer Identitätsstabilität und XML-Rückeinlesen. Diese Tests ersetzen keine Abnahme mit einem konkreten Herstellerwerkzeug und dessen exportierter Projektdatei.
