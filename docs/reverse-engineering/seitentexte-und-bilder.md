# Seitentexte, Gerätebeschriftungen und Bilder

Die Untersuchung verwendet das vorhandene REA-Archivinventar (`ev_de4dc0fb509a8c5e9b4e0f8cea75543cdb07faa07664ed13c6242903550e644b`) und zusätzliche lesende Datensatz-/PDF-Proben. Die folgenden Feldbedeutungen sind durch diese Proben belegt, keine Aussagen eines Decompilers. SHA-256 des zusammengesetzten Beispielarchivs: `6fdf42f60f4728528b87ebfed9fef7b610122d8563f6801a1a0d6e46cd81d028`.

## Freie Texte

Der aktive Index enthält neben Typ `0x1e` auch Typ `0x53` mit wörtlichem Text in `EC5F` und Position in `EC55`. Typ `0x35` bezeichnet dagegen Eigenschaftsplatzhalter und darf nicht als freier Text angelegt werden. Der Import berücksichtigt beide wörtlichen Texttypen allgemein, ohne Seitennamen oder Textinhalte abzufragen. Jeder Text ist eine reguläre editierbare Platzierung einer gemeinsamen Bibliotheksdefinition ohne elektrische Anschlüsse.

Auf der Seite „Server“ (Quellseite 789) waren sieben Texte vom Typ `0x53` ausgelassen: X-Sense Hub, Server, Zigbee, Thread, RF433, Bluetooth, KVM. Alle liegen bei Y=32 mm im nach oben gerichteten Quellkoordinatensystem, X=132/172/236/256/276/296/316 mm. Ebene 110 enthält 2,5 mm nominale Texthöhe und Palettenwert 6 für Magenta. Der unabhängige Vektor-PDF-Export bestätigt die Baselines, Farbe und den Em-Faktor 1,242. Explizite Texthöhen haben Vorrang vor Ebenenvorgaben. Unbekannte Palettenwerte erhalten keine erfundene Farbe.

## Eingetragene Gerätebeschriftungen

Funktionstext (20011), Gravur/Zusatztext (20025), Gerätebezeichnung (20030) und technische Daten (20027) bleiben getrennte, editierbare Werte. Vorhandene Inhalte werden im Editor und PDF angezeigt. Früher gespeicherte importierte Standardwerte mit unsichtbaren Texten werden beim Öffnen sichtbar; ausdrücklich vom Benutzer gewählte Sichtbarkeit wird gespeichert und beibehalten.

Die automatische Anordnung verwendet vollständig dekodierte Eigenschaftsgruppen und deren `EC56`-Vorgängerketten innerhalb derselben Variante/Anordnung. Leere Zwischenfelder belegen keine Zeile. Ein eindeutiger gespeicherter Anordnungswert wird verwendet; sonst der gegen den Export geprüfte Standard 1. Der allgemeine Instanz-Selektor ist bislang nicht identifiziert. Unvollständige Gruppen, unbekannte Zwischenfelder, Zyklen oder nicht belegte Winkel/Ausrichtungen fallen auf die vorhandene Anordnung zurück. BMK-Positionen bleiben in diesem Schritt erhalten.

Bei Quellobjekt 40478 ist „X-Sense“ der Funktionstext, „Hub“ die separate Gravur. Beide stehen rechtsbündig links des Geräts: X=122,5 mm, Baselines von oben 151,6648 und 154,3646 mm. Objekt 40440 bestätigt dieselbe Anordnung für „Router 2“. Die neuen Regressionen prüfen die aufgelösten Anker mit 0,001 mm Toleranz. Der Referenzexport hat gegenüber dem reinen A3-Format einen zusätzlichen Rand von 0,5 pt; freie Texte werden anhand der Quellkoordinaten geprüft. Der PDF-Export verwendet weiterhin seine vorhandene Ersatzschrift, weshalb Textbreiten gegenüber der Referenzschrift abweichen können.

## Individuelle Anschlussbezeichnungen

Die acht USB-Anschlussbezeichnungen auf „Server“ verwenden vollständige Instanz-Overrides für Eigenschaft 20036. Die Position ist (0,+4) mm relativ zur Insertion, EE26=8 horizontal unten zentriert. Der separate Text 20039 bei (2,3;−4,9) mm gehört nicht zu dieser Bezeichnung. Der Import bewahrt die individuelle Anordnung am Instanzanschluss; physische Anschlüsse und Symbolkonturen bleiben unverändert in der Bibliothek. Editor, PDF, Speichern und Makros berücksichtigen dieselben Positionen. Für das erste USB-Feld bestätigt der Referenzexport den zentrierten X-Anker 216 mm, Baseline 152,714688 mm und Schrift 6,337130 pt. Die Umsetzung ist auf vollständig gelesene, eindeutige horizontale Ein-Anschluss-Overrides dieser Ausrichtung begrenzt; andere Fälle behalten die Bibliotheksvorgabe.

## Seitengrafiken

Bildplatzierungen sind aktive Instanzdatensätze vom Typ 91: `F0D3/F0D4` enthalten die Eckpunkte, `F0E7` den Dateiverweis. Nur direkte Seitenreferenzen vom Typ 4 oder auflösbare Elternketten erzeugen normale Seitenbilder. Formularreferenzen sind keine Seitenreferenzen. Der Dateiname wird eindeutig unter dem eingebetteten Bilderverzeichnis aufgelöst; PNG/JPEG werden anhand ihrer Bytes erkannt. Fehlende oder mehrdeutige Dateien werden diagnostiziert, nicht ersetzt.

Auf „Einspeisung“ ist Objekt 153386 das Bild unten links, 377 × 376 Pixel. Position von links/oben 12 × 193 mm, Größe 76 × 75,7984085 mm; der Export auf PDF-Seite 2 bestätigt diese Grenzen. Acht Bilder auf normalen Seiten werden übernommen; ein weiteres Bild gehört zum Titelformular. Die Seitengrafiken werden als `PageImage` gespeichert und unabhängig von elektrischen Komponenten bearbeitet. Der Import verwendet denselben Maßstab 1000/420 wie die übrige Quellzeichnung.

Früher verlorene freie Texte, Gravuren und Bildzuordnungen lassen sich nur aus den ursprünglichen Archivdaten wiederherstellen: Beide Teilarchive erneut importieren. Bereits erhaltene Beschriftungswerte werden auch bei älteren gespeicherten Projekten sichtbar gemacht.
