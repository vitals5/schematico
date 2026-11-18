# Schaltschrank-Aufbau in 2D

**Projekt → Schaltschrank-Aufbau 2D…** öffnet einen eigenen mechanischen Entwurfsbereich. Montageplatten, Tragschienen, Verdrahtungskanäle und Gerätekörper werden in Millimetern gespeichert. Dieser Bereich verschiebt keine Schaltzeichen und erzeugt keine elektrischen Verbindungen.

## Maße und Gerätebezüge

Der Artikelkatalog bietet **Mechanische Abmessungen** mit gemeinsam anzugebender Breite und Höhe sowie optionaler Tiefe in Millimetern. Diese strukturierten Werte bleiben in JSON/CSV, Projekt-Snapshots und der Katalogeinreichung erhalten. Im unterstützten WSPAK-Format werden positive numerische Werte aus den ausdrücklich vorhandenen `cabinet.width`, `cabinet.height` und optional `cabinet.length` übernommen; der Import bleibt ungeprüft. Freie Beschreibungstexte, Klassifikationscodes, Schaltzeichengrößen und unbestimmte Grafikdatei-Einheiten liefern keine Gerätemaße.

Änderungen am Katalog aktualisieren vorhandene Artikel-Snapshots nicht automatisch. Dafür stehen die vorhandenen Artikelwerkzeuge zur Verfügung. Der Aufbau verwendet die Maße des zugeordneten Hauptartikels im Projekt. Ein Zubehörteil liefert keinen ersatzweisen Gerätekörper. Ohne strukturierte Maße sind Breite und Höhe vor dem Platzieren ausdrücklich einzutragen. Eine Größenänderung kann als manuelle Maßangabe gespeichert werden. Tiefe wird aufbewahrt, aber in dieser 2D-Ansicht nicht geprüft.

Der Gerätebestand verwendet bestätigte physische Geräte beziehungsweise einzelne Schaltplandarstellungen. Gleiche BMK bestätigen keine gemeinsame Geräteidentität. Ein bestätigtes Gerät mit mehreren Darstellungen wird einmal angeboten. Die Suche und jeweils 30 Arbeitspositionen pro Bestandsseite halten auch größere Projekte erreichbar.

## Platte und Platzierung

Eine neue Platte beginnt mit 600 × 800 mm, 10 mm Rand und 5 mm Raster. Dies sind veränderbare Entwurfswerte, keine Herstellerangaben. Unterstützt werden Plattenmaße von 50 bis 10.000 mm, ein Raster von 1 bis 50 mm, Randabstände bis 100 mm und bis zu 1.000 Objekte je Platte. Die aktuelle Darstellung auf dem Bildschirm ist eine Ansicht, kein physischer 1:1-Maßstab.

- **Tragschiene hinzufügen** und **Kanal hinzufügen** erzeugen bearbeitbare Rechteckgeometrie. Maße und Lage werden im Eigenschaftenbereich angepasst. Der Startwert der Schienenhöhe ist 35 mm.
- Ein Gerät auswählen, seine bekannten oder manuell eingegebenen Maße prüfen und optional eine horizontale Schiene auswählen. Beim Platzieren wird eine freie Rasterlage zwischen den vorhandenen Hindernissen gesucht. Wird keine passende Lage gefunden, wird kein überlappendes Gerät ergänzt. Dies ist eine Einfügehilfe, keine globale Aufbauoptimierung.
- Objekte lassen sich anklicken und ziehen. Pfeiltasten bewegen das fokussierte Objekt um einen Rasterschritt. X/Y, Breite, Höhe, zusätzliche Abstände und 0°/90°-Einbaulage lassen sich über **Eigenschaften anwenden** ändern.
- Geräte mit Schienenzuordnung sitzen mittig auf der horizontalen Schiene. Beim Verschieben der Schiene werden sie gemeinsam mitgenommen. Beim Entfernen der Schiene bleiben die Geräte an ihren absoluten Positionen und werden zu freien Platzierungen.
- Die Fokuslinse bietet Zoom von 25 bis 800 Prozent, eine Übersicht und Objektnavigation. Strg+Mausrad zoomt innerhalb der Zeichnung. Die gespeicherten Millimetermaße bleiben unverändert. Vorhandene Gerätebezüge öffnen mit **Im Plan ansehen** die Schaltplanstelle und anschließend denselben Aufbauentwurf wieder.

**Entwurf zurück/wiederholen** und Strg+Z beziehungsweise Strg+Umschalt+Z verwalten bis zu 50 lokale Entwurfsschritte. Das Projekt wird erst durch **Aufbau übernehmen** verändert. Die gesamte Übernahme ist anschließend ein gewöhnlicher Projekt-Rückgängig-Schritt. **Neu laden (Entwurf verwerfen)** liest den aktuellen Stand ein; eine zwischenzeitliche Projektänderung blockiert die Übernahme einer alten Vorschau.

## Aufbauprüfung

Die Prüfung erkennt unzulässige Maße, überlagernde Körper/Abstände, Überschreitungen der nutzbaren Platte, ungültige Schienensitze, fehlende Gerätebezüge und doppelt platzierte Geräte – auch auf anderen Platten. Die Berührung von Objektkanten ist erlaubt. Die Überlagerung eines Geräts mit seiner ausdrücklich zugeordneten Schiene ist beabsichtigt; sie verbindet nichts elektrisch.

Geänderte Artikelzuordnungen, abweichende beziehungsweise nicht mehr verfügbare Artikelmaße sowie geänderte bestätigte Geräteidentitäten werden als Hinweise sichtbar. Maße lassen sich gezielt aus dem aktuellen Artikel-Snapshot neu übernehmen. Ein ungültiger Gerätebezug ist zu entfernen und durch eine ausdrücklich gewählte gültige Platzierung zu ersetzen. Fehler blockieren die Übernahme und den Export.

Die Auslastung bezeichnet ausschließlich die Rechteckfläche der Gerätekörper im Verhältnis zur gesamten Platte. Bei Schienen wird die belegte Breite vereinigt gezählt, damit überlappende Geräte den Kennwert nicht künstlich erhöhen. Die freie Gesamtlänge ist keine Zusage für eine zusammenhängende freie Stelle oder ausreichende Kühlung.

## Speicherung und Export

Aufbauten liegen unter `cabinetLayouts` in der Projektdatei und werden mit ihr übertragen. Alte Projekte benötigen keine Migration. Gerätekörper sind Referenzen auf vorhandene Darstellungen; sie fügen der Stückliste keine weiteren Artikel hinzu. Die geometrischen Schienen und Kanäle sind ebenfalls keine automatisch bestellten Stücklistenartikel.

Der SVG-Export ist eine eigenständige Vektorgrafik mit Millimeterabmessungen. Der PDF-Export passt die gewählte Platte auf ein A3-Blatt ein und benennt ihre realen Maße sowie den Zeichnungsfaktor. Er ist dadurch nicht automatisch ein Ausdruck in 1:1. Die gespeicherten Körper bleiben unabhängig von der Bildschirmvergrößerung maßstäblich.

Der Bereich liefert einen geometrisch geprüften 2D-Aufbau. Er berechnet keine Wärmeabfuhr, Einbautiefe, elektrischen Sicherheitsabstände, Bohrbilder, Verdrahtungslängen oder 3D-Montagewege. Zusätzliche Abstände sind ausdrücklich eingegebene Entwurfswerte, keine aus einer Norm oder einem Datenblatt bewiesenen Herstellerabstände.
