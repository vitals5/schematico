# Assistenten zur Projektbereinigung

Diese Werkzeuge ergänzen den gemeinsamen elektrischen Prüflauf. Änderungen werden zuerst als Vorschlag angezeigt und erst durch **Übernehmen** in das Projekt geschrieben. Eine Übernahme ist ein Rückgängig-Schritt; Strg+Z und Wiederholen gelten auch für diese Datenänderungen. Wurde das Projekt inzwischen bearbeitet, muss eine neue Vorschau erstellt werden. Anschlusskoordinaten, Symbolgrößen und Leitungswege bleiben erhalten.

## Kabelzuordnungen prüfen

Unter **Projekt → Klemmen und Kabel… → Kabeldaten: Reparaturvorschläge** zeigt der Assistent mögliche Korrekturen mit bisherigem Wert, künftigem Wert und Begründung. Vorschläge sind zunächst nicht ausgewählt.

- **Leitungen zuordnen:** Eine bisher unaufgelöste Aderposition wird mit tatsächlichen Kreuzungen der Kabeldefinitionslinie verglichen. Ein eindeutiger, naher geometrischer Treffer muss zusätzlich einem einzigen auflösbaren elektrischen Leiternetz entsprechen. Mehrdeutige Leitungen, konkurrierende Aderpositionen und bereits anderweitig belegte Leitungen werden nicht vorgeschlagen. Die Vorschau nennt Abstand, Position und vorhandenen Quellnachweis. Ein geometrischer Treffer ist ein Vorschlag zur Prüfung und kein Herstellerbeleg für die reale Aderbelegung.
- **Als Reserve kennzeichnen:** Für Adern ohne gültige Zuordnung kann eine Reservekennzeichnung vorgeschlagen werden. Ob die Ader tatsächlich unbenutzt ist, muss ausdrücklich bestätigt werden. Eine leere Zuordnung allein beweist dies nicht.
- **Reservepositionen ergänzen:** Bei höherer deklarierter Aderzahl lassen sich fehlende Positionen ausdrücklich als Reserve anlegen. Vorhandene Adern bleiben bestehen.
- **Deklarierte Aderzahl anpassen:** Alternativ lässt sich die deklarierte Zahl an die erfassten Positionen anpassen. Auch dies erfordert eine ausdrückliche Bestätigung und sagt nichts über den tatsächlichen Kabelaufbau aus.

Zwei alternative Korrekturen für dieselbe Ader oder dieselbe Aderzahl können nicht gemeinsam übernommen werden. Das Überschreiben alter Zuordnungen verlangt eine zusätzliche Bestätigung. Übernommene Änderungen speichern ihre Begründung und Bestätigung in `repairHistory`; ursprüngliche Importdaten bleiben erhalten. Reserveadern erzeugen keine ersatzweise aus der Zeichnungsgeometrie abgeleiteten Aderbeschriftungen.

## Herstellerdaten und Funktionsplätze

Der lokale Artikelkatalog importiert zusätzlich **BMEcat-XML**. Herstellerartikelnummer und Herstellername werden bevorzugt verwendet, eine Lieferantenartikelnummer dient als Rückfall. Varianten werden nur aus einer ausdrücklichen Variantenkennung übernommen. Kurz-/Langbeschreibung, Typbeschreibung, Lieferantennummer und Merkmale einschließlich Einheiten bleiben als Beschreibung erhalten. Für CSV und JSON gelten weiterhin die bestehenden [Katalogformate](article-workbench.md).

Codierte Merkmale, etwa aus einer Klassifikation, werden nicht in elektrische Anschlussbilder umgedeutet. Ein Datensatz ohne strukturierte Funktionen bleibt entsprechend ungeprüft. Als ausdrückliche Erweiterung kann ein BMEcat-Merkmal `SCHEMATICO_FUNCTIONS` ein JSON-Array im bekannten Format enthalten:

```json
[
  { "id": "coil", "type": "relay_coil", "pins": ["A1", "A2"] },
  { "id": "aux1", "type": "contact_no", "pins": ["13", "14"] }
]
```

Der Import prüft diese Struktur, markiert die Daten aber weiterhin als **ungeprüft**. XML mit Dokumenttyp-/Entity-Deklarationen wird abgelehnt. Die unterstützte XML-Dateigröße ist auf 20 MiB, die Artikelzahl auf 10.000 begrenzt. Vor dem Katalogschreiben erscheinen dieselbe Konfliktvorschau und dieselben Schutzprüfungen wie bei CSV/JSON. Bereits im Projekt verwendete Artikel-Snapshots werden durch einen Katalogimport nicht automatisch ersetzt.

Im Artikelwerkzeug öffnet **Artikelfunktionen zuordnen…** Vorschläge für die ausgewählten Darstellungen. Ein Kandidat benötigt exakt passende Anschlussbezeichnungen, einschließlich eigener Anschlussnamen, und bei bekanntem Symboltyp denselben Funktionstyp. Ein unbekannter Funktionstyp wird nur nach ausdrücklicher Bestätigung übernommen. Mehrere passende Funktionsplätze bleiben auswählbar; der Assistent rät keine Zuordnung. Das Ersetzen eines bereits eingetragenen Funktionsplatzes muss bestätigt werden.

Die Zuordnung speichert ihren Nachweis unter `articleFunctionEvidence`. Sie bestätigt weder ungeprüfte Herstellerdaten noch elektrische Bemessungswerte. Fehlen passende strukturierte Funktionen, müssen diese im Katalog erfasst und der Artikel-Snapshot im Projekt gezielt aktualisiert werden.

## Bestätigte Geräteidentität und Verweise

Eine ausdrücklich bestätigte Verknüpfung unter `physicalDevices` ist jetzt auch für Haupt-/Nebenverweise und Kontaktspiegel maßgeblich. Die ausgewählte Hauptdarstellung kann ein Gerätekasten sein; sie muss kein Spulensymbol sein. Bekannte Kontaktfunktionen werden auch über ihre ausdrücklichen Funktionstypen erkannt. Andere Darstellungen mit zufällig gleichem BMK werden nicht hinzugefügt.

Die Verweise speichern neben dem gedruckten Text die genauen Seiten- und Objektadressen. Dadurch bleiben Ziele auch bei gleichen gedruckten Blattnummern und Strompfaden unterscheidbar. Editor und interaktives PDF verwenden diese Adressen. Ungültige Geräteverknüpfungen werden gemeldet und erhalten keine ersatzweisen Verweise auf ähnlich bezeichnete Objekte.

Die ursprüngliche Verweisangabe wird beim ersten Erzeugen eines Geräteverweises gesichert. Beim Auflösen der Verknüpfung wird sie wiederhergestellt; danach gelten für nicht verknüpfte Darstellungen die bisherigen Verweisregeln. Artikelmengen bleiben unverändert: Eine bestätigte Geräteverknüpfung zählt weiterhin ein physisches Gerät, eine bloße Funktionsplatzzuordnung fasst keine Geräte zusammen.

## Zentrale Potenzialdefinitionen

**Projekt → Potenziale und Leitervorgaben…** verwaltet benannte Definitionen mit Anlage, Einbauort, optionaler Aderfarbe, optionalem Querschnitt und ausdrücklich ausgewählten Anschlussankern. Die Definitionen liegen in der Projektdatei unter `potentialDefinitions` und benötigen keinen Serverkatalog.

Ein Anker bezeichnet einen vorhandenen Anschluss. Aus ihm ermittelt der gemeinsame Netzdienst die tatsächlich verbundenen Leiter, einschließlich logischer Verbindungen und aufgelöster Blattübergänge. Gleiche Namen oder mehrere Anker einer Definition verbinden für sich allein keine Netze elektrisch.

1. Definition und Anschlussanker bearbeiten, **Definition prüfen** wählen und die Vorschau übernehmen. Das Speichern allein ändert keine Leiterwerte.
2. Die gespeicherte Definition erneut öffnen und **Leiteränderungen vorschlagen** wählen.
3. **Nur leere Leiterfelder ergänzen** lässt bestehende abweichende Angaben stehen und zeigt sie als übersprungen an. **Vorhandene Leiterwerte ersetzen** zeigt alle Änderungen und erfordert bei Überschreibungen eine Bestätigung.
4. Vorschau prüfen und übernehmen. Nur die vorgegebenen Felder werden in den tatsächlich angebundenen Leitern geändert.

Eine Definition lässt sich löschen, ohne vorhandene Leiterwerte zu löschen. Der Dialog prüft ungültige oder mehrdeutige Anschlussanker, doppelte Namen im gleichen Strukturkontext, konkurrierende Definitionen an einem Netz und Widersprüche zu festen Anschlusspotenzialen. Diese Probleme blockieren eine Übernahme; abweichende Leiterattribute bleiben im normalen Prüflauf sichtbar.

Die Regeln `potential_anchor_invalid`, `potential_definition_collision` und `potential_policy_mismatch` erscheinen im Editor, im Importbericht und in den KI-Prüfabfragen. Der Prüfbericht öffnet die betroffene Potenzialdefinition direkt. Vorgaben und Prüfungen ersetzen keine Strombelastbarkeits-, Schutz- oder Querschnittsberechnung.

## Prüfung mit einem importierten Referenzprojekt

Die unveränderte private Referenz mit 48 Seiten und 4.724 Platzierungen wurde erneut eingelesen. Die Analyse erzeugt 102 Kandidaten zur ausdrücklichen Reserveklärung, vier Vorschläge zur Ergänzung fehlender Reservepositionen und 20 alternative Vorschläge zur Anpassung einer deklarierten Aderzahl. Diese Vorschläge wurden nicht automatisch übernommen. Es ergab sich keine ausreichend eindeutige neue geometrische Leitungszuordnung.

351 Artikelzuordnungen bleiben ohne strukturierte Funktionsspezifikation ungeprüft. Die Werkzeuge machen diese Arbeit bearbeitbar; fehlende Herstellerdaten werden dadurch nicht nachträglich bewiesen. Private Projekt- und Herstellerdateien werden nicht im Repository gespeichert.
