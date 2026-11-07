# Artikelpakete importieren

Unter **Artikelkatalog → Importieren** lassen sich `.wspak` und `.edz` auswählen. Auch Drag-and-drop auf die Zeichenfläche und **Datei öffnen** leiten diese Pakete in die Artikelvorschau weiter. Importieren ersetzt kein geöffnetes Projekt. Erst **Vorschau übernehmen** schreibt die Datensätze in den lokalen Katalog. Vorhandene Einträge werden anhand von Hersteller, Artikelnummer und Variante auf Konflikte geprüft.

## Unterstützte Daten

- WSPAK: ZIP-Pakete mit `Data/part.json` (auch mit Backslashes im Archivpfad). Hersteller, Bestellnummer, Typbezeichnung, lokalisierte Beschreibung, Spannung/Strom und vorhandene Abmessungen werden aus den Daten übernommen. Die Bestellnummer ist die Artikelnummer; die zusätzliche Typnummer bleibt in der Beschreibung erhalten.
- EDZ: ZIP- und 7z-Container mit strukturierten Artikel-XML-Dateien. Herstellerkürzel werden anhand der mitgelieferten Herstellerdatensätze aufgelöst. Artikelvarianten bleiben getrennt. Beschreibungen werden bevorzugt in der eingestellten Sprache gelesen.
- Beide Formate: Datensätze bleiben ungeprüft. Es gibt keine automatische Veröffentlichung im gemeinsamen GitHub-Katalog und keine automatische Symbolauswahl.

Die geprüften Anwenderbeispiele ergeben `Busch-Jaeger / 2CKA001011A0928` und `Siemens AG / 5SL6116-6 / Variante 1`. Private Originalpakete sind nicht Teil des Repositorys.

## Grenzen

Der Import betrifft Artikeldaten. Binäre `.wsLIB`-Bibliotheken, `.mdb`-Datenbanken, eingebettete Makros, Bilder, PDF-Datenblätter und 3D-Geometrien werden hier nicht als Zeichenelemente oder Artikelanhänge übernommen. Die Vorschau weist auf eingebettete Symbol-/Makrodateien hin. Ältere Pakete ohne lesbare Artikel-JSON beziehungsweise Artikel-XML werden abgelehnt. Funktionsdefinitionen werden nicht aus Produkttexten oder unbekannten numerischen Vorlagen geraten. Ein Standardsymbol kann nach dem Import über **Symbol zuordnen…** ausgewählt werden.

## Herstellerportal

**Herstellerportal öffnen** öffnet `https://www.wscaduniverse.com/` im Browser. Dort erfolgt die Registrierung beziehungsweise Anmeldung direkt beim Anbieter. Heruntergeladene Artikelpakete können anschließend importiert werden. In der Desktop-App öffnet ausschließlich eine feste HTTPS-Adresse im Systembrowser; Zugangsdaten und Sitzungscookies werden nicht an Schematico übertragen.

Eine integrierte Suche und ein automatischer Abruf über eine Anbieter-API sind noch nicht implementiert. In der untersuchten öffentlichen Webanwendung sind ein eigener Anmeldeserver und ein Web-Backend erkennbar. Das belegt keine für Drittanbieter freigegebene API. Für eine stabile direkte Anbindung benötigen wir dokumentierte Such-/Download-Endpunkte, ein unterstütztes Authentifizierungsverfahren und gegebenenfalls eine eigene registrierte Anwendung beim Anbieter. Interne Webseiten-Endpunkte oder die Anwendungskonfiguration des Anbieters werden dafür nicht als freigegebene Schnittstelle ausgegeben.
