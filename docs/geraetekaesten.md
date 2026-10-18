# Gerätekästen als Elemente

Über den **Pfeil neben Element → Gerätekasten zeichnen** in der Werkzeugleiste oder **Einfügen → Gerätekasten zeichnen** ein Rechteck aufziehen oder zwei gegenüberliegende Ecken anklicken. Alternativ in **Elemente → Schrankbau & Struktur** nach „Gerätekasten“ suchen und eine Vorlage platzieren.

Gerätekästen sind reguläre Bibliothekselemente. Sie verwenden dieselbe Eigenschaftenleiste und dasselbe Fenster **Eigenschaften** wie andere Elemente, einschließlich BMK, Funktionstext, Gerätebezeichnung, technischen Daten, Gravur/Zusatztext, Artikelzuordnung und Anlagen-/Ortskennzeichen. Doppelklick oder **F2** öffnet das Fenster.

Neue Kästen erhalten die normalen automatischen Beschriftungen: **links neben dem Rahmen, rechtsbündig**. Unter **Anzeige / Beschriftung** lassen sich Position, Versatz, Ausrichtung, Schriftgröße, Textwinkel und Sichtbarkeit für jede Beschriftung getrennt einstellen. „Standardpositionen“ stellt die automatische Anordnung wieder her. Dies gilt auch nach einer Elementdrehung und im PDF.

Breite, Höhe, Linienbreite und durchgezogene/gestrichelte Linie stehen in der Eigenschaftenleiste sowie unter **Darstellung & Lage**. Eine optionale Rahmenfarbe betrifft die Umrandung; Beschriftungen behalten ihre eigenen Farbeinstellungen. Am Rahmen ziehen, um ihn zu verschieben; der Griff ändert die Größe. Die gegenüberliegende Ecke bleibt beim Skalieren fest. **Esc** verwirft die laufende Größenänderung oder Verschiebung.

Die Rahmenmitte fängt keine Klicks ab: enthaltene Bauteile und Anschlüsse bleiben eigenständige Elemente. Gemeinsam markieren, um den Rahmen und diese Elemente zusammen zu verschieben. Auch die gemeinsamen Schriftgrößen sind über die normale Mehrfachauswahl einstellbar. Rahmenlinien lassen sich bei mehreren Gerätekästen gemeinsam ändern.

## Import und vorhandene Projekte

Im Beispielprojekt werden **119 Gerätekästen** anhand ihrer gespeicherten Bibliotheksidentität erkannt, darunter sieben auf „Server“. Abmessungen und ausdrücklich gespeicherte Beschriftungspositionen werden übernommen. Ein Strukturkasten bleibt eine eigene Objektart. Anschlusspunkte und Leitungen im und am Gerät bleiben erhalten.

Die bisherigen selbst gezeichneten Kästen werden beim Öffnen eines gespeicherten Projekts automatisch in reguläre Elemente umgewandelt. IDs, Maße, BMK und Texte bleiben erhalten; Beschriftungen erhalten die gemeinsame Elementlogik. Erneutes Öffnen erzeugt keine Duplikate. Auch ältere native Projektimporte erkennen die Gerätekasten-Symbolidentitäten beim Öffnen.

Variable Maße gehören zur einzelnen Platzierung. Eine Größen- oder Linienänderung verändert weder die gemeinsame Vorlage noch andere Platzierungen. Speichern, Rückgängig/Wiederholen, Makroaustausch und PDF berücksichtigen die Elementdaten und Beschriftungspositionen.
