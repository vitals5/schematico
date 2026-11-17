# Tabellarische Massenbearbeitung für SPS und Busse

Unter **Projekt → SPS- und Busprojektierung…** stehen **Bearbeitungs-CSV exportieren** und **Bearbeitungs-CSV importieren** bereit. Damit lassen sich CPU-, Baugruppen-, Kanal-, Bus-, KNX- und Loxone-Daten in einer Tabellenkalkulation bearbeiten. Die bisherigen CSV-/PDF-Übersichten bleiben lesbare Berichte; sie sind keine Importdateien.

## Ablauf

1. Gewünschten Bereich wählen und bei Bedarf die Suche eingrenzen. Der Bearbeitungsexport enthält alle gefilterten Datensätze dieses Bereichs, auch außerhalb der sichtbaren Tabellenseite. Ein CPU-Export enthält hier nur CPUs; Baugruppen und Kanäle werden in ihren eigenen Bereichen exportiert.
2. **Bearbeitungs-CSV exportieren** wählen.
3. Datei in Excel oder LibreOffice über den **Text-/CSV-Import** öffnen: **UTF-8**, Trennzeichen **Semikolon**, alle Spalten als **Text** importieren. Die erste Zeile ist die Format-/Projektkennung, die zweite enthält die Spaltenüberschriften. Die ersten beiden Zeilen beibehalten. Insbesondere Adressen, Nummern, DPTs und IDs nicht automatisch in Zahlen oder Datumswerte umwandeln lassen.
4. Eigenschaften bearbeiten. `ID` und `Stand` vorhandener Zeilen unverändert lassen. Spalten dürfen umsortiert werden; die Überschriften und alle Spalten müssen erhalten bleiben.
5. Als UTF-8-CSV speichern, keine XLSX-Datei. Semikolon, Komma und Tabulator werden als Feldtrenner unterstützt; Dezimalzahlen erlauben Punkt oder Komma.
6. Datei mit **Bearbeitungs-CSV importieren** einlesen. Der Navigator wählt den Bereich aus der Datei. Die Vorschau zeigt neu angelegte und geänderte Datensätze samt Feldern **Vorher / Nachher** und die Zahl unveränderter Einträge. Große Änderungsübersichten sind vollständig herunterladbar.
7. Erst **Übernehmen** speichert den gesamten geprüften Import in einem Schritt. Rückgängig/Wiederholen gilt für den ganzen Import. Ohne Änderungen bleibt Übernehmen deaktiviert.

## Identität, neue Einträge und leere Felder

- Bestehende Datensätze werden über ihre ID zugeordnet, nicht über BMK, Zeilennummer oder Anzeigename. `Stand` enthält einen SHA-256-Fingerabdruck des exportierten Datensatzes. Wurde er im Projekt zwischenzeitlich geändert, wird ein abweichender Import abgewiesen. Stimmt der gewünschte Datensatz bereits exakt mit dem Projekt überein, ist das erneute Einlesen wirkungslos.
- Dateien sind an das Projekt gebunden, aus dem sie exportiert wurden. Eine ältere Datei legt zwischenzeitlich entfernte Datensätze nicht automatisch wieder an.
- Neue Zeilen erhalten einen leeren `Stand` und eine neue, eindeutige `ID`. Ein leeres ID-Feld erzeugt bei der Vorschau eine Kennung. Pflichtangaben und gültige Elternverweise müssen ausgefüllt werden. Neue CPUs zuerst importieren, dann ihre Baugruppen, danach Kanäle; analog KNX-Teilnehmer/Gruppen vor ihren Kommunikationsobjekten und Loxone-Schnittstellen vor den zugeordneten Geräten. Eltern-IDs lassen sich aus dem jeweiligen Bereich exportieren.
- Ein leerer Funktionstext bzw. eine leere Beschreibung leert das betreffende Feld. Leere optionale Felder lösen die jeweilige Zuordnung; erforderliche Werte werden von der gemeinsamen Prüfung kontrolliert.
- Die Spalten einer Zeichnungszuordnung müssen vollständig ausgefüllt oder vollständig leer sein: Blatt-ID und Element-ID sowie bei Kanalrollen die tatsächliche Anschluss-ID. Die Prüfung verwendet echte Bibliotheksanschlüsse. Nicht bearbeitete Eigenschaften und zusätzliche, nicht als Spalte dargestellte Metadaten bleiben erhalten.
- Nicht enthaltene oder aus der CSV entfernte Zeilen **löschen keine Datensätze**. Entfernen erfolgt weiterhin gezielt im Navigator.

## Prüfung und Konflikte

Alle Zeilen werden zunächst zusammengeführt, anschließend wird der gesamte Endzustand mit derselben SPS-/Busprüfung wie bei der Einzelbearbeitung geprüft. So ist beispielsweise ein gegenseitiger Tausch zweier E/A-Adressen möglich, obwohl die erste Änderung allein eine Überschneidung erzeugen würde. Ungültige Endzustände, neue doppelte Adressen, unpassende Datenpunkttypen, verlorene Referenzen, Tree-Querverbindungen oder überschrittene Schnittstellenkapazitäten blockieren die gesamte Übernahme.

Fehler erscheinen mit CSV-Zeile, Datensatz-ID und gegebenenfalls Spalte. `Projektprüfung` bezeichnet eine betroffene Referenz außerhalb der geänderten CSV-Zeilen. **Fehlerbericht herunterladen** liefert sämtliche Befunde als JSON; große Fehlerlisten werden in der Oberfläche gekürzt. Korrigierte Dateien erneut einlesen. Bei zwischenzeitlichen Änderungen im geöffneten Projekt muss der Navigator aktualisiert werden; die alte Vorschau wird nicht angewendet.

## Feldwerte

| Bereich/Feld | Werte |
|---|---|
| Kanaltyp | `DI`, `DO`, `AI`, `AO` |
| Reserve | `true`/`false`, `ja`/`nein` oder `1`/`0` |
| Loxone-Schnittstellenrolle | `interface` (Schnittstelle/Tree-Zweig), `device` oder leer (Gerät) |
| Loxone-Schnittstellenprofil | `air-base` oder `generic`; nur an der passenden Schnittstelle |
| KNX-Richtung | `send`, `receive`, `both` |
| Protokoll | Die Namen aus dem Navigator, z. B. `KNX TP`, `Loxone Tree`, `PROFINET` |

Mehrzeilige Texte und Anführungszeichen werden als normale CSV-Zellen erhalten. Für Texte, die als Tabellenformel interpretiert werden könnten, fügt der Export reversibel ein führendes Apostroph hinzu; dieses wird beim Import entsprechend dem Dateiformat wieder entfernt. Ursprüngliche Apostrophe bleiben erhalten. Keine Formeln in der Tabelle berechnen lassen.

Pro Datei sind höchstens 5.000 Datensätze und 4 MiB erlaubt. Größere Bereiche über Suchfilter in mehrere Dateien aufteilen. Die Prüfung ist eine Daten-/Zuordnungsprüfung; Schaltzeichen, Beschriftungen und elektrische Verdrahtung werden nicht verändert. Das Format ist ein Schematico-Datenaustausch, kein nativer Import aus Engineeringsoftware. Für AutomationML gibt es den separaten [vorlagenbasierten APC-Austausch](automationml.md), für KNX den [Gruppenadress-XML-Austausch](knx-xml.md).
