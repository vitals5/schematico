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

Alle eingebetteten `.ema`, `.ems` und `.wsLIB` werden zusätzlich als unveränderte Originalbytes gespeichert. **Originaldateien sichern** im Artikelkatalog lädt eine ZIP-Datei mit den Quelldateien und den Artikeldaten herunter. Das ist eine Quellsicherung; der normale JSON-/CSV-Katalogexport enthält keine binären Paketdateien. Löschen des lokalen Artikels entfernt seine Paketzuordnung.

Die binäre `.wsLIB` des geprüften WSPAK kann noch nicht decodiert werden. Sie wird daher gesichert und ausdrücklich als noch nicht lesbar angezeigt. Ebenso bleiben 3D-Makros im Original erhalten; eine 3D-Umwandlung ist nicht implementiert. Es gibt keine behauptete vollständige Unterstützung aller Bibliotheksversionen. Bilder, PDF-Datenblätter und Datenbanken werden durch diesen Schritt nicht als Artikelanhänge übernommen.

## Herstellerportal

**Herstellerportal öffnen** öffnet `https://www.wscaduniverse.com/` im Browser. Dort erfolgt die Registrierung beziehungsweise Anmeldung direkt beim Anbieter. Heruntergeladene Artikelpakete können anschließend importiert werden. In der Desktop-App öffnet ausschließlich eine feste HTTPS-Adresse im Systembrowser; Zugangsdaten und Sitzungscookies werden nicht an Schematico übertragen.

Die Portalnutzung bleibt bewusst manuell. Eine integrierte API-Suche oder automatisierte Anmeldung ist nicht vorgesehen.
