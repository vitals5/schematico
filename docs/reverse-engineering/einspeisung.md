# Projektarchiv: allgemeiner Bibliotheksimport

Stand: 17.10.2026. Ausgangspunkt ist PDF-Seite 2 „Einspeisung“ des
bereitgestellten PDF-Exports. Grundlage sind ausschließlich die beiden
unveränderten Archivteile (`.001` und `.002`). Der PDF-Export wird nicht eingeblendet.

## REA und Evidenz

Untersuchungsworkflow: [REA von morluto/rea](https://github.com/morluto/rea),
[reverse-engineer-anything/SKILL.md](https://github.com/morluto/rea/blob/main/.agents/skills/reverse-engineer-anything/SKILL.md).
Das vorhandene REA-Artefaktinventar wird weiterverwendet:

- CLI `rea-agents@6.5.0 inspect-artifact /tmp/haus.zip --format json`.
- Evidence `ev_de4dc0fb509a8c5e9b4e0f8cea75543cdb07faa07664ed13c6242903550e644b`.
- Zusammengefügtes ZIP SHA-256:
  `6fdf42f60f4728528b87ebfed9fef7b610122d8563f6801a1a0d6e46cd81d028`.
- Provider `rea-artifact-graph`, Version 1.

REA belegt Container und Mitgliederinventar. Die folgenden EOD-Felder wurden
durch eigene begrenzte Byte-Proben, Identitäts-/Indexabgleich und Abgleich mit
dem Beispiel untersucht. Sie sind keine vom REA-Provider behauptete
formatspezifische Semantik. Es wurde keine Quellsystem-Installation ausgeführt.

## Gemeinsamer Importweg

Der frühere, auf den Seitentitel „Einspeisung“ begrenzte Nachzeichnungsweg ist
entfernt. Der Projektimporter liest die Tabellen einmal pro Projekt und verwendet
denselben Import für alle aktiven Seiten, unabhängig vom Titel.

Der Bibliotheksimporter liest die mitgelieferten `.sdb`-Stammdaten. Die Zuordnung
der Bibliotheksindizes stammt aus dem benannten Setting
`TrDMProject.EmbeddedMasterDataLibraries.SymbolLibs` in
`Settings.xdb/Setting.eod`; Bibliotheksnummern werden nicht fest einprogrammiert.
Für das Beispiel lautet diese Liste:
`SPECIAL`, `IEC_symbol`, `IEC_single_symbol`, leer, `GRAPHICS`, `PNE1ESS`,
`HYD1ESS`, `HYD2ESS`, leer.

| Daten | Eigenschaft | Bedeutung |
| --- | --- | --- |
| Platzierung | `EF4D`, `EF4E`, `EF4F` | Bibliotheksindex, öffentliche Symbolnummer, Variante |
| Symbol | `EB51`, `EB52` | Name, öffentliche Nummer (verschieden von Objekt-ID) |
| Variante | `ED95`, `ED96` | Elternsymbol-Objekt, Variantenindex |
| Anschlussblock | `ED97` | Beginn eines physischen Anschlusses |
| Anschluss | `EDBD`, `EDBE`, `EDBF` | physischer Index, lokale Position, Richtung |
| Bibliotheksgrafik | `EBF1` | Elternvariante |
| Platzierung | `ED5A`, `EBF2` | Position in mm, gezeichnete Seite |
| Beschriftungsplatzierung | `EA65`, `ED63`, `EC55` | Unterobjekt, Feldnummer, lokale Textposition |
| Verbindung | `EB2B`, `EB2C`, `EB2E`, `EB2F` | Quell-/Zielobjekt und physische Anschlussindizes |

Omittierte Standardwerte wie Anschlussindex 0 oder Koordinate (0,0) sind
zulässig. Die Pins werden nur aus dem Variantenkopf gelesen, vor den
Beschriftungs-Unterobjekten. Richtungen 1/2/4/8 entsprechen oben/rechts/unten/links.
Koordinaten werden genau einmal von mm mit Ursprung unten links ins y-abwärts
gerichtete Editor-Koordinatensystem umgerechnet.

| Tabelle | Slotgröße (Bytes) | Index |
| --- | ---: | --- |
| Page | 1134 | untypisiert |
| Function | 1333 | typisiert |
| IPoint | 530 | typisiert |
| Instance (Projekt) | 215 | typisiert |
| Potential | 513 | untypisiert |
| Connection | 980 | untypisiert |
| Symbol (.sdb) | 901 | untypisiert |
| Variant (.sdb) | 635 | untypisiert |
| Instance (.sdb) | 134 | untypisiert |

Die Symbolkonturen stammen aus den Grafikobjekten der referenzierten Variante,
nicht aus einer Tabelle handgezeichneter Ersatzsymbole. Enthalten sind Linien,
Kreise, Rechtecke, Polygone und literale Symboltexte. Property-Platzhalter werden
nicht als feste Texte in Symbole kopiert. Variable Gerätekästen erhalten eine
gemeinsame größenabhängige Definition anhand ihrer Quellausdehnung.

## Editierbares Projektmodell

- `Project.symbolLibrary` enthält gemeinsame Definitionen. Jede Platzierung
  referenziert ausschließlich eine `symbolId`, mit eigenen Eigenschaften,
  Position, Rotation und Anschlussbezeichnungen.
- Keine neuen Inline-Definitionen in `component.importedSymbol` und keine
  seitenbezogene eingefrorene Zeichnung. Ältere JSON-Projekte werden beim Laden
  in gemeinsame Stammdaten überführt.
- Freie Texte sind normale editierbare Text-Platzierungen mit Funktionstext;
  freie Grafikobjekte referenzieren ebenfalls gemeinsame Projektressourcen.
- Die mitgebrachten Symbole erscheinen in der regulären Bibliothek und können
  neu platziert werden. Makros nehmen verwendete Stammdaten mit.
- Editor: normale dunkle Fläche, Raster, Farben, Auswahl, Verschieben, Drehen,
  Eigenschaftendialog, Anschlussbezeichnungen und Verdrahtung.
- PDF: weißes Papier, Druckfarben und aktuelle bearbeitete Eigenschaften.
- JSON, eigenes Projekt-XML und eigene `.zw1`-Archive erhalten die Stammdaten.
  Das ist kein Rückexport der proprietären Quellsystem-Datenbank.

Die explizit importierte Leitungsstruktur wird beim Öffnen erhalten. Autoconnect
erfindet keine zusätzlichen Kanten zwischen unveränderten Quellplatzierungen;
neue Editorplatzierungen können weiterhin automatisch verbunden werden.
Gleiches BMK allein beweist bei Quellprojekt-Geräteanschlüssen keinen Kontaktspiegel.

## Befund für das Beispiel

Alle 4.206 Bibliotheksverweise der untersuchten Objektklassen lassen sich
auflösen: 2.215 Function-, 1.681 Instance-, 302 IPoint- und 8 Potential-Objekte.
Alle 3.830 Quell-/Zielanschlüsse der 1.915 Verbindungsdatensätze existieren in
der jeweiligen Bibliotheksvariante.

- Die 1.915 Datensätze bilden eine elektrische Endpunkt-Netzliste. 1.753 tragen
  eine Seitenzuordnung, 162 keine. Alle bleiben in `logicalConnections` erhalten.
  Sie sind keine Liste der sichtbaren Leitersegmente: Bei Wohnzimmer-Motoren
  fehlen beispielsweise N-/PE-Zeilen, obwohl das PDF diese Leiter zeigt.
- `page.wires` enthält deshalb die aus gerichteten Bibliotheksanschlüssen und
  Quell-Routingknoten rekonstruierten, editierbaren Leiterabschnitte. Einseitige
  Kontakte dürfen keine direkte Sternverdrahtung durch nachfolgende Geräte erhalten.
- Der indexierte Page-Bestand enthält 48 aktive Seiten: die 45 Seiten des
  Referenzumfangs sowie Inhaltsverzeichnis und zwei Klemmenberichte. Die vier
  zuvor durch rohe Markersuche wiedergefundenen gelöschten Steckerberichte
  werden nicht mehr übernommen.
- Q12 hat zwei separate physische Platzierungen mit derselben
  `IEC_symbol:1526:0`-Definition. Deren 28 Konturobjekte und acht physische Pins
  stammen aus `QLTR4_2` der mitgelieferten Bibliothek.

## Anschlüsse, Kreuzungen und T-Verbindungen

Der Abgleich mit den PDF-Vektoren verwendet weiterhin dieselbe REA-Artefaktidentität.
Die gerichteten Varianten `SPECIAL 64/66/67/69/72` bestehen aus originalen
Bibliothekslinien mit diagonalen Abzweigen; `70` enthält Eckvarianten. Im Beispiel
wird keine automatische Routing-Platzierung mit Punktvariante 8 verwendet.
Eine Kreuzung ohne Quell-Verbindungssymbol erhält keinen aus Koordinaten
erfundenen Verbindungspunkt. Die elektrische Kantenliste bleibt unverändert.

- `Layer.eod/eox`: indexierte Slots mit 284 Bytes; `EFF2` ist die Ebenennummer,
  `EFF5` die Strichstärke in mm, `EE21` die nominale Textgröße. Ebene 311 enthält
  0,25 mm, Ebene 317 1 mm. Bei `SPECIAL 77:1` bleiben deshalb die dicken
  Sammelschienen und der dünne Abzweig verschieden. `EFFB=8` ist kein belegtes
  Ausblendungsbit und wird nicht so verwendet.
- Die Leitungstinte wird innerhalb der tatsächlichen, gedrehten Konturgrenzen
  eines Verbindungssymbols ausgespart. Das Bibliothekssymbol zeichnet dort die
  Geometrie. Die vollständige Leitung bleibt auswählbar; Modell, Anschlussindizes
  und gespeicherte Wegpunkte werden durch diese Darstellung nicht verändert.
  Editor, Verschiebevorschau und PDF verwenden dieselben Linienzüge.
- Der Quell-Funktionstyp 1400 bezeichnet Verteiler. Liegt ein explizites
  Routing-Symbol mit gleicher Anschlussrichtung und gleichem Anker über einem
  solchen Funktionsobjekt, liefert das Routing-Symbol die sichtbare Kontur.
  Beispiel: Funktion 38842 und Routing-Objekt 153626 auf Quellseite 13. Der
  Verteiler bleibt im Modell. Verteiler ohne eine solche Überlagerung behalten
  ihren echten Bibliothekspunkt, etwa Funktion 38837.
- Einige indexierte automatische Routing-Objekte liegen auf keiner gezeichneten
  Quellverbindung und haben kein Gegenstück im PDF. Sie bleiben mit
  `source.routingUsed=false` als editierbare Hilfsobjekte erhalten. Ihre Kontur
  wird bei Auswahl gezeigt, aber nicht gedruckt. Dies ist eine am Beispiel
  geprüfte Nutzungsprüfung, keine vollständige Dekodierung der Sichtbarkeitsflags.
- Gleiche Y-Koordinaten zweier nach oben zeigender Anschlüsse erlauben keine
  direkte Leitung durch das Gerät. Die Quellroute berücksichtigt beide
  Anschlussrichtungen; Q12 läuft über die originalen oberen Ecken.
- Physische Anschlusskoordinaten sind keine zusätzlichen Kreisgrafiken. Im
  Verdrahtungsmodus gibt es temporäre Anschlussgriffe; im PDF erscheinen nur die
  tatsächlichen Kreise der Bibliothek. Gefüllte Quellpunkte verwenden die am PDF
  beobachtete 0,02-mm-Kontur statt einer vergrößernden normalen Umrandung.
- Anschlussbezeichnungen stammen aus vollständig strukturiert gelesenen
  Property-Unterobjekten: `ED63=20028`, `ED64` = Anschlussindex plus 1,
  `EC55` relativ zum physischen Pin, `EE19=2` horizontale Anordnung, `EC57`
  Ausrichtung. Die nominale Quellprojekt-Textgröße wird für SVG/PDF mit dem am Export
  geprüften Faktor 1,242 zur Schriftgröße umgerechnet. Instanztexte bleiben
  veränderbar. Routing-Symbole bekommen keine künstlichen Pin-Nummern.

Regressionen prüfen die echten Varianten 64:0, 66:0/1, 69:0 und 72:0, Q12s
obere Route, die 0,25-/1-mm-Sammelschiene sowie Auswahl, Verschieben,
Anschlussbezeichnungen und PDF-Ausgabe. Visuelle Stichproben verwenden die
T-Verbindungen auf PDF-Seite 2 und die Kreuzung auf PDF-Seite 24.

## Gemeinsames Raster und Bibliotheksmaßstab

Das Projekt speichert `drawingUnitsPerMm`, die Seite ihr Raster mit Abstand
und Ursprung, und jede Bibliotheksdefinition ihren Maßstab `unitsPerMm` und
logischen `insertionPoint`. Beim Quellprojekt-Import bleibt der Maßstab `1000/420`
Zeichnungseinheiten pro mm erhalten. Das Editor-Grundraster beträgt 4 mm,
Halbraster 2 mm und Feinraster 1 mm, mit dem Quellursprung unten links.
Rasterdarstellung und Fang verwenden dieselben Werte, einschließlich des
y-abwärts gerichteten Seitenursprungs. Die 4 mm sind die Editor-Voreinstellung;
abweichende proprietäre Projekteinstellungen sind damit nicht vollständig dekodiert.

Einrasten, Vorschau, Maus- und Touch-Verschieben verwenden den logischen
Einfügepunkt statt der normalisierten Kontur-Ecke. Beim Drehen bleibt dieser
Punkt stehen. Der Eigenschaftendialog zeigt und bearbeitet denselben Punkt.
„Raster aus“ lässt freie Koordinaten zu. Neu erzeugte Leitungsknicke und
Ausweichstücke nach dem Verschieben richten sich nach dem Seitenraster.

Die Quellprojekt-Stammdaten bleiben maßhaltig. Im Beispiel besitzen auch tatsächlich
verbundene Kontakte konturbedingte Viertelmillimeter-Abstände, etwa 0,75 mm
bis zum Rand eines runden Anschlusses. Deren physische Koordinaten werden
beibehalten. Der Rasterfang führt Einfügepunkte und Leitungsachsen; ein
unabhängiges Runden aller Kontaktkonturen würde die Originalgeometrie verändern.

Die Standardbibliothek hat explizite Einfügepunkte und einen Maßstab von zwei
Zeichnungseinheiten pro mm. Beim Verwenden in einem importierten Projekt werden ihre
Konturen, physischen Pins und Maße zusammen in den Projektmaßstab umgerechnet.
LS-Schalter 3P, NH-Trenner 3P, Umschalter 4P und Drehstromzähler haben jetzt
einheitliche 12-mm-Polabstände. Einzelne ungerade Pin-Koordinaten wurden auf
das 1-mm-Feinraster gebracht; fehlende Anschlussstummel an Thermostat,
Wechselrichter und Mehrkanalrelais sowie am oberen T-Abzweig wurden ergänzt.
SVG- und PDF-Polpositionen wurden gemeinsam korrigiert.

Autoconnect verwendet bei Seiten mit physischem Raster eine numerische
Achstoleranz von `1e-6` Zeichnungseinheiten. Ein räumlich benachbarter Pin
erzeugt dadurch keine Verbindung in die nächste Rasterspalte. Die importierte
Kantenliste bleibt erhalten. Makros speichern ihren Maßstab und Einfügegriff;
relative Komponentenpositionen und Leitungswegpunkte werden gemeinsam
normalisiert und beim Einfügen in einen anderen Maßstab umgerechnet.

Prüfungen verwenden das ganze Originalarchiv, die Quellenkoordinaten von Q12,
alle physischen Pins der importierten Bibliotheken, alle Standardbibliotheks-Pins,
vier Drehstellungen, genaue Autoconnect-Achsen und Makro-Wegpunkte. Der
Browser-Test prüft Import, Drehen und Verschieben von Q12, neue Quellprojekt- und
Standardplatzierungen, eine neue Leitung, Rasterwechsel und erneutes JSON-Laden.

## Wohnzimmer 1: Anschlussrichtungen und echte Leiterabschnitte

Die Untersuchung verwendet dasselbe REA-Archiv `ev_de4dc0fb509a8c5e9b4e0f8cea75543cdb07faa07664ed13c6242903550e644b`
(SHA256 `6fdf42f60f4728528b87ebfed9fef7b610122d8563f6801a1a0d6e46cd81d028`)
und den erneut bereitgestellten PDF-Export, Seite 17. Quellrecord-Probes und
PDF-Vektoren wurden unabhängig auf Anschlussbeteiligung, Bögen und Beschriftungen geprüft.

- IEC1169:0 hat drei nach oben gerichtete Ports. Die sichtbaren Leiter laufen
  über die Winkel und T-Stücke seitlich der Steckdosen. Direkte Sternkanten
  vom unteren zum oberen Kontakt gehören zur elektrischen Netzliste.
- DCP 37009/37011 und 37015/37017 besitzen keine Connection-Zeilen, aber das PDF
  zeigt ihre N-/PE-Leiter. Die physische Rekonstruktion findet diese über die
  benachbarten, gegenüber gerichteten Quellports. Ein gleich gerichteter Port
  blockiert die Achse; eine bloße Kreuzung verbindet keine Netze.
- Automatische Routingreste ohne zwei unterstützte Richtungen werden vor der
  Nachbarschaftssuche entfernt. So blockiert der alte Winkel 627 bei (56,256)
  nicht die tatsächliche Q12-Zuführung über (56,280). Die Originalobjekte bleiben
  als nichtdruckende Helfer im Modell. Abgetrennte Routinggruppen zeichnen keine Leiter.
- Alle 1.915 Quellverbindungen bleiben separat erhalten. Die Typ 130-Sammelgrafik
  verbindet keine unterschiedlichen Pole zur Potentialübertragung. Farben und
  Querschnitte werden nur bei eindeutigen Quellenwerten weitergegeben.
- Ein Motorbild mit explizit leeren Pinstrings, ohne Netzlisteneintrag und mit
  gesonderten DCPs und Gerätebox desselben strukturierten Geräts erhält keine
  erfundenen äußeren Leiter an seinen Bildpins. Die Bibliothekspins bleiben erhalten.
- SPECIAL8-Unterbrechungspunkte besitzen keinen generell unsichtbaren Pin:
  dieselbe Variante verwendet im Projekt beide Seiten. Eine Quellverbindung
  legt bei vorhandener Beteiligung den genutzten Instanzpin fest.
- EC89/EC8A sind Anfangs-/Endparameter relativ zum Radiusvektor EC8C. Dadurch
  werden Steckdosen als obere Halbkreise mit 3 mm Durchmesser statt als Vollkreise
  importiert. Drehung und Spiegelung der Varianten bleiben erhalten.
- Die Motorrahmen enthalten Inline-Rechtecke 0x59 mit Ebene 305 und solidem Stil 0.
  Diese Kontur ersetzt die zuvor erfundene Strichelung. Function.EB23=3 unterdrückt
  das BMK, bestätigt an Q12, Motoren, Spulen, DCPs und Wiederholklemmen.
- DCP-Texte nutzen Property 20036, Anordnung 1, relativ zum Einfügepunkt. Sie zeigen
  L/N/PE zentriert unter dem Anschluss; Property 20028 bleibt pinrelativ. Die
  Tahoma-Baseline wurde gegen den PDF-Text von N bei (220,160) abgeglichen.

Alle 193 rekonstruierten Leiterabschnitte von Wohnzimmer 1 wurden außerhalb der
kleinen Quellglyphen an mehreren Punkten gegen die PDF-Vektorlinien geprüft:
keine Abweichung über 0,08 mm. Auch die 132 Leiterabschnitte der Einspeisung
bestehen diesen punktweisen Vergleich mit PDF-Seite 2. Das belegt diese
Leitergeometrie, keine vollständige
Pixelgleichheit von Farben, Schriften, Texten oder allen anderen Seiten.
Regressionen prüfen außerdem alle importierten Leiter auf beidseitig passende
Richtungen, alle Quelldaten-Endpunkte, gezielt fehlende Motorleiter sowie
kollineare und gedrehte Pins beim normalen Editieren. Der Browser prüft echten
Split-Archivimport, dunklen Editor, Steckdosenbögen, L/N/PE und Bearbeiten,
Drehen, Verschieben sowie JSON-Wiederladen.

## Normblatt und Editorbedienung (17.10.2026)

Das Projekt referenziert über `TrDMProject.Frame` die eingebettete Vorlage
`FN1_001` (Form-Typ 21, Objekt 106). Die indexierten Form-Slots sind 1297 Bytes
breit; die zugehörigen Instance-Objekte verweisen über EBF1 auf diese Form.
Übernommen werden 30 Konturen und 53 Text-/Property-Platzierungen auf 420 × 297 mm.
Die Fußzeile beginnt 16 mm über dem unteren Blattrand und läuft über die ganze
Breite. EE26 bestimmt den Textanker, EE21 die Größe und ED63/ED65 das Feld bzw.
seine Untereigenschaft. 20132/20134 binden Anlagen-/Ortskennzeichen ein.
Editor und PDF verwenden dieselbe Vorlage, Feldauflösung und Textanpassung.
Lange Texte werden umbrochen, bei Bedarf verkleinert/gekürzt und an der Zelle
beschnitten. Blattzahl und Seitennummerierung zählen die tatsächlich importierten
48 aktiven Seiten; die PDF-Vorlage enthält eine Auswahl von 45 Druckseiten.
Einige mehrsprachige Beschriftungen sind nur als Präfix verfügbar; für Seite,
Ersatz von und Ersetzt durch dienen die identifizierten Standardfeldbezeichnungen
als Ersatz. Das ist keine vollständige Wiederherstellung aller Sprachressourcen.

Abbruchstellen sind in der eigenen Verbindungsauswahl einschließlich der
Projektbibliothek verfügbar. Gegenüberliegende, auch deckungsgleiche Ports werden
bei der Nachbarschaftssuche als gemeinsamer Ort behandelt. Die Bibliothekspfeile
besitzen beidseitige Anschlüsse. Die Projekteinstellung vor/nach dem Pfeil steuert
Bezeichnung und Querverweis in allen vier Drehlagen und bleibt in JSON/XML erhalten.
Textanker drehen sich mit dem Element, Textwinkel bleiben eigenständig; das gilt
für Beschriftungen, Pintexte und interne Symboltexte in Editor und PDF.
Pfeiltasten verschieben nur die Ansicht (40 Bildschirmpixel, mit Umschalt 160);
Eingabefelder und Dialoge behalten ihre Tastaturbedienung.

Browserprüfung: echter Split-Archivimport, eigene Auswahlfelder, alle vier
Pfeiltasten, Eigenschaftendialog mit 180°, horizontale Textmatrizen, Einstellungs-
Undo/Redo und geometrisch begrenzter langer Plankopftext. Die bestehenden 193
Leiterabschnitte von Wohnzimmer 1 bleiben im PDF-Vektorvergleich erhalten.

## Kabeldefinitionen und Schriftgrößen (17.10.2026)

REA-Abgleich am selben Archiv und PDF: SPECIAL/CABDL 4, Function-Typ 17,
Funktionsdefinition 400 beschreibt die variable Kabeldefinitionslinie.
ED5A ist der Einfügepunkt; EB1E/EB1F sind die relativen Endpunkte.
20040 (4E48) liefert den Kabeltyp, 20042 (4E4A) die Aderzahl und 20043 (4E4B)
den Querschnitt. Für die Heizungs-Unterverteilung sind W1/W2 NYM-J 5×2,5
und W3 NYM-J 3×1,5 im Quelldatensatz und PDF nachweisbar.
SPECIAL/CDPNG 311, Function-Typ 59, referenziert über EE67 (Typ/ID) die
Kabeldefinition. 791C enthält die Aderfarbe, 791A den Verbindungsquerschnitt.

81 Kabeldefinitionen und 418 zugehörige Aderdefinitionspunkte werden als
`Page.cables` übernommen. Zehn eigenständige CDPNG-Punkte ohne Kabelreferenz
bleiben als separate Quellobjekte erhalten; die weiteren 26 Function-Typ-59-
Objekte verwenden SPECIAL 308. Bibliotheksreferenzen bleiben für die Kabel
im gemeinsamen Projektbestand. Die Linien sind keine elektrischen Pins und
verbinden die gekreuzten Leiter nicht miteinander. Geometrische Schnittpunkte
ordnen die sichtbaren Leiter zu; eine deklarierte Aderzahl wird nicht aufgrund
zusätzlicher Quellpunkte überschrieben. Punkte ohne sichtbaren Leiter bleiben
in den Kabeldaten erhalten. Native Definitionslinien werden wie im Referenz-PDF
ohne zusätzliche Schrägstriche importiert; Schrägstriche sind im Kabeldialog
wählbar und der Standard für neu gezeichnete Linien.

Der Editor besitzt ein eigenes Kabelwerkzeug mit zwei Rasterpunkten und einen
Kabel-Eigenschaftsbereich für BMK, Typ, Aderzahl, Querschnitt, Adertexte,
Schriftgrößen und Positionen. Verschieben, Drehen, Duplizieren, Löschen,
Rückgängig und JSON/XML-Speichern verwenden das eigenständige Kabelmodell.
SVG und PDF erzeugen die Kabeldarstellung aus derselben Geometrie.

Schriftgrößen für BMK, Funktionstext, technische Daten, Anschlussbezeichnungen
und Querverweise werden in mm im Eigenschaftendialog und der Seitenleiste
bearbeitet. Die Werte bleiben in den Zeichnungseinheiten des Projekts gespeichert
und werden für den PDF-Export physikalisch skaliert. Die vorhandene Textrotation
wurde auf Wunsch unverändert gelassen.

Prüfung: echter Archivimport mit 81/418 Objekten, 1.915 unveränderte elektrische
Quellverbindungen, Browserbedienung der Schriftfelder und Kabelwerkzeuge,
Rückgängig sowie Kabel- und Schriftgrößen-Roundtrip. Die 193 physischen Leiter
in Wohnzimmer 1 und 132 in Einspeisung bleiben unverändert.

## Verbleibende Grenzen

Die Slot-/Indexinterpretation ist für das mitgelieferte Quellprojekt-Layout rekonstruiert,
kein vollständiger allgemeiner c-tree-/Quellsystem-Parser für alle Versionen.
Einige Slots liefern nur einen lesbaren Präfix. Solche Grenzen werden pro Seite
in `importDiagnostics` gemeldet, nicht als fehlerfreie Dekodierung ausgegeben.
Die vollständige Semantik dynamischer Property-Gruppen, Haupt-/Nebenfunktionen,
aller Grafiktypen und automatisch erzeugter Quellsystem-Auswertungsformulare ist
weiterhin nicht bewiesen. Ein pixelidentisches Property-Layout und ein nativer
Quellsystem-Rückexport werden nicht behauptet.
Neun Anschluss-Textplatzierungen in verwendeten Varianten referenzieren Ebene
809, die im indexierten Ebenenbestand fehlt. Ohne belegte Textgröße erzeugt der
Importer eine Diagnose statt einer geratenen Beschriftung. Browser-Schriften
und die Helvetica-Näherung des PDF-Exports sind kein pixelidentischer Ersatz
für die Originalschrift Tahoma.

## Prüfen

```sh
npm test
npm run build
npx tsx scripts/export-einspeisung.ts /tmp/einspeisung-import.pdf
npm run dev
```

Die Integrationsprüfung importiert das echte geteilte Archiv, prüft alle Seiten
und Anschlüsse, gemeinsame Definitionen, mehrere andere Stromlaufplanseiten,
Editieren/Rotation/Anschlusspositionen, JSON und PDF. Weitere Prüfungen decken
Editor-/PDF-Farben, sichtbare geänderte Texte, den Eigenschaftendialog,
Bibliothekswechsel, portable Makros und verlustfreies eigenes Projekt-XML ab.
