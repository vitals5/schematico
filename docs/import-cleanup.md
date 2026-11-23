# Importdaten bereinigen

**Projekt → Importdaten bereinigen…** erstellt eine Vorschau für Navigatoren und Listen. Beim Öffnen wird der aktuelle Projektstand geprüft. Drei Regeln sind einzeln wählbar:

- **Objektrollen:** Reine native Grafik wird von Geräten unterschieden. Geräteanschlusspunkte werden nicht als Reihenklemmen ausgewertet; bekannte Steckdosen-/Steckersymbolfamilien bleiben eigene Geräte statt Klemmen. Benannte Gerätekästen und ausdrücklich zugeordnete Artikel bleiben im Gerätebestand erreichbar.
- **Artikelbestand:** Die Stückliste zählt zugeordnete Artikel, Kabelartikel mit erfassten Längen und Klemmenzubehör. Fehlende Zuordnungen erzeugen keine fiktiven `STD-…`-Artikel. Eine unzugeordnete Grafikgruppe unterdrückt keine zugeordneten Artikel ihrer Mitglieder.
- **Verbindungsdarstellungen:** Eine eindeutig zuordenbare native gezeichnete und logische Verbindung zwischen denselben aufgelösten Anschlüssen erscheint gemeinsam in der Verbindungsliste. Beide ursprünglichen Datensätze bleiben im Projekt. Ihre IDs sind in den Verbindungsdetails sichtbar. Eine ausdrücklich eingetragene reale Länge gilt anschließend für beide zugeordneten Darstellungen.

Die Tabelle zeigt Einträge vor und nach der Interpretation. Diese Zahlen sind **keine bestätigten physischen Gerätemengen**. Verschiedene Darstellungen desselben Betriebsmittels werden nicht automatisch allein anhand des BMKs zu einem Gerät zusammengeführt. Fehlende Klemmennummern erscheinen als `?`; Ziffern in Funktionstexten oder freien Gerätebeschreibungen gelten nicht als Nummerierungsnachweis.

## Importierte Klemmen in Reihen übernehmen

**Erkannte Klemmen in Klemmenreihen übernehmen** ist zusätzlich wählbar und beim Öffnen vorausgewählt. Die Vorschau nennt erkannte, zu übernehmende und bereits konfigurierte Darstellungen, neue/ergänzte Reihen sowie offene Prüfpunkte. **Betroffene Klemmenreihen anzeigen** zeigt Kennzeichen mit Anlage, Einbauort und Anzahl.

Die Erkennung trennt Reihenklemmen von Geräteanschlüssen und Steckverbindern. Als Nummer gelten eine vorhandene Klemmenkonfiguration oder der nummerierte BMK-Zusatz. Bei bekannten nativen Zweianschluss-Klemmensymbolen wird außerdem die beim früheren Import im Feld **Gerätebezeichnung** gespeicherte, einzelne Klemmenkennzeichnung übernommen, etwa `1`, `N` oder `PE`. Freie Beschreibungstexte, Anschlussnummern und räumliche Nähe sind keine Nummerierungsnachweise.

Die Umwandlung speichert `terminal`-Metadaten und `terminalStrips` mit eigener Geräteposition je eindeutiger Darstellung. Die Reihenfolge folgt den vorhandenen Blatt- und Zeichnungspositionen. Vorhandene Zuordnungen und Artikel bleiben erhalten. Gleiche Nummern werden weder umnummeriert noch automatisch als Etagen oder Teilklemmen zusammengefasst. Fehlende Nummern, unklare Leistenkennzeichen, widersprüchliche Angaben und bestehende Gerätebindungen erscheinen unter **Klemmenstruktur prüfen**; **Klemme bearbeiten** führt in den zentralen Editor. Neue elektrische Brücken, interne Verbindungen oder Herstellerzuordnungen entstehen nicht.

**Übernehmen und Klemmeneditor öffnen** speichert die geprüfte Struktur und zeigt sie direkt im Klemmeneditor. Bereits verdrahtete importierte Klemmen bleiben an ihrer Position; die Umwandlung verändert weder Leitungswege noch die bestehende Beschriftungsdarstellung. Die automatische horizontale Anordnung neuer Reihen ist davon unabhängig. Erneute Bereinigung erzeugt keine doppelten Positionen; neue eindeutige Klemmen können vorhandene Reihen ergänzen.

## Befunde bearbeiten

Der Filter **Zu prüfen** zeigt Zuordnungskandidaten, fehlende Klemmennummern, widersprüchliche Verbindungsdaten und abweichende Kabeladerzahlen. **Alle Befunde** beziehungsweise die einzelnen Rollenfilter machen auch Grafik und Geräteanschlüsse nachvollziehbar. Die Liste ist durchsuchbar und auf 50 Zeilen je Ansicht begrenzt.

**Im Plan** springt zur betreffenden Darstellung. **Zuordnen** öffnet die Artikelverwaltung mit den betreffenden Darstellungen vorausgewählt. Dort lassen sich eine Hauptdarstellung wählen, die gemeinsame Geräteidentität nach Prüfung bestätigen und Artikel zuweisen. Die Vorschau selbst bestätigt keine Identitäten oder Herstellerdaten. **Kabel prüfen** öffnet den zugehörigen Kabeldatensatz im Klemmen-/Kabelwerkzeug; die Verbindungsübersicht ist ebenfalls direkt erreichbar.

Die Artikelverwaltung blendet nach aktivierter Rollenregel technische Darstellungen standardmäßig aus. **Technische Darstellungen anzeigen** macht sie wieder sichtbar. Ausdrücklich zur Bearbeitung vorausgewählte Darstellungen bleiben erreichbar.

## Bewusst offene Fälle

Widersprüchliche Potenziale, Farben, Querschnitte oder Längen bleiben als getrennte Verbindungen mit Hinweis sichtbar. Auch unterschiedliche Kabel-/Aderzuordnungen verhindern die Zusammenfassung. Parallele Zeichnungsleitungen, mehrdeutige Anschlüsse und manuell neu angelegte Verbindungen werden nicht als vermeintliche Duplikate entfernt. Gezeichnete Teilstrecken über Winkel und T-Stücke werden nicht automatisch zu neuen Leitungswegen umgebaut.

Die Bereinigung rekonstruiert keine fehlenden Herstellerartikel aus dem Aussehen eines Symbols. Quelle sind die ursprünglichen Artikeldaten oder eine ausdrücklich geprüfte Katalogzuordnung. Kabeladern werden bei abweichender Anzahl weder gelöscht noch erfunden.

## Übernehmen, Speichern und Rückgängig

Die Vorschau verändert das Projekt nicht. **Bereinigung übernehmen** speichert die versionierten Regeln unter `dataInterpretation` und bei gewählter Klemmenübernahme zusätzlich die nachgewiesene Klemmenstruktur. Ohne diese Option bleiben alle Seitenobjekte unverändert. Symbole, Anschluss-IDs, Artikelbelege, Grafiken, Leitungswege, logische Verbindungen und Schaltschrankaufbauten bleiben in beiden Fällen erhalten. Die elektrische Netzstruktur wird nicht geändert.

Eine zwischenzeitliche Datenänderung blockiert die veraltete Vorschau. **Projektstand neu laden** berechnet sie erneut. Die Übernahme ist ein globaler Rückgängig-Schritt; Regeln und Klemmenstruktur werden mit der Projektdatei gespeichert. Die Auswertungsregeln können später einzeln ausgeschaltet werden. Das Ausschalten der Klemmenübernahme löscht keine bereits gespeicherte Struktur; deren Änderungen erfolgen im Klemmeneditor oder über Rückgängig.

**Prüfbericht als JSON** exportiert die Vorher-/Nachher-Zahlen, Rollen, Quellobjekt-Adressen und offenen Befunde. Die Datei enthält Projektbezüge und sollte entsprechend behandelt werden.

Automatisierte Tests prüfen Rollen, Artikelzählung, Nummerierungsnachweise, Verbindungszuordnung und Konflikte, unveränderte Seiten/Bibliotheken/Schaltschrankaufbauten, elektrische Netze, Speichern und Rückgängig/Wiederholen. Der optionale Browserlauf `python scripts/browser/import-cleanup.py http://localhost:4198` prüft die vollständige Bedienung und unverändertes Zeichnungs-SVG. Als zweites Argument kann ein lokales Projekt angegeben werden; private Beispieldaten werden nicht im Repository mitgeliefert.
