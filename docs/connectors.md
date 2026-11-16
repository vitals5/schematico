# Stecker- und Buchsenverwaltung

**Projekt → Stecker- und Buchsennavigator…** verwaltet Gehäuse, Kontaktpositionen und Gegenstücke projektweit. Neue Gehäuse können auch vor der Platzierung ihrer Schaltzeichen angelegt werden. Die Daten werden im Projekt unter `connectorAssemblies` und `connectorPairings` gespeichert. Bestehende Projekte benötigen keine Migration.

## Gehäuse und Positionen

**Neues Gehäuse** erfasst Anlage, Ort, BMK, Beschreibung, Stecker/Stift oder Buchse und eine kommagetrennte Positionsliste, etwa `1, 2, 3, PE`. Positionen müssen eindeutig sein. Gleiche sichtbare BMK bleiben bei unterschiedlichem Strukturkontext getrennt. Stecker und Buchse dürfen dasselbe BMK besitzen.

Nach **Gehäusedaten prüfen** zeigt die Vorschau den künftigen Kontaktplan. Erst **Übernehmen** ändert das Projekt. Auch Änderungen, Löschen und Gegenstückzuordnungen unterstützen Rückgängig/Wiederholen. Eine zwischenzeitliche Projektänderung verlangt eine neue Aktualisierung. Veränderte Formulareingaben verwerfen eine zuvor erzeugte Vorschau und müssen erneut geprüft werden.

Bei ausgewähltem Gehäuse lassen sich die Stammdaten bearbeiten. Änderungen an der Positionsliste erhalten Zuordnungen gleicher Positionen. Zum Entfernen gepaarter Positionen oder Wechseln des Kontakttyps muss zunächst das Gegenstück gelöst werden. Das Entfernen eines Gehäuses entfernt seine mechanischen Paarungen, aber keine Schaltzeichen oder Leitungen.

## Kontaktbelegung

**Belegung** wählt für eine Position einen Zustand:

- **Ungeklärt:** Noch keine ausdrückliche Belegungsangabe.
- **Frei:** Ausdrücklich als freie Position dokumentiert.
- **Reserve:** Ausdrücklich reservierte Position.
- **Anschluss zuordnen:** Ein tatsächlicher Bibliotheksanschluss eines Elements wird über Blatt, Element und Anschluss ausgewählt.

Ein Anschluss darf nicht mehreren Kontaktpositionen zugeordnet werden. Fehlende, mehrdeutige oder nur als veralteter Platzierungseintrag vorhandene Anschlüsse werden abgelehnt. Frei/Reserve besitzt keine Anschlussbindung. Eine solche Metadatenänderung löscht keine vorhandene Leitung am ursprünglichen Symbol und bestätigt keine reale physische Trennung.

Die Zuordnung ist ausdrücklich. Vorhandene Schaltzeichen, gleiche BMK, Grafikformen oder gleiche Anschlussnummern erzeugen nicht automatisch eine Geräte- oder Gehäuseidentität. Bestehende/importierte Symbole lassen sich über ihre tatsächlichen Anschlüsse zuordnen. Die Verwaltung fügt keine zusätzliche Artikelposition zur Stückliste hinzu.

## Gegenstücke

**Gegenstück zuordnen** verbindet ein Steckergehäuse mit einem Buchsengehäuse. Jede Seite darf nur ein Gegenstück besitzen. Die Tabelle schlägt gleiche Positionsnamen vor; jede Zuordnung kann auf eine andere vorhandene Position geändert oder leer gelassen werden. Zugeordnete Positionen müssen eins zu eins zusammenpassen. Nicht zugeordnete Kontakte bleiben sichtbar.

**Diese Paarung ist mechanische Dokumentation.** Sie bestätigt keine Herstellerkompatibilität und fügt keine elektrische Verbindung hinzu. Der elektrische Netzservice verwendet weiterhin die tatsächlichen Schaltplanverbindungen. Erzeugung zusätzlicher Leiterverbindungen und Simulation eines gesteckten Zustands gehören nicht zu dieser Funktion.

## Navigation, Prüfung und Steckerplan

Die Suche berücksichtigt Belegung, Anschluss, Gegenstück und Hinweise. Die Tabelle zeigt bis zu 100 Positionen pro Ansicht. **Zum Anschluss** öffnet die Zeichnungsstelle. Verdrahtungsziele werden mit dem vorhandenen Netzservice über Verbindungselemente und Blattübergänge ermittelt.

Gelöschte Anschlüsse, doppelte Positionen, mehrfach gebundene Anschlüsse und widersprüchliche Paarungen erscheinen als Hinweise. Der gemeinsame elektrische Prüflauf führt sie unter `connector_configuration`, einschließlich Gehäuse- und Positionskennung. Die Bewertung ist keine elektrische Freigabe.

**CSV/PDF: gefilterter Steckerplan** exportiert alle gefilterten Positionen mit Belegungsstatus, Anschlüssen, Gegenstückpositionen, Verdrahtungszielen und Hinweisen. PDF verwendet A3 quer, umbrochene Texte und Folgeseiten. CSV schützt potenziell als Tabellenformel interpretierbare Werte. Noch ungeklärte Kontakte bleiben auch im Export ungeklärt.
