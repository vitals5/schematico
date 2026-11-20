# Importdaten bereinigen

**Projekt → Importdaten bereinigen…** erstellt eine Vorschau für Navigatoren und Listen. Beim Öffnen wird der aktuelle Projektstand geprüft. Drei Regeln sind einzeln wählbar:

- **Objektrollen:** Reine native Grafik wird von Geräten unterschieden. Geräteanschlusspunkte werden nicht als Reihenklemmen ausgewertet; bekannte Steckdosen-/Steckersymbolfamilien bleiben eigene Geräte statt Klemmen. Benannte Gerätekästen und ausdrücklich zugeordnete Artikel bleiben im Gerätebestand erreichbar.
- **Artikelbestand:** Die Stückliste zählt zugeordnete Artikel, Kabelartikel mit erfassten Längen und Klemmenzubehör. Fehlende Zuordnungen erzeugen keine fiktiven `STD-…`-Artikel. Eine unzugeordnete Grafikgruppe unterdrückt keine zugeordneten Artikel ihrer Mitglieder.
- **Verbindungsdarstellungen:** Eine eindeutig zuordenbare native gezeichnete und logische Verbindung zwischen denselben aufgelösten Anschlüssen erscheint gemeinsam in der Verbindungsliste. Beide ursprünglichen Datensätze bleiben im Projekt. Ihre IDs sind in den Verbindungsdetails sichtbar. Eine ausdrücklich eingetragene reale Länge gilt anschließend für beide zugeordneten Darstellungen.

Die Tabelle zeigt Einträge vor und nach der Interpretation. Diese Zahlen sind **keine bestätigten physischen Gerätemengen**. Verschiedene Darstellungen desselben Betriebsmittels werden nicht automatisch allein anhand des BMKs zu einem Gerät zusammengeführt. Fehlende Klemmennummern erscheinen als `?`; Ziffern in Funktionstexten oder freien Gerätebeschreibungen gelten nicht als Nummerierungsnachweis.

## Befunde bearbeiten

Der Filter **Zu prüfen** zeigt Zuordnungskandidaten, fehlende Klemmennummern, widersprüchliche Verbindungsdaten und abweichende Kabeladerzahlen. **Alle Befunde** beziehungsweise die einzelnen Rollenfilter machen auch Grafik und Geräteanschlüsse nachvollziehbar. Die Liste ist durchsuchbar und auf 50 Zeilen je Ansicht begrenzt.

**Im Plan** springt zur betreffenden Darstellung. **Zuordnen** öffnet die Artikelverwaltung mit den betreffenden Darstellungen vorausgewählt. Dort lassen sich eine Hauptdarstellung wählen, die gemeinsame Geräteidentität nach Prüfung bestätigen und Artikel zuweisen. Die Vorschau selbst bestätigt keine Identitäten oder Herstellerdaten. **Kabel prüfen** öffnet den zugehörigen Kabeldatensatz im Klemmen-/Kabelwerkzeug; die Verbindungsübersicht ist ebenfalls direkt erreichbar.

Die Artikelverwaltung blendet nach aktivierter Rollenregel technische Darstellungen standardmäßig aus. **Technische Darstellungen anzeigen** macht sie wieder sichtbar. Ausdrücklich zur Bearbeitung vorausgewählte Darstellungen bleiben erreichbar.

## Bewusst offene Fälle

Widersprüchliche Potenziale, Farben, Querschnitte oder Längen bleiben als getrennte Verbindungen mit Hinweis sichtbar. Auch unterschiedliche Kabel-/Aderzuordnungen verhindern die Zusammenfassung. Parallele Zeichnungsleitungen, mehrdeutige Anschlüsse und manuell neu angelegte Verbindungen werden nicht als vermeintliche Duplikate entfernt. Gezeichnete Teilstrecken über Winkel und T-Stücke werden nicht automatisch zu neuen Leitungswegen umgebaut.

Die Bereinigung rekonstruiert keine fehlenden Herstellerartikel aus dem Aussehen eines Symbols. Quelle sind die ursprünglichen Artikeldaten oder eine ausdrücklich geprüfte Katalogzuordnung. Kabeladern werden bei abweichender Anzahl weder gelöscht noch erfunden.

## Übernehmen, Speichern und Rückgängig

Die Vorschau verändert das Projekt nicht. **Auswertungsregeln übernehmen** speichert ausschließlich die versionierten Regeln unter `dataInterpretation`. Seiten, Symbole, Anschluss-IDs, Artikelbelege, Grafiken, Leitungswege, logische Verbindungen und Schaltschrankaufbauten bleiben unverändert. Die elektrische Netzstruktur wird durch diese Regeln nicht geändert.

Eine zwischenzeitliche Datenänderung blockiert die veraltete Vorschau. **Projektstand neu laden** berechnet sie erneut. Die Übernahme ist ein globaler Rückgängig-Schritt; die Regeln werden mit der Projektdatei gespeichert. Auch nach erneutem Öffnen können die Regeln einzeln ausgeschaltet und übernommen werden. Ohne gespeicherte Regeln behalten bestehende Projekte ihre bisherige Auswertung.

**Prüfbericht als JSON** exportiert die Vorher-/Nachher-Zahlen, Rollen, Quellobjekt-Adressen und offenen Befunde. Die Datei enthält Projektbezüge und sollte entsprechend behandelt werden.

Automatisierte Tests prüfen Rollen, Artikelzählung, Nummerierungsnachweise, Verbindungszuordnung und Konflikte, unveränderte Seiten/Bibliotheken/Schaltschrankaufbauten, elektrische Netze, Speichern und Rückgängig/Wiederholen. Der optionale Browserlauf `python scripts/browser/import-cleanup.py http://localhost:4198` prüft die vollständige Bedienung und unverändertes Zeichnungs-SVG. Als zweites Argument kann ein lokales Projekt angegeben werden; private Beispieldaten werden nicht im Repository mitgeliefert.
