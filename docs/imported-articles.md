# Artikelübernahme aus Projektarchiven

Der native Projektleser liest die optionalen Tabellen `Article.eod` / `.eox` und `ArticleRef.eod` / `.eox`. Unterstützt werden die beobachteten indexierten Layouts mit 1940 beziehungsweise 667 Byte großen Datensatzplätzen. Fehlende oder unbekannte Tabellenformate verhindern den übrigen Projektimport nicht und bleiben als Importlücke erkennbar.

Die neuen Felder sind optional. Vorhandene JSON-Dateien bleiben lesbar; fehlende Quelldaten in bereits gespeicherten Projekten werden nicht aus BMK oder Symbolnamen rekonstruiert. **Projekt → Artikel aus Originalquelle ergänzen…** öffnet einen gesonderten Abgleich für bereits bearbeitete Projekte. Die Originalquelle wird dabei gelesen, ohne die Zeichnung zu ersetzen.

## Zuordnung und Herkunft

Eine Referenz wird ausschließlich über Quellobjekttyp und Quellobjektkennung an eine importierte Funktion gebunden. Gleiche BMK erzeugen keine Artikelzuordnung. Hersteller und Beschreibung werden nur aus einem eindeutig passenden eingebetteten Stammsatz mit **derselben Artikelnummer und Variante** ergänzt. Es gibt keine unscharfe Suche nach Nummernpräfix, Herstellername oder sichtbarer Beschriftung.

Der Leser prüft aktive Indexreferenzen und die gespeicherte Datensatzidentität. Die unterstützten Kopffelder werden in Reihenfolge gelesen. Ein unbekanntes Feld führt dazu, dass der betreffende Kopf nicht interpretiert wird. Zeichenfolgen benötigen einen Abschluss und gültiges UTF-8. Damit werden keine vermeintlichen Artikelverknüpfungen aus Textinhalten oder Koordinaten gelesen.

Bei komprimierten Stammsätzen kann nur ein begrenzter Datenpräfix verfügbar sein. Vollständig lesbare Felder werden erhalten; fehlende Felder werden nicht als leer interpretiert. Solche Stammsätze tragen `partial: true`. Unvollständige Referenzdatensätze werden nicht zur automatischen Zuordnung verwendet.

## Gespeicherte Daten

- `project.importedArticleLibrary`: lesbare eingebettete Artikelstammsätze mit Artikelnummer, Variante, Hersteller/-code, Bezeichnung und Quellkennung.
- `project.articleImportDiagnostics`: erhaltene Importhinweise zu unvollständigen Stammsätzen, nicht auflösbaren Referenzen und fehlenden Tabellen.
- `project.sourceArticleReferences`: benannte Quellreferenzen einschließlich Verweisen auf nicht platzierte Funktionen.
- `component.articleReferences`: sämtliche an die jeweilige Platzierung gebundenen Referenzen, einschließlich Position, Variante, deklarierter Menge und gegebenenfalls Stammsatzkennung.
- `component.articleImport`: Nachweis der gelesenen Referenzdatensätze und der ursprünglichen Hauptartikelnummer. Ein geprüfter leerer Referenzdatensatz ist kein Nachweis, dass die gesamte Quelldatenbank leer ist.

Eine eindeutig bezeichnete Position 1 wird in die bisherigen Einzelfelder `articleNumber` und `manufacturer` übernommen. Bei nur einer Referenz kann diese alleinige Referenz verwendet werden. Bei mehrdeutiger Hauptposition wird kein beliebiger Artikel ausgewählt; die vollständige Liste bleibt dennoch gespeichert und wird als vorhandene Quellenzuordnung erkannt. Fehlende Mengen bleiben unbekannt, eine Quellmenge 0 bleibt 0.

Neue Importe speichern zusätzlich `nativeSourceIdentity` und `source.datasetId`: SHA-256 über die längengetrennten Originaltabellen `Page.eod`, `Function.eod` und ihrer aktiven `.eox`-Indizes mit Formatkennung. Artikel-/Referenztabellen, Dateinamen, Pfade und Dateizeitstempel sind nicht Teil dieser Inhaltskennung. Dadurch bleiben geänderte Artikel-Snapshots derselben Quellstruktur vergleichbar; eine Änderung der Quellstruktur wird als andere Quelle erkannt. Referenzen und Stammsätze behalten die zugehörige `sourceDatasetId`.

Die Rohkennungen gelten innerhalb ihres Quellprojekts. Sie sind kein Ersatz für das noch auszubauende projektübergreifende Geräte-/Artikelmodell.

## Oberfläche und Stückliste

**Eigenschaften → Artikel** zeigt die importierten Referenzen als lesbaren Quellnachweis mit Varianten und Mengen. Diese Liste wird durch Änderungen am bisherigen Hauptartikelfeld nicht überschrieben.

Die Stückliste und deren PDF-Ausgabe verwenden bei unveränderter Quellenzuordnung die gesamte Referenzliste und deren deklarierte Mengen. Varianten bleiben getrennt. Bei unbekannten Mengen erscheint `?x`, bei teilweise bekannter Summe beispielsweise `2 + ?x`.

Eine manuelle Änderung oder Leerung des Hauptartikelfelds deaktiviert die ursprüngliche Referenzliste für die aktuelle Stücklistenberechnung. Alte Zubehörartikel werden dadurch nicht unbemerkt weitergezählt. Der Quellnachweis bleibt für den Vergleich gespeichert. Eine vollwertige Bearbeitung mehrteiliger Artikelzuordnungen folgt separat.

`quantityBasis: source_function` kennzeichnet die Summierung deklarierter Artikelreferenzen je platzierter Quellfunktion. Klassische Platzierungen ohne Quellenreferenzen behalten die bisherige Basis `placement`. Das bestätigt keine physische Geräteanzahl bei mehrfach dargestellten Betriebsmitteln. Eine solche Mengenbereinigung setzt das eigenständige Betriebsmittelmodell voraus. Nicht platzierte Quellreferenzen werden nicht automatisch bestellt oder in die Stückliste übernommen.

## KI-Abfrage

`get_imported_articles` liefert die erhaltenen Quelldaten rein lesend:

- `view: masters` oder `references`;
- optionale Filter `componentId`, `search` und `unplacedOnly`;
- `offset` und `limit` (1–200) zum vollständigen Durchblättern;
- Quellreferenzen mit ihren platzierten Zielkennungen beziehungsweise einer leeren Zielliste.

Die Abfrage ist kein Herstellerportal und nimmt keine neuen Artikelzuordnungen vor. Die Herkunftsanalyse und der elektrische Prüflauf berücksichtigen die importierten Referenzen ebenfalls.

## Abgleich bearbeiteter Projekte

1. Unter **Projekt → Artikel aus Originalquelle ergänzen…** das Originalarchiv auswählen. Bei geteilten Archiven alle Teile gemeinsam auswählen. Alternativ ist eine gespeicherte Projektdatei mit gültiger Herkunftskennung möglich.
2. Die Vorschau zeigt aktuelle und ursprüngliche Artikelangaben, Status und Konfliktursachen. Filter und Seitenwechsel begrenzen die Darstellung großer Projekte. Die Auswahl umfasst standardmäßig alle ergänzbaren Einträge; sie kann beliebig reduziert werden.
3. Neue Importe werden über Inhaltskennung und Quellobjektidentität zugeordnet. Bei älteren Projekten ohne Inhaltskennung müssen außerdem Quellsymbol, Anlage, Einbauort und BMK passen. Zusätzlich ist die konkrete Originalquelle in der Vorschau ausdrücklich zu bestätigen. Das ist ein vom Benutzer bestätigter Abgleich, kein nachträglich bewiesener Ursprung; nur die ausgewählten Objekte erhalten `datasetVerification: user_confirmed`.
4. **Auswahl ergänzen** übernimmt fehlende Artikel-/Herstellerangaben und vollständige Quellenlisten gemeinsam. Ein gelesener leerer Quelldatensatz ergänzt ausschließlich den Quellennachweis. Die gesamte Übernahme kann mit einem Rückgängig-Schritt entfernt und wiederhergestellt werden.

Manuell geänderte oder bewusst geleerte Hauptartikel, abweichende Hersteller/Referenzlisten, doppelte Kennungen, andere Quellen, nicht gelesene Artikel und ausgeschlossene Artikelpflicht werden nicht überschrieben. Für diese Fälle zeigt die Vorschau den Grund; eine erzwungene Übernahme ist nicht vorgesehen. Fehlen Quellkennungen, erfolgt keine Zuordnung allein anhand eines BMK. Wurde das Ziel seit der Vorschau bearbeitet, muss neu verglichen werden.

Geometrie, Beschriftungen, Verbindungen und Symbolbibliothek bleiben erhalten. Artikelstammsätze und ursprüngliche Referenzen werden als Quellnachweise zusammengeführt; bestehende Stammsätze bleiben bestehen, kollidierende interne Kennungen werden umbenannt. Die Zusammenführung enthält auch Referenzen ohne aktuelle Platzierungszuordnung; diese werden dadurch nicht automatisch Teil der Stückliste. Die KI-Abfrage ordnet Referenzen über Herkunft und genaue Referenzwerte zu, nicht über rohe Datensatznummern verschiedener Quellen.

Die Inhaltskennung schützt vor versehentlichem Abgleich verschiedener Quellbestände; sie ist keine digitale Signatur. Veränderte Quelltabellen oder ältere Projekte mit abweichenden Zuordnungsmerkmalen erfordern eine gesonderte Prüfung. Eine direkte Bearbeitung der vollständigen mehrteiligen Artikelzuordnung und ein zentraler Herstellerkatalog sind weiterhin separate Ausbauschritte.
