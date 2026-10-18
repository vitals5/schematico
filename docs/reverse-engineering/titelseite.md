# Projektarchiv: Titelseite F26_001

Untersuchung am 17.10.2026 mit dem [REA-Workflow](https://github.com/morluto/rea/blob/main/.agents/skills/reverse-engineer-anything/SKILL.md).
Das vorhandene Containerinventar wird weiterverwendet, keine erneute identische
Analyse: Evidence `ev_de4dc0fb509a8c5e9b4e0f8cea75543cdb07faa07664ed13c6242903550e644b`,
ZIP-SHA256 `6fdf42f60f4728528b87ebfed9fef7b610122d8563f6801a1a0d6e46cd81d028`.
Dieses Inventar belegt die Archivmitglieder. Die folgenden Formatfelder wurden
mit begrenzten Byte-Proben und dem unabhängigen PDF-Export, Seite 1, abgeglichen;
sie sind keine vom REA-Provider behauptete Quellsystem-Semantik. Quellsystem wurde nicht ausgeführt.

## Ressourcen und Koordinaten

`<Projektstamm>/Page.eod/eox`, Objekt 1, referenziert über Property `2B07`
(UTF-8-String nach vier Bytes) die Vorlage `F26_001`; `EFE5` wiederholt den Namen.
`Form.eod/eox` enthält sie als indexiertes Objekt 101, Typ 51, Slotgröße 1297.
Das Normblatt FN1_001 ist dagegen Objekt 106, Typ 21. Der bisherige Normblattparser
ließ die Titelseite deshalb aus. F26_001 besitzt im untersuchten Formrecord keine
eigenen Breiten-/Höhenstrings; das zugehörige Normblatt definiert 420 × 297 mm.

Die Titelblattzuordnung verwendet die Referenz auf die geladene F26-Vorlage.
Die beobachtete Seitenkennung `2AFE = 7` allein reicht nicht aus: Auch andere
Berichtsseiten besitzen diese Kennung. Formtyp 51 enthält ebenfalls weitere
Berichtsformulare; der neue Leser wählt deshalb eine tatsächlich referenzierte
F26-Vorlage und ersetzt damit weder Klemmenberichte noch das Normblatt.

Die zugehörigen `Instance.eod/eox`-Objekte verweisen mit `EBF1` auf Typ 51,
Objekt 101. Es gibt 48 Objekte: 17 Literaltexte (Typ 30), 22 Propertytexte (53),
zwei Linien (31), sechs Rechtecke (89) und ein Bild (91).
Alle 17 Literaltextslots sind als partielle Dekompressionspräfixe gekennzeichnet;
zwölf Beschriftungen benötigen Ergänzungen. Nur für die identifizierte Vorlage
F26_001 werden sie anhand des benachbarten Propertyfelds und des PDF-Belegs
wiederhergestellt, mit einer Importdiagnose. Andere Vorlagen erhalten diese
spezifischen Ergänzungen nicht.

Quellkoordinaten sind mm mit Ursprung unten links. Beispiele:

- Linie 151954: (12,156)–(408,156), Stärke 0,25 mm.
- Rahmen 151959: (12,56)–(408,204), Stärke 0,25 mm.
- Beschreibung 151958: Property 10011, Position (116,182), nominal 5 mm.
- Kunde 151971: Property 10100, Position (116,192), nominal 5 mm.
- Erstellungsdatum 151964: Property 10021, Position (76,72), nominal 3,5 mm.

`EE26=10/12` verwendet die Basislinie (links/rechts). Bei `4/6` liegt die im
PDF beobachtete Basislinie 1,727 mm unter dem 3,5-mm-Anker. Die Textgröße
verwendet denselben Faktor 1,242 wie der vorhandene Normblattimport.
Fünf Rechtecke mit `F0D8=1` sind gefüllte Balken und Schatten, vom PDF bestätigt.
Sie werden als gefüllte Polygone übernommen. Die PDF-Papierhöhe ist etwa
297,176 mm; Koordinatenvergleiche berücksichtigen den oberen Rand von 0,176 mm.

Bild 152001 speichert `F0D3=(64,232.267605633803)` und
`F0D4=(93,272.653605633803)` sowie `F0E7=$(MD_IMG)\<Quelllogo>.jpg`.
Die eindeutige eingebettete Datei ist
`<Projektstamm>/Images/<Bildverzeichnis>/<Quelllogo>.jpg`, JPEG, 1229 × 1718 Pixel.
Der Ressourcenleser belegt diese Data-URL und die Position (64,24.346394366197)
in y-abwärts gerichteten Vorlagen-mm, Größe 29 × 40,386 mm. Die neutrale
Darstellung entfernt dieses mitgelieferte Herstellerlogo vor der Verwendung.
Es wird kein Bild aus dem PDF extrahiert und kein externer Bildpfad aufgerufen.

## Propertybindungen

Die Schlüssel behalten Index und Property-ID (`property:index`).

| Property | Inhalt / beobachteter Wert | Position, Quell-mm |
| --- | --- | --- |
| 10100:0 | Firma / Kunde: STECKLER | 116,192 |
| 10011:0 | Projektbeschreibung: Einfamilienhaus mit Garage | 116,182 |
| 10013:0 | Projektnummer | 116,172 |
| 10014:0 | Kommission | 116,162 |
| 10015:0 | Hersteller / Firma: Viktor Steckler | 116,148 und 116,264 |
| 10901:1 | Pfad | 116,132 |
| 10000:0 | Projektname, im PDF Haus | 116,124 |
| 10030:0 | Fabrikat | 116,116 |
| 10031:0 | Typ | 116,108 |
| 10032:0 | Installationsort | 116,100 |
| 10025:0 | Projektverantwortlicher | 116,92 |
| 10033:0 | Teilebesonderheit | 116,84 |
| 10021:0 | Erstellt am: 14.05.2026 | 76,72 |
| 10023:0 | Bearbeitet am: 18.09.2026 | 76,64 |
| 10022:0 | Bearbeiter: VITAL | 168,64 |
| 10300:0 | Seitenzahl, Quell-XML/PDF 45 | 400,64 |
| 11015:0 | Formularname F26_001 | 408,280 |
| 10235:0 | Unbelegtes Kopfadressfeld | 116,247.5 |
| 10237:0 | Unbelegtes Kopfadressfeld | 116,241 |
| 10238:0 | Unbelegtes Kopfadressfeld | 138,241 |
| 10240:0 | Unbelegtes Feld nach dem Literal „Tel.“ | 133.5,234.5 |

`ProjectInfo.xml` belegt die vorhandenen Projektwerte und Datumstyp 14 als
Unix-Sekunden. Die vier Kopfadressfelder fehlen dort und bleiben wie im PDF leer;
eine Substitution durch ähnlich aussehende Kundenadressfelder wäre unbelegt.
10000 wird im Modell aus dem aktuellen Projektnamen aufgelöst, 10300 aus der
aktuellen Seitenzahl. Das importierte Projekt enthält 48 aktive Seiten, der
bereitgestellte Export eine Auswahl von 45. Der XML-Rohwert wird erhalten,
ist aber keine aktuelle Blattzählung.

## Grenzen und Prüfung

Die beobachteten Feld- und Slotlayouts sind weiterhin auf diese Quellprojekt-Datenbank
begrenzt. Die genaue Semantik der vier leeren Kopfadressfelder und alle übrigen
Berichtsformtypen sind nicht rekonstruiert. Schriftmetriken bleiben eine
Browser-/PDF-Näherung von Tahoma. Eine pixelidentische Quellsystem-Ausgabe oder ein
proprietärer Datenbank-Rückexport wird nicht behauptet.

Der Integrationstest für Titelseiten prüft am echten geteilten Quellarchiv die
Vorlage, Feldbindungen, Datumswerte, Ankerpositionen, gefüllte Grafik und die
eingebettete Bildquelle. Mehrdeutige Bildnamen erzeugen eine Diagnose statt
einer willkürlichen Dateiauswahl.

## Neutrale Darstellung

Die Oberfläche verwendet neutrale Begriffe wie „Titelblatt“ und „Projektbibliotheksimport“.
Das bisher im Quellprojekt enthaltene Herstellerlogo wird aus neuen und älteren
Beispielimporten entfernt und nicht im Editor oder PDF angezeigt. Eigene Logos
bleiben nutzbar; die Erkennung vergleicht Bildinhalt und Länge, damit ein eigenes
Ersatzbild mit altem Dateinamen erhalten bleibt. Auch der Beispiel-Projektname
wird neutral übernommen. Technische Herkunftskennungen bleiben für vorhandene
Projektdateien kompatibel. Quellpfade sind in dieser Dokumentation neutral bezeichnet.
