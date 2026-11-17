# Stecker- und Buchsenverwaltung

**Projekt → Stecker- und Buchsennavigator…** verwaltet Gehäuse, Kontaktpositionen und Gegenstücke projektweit. Neue Gehäuse können auch vor der Platzierung ihrer Schaltzeichen angelegt werden. Die Daten werden im Projekt unter `connectorAssemblies` und `connectorPairings` gespeichert. Bestehende Projekte benötigen keine Migration.

## Grafische Kontaktübersicht

Die Standardansicht **Grafik** zeigt Gehäuse als Karten mit schematischen Kontaktfeldern. Stifte sind gefüllt, Buchsen hohl dargestellt. Jede Position zeigt Nummer, Belegungsstatus und zugeordneten Zeichnungsanschluss. Farbe und Text unterscheiden **Zugeordnet**, **Ungeklärt**, **Frei** und **Reserve**; ein Ausrufezeichen markiert vorhandene Hinweise. Die Reihenfolge stammt aus der gespeicherten Positionsliste. Dies ist kein maßstäbliches Hersteller-Anschlussbild.

Ein Klick auf den Gehäusenamen fokussiert dessen Belegung und Gegenstückpaarungen. Ein Kontakt öffnet rechts seine Belegung, **Eigenschaften** am Gehäuse öffnet dessen Stammdaten. Über **Zum Anschluss** im Kontaktpanel gelangt man direkt zur Zeichnung. Auf schmalen Bildschirmen erscheint das Panel unterhalb der Übersicht. Bei ausgewähltem Gehäuse zeigt eine zusätzliche Grafik die tatsächlich gespeicherten Kontaktpaarungen zum Gegenstück, einschließlich abweichender Positionsnummern. Diese Darstellung ist mechanische Dokumentation.

**Grafik / Liste** wechselt die Darstellung, ohne offene Formulareingaben oder eine geprüfte Vorschau zu verlieren. Suche, Gehäuseauswahl und Belegungsstatus begrenzen die Treffermenge; die Kennzahlen oben beziehen sich auf den Projektbestand. Der Darstellungswechsel und die Suche verändern keine Projektdaten. Eine andere Gehäuseauswahl oder **Aktualisieren** verwirft offene Eingaben.

Die Grafik zeigt bis zu zwölf Gehäuse pro Seite, höchstens 64 Positionen je Gehäuse und 192 Kontaktfelder insgesamt. Weitere Gehäuse sind über **Weiter**, weitere Positionen über Suche oder die Liste erreichbar. Die vollständige Liste zeigt 100 Treffer pro Seite. Die separate Gegenstückgrafik zeigt bis zu 60 gespeicherte Paarungen unabhängig vom Positionsfilter. **Daten & Berichte** bündelt CSV, PDF und Aktualisieren; Exporte enthalten alle gefilterten Kontaktpositionen.

## Gehäuse und Positionen

**Neues Gehäuse** erfasst Anlage, Ort, BMK, Beschreibung, Stecker/Stift oder Buchse und eine kommagetrennte Positionsliste, etwa `1, 2, 3, PE`. Positionen müssen eindeutig sein. Gleiche sichtbare BMK bleiben bei unterschiedlichem Strukturkontext getrennt. Stecker und Buchse dürfen dasselbe BMK besitzen.

Nach **Gehäusedaten prüfen** zeigt die Vorschau den künftigen Kontaktplan. Erst **Übernehmen** ändert das Projekt. Auch Änderungen, Löschen und Gegenstückzuordnungen unterstützen Rückgängig/Wiederholen. Eine zwischenzeitliche Projektänderung verlangt eine neue Aktualisierung. Veränderte Formulareingaben verwerfen eine zuvor erzeugte Vorschau und müssen erneut geprüft werden.

Über **Eigenschaften** am Gehäuse oder **Gehäuse bearbeiten** für die ausgewählte Gehäusefilterung lassen sich die Stammdaten bearbeiten. Änderungen an der Positionsliste erhalten Zuordnungen gleicher Positionen. Zum Entfernen gepaarter Positionen oder Wechseln des Kontakttyps muss zunächst das Gegenstück gelöst werden. Das Entfernen eines Gehäuses entfernt seine mechanischen Paarungen, aber keine Schaltzeichen oder Leitungen.

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
