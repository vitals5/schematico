# Artikelpakete importieren

Unter **Artikelkatalog → Importieren** lassen sich `.wspak` und `.edz` auswählen. Auch Drag-and-drop auf die Zeichenfläche und **Datei öffnen** leiten diese Pakete in die Artikelvorschau weiter. Importieren ersetzt kein geöffnetes Projekt. Erst **Vorschau übernehmen** schreibt die Datensätze in den lokalen Katalog. Vorhandene Einträge werden anhand von Hersteller, Artikelnummer und Variante auf Konflikte geprüft.

## Unterstützte Daten

- WSPAK: ZIP-Pakete mit `Data/part.json` (auch mit Backslashes im Archivpfad). Hersteller, Bestellnummer, Typbezeichnung, lokalisierte Beschreibung, Spannung/Strom und vorhandene Abmessungen werden aus den Daten übernommen. Die Bestellnummer ist die Artikelnummer; die zusätzliche Typnummer bleibt in der Beschreibung erhalten.
- EDZ: ZIP- und 7z-Container mit strukturierten Artikel-XML-Dateien. Herstellerkürzel werden anhand der mitgelieferten Herstellerdatensätze aufgelöst. Artikelvarianten bleiben getrennt. Beschreibungen werden bevorzugt in der eingestellten Sprache gelesen.
- Beide Formate: Datensätze bleiben ungeprüft. Es gibt keine automatische Veröffentlichung im gemeinsamen GitHub-Katalog und keine automatische Symbolauswahl.

Die geprüften Anwenderbeispiele ergeben `Busch-Jaeger / 2CKA001011A0928` und `Siemens AG / 5SL6116-6 / Variante 1`. Private Originalpakete sind nicht Teil des Repositorys.

## Symbole, Makros und Originaldateien

Artikel und Paketdateien werden gemeinsam in einer lokalen IndexedDB-Transaktion gespeichert. Vor dem Übernehmen der Vorschau wird nichts in die Bibliothek geschrieben. Ein veralteter oder fehlgeschlagener Import darf auch keine Makrodateien hinterlassen.

Lesbare 2D-Makros werden mit dem vorhandenen Makroimporter ohne heuristische Ersatzsymbole gelesen. Sie erscheinen anschließend bei dem zugehörigen Artikel und in der Makrobibliothek. Im Editorbereich **Artikel** lässt sich das gewünschte Paketmakro auswählen und über **Originalmakro platzieren** einsetzen. Seine Symboldefinitionen werden in der Projektbibliothek gespeichert; die platzierten Elemente unterstützen Eigenschaften, Verschieben, Löschen und Rückgängig/Wiederholen. Die Artikelzuweisung wird am größten Hauptelement des gewählten Makros hinterlegt.

Das geprüfte EDZ enthält ein lesbares 2D-Geräte-/Montagemakro mit zwei Elementen. Es besitzt keine elektrischen Anschlüsse. Der Import erfindet keine Pins und macht daraus keinen elektrisch anschließbaren Leitungsschutzschalter. Für eine Stromlaufdarstellung ist weiterhin ein entsprechendes Schaltzeichen oder ein dafür bestimmtes Herstellermakro nötig.

Alle eingebetteten `.ema`, `.ems` und `.wsLIB` werden zusätzlich als unveränderte Originalbytes gespeichert. **Originaldateien sichern** im Artikelkatalog lädt eine ZIP-Datei mit den Quelldateien und den Artikeldaten herunter. Zusätzlich enthält die ZIP die lesbaren beziehungsweise bestätigten Makros als JSON im Ordner `macros/`; diese Dateien lassen sich wieder über die Makrobibliothek importieren. Das ist eine Quellsicherung; der normale JSON-/CSV-Katalogexport enthält keine binären Paketdateien. Löschen des lokalen Artikels entfernt seine Paketzuordnung.

Die binäre `.wsLIB` des geprüften WSPAK kann noch nicht decodiert werden. Sie wird daher gesichert und ausdrücklich als noch nicht lesbar angezeigt. Ebenso bleiben 3D-Makros im Original erhalten; eine 3D-Umwandlung ist nicht implementiert. Es gibt keine behauptete vollständige Unterstützung aller Bibliotheksversionen. Bilder, PDF-Datenblätter und Datenbanken werden durch diesen Schritt nicht als Artikelanhänge übernommen.

## WSPAK und DWG gemeinsam verwenden

Die Artikeldaten aus einem WSPAK können mit der separat heruntergeladenen DWG desselben Artikels kombiniert werden. Die Dateinamen werden nicht als Nachweis einer Artikelzuordnung verwendet.

1. Das WSPAK wie gewohnt importieren. Bereits in der Artikelvorschau kann über **CAD-Symbol zum Artikel hinzufügen** die Geometrie ergänzt werden. Bei einem vorhandenen Artikel steht dieselbe Schaltfläche unter **Bearbeiten** zur Verfügung.
2. **DWG auswählen** öffnet den eigenständigen lokalen DWG→DXF-Konverter. Dort die DWG auswählen und **DXF an Schematico übergeben** anklicken. Alternativ lässt sich eine vorhandene ASCII-DXF direkt auswählen. Kein Upload und kein Portalzugriff sind nötig.
3. CAD-Block, Zeichnungseinheit, Symbolname, Kategorie und BMK-Kennbuchstabe prüfen. Ein CAD-Text kann dem editierbaren BMK zugeordnet werden. Die Vorschau enthält die aus der Datei gelesene Geometrie einschließlich Bögen und Textdrehungen.
4. Tatsächliche elektrische Anschlüsse aus den vorgeschlagenen Linienenden aktivieren oder manuell ergänzen. Bezeichnung, Position, Anschlussrichtung und zugehörigen CAD-Text prüfen. Vorschläge sind zunächst deaktiviert. Ein Grafikimport ohne elektrische Anschlüsse muss ausdrücklich gewählt werden.
5. Das Anschlussraster wählen. Bei **8 mm** wird das ganze Symbol gleichmäßig skaliert, ausgehend vom kleinsten Abstand bestätigter Anschlüsse. So wird etwa ein ursprünglicher Abstand von 7,5 mm zu 8 mm. Unvereinbare Anschlussabstände werden gemeldet; einzelne Grafikpunkte werden nicht unabhängig verschoben. **Originalmaß beibehalten** übernimmt den ursprünglichen Maßstab.
6. Die Prüfung bestätigen, **Symbol zuordnen** wählen und danach die Artikelvorschau übernehmen. Bis zu diesem letzten Schritt werden weder Artikel noch Quelldateien dauerhaft geschrieben.

Der Artikel besitzt danach ein eigenes, platzierbares Bibliothekssymbol. Seine bestätigten Anschlüsse nutzen normales Autoconnect. Die Artikelzuweisung sowie Eigenschaften, Verschieben, Löschen und Rückgängig/Wiederholen funktionieren wie bei anderen Elementen. Beim Platzieren werden die Symbolstammdaten in die Projektbibliothek übernommen und bleiben beim JSON-Projektexport erhalten. Die Quelldateien und die bestätigte Makrodefinition bleiben im lokalen Artikelkatalog gespeichert. Der Artikel wird damit nicht automatisch veröffentlicht oder als fachlich geprüft eingestuft.

Unterstützt sind zunächst ebene 2D-Linien, Polylinien einschließlich Bulge-Bögen, Kreise, Kreisbögen, Ellipsen, einfache Texte und gefüllte Flächen sowie verschachtelte Blockeinfügungen mit Maßstab, Drehung und Einfügepunkt. Allgemeine Ellipsen werden als Liniensegmente abgebildet; Kreisbögen bleiben Bögen. Nicht unterstützte Objekttypen werden angezeigt und verlangen eine ausdrückliche Bestätigung einer Teilübernahme. Rekursive/fehlende Blöcke, räumliche Geometrie und nicht unterstützte Textformatierungen führen zu einer Fehlermeldung. Zeichnungen ohne bekannte Einheit benötigen eine Einheitsauswahl. Maximal 20 MiB pro CAD-Datei, 50.000 Grafikobjekte und 256 bestätigte Anschlüsse.

### Eigenständiger CAD-Konverter

Die MIT-Hauptanwendung liest DXF mit dem MIT-lizenzierten Parser `dxf-parser`. Die optionale DWG-Umwandlung erfolgt in einem eigenen Dokument und Worker unter `cad-converter/`, ohne die DWG-Engine in den Hauptanwendungs-Code zu importieren. Dieser auch unabhängig nutzbare Dateikonverter steht unter **GPL-3.0** und verwendet LibreDWG/WebAssembly. Lizenz und vollständiger zugehöriger Quellcode sind direkt im Konverter verlinkt und werden mitgeliefert. Die Kommunikation übergibt Standard-DXF-Dateien und optional unveränderte DWG-Quelldateien, keine internen Schaltungsobjekte.

`npm run dev` und `npm run build` bereiten den Konverter automatisch vor. Hierfür werden einmalig die separat gesperrte npm-Abhängigkeit und das per SHA-256 geprüfte Quellarchiv benötigt; danach kann der lokale Cache wiederverwendet werden. Bei Weitergabe müssen die GPL-Lizenz und die Konverterquellen erhalten bleiben. Der Konverter ist auf Web, Windows und Linux lokal verwendbar; bei blockierten Zusatzfenstern kann eine anderweitig erzeugte DXF direkt importiert werden.

## Herstellerportal

**Herstellerportal öffnen** öffnet `https://www.wscaduniverse.com/` im Browser. Dort erfolgt die Registrierung beziehungsweise Anmeldung direkt beim Anbieter. Heruntergeladene Artikelpakete können anschließend importiert werden. In der Desktop-App öffnet ausschließlich eine feste HTTPS-Adresse im Systembrowser; Zugangsdaten und Sitzungscookies werden nicht an Schematico übertragen.

Die Portalnutzung bleibt bewusst manuell. Eine integrierte API-Suche oder automatisierte Anmeldung ist nicht vorgesehen.
