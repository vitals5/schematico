# Einheitlicher elektrischer Prüflauf

`inspectElectricalProject` ist der gemeinsame, rein lesende Prüfdienst für den Meldungsdialog, Projektimporte und KI-/MCP-Abfragen. Er verwendet den Projektindex und den statischen Netzservice. Der bisherige Einstieg `collectPlausibilityMessages` bleibt als kompatibler Zugriff auf dieselben Befunde erhalten.

Jeder Befund enthält eine feste `ruleId`, eine deterministische `id`, Schweregrad, Ursache mit strukturierten Details, Handlungshinweis und `location`. Diese Fundstelle enthält Seite, Objekt, gegebenenfalls Anschluss, Leitung und Netz sowie Markerkoordinaten. `relatedLocations` nennt weitere beteiligte Stellen. Identität und Ursache werden unabhängig von Sprache und Bildschirmposition gebildet.

## Erste Regeln

| Regeln | Verhalten |
|---|---|
| `required_pin_open`, `reserve_pin_connected` | Prüfen ausdrückliche Anschlussvorgaben anhand der tatsächlichen Leitungsbelegung des Anschlusses. Eine interne Brücke belegt keinen freien Klemmplatz. |
| `unwired` | Kompatibler Hinweis bei vollständig unverdrahteten normalen Symbolen ohne ausdrückliche Anschlussvorgaben. Keine pauschalen Hinweise für Verbindungsgrafiken. |
| `invalid_endpoint`, `invalid_internal_group` | Melden fehlende/mehrdeutige Endpunkte und ungültige Bibliotheksgruppen. Auch ein alter Eintrag in `component.pins` macht einen im aufgelösten Bibliothekssymbol nicht vorhandenen Anschluss nicht gültig. |
| `unresolved_reference` | Prüft unterstützte gedruckte Verweise im Format `/Blatt.Spalte`. Bei bekannten Spulen, Kontakten und Abbruchstellen muss auch die Funktionszuordnung auflösbar sein. |
| `missing_reference_target`, `missing_master_reference` | Prüfen ausdrücklich erforderliche Verweisziele beziehungsweise die Hauptfunktion generischer Kontakte. Native Teilfunktionen werden konservativ behandelt. |
| Kennzeichnungs- und ID-Regeln | Verwenden die strukturierten Zuordnungen des Projektindex; mehrere Hauptfunktionen und eigenständige Geräte bleiben unterscheidbar. |
| `missing_article` | Verlangt Artikel nur entsprechend der Vorgabe. Alte normale Geräte ohne Vorgabe erhalten weiterhin einen Hinweis; bei ausdrücklicher Pflicht eine Warnung. Ein zugeordneter Kontakt kann den Artikel einer eindeutigen Hauptfunktion verwenden. |
| `potential_conflict` | Meldet unterschiedliche ausdrückliche `potentialConstraint`-Werte am selben Leiter als Fehler. Freie Potenzial-/Drahtbeschriftungen werden dafür nicht verwendet. |
| `neutral_pe_connection` | Meldet einen leitenden Zusammenhang ausdrücklich definierter N-/PE-Anschlussrollen als Prüfhinweis. Eine beabsichtigte PEN-Aufteilung wird nicht pauschal als unzulässig eingestuft. |

## Vorgaben bearbeiten

Unter **Eigenschaften → Schaltzeichen → Prüfvorgaben** lassen sich Artikelpflicht und Verweisziel sowie je Anschluss **Pflicht**, **Optional**, **Reserve** und ein festes Potenzial festlegen. Unveränderte Felder bleiben erhalten. Bei mehreren Komponenten werden nur gemeinsam vorhandene Anschlüsse angeboten und nur tatsächlich geänderte Vorgaben übertragen.

Bibliotheksvorgaben stehen an `PinDefinition.connectionRequirement`, `PinDefinition.potentialConstraint` und den entsprechenden Symbolrichtlinien. Platzierungsvorgaben überschreiben diese unter `component.pins[pinId]` beziehungsweise direkt am Element. Die Auswahl **Bibliothek / Standard** entfernt den jeweiligen Richtlinien-Override. Ein ausdrücklich geleertes Potenzialfeld deaktiviert die geerbte feste Vorgabe. Bestehende JSON-Projekte benötigen keine Migration.

Ein optionales Verweisziel darf fehlen. Ein bereits gedruckter, fehlerhafter Verweis wird weiterhin gemeldet. Bei unbekannten Anschlussvorgaben wird nicht nachträglich jeder Anschluss zum Pflichtanschluss erklärt.

## Editor, Import und KI

Der Meldungsdialog zeigt die Regelkennung und den betroffenen Anschluss beziehungsweise die Leitung. **Zur Fundstelle springen** zentriert die tatsächliche Stelle und wählt das Element oder die Leitung aus. **Erneut prüfen** aktualisiert den Bericht; **Prüfbericht herunterladen** exportiert den gerade angezeigten Bericht als JSON. Er enthält technische Kennzeichnungen und Ursachen, keine komplette Projektkopie.

`PackageHandler.inspectFile`/`inspectFiles` liefern bei Projekten denselben Bericht als `electricalInspection`. Beim Öffnen über die Oberfläche wird er im Session-Protokoll erfasst. Die Prüfung repariert oder verwirft das importierte Projekt nicht; der aktuelle Stand kann anschließend über die Projektprüfung erneut geprüft werden.

`validate_electrical_project({offset: 0, limit: 100})` liefert Berichtszusammenfassung, Regelkennungen, Prüfumfang und eine paginierte Befundliste (`limit` 1–500). `success: true` bedeutet, dass die Prüfung ausgeführt wurde. `status` unterscheidet `errors`, `warnings`, `infos` und `no_findings`. Die vorhandenen Werkzeuge `get_project_index` und `get_electrical_nets` geben dieselben Befunde zurück.

`validate_schematic_layout` behält seinen geometrischen Status. Ein getrenntes Feld `electrical` enthält die projektweite elektrische Zusammenfassung und bis zu 100 Befunde mit Bezug zur geprüften Seite. Für die vollständige Liste dient der elektrische Prüflauf. Eine gültige Geometrie bedeutet keine elektrisch geprüfte Schaltung.

Der Prüfumfang benennt unbekannte interne Anschlussdaten und Anschlussrollen. Unbekannte native Verweisformate und interne Gerätefunktionen werden nicht erfunden. Der Dienst simuliert keine Schaltzustände und ersetzt weder Kurzschluss-/Lastberechnungen noch eine vollständige Normenprüfung.
