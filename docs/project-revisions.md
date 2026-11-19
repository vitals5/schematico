# Projektstände, Vergleich und Freigaben

**Projekt → Projektstände & Freigaben…** verwaltet benannte Momentaufnahmen des vollständigen bearbeitbaren Projekts. Ein Stand enthält Zeichnungen, Bibliotheksdefinitionen, Artikelzuordnungen, Projektierungs- und Dimensionierungsdaten. Name, Bearbeiter und Änderungsgrund sind Pflichtangaben. Namen sind innerhalb des Archivs eindeutig.

## Speichern und Weiterbearbeiten

**Stand speichern** archiviert den aktuellen Projektbestand. Der Arbeitsstand bleibt bearbeitbar. Das Archiv liegt unter `Project.revisions` in der normalen Projektdatei; es benötigt keinen Server und reist mit JSON-, XML- und eigenen Archivexporten. Die Projektdatei anschließend wie gewohnt speichern. Die automatische Browsersicherung unterliegt weiterhin dem verfügbaren lokalen Speicher; sie ersetzt die Projektdatei nicht.

Jede Momentaufnahme wird unabhängig mit gzip komprimiert und als Base64 gespeichert. Ältere Archive sind nicht erneut in den Nutzdaten enthalten. Dadurch entsteht keine rekursive Verdoppelung. Bibliotheksdaten werden beim späteren Öffnen aus dem jeweiligen Stand aufgelöst. Die Grenzen betragen 128 MiB unkomprimiert je Stand und zusammen 64 MiB Base64-Archivdaten; das Überschreiten wird gemeldet, ohne ältere Stände automatisch zu löschen.

**Projektdatei dieses Stands** prüft und exportiert die Momentaufnahme als eigenständiges bearbeitbares Projekt ohne eingeschachteltes Revisionsarchiv. **Arbeitskopie daraus erstellen** ersetzt den Arbeitsbestand nach ausdrücklicher Bestätigung. Vorher wird der aktuelle Arbeitsstand mit Bearbeiter und Grund als zusätzlicher Sicherungsstand archiviert. Das bestehende Archiv bleibt erhalten, der Ursprung der Arbeitskopie wird dokumentiert. Die Wiederherstellung ist ein Rückgängig-Schritt.

## Vergleichen

Ein gewählter Stand lässt sich mit dem aktuellen Arbeitsstand oder einem anderen gespeicherten Stand vergleichen. Verglichen werden stabile Blatt-/Objektkennungen und deren Eigenschaften: unter anderem BMK, Texte, Artikel, Positionen, Leitungsanschlüsse, Leitungsattribute, Bibliotheksdefinitionen, Aufbauten und Dimensionierungen. Unbekannte zusätzliche Projektdaten bleiben ebenfalls im Vergleich erhalten. Gleiche BMK ersetzen keine Objektidentität.

Reine Ansichtswechsel, der Änderungszeitstempel und abgeleitete Anschluss-Leitungslisten erzeugen keine Befunde. Die Blattreihenfolge wird berücksichtigt. Mehrdeutige Objektkennungen führen zu einer Fehlermeldung statt zu einer willkürlichen Zuordnung.

Die seitlichen Blattansichten zeigen die gespeicherte Geometrie: **grün hinzugefügt, rot entfernt, gelb geändert**. Markierungen verändern keine Zeichnung. Die feldgenaue Liste nennt Vorher-/Nachher-Werte und lässt sich durchsuchen und seitenweise anzeigen. Die Oberfläche begrenzt lange Zellwerte; **Vollständiger Vergleich JSON** und der Vergleichs-PDF enthalten alle erfassten Änderungen. Nicht zeichnungsbezogene Änderungen sind in der Liste sichtbar. Die Ansicht ist eine geometrische Vergleichsvorschau, keine zweite Bearbeitungsfläche für Grundrisse oder Deckblätter.

## Freigabe

**Freigeben** verlangt einen Bearbeiter und einen Freigabegrund und prüft vorher die SHA-256-Prüfsumme der Nutzdaten. Ein freigegebener Archivstand kann weder erneut freigegeben noch gelöscht werden. Seine Momentaufnahme bleibt unverändert. Auch Rückgängig/Wiederholen von Zeichnungsänderungen entfernt oder entsperrt bereits freigegebene Stände nicht. Ein anderes Projekt oder eine andere Projektdatei zu öffnen beginnt einen eigenen Verlauf.

Die Freigabe dokumentiert eine ausdrücklich eingetragene Benutzerentscheidung. Sie ist keine kryptografische Signatur und keine serverseitige Benutzerprüfung. Die Prüfsumme erkennt beschädigte oder nachträglich veränderte Nutzdaten; sie beweist nicht die Identität eines Unterzeichners. Extern bearbeitete Projektdateien sind kein manipulationssicheres Archiv.

## Dokumentation

Die Revisionsliste lässt sich als CSV und PDF ausgeben. Der gemeinsame Projekt-PDF-Dialog enthält **Projektstände und Freigaben** als eigenen auswählbaren Abschnitt. Die Liste nennt Name, Status, Bearbeiter, Zeit, Grund, Prüfsumme und gegebenenfalls die Freigabeangaben. Alle PDF-Seiten verwenden Querformat und den Projektplankopf.

Kompression, Prüfung und Wiederherstellung kontrollieren den Projektstand vor der Übernahme erneut. Hat beispielsweise der KI-Assistent zwischenzeitlich Änderungen vorgenommen, wird die alte Vorschau nicht über den neuen Bestand geschrieben.
