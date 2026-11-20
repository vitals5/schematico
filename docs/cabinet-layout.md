# Schaltschrank-Aufbau in 2D

**Projekt → Schaltschrank-Aufbau 2D…** öffnet den mechanischen Arbeitsmodus direkt in der Hauptarbeitsfläche. Alternativ schaltet die Schaltfläche **Schaltschrank** in der oberen Werkzeugleiste um. Es wird kein separates Dialogfenster geöffnet. Bibliothek und Montagewerkzeuge stehen links, die Aufbauzeichnung in der Mitte und die Objekteigenschaften rechts. Mit **Schaltplan / Grundriss** gelangt man zurück zur Zeichnung. Bestehende Aufbauten bleiben unverändert im Projekt gespeichert. Montageplatten, Tragschienen, Verdrahtungskanäle und Gerätekörper werden in Millimetern gespeichert. Dieser Bereich verschiebt keine Schaltzeichen und erzeugt keine elektrischen Verbindungen.

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
- Die Fokuslinse bietet Zoom von 25 bis 800 Prozent, eine Übersicht und Objektnavigation. Strg+Mausrad zoomt innerhalb der Zeichnung. Die gespeicherten Millimetermaße bleiben unverändert. Vorhandene Gerätebezüge öffnen mit **Im Plan ansehen** die Schaltplanstelle im Haupteditor. Beim erneuten Öffnen des Schaltschrankmodus wird die zuletzt gewählte gespeicherte Platte desselben Projekts ausgewählt.

**Entwurf zurück/wiederholen** und Strg+Z beziehungsweise Strg+Umschalt+Z verwalten bis zu 50 lokale Entwurfsschritte. Das Projekt wird erst durch **Aufbau übernehmen** verändert. Die gesamte Übernahme ist anschließend ein gewöhnlicher Projekt-Rückgängig-Schritt. **Neu laden (Entwurf verwerfen)** liest den aktuellen Stand ein; eine zwischenzeitliche Projektänderung blockiert die Übernahme einer alten Vorschau.

## Aufbauprüfung

Die Prüfung erkennt unzulässige Maße, überlagernde Körper/Abstände, Überschreitungen der nutzbaren Platte, ungültige Schienensitze, fehlende Gerätebezüge und doppelt platzierte Geräte – auch auf anderen Platten. Die Berührung von Objektkanten ist erlaubt. Die Überlagerung eines Geräts mit seiner ausdrücklich zugeordneten Schiene ist beabsichtigt; sie verbindet nichts elektrisch.

Geänderte Artikelzuordnungen, abweichende beziehungsweise nicht mehr verfügbare Artikelmaße sowie geänderte bestätigte Geräteidentitäten werden als Hinweise sichtbar. Maße lassen sich gezielt aus dem aktuellen Artikel-Snapshot neu übernehmen. Ein ungültiger Gerätebezug ist zu entfernen und durch eine ausdrücklich gewählte gültige Platzierung zu ersetzen. Fehler blockieren die Übernahme und den Export.

Die Auslastung bezeichnet ausschließlich die Rechteckfläche der Gerätekörper im Verhältnis zur gesamten Platte. Bei Schienen wird die belegte Breite vereinigt gezählt, damit überlappende Geräte den Kennwert nicht künstlich erhöhen. Die freie Gesamtlänge ist keine Zusage für eine zusammenhängende freie Stelle oder ausreichende Kühlung.

## Speicherung und Export

Aufbauten liegen unter `cabinetLayouts` in der Projektdatei und werden mit ihr übertragen. Alte Projekte benötigen keine Migration. Aus dem Gerätebestand übernommene Gerätekörper referenzieren vorhandene Darstellungen; Bibliotheksbauteile sind eigenständige mechanische Objekte. Beide fügen der Stückliste keine weiteren Artikel hinzu. Die geometrischen Schienen und Kanäle sind ebenfalls keine automatisch bestellten Stücklistenartikel.

Der SVG-Export ist eine eigenständige Vektorgrafik mit Millimeterabmessungen. Der PDF-Export passt die gewählte Platte im freien Bereich eines A3-Blatts mit Projektplankopf ein und benennt ihre realen Maße sowie den Zeichnungsfaktor. Die Projektangaben und die globale Blattnummer erscheinen auch bei Aufnahme in die gemeinsame PDF-Dokumentation. Er ist dadurch nicht automatisch ein Ausdruck in 1:1. Die gespeicherten Körper bleiben unabhängig von der Bildschirmvergrößerung maßstäblich.

Der Bereich liefert einen geometrisch geprüften 2D-Aufbau. Er berechnet keine Wärmeabfuhr, Einbautiefe, elektrischen Sicherheitsabstände, Bohrbilder, Verdrahtungslängen oder 3D-Montagewege. Zusätzliche Abstände sind ausdrücklich eingegebene Entwurfswerte, keine aus einer Norm oder einem Datenblatt bewiesenen Herstellerabstände.

## Standardbibliothek

Im Gerätebereich stehen **Gerätebestand** und **Standardbibliothek** als getrennte Quellen bereit. Die Bibliothek ist lokal in der Anwendung enthalten und ohne Katalogdienst nutzbar. 104 herstellerneutrale Bauformen sind nach sieben Gerätegruppen filterbar; die Suche versteht deutsche und englische Namen sowie übliche Abkürzungen. Jede Form hat eine Vorschau und eine erkennbare Frontansicht, die auch im SVG- und PDF-Export verwendet wird.

- **Schutzgeräte:** LS 1-/2-/3-/4-polig und 1P+N/3P+N, FI 2-/4-polig, FI/LS, AFDD, SLS, Motorschutz, D01/D02-, Diazed-, Zylinder- und NH-Sicherungen, Überspannungsschutz und Kompaktleistungsschalter.
- **Schalten und Steuern:** Haupt-/Lasttrennschalter, Umschalter, Installations- und Leistungsschütze, Stromstoß-, Koppel-, Zeit-, Sicherheits- und Halbleiterrelais sowie Zeitschaltuhren.
- **Klemmen und Verteilung:** Durchgangs-, PE-, N-, Doppelstock-, Installations-, Trenn- und Sicherungsklemmen, Potenzialverteiler und Hauptleitungsabzweigklemmen.
- **Versorgung und Messung:** Netzteile, Transformatoren, DC/DC-Wandler, DC-USV, Batteriemodule, Energiezähler, Multifunktionsmessgerät und Stromwandler.
- **Automatisierung:** Kompakt-SPS, CPU, DI/DO/AI/AO, Buskoppler, Ethernet-Switch, KNX-Versorgung und -Aktoren, DALI- und Schnittstellen-Gateways und Gebäudeautomations-Controller.
- **Antriebe:** Frequenzumrichter, Sanftstarter, Bremswiderstand und Netzfilter.
- **Zubehör:** Servicesteckdose, Reserveplätze, Endhalter, Thermostat, Heizung, Filterlüfter und Schrankleuchte.

Die mechanischen Planungswerte sind keine freigegebenen Herstellermaße. Modulare Bauformen verwenden hier nominell **18 mm pro Teilungseinheit (TE)** und 90 mm Höhe; Produktserien können davon abweichen. Die Varianten bilden die Baugröße ab. Auslösecharakteristik, Bemessungsstrom, Fehlerstromtyp und eine elektrische Schutzwirkung werden daraus nicht abgeleitet. Breite/Höhe, Bezeichnung, Drehung und Abstand sind nach dem Einfügen bearbeitbar; **Bibliotheksmaße wiederherstellen** übernimmt die Standardgröße gezielt erneut.

Eine Form kann 1–24 Mal auf einmal eingefügt werden. Schienenfähige Geräte werden auf der gewählten horizontalen Schiene platziert; sonst erfolgt die freie Montage auf der Platte. Die Einfügehilfe sucht jeweils eine freie Lage auf dem eingestellten Plattenraster. Für enge modulare Reihen kann das Raster auf 1 mm eingestellt werden. Passt eine ganze Serie nicht, bleibt der Entwurf unverändert. Eine erfolgreiche Serie ist ein gemeinsamer Entwurfsschritt. Die Bezeichnungen werden innerhalb des Aufbaus fortlaufend vorgeschlagen und bleiben editierbar.

Standardbauteile sind eigenständige mechanische Aufbauobjekte. Sie erzeugen keine Schaltplan-Betriebsmittel, Artikelbestellungen oder elektrischen Anschlüsse und benötigen keinen Gerätebezug. Bereits aus dem Projekt übernommene Geräte können im Eigenschaftenbereich eine **Frontansicht aus Bibliothek** erhalten: Dies verändert ausschließlich ihre Darstellung, nicht ihre Artikelmaße oder Gerätezuordnung. Beim Speichern bleiben Bibliothekskennung, individuelle Maße, Beschriftung und Schienenzuordnung in der Projektdatei erhalten; erneutes Öffnen überschreibt keine angepassten Maße.

### Maus- und Touch-Bedienung prüfen

Objekte lassen sich mit Maus, Stift oder einem Finger ziehen. Das SVG übernimmt die Touch-Geste, damit der Browser sie nicht als native Scrollbewegung abbricht. Auf freier Zeichenfläche wird die Ansicht verschoben; die mittlere Maustaste verschiebt die Ansicht auch über einem Objekt. Schienengebundene Geräte bleiben beim Ziehen auf ihrer Schiene; die ganze Schiene nimmt ihre Geräte mit. Zoom und Scrollposition bleiben beim Auswählen, Verschieben und Rückgängigmachen erhalten. Ein vom System abgebrochener Ziehvorgang verwirft seine Vorschau.

Der optionale Browser-Regressionslauf verwendet echte Chromium-Touch-Gesten, einschließlich der nativen Gestenerkennung: `python -m pip install playwright`, `python -m playwright install chromium`, anschließend bei laufendem Entwicklungsserver `python scripts/test-cabinet-pointer.py --url http://127.0.0.1:5173`. Er prüft Maus und Touch auf Desktop- und Mobilgröße, alle Aufbauobjektarten, Schienenbindung, Abbruch, Capture-Verlust, Zoom/Scrollposition, Hintergrundverschiebung sowie Speichern und Rückgängig.

## Haupteditor und Speichern

Der Aufbau nutzt die vollständige Hauptarbeitsfläche. Die Werkzeuge des ausgeblendeten Schaltplans sind in diesem Modus ausgeblendet; Tastenkürzel verändern keine unsichtbaren Schaltzeichen. Die Statuszeile zeigt die aktuelle Montageplatte, Millimetermaße, Objektzahl und das Aufbauraster.

Platzieren und Verschieben erfolgen weiterhin in einem prüfbaren Entwurf. **Aufbau übernehmen** überträgt einen gültigen Entwurf in das Projekt. Die globale Speicherschaltfläche beziehungsweise **Strg+S** übernimmt einen gültigen Aufbauentwurf vor dem Speichern ebenfalls; fehlerhafte Entwürfe werden angezeigt und nicht stillschweigend als alter Stand gespeichert. Einzelne Eigenschaften müssen zuvor über **Eigenschaften anwenden** in den Entwurf übernommen werden.

Die globalen Rückgängig-/Wiederholen-Schaltflächen bearbeiten zuerst lokale Entwurfsschritte, danach die Projektgeschichte. Bei Projekt-Rückgängig aktualisiert sich der sichtbare Aufbau. Ein Wechsel zur Zeichnung, auf eine andere Platte oder zu einem anderen Projekt fragt vor dem Verwerfen nicht übernommener Aufbauänderungen nach. Ein neuer Projektbestand übernimmt keine Entwürfe des vorherigen Projekts. Der PDF-Dialog in der Hauptleiste übernimmt vor dem Öffnen einen gültigen Aufbauentwurf; die direkten PDF-/SVG-Ausgaben bleiben ebenfalls verfügbar.

Optionaler Browser-Smoke-Test: `python scripts/browser/cabinet-workspace.py http://localhost:4198` (Python Playwright und Chromium erforderlich). Er prüft die eingebettete Hauptfläche, sichere Ansichtswechsel, lokale/globale Historie, Strg+S, Persistenz, PDF und schmale Ansichten.
