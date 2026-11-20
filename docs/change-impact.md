# Änderungsfolgen

**Auswerten → Änderungsfolgen** vergleicht den aktuellen Arbeitsstand mit einem gespeicherten Projektstand. Der Einstieg ist auch unter **Projektstände & Freigaben → Änderungsfolgen bearbeiten** verfügbar, wenn mit dem Arbeitsstand verglichen wird. Ohne Referenzstand zuerst einen benannten Stand speichern. Standardmäßig wird der jüngste freigegebene, andernfalls der jüngste gespeicherte Stand gewählt.

## Aufgaben und Zuordnung

Die Analyse erzeugt eine Arbeitsliste mit betroffenen Stromkreisen, noch nicht zugeordneten elektrischen Änderungen und geänderten Unterlagen. Geräte werden über Blatt- und Objektkennungen sowie ausdrücklich bestätigte Haupt-/Nebenfunktionen zugeordnet. Änderungen an Verbindungen werden zusätzlich über tatsächlich zusammenhängende Leiternetze verfolgt. Gleiche BMK oder Potenzialnamen allein begründen keine Zuordnung. Schaltkontakte werden nicht als dauerhaft geschlossen angenommen. Die Analyse ist eine Abhängigkeitsprüfung, keine Simulation des Schaltzustands.

Artikelnummer, Hersteller, Variante, strukturierte Kennwerte und deren Quellen werden berücksichtigt. Eine reine Mengen- oder Beschreibungsänderung erzeugt keine neue elektrische Dimensionierung. Positions-, Beschriftungs- und gewöhnliche Textänderungen betreffen die Dokumentation. Elektrische Funktions-, Anschluss- oder Netzänderungen verlangen eine entsprechende Nachprüfung. Nicht zuordenbare Änderungen bleiben ausdrücklich sichtbar; die Liste behauptet keine vollständige automatische Erkennung aller realen Stromkreisabhängigkeiten.

Die vorgeschlagenen Prüffamilien betreffen unter anderem Spannungsfall, Strombelastbarkeit, Kurzschluss/Abschaltung, thermischen Nachweis und Schutzkoordination. Nicht angeforderte optionale Nachweise werden dadurch nicht eingeschaltet. Die bestehende Dimensionierung zeigt weiterhin fehlende Quellen und Werte an. Über **Dimensionierung öffnen**, **Artikel bearbeiten** und **Verbindungen prüfen** gelangt man zur jeweiligen Bearbeitung.

## Konkrete Korrekturvorschläge

Explizite Bezüge von Stromkreisen auf Kabeldefinitionen werden ebenfalls verfolgt. Artikel-, Kennwert- und Längenänderungen einer solchen Kabeldefinition erreichen die betroffene Berechnung auch ohne zugeordnetes Projektgerät. **Verbindungen prüfen** öffnet in diesem Fall direkt das passende Kabel. Siehe [Kabelartikel](cable-articles.md).

Die Oberfläche kann ausdrücklich gebundene, inzwischen geänderte Hauptartikel in die zugehörige Berechnung übernehmen. Dokumentierte Kennwerte werden angeboten; Werte werden nicht aus Artikelbeschreibungen geschätzt. Bekannte inkompatible Artikel werden nicht automatisch übernommen. Ein Artikelwechsel verwirft überholte gerätepaarbezogene Selektivitätsbelege. Fehlende Daten bleiben unvollständig.

Eine bereits mit Quelldaten verknüpfte Bezugslinie kann ihre gespeicherte reale Länge und ihren Querschnitt erneut an die Berechnung übergeben. Dafür müssen Objekt und Anschlüsse weiterhin eindeutig und unverändert zugeordnet sein. Der Nutzer bestätigt zusätzlich, dass die Bezugslinie die vollständige Stromkreisleitung repräsentiert. Aus Zeichnungsabständen wird keine Leitungslänge abgeleitet. Ein neuer Querschnitt ersetzt nicht automatisch den ausgewählten Kabelartikel; Widersprüche erscheinen weiterhin in der Berechnung.

Vorschläge zunächst auswählen und **Änderungen vorschauen** aufrufen. Die Vorschau zeigt die tatsächlichen Vorher-/Nachher-Felder und den anschließend berechneten Status. **Angezeigte Änderungen gemeinsam übernehmen** ist ein einzelner Rückgängig-Schritt. Zeichnungen und tatsächliche Artikelzuordnungen werden dabei nicht umgeschrieben. Die Übernahme markiert keine Aufgabe als nachgeprüft.

## Nachverfolgung und Freigaben

Ausgewählte Aufgaben lassen sich mit Bearbeiter und Begründung auf **Offen**, **In Bearbeitung** oder **Nachgeprüft** setzen. Diese Entscheidungen werden in `Project.changeImpactReview` gespeichert und mit der Projektdatei weitergegeben. Der Bezug umfasst die Prüfsumme des Referenzstands und einen Fingerabdruck der relevanten Änderungen. Neue relevante Änderungen öffnen die Aufgabe erneut. Reine Darstellungsänderungen öffnen eine elektrische Nachprüfung nicht erneut.

Ein Prüfvermerk ist keine elektrische Freigabe und unterdrückt keine Befunde. Freigegebene Archivstände bleiben unverändert. Weicht der aktuelle Arbeitsstand von einem freigegebenen Referenzstand ab, weist die Übersicht darauf hin. Ein neuer Arbeitsstand muss separat gespeichert und freigegeben werden.

## Unterlagen und Export

Stücklisten und Klemmen-, Kabel-, Stecker- und Verbindungslisten werden anhand ihrer erzeugten Inhalte verglichen. Geänderte Zeichnungen oder Projektierungsdaten verlangen außerdem eine erneute Projektausgabe. Bereits heruntergeladene Dokumente werden nicht automatisch ersetzt oder zurückgerufen.

JSON enthält sämtliche Ursachen einschließlich der verglichenen Felder. CSV und PDF enthalten die Arbeitsliste mit Referenz, Prüfsummen, Nachverfolgung und Prüfumfang. PDF verwendet Querformat und Projektplankopf. Suche und Filter begrenzen nur die Ansicht; Exporte enthalten alle Aufgaben. Die Analyse läuft auf Anforderung. Ändert sich das Projekt zwischen Analyse und Übernahme oder Export, muss die Analyse aktualisiert werden.

## English

**Reports → Change impact** compares the working project with a saved reference revision. It provides an actionable worklist for affected circuits, unassigned electrical changes and documents. Exact device bindings and actual conductor nets determine dependencies; matching names are insufficient. Review decisions require an author and reason and expire after relevant changes. They do not approve the installation or suppress electrical findings.

Bound part ratings and explicit physical wire values can be synchronized into calculations after an exact preview. Known incompatible parts, changed endpoints and inferred drawing lengths are excluded. Batch adoption is undoable. Released archives remain immutable. Export the complete worklist as JSON, CSV or landscape PDF with the project title block.
