# Kabelartikel, reale Länge und Stromkreisbezug

**Projekt → Klemmen und Kabel → Kabel → Kabeleigenschaften → Artikel, Länge & Stromkreis** verbindet eine Kabeldefinition mit einem Herstellerartikel, der realen Kabellänge und ausgewählten Stromkreisberechnungen. In der elektrischen Dimensionierung gibt es außerdem **Kabeldefinition (optional)** und bei vorhandenem Bezug **Kabelartikel und reale Länge bearbeiten**.

## Artikel auswählen

Die Artikelauswahl bietet die vorhandene Suche, Herstellerfilter, Projektartikel, Kennwerte und exakte Varianten. Sie nimmt für eine unabhängige Kabeldefinition keine Stromart, Betriebsspannung oder Mindestaderzahl eines Stromkreises an. Ein zweipoliges DC-Kabel ist deshalb auswählbar. Erst die ausdrücklich verknüpfte Stromkreisberechnung prüft ihre tatsächlichen Anforderungen. Bekannte andere Artikelfunktionen werden nicht als Kabel übernommen.

**Aderzahl und Querschnitt des Artikels übernehmen** kopiert ausschließlich strukturierte, belegte Nennangaben. Die App schätzt keine Kennwerte aus Beschreibungen. Vorhandene Adern, Reserven, Leitungen und elektrische Anschlüsse bleiben unverändert. Konflikte mit den vorhandenen Kabeldaten und noch zu bearbeitende Aderzuordnungen erscheinen in der Vorschau und in der elektrischen Prüfung.

## Reale Kabellänge und Stückliste

Die reale Länge wird in Metern erfasst und unter `CableDefinition.lengthM` gespeichert. Das Feld darf leer bleiben. Die Geometrie, die Zahl der Adern und vorhandene einzelne Drahtlängen ergeben keine automatische Gesamtkabellänge.

Ein zugeordneter Artikel liegt als portabler Snapshot in `CableDefinition.article`. Die Stückliste summiert seine ausdrücklich eingetragenen Kabelstrecken als **Meterware**. Die genaue Identität besteht aus Hersteller, Artikelnummer und Variante. Eine Strecke mit fünf Adern und 12 Metern zählt als **12 m**, nicht als 60 m. Fehlende oder ungültige Längen bleiben als unbekannte Mengen sichtbar, beispielsweise **12 + ? m**. Stückartikel werden nicht mit Meterware vermischt. Ein in einer stücklistenwirksamen Baugruppe enthaltenes Kabel wird nicht zusätzlich als Meterware bestellt. Eine explizite Länge von 0 bleibt 0.

Jede artikelbelegte Kabeldefinition repräsentiert eine eigene reale Kabelstrecke. Gleiche BMK oder räumlich ähnliche Zeichnungen werden nicht automatisch zu einem physischen Kabel zusammengelegt. Für zusätzliche Darstellungen derselben realen Strecke den Bestellartikel an einer maßgebenden Kabeldefinition pflegen. Eine unabhängig platzierte Komponente mit demselben Artikel bleibt ein eigener Stückartikel; die App unterdrückt keine Objekte aufgrund ähnlicher Namen.

Die grafischen Kabelkarten zeigen Artikel und reale Länge. Die Artikelstückliste in der Oberfläche und im gemeinsamen Projekt-PDF verwendet dieselbe Mengenberechnung. Der Kabelplan und der CSV-Kabelexport enthalten zusätzlich Artikel und Länge. Im aderorientierten Kabelplan wiederholt sich die Kabellänge pro Aderzeile; sie darf dort nicht summiert werden. Die aggregierte Bestellmenge steht in der Stückliste. Bestehende individuell gespeicherte Berichtsvorlagen behalten ihre Spalten; die neuen Felder lassen sich im Berichtsdesigner ergänzen.

## Stromkreise ausdrücklich verknüpfen

Ausgewählte Stromkreise bekommen einen eindeutigen Bezug über Blatt- und Kabelkennung in `CircuitArticle.cable`. Mehrere Berechnungen dürfen dasselbe reale Kabel verwenden, ohne dadurch zusätzliche Stücklistenmengen zu erzeugen. Die Auswahl verbindet den Artikel, ändert aber noch keine Rechenwerte.

**Dokumentierte Kabelkennwerte und reale Länge in ausgewählte Berechnungen übernehmen** setzt zusätzlich die gespeicherten Kabelkennwerte und die Kabellänge. Dafür ist zu bestätigen, dass diese Länge die vollständige Leitungslänge jedes ausgewählten Stromkreises beschreibt. Vorhandene, bereits übernommene Quelldaten einer anderen Bezugslinie müssen zuvor im Stromkreis über **Bezug entfernen** gelöst werden. Eine Zeichnungslinie und ein reales Kabel dürfen nicht unbemerkt konkurrierende Längenquellen bilden.

Fehlende Kennwerte bleiben unvollständig. Eine andere Stromart, unzureichende Bemessungsspannung oder zu wenige Adern werden weiterhin von der vorhandenen Artikelauswahlprüfung des konkreten Stromkreises abgewiesen. Verlegebedingungen und Schutzgeräte werden nicht aus dem Kabelartikel erfunden.

Spätere Änderungen des Artikels, seiner belegten Kennwerte, der Nennangaben oder einer übernommenen realen Länge erzeugen Klärungsbefunde. **Änderungsfolgen** verfolgt den Kabelbezug auch ohne zugeordnetes Projektgerät. Abgewählte Bezüge werden ausdrücklich gelöst; gespeicherte Rechenwerte bleiben als eigenständiger Auslegungsdatensatz erhalten.

## Vorschau und Rückgängig

**Änderungen vorschauen** zeigt Artikel, Länge, Nennangaben, resultierende Meterware und betroffene Berechnungen einschließlich offener Prüfpunkte. Die vollständigen geänderten Felder sind aufklappbar. Jede weitere Eingabe verwirft die alte Vorschau. **Angezeigte Änderungen übernehmen** ist ein einzelner rückgängig machbarer Projektschritt. Hat sich das Projekt zwischenzeitlich geändert, wird die veraltete Übernahme abgewiesen.

## English

Use **Project → Terminals and cables → Cables → Cable properties → Part, length & circuit** to assign an exact cable part, enter its real length and link existing circuit calculations. The independent cable picker assumes no circuit voltage or AC/DC system. Nominal values and calculation values require explicit adoption and an exact preview. Wires and core assignments are preserved.

The BOM orders cable length in metres, once per assigned physical cable definition. Unknown lengths stay unknown; core count and diagram geometry never become purchasing quantities. Pieces and metres remain separate. Circuit bindings detect later source changes, travel with the project and participate in change-impact analysis. Applying the preview is one undoable transaction.
