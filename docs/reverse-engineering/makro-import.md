# XML-Makros: Grafik- und Bibliotheksimport

Stand: 19.10.2026. Die beiden bereitgestellten Makroarchive wurden als Daten untersucht. Mitgelieferte Dokumente wurden weder ausgeführt noch als Arbeitsanweisungen verwendet. Vollständige Originalarchive bleiben außerhalb des Repositorys.

## REA-Evidenz

Beide Inventare wurden mit `rea-agents@6.5.0 inspect-artifact … --format json` erstellt, Provider `rea-artifact-graph`, Version 1.

| Korpus | SHA-256 | Evidence |
| --- | --- | --- |
| Hilfsgeräte | `398c3e400cf0693cacb00241c3a5d3a485dbf6546dadc40d8f4407da63b530aa` | `ev_24a87c46963e2297f744c7c9db2956bfe54ed04e3a35887f79d4a4edeeeec19f` |
| Gemischte Makros und Vorlagen | `55081ec0fd4ed37be9663e8168014c8c1e7d01eae3e8a0fa569487ef1d5b131b` | `ev_1a2567228ae75cff0d83655342b8b79287aa647b42b3f233c88934e64e871a82` |

REA belegt Container und Inventar. Die XML-Feldbedeutungen wurden durch eigene Feldproben und den Abgleich mit dem vorhandenen Datenbankleser untersucht. Es wurde keine Quellsystem-Installation ausgeführt.

## Fehler und Korrektur

Im ersten Korpus ließen sich vor der Änderung nur 9 von 36 Makros streng importieren. Die übrigen 27 scheiterten an unbekannten Grafikobjekten oder fehlenden Bibliotheksdefinitionen.

| Datentyp | Inhalt | Übernahme |
| --- | --- | --- |
| `O31`, `O89` | Linie, Rechteck | Bestehender Grafikimport |
| `O32` | Kreis oder Kreisbogen | Mittelpunkt `A555`, Radiusvektor `A556`, Parameter `A553`/`A554` in Radiant; Y-Spiegelung einschließlich Bogenrichtung |
| `O30`, `O83` | Text, Pfadfunktionstext | Position `A501`, Inhalt `A511`, Schriftgröße `S54x505/A961`; eine Übersetzung statt verketteter Sprachfassungen |
| `O34` | Linienzug/Polygon | Punkte `A621`, gefüllte Polygone mit `A623=1`; offene Linienzüge bleiben offen |
| `O17`, `O42` | Funktion, Verbindungselement | Bibliotheksauflösung nach Bibliothek, Symbolnummer und Variante |
| `O59`, `O88`, `O93` | Verbindungsannotation, Strukturkasten, Potenzialdefinition | Explizite Bibliotheksreferenz und Platzierung; variable Kastenabmessungen und Potenzialbeschriftung |
| `O26`, `O37` | Gruppe, Makrodefinition | Gruppen bleiben bearbeitbar; der Definitionsrahmen ist Metadatum |

Neuere 2D-Dateien speichern Punkte als `x/y/0`. Diese Form wird ebenso wie `x/y` gelesen. Ein tatsächlich räumlicher Punkt mit Z ungleich null wird ausdrücklich abgelehnt und nicht stillschweigend auf die Ebene projiziert.

Die geprüften Standarddefinitionen wurden über den vorhandenen Leser aus bereits verfügbaren eingebetteten Bibliotheksstammdaten gewonnen. Die Sammlung umfasst nun 226 Identitäten. Maßstab, Einfügepunkt, Anschlusspositionen und Anschlussrichtungen stammen aus diesen Definitionen. Passende Projektstammdaten haben Vorrang. Fehlende Identitäten bleiben ein Fehler; es werden keine geratenen Ersatzgeräte angelegt.

Normale Texte werden als bearbeitbare Komponentenbeschriftungen übernommen. Grafikobjekte bleiben über eigene Bibliotheksdefinitionen referenziert und erhalten keine erfundenen elektrischen Anschlüsse. Die Vorschau zeichnet alle Komponenten statt nur der ersten acht und erhält mehrzeilige Beschriftungen.

## Ergebnisse und Grenzen

- **Hilfsgeräte:** 35 direkte Makros und ein Makro in einem verschachtelten ZIP. Alle 36 bestehen strengen Import, externe Bibliothek, skaliertes Platzieren und Export/Wiederöffnen: 565 Komponenten, 17 interne Verbindungen und 51 übernommene Gruppen.
- **Gemischte Sammlung:** 137 Fenster-/Symbolmakros, 35 native Seitenmakros und 3 Formulardateien. Vor der Änderung konnte keines der 172 Makros vollständig eingelesen werden; nach der Erweiterung bestehen 24 Fenster-/Symbolmakros den Import. Die 35 Seitenmakros werden noch nicht unterstützt; die Formulardateien sind keine `.ema`-/`.ems`-Makros.
- **Verbleibende erste Importfehler der gemischten Sammlung:** 58 Makros mit `O106`, 19 mit `O91`, 13 mit `O70`, 9 mit `O212`, 6 mit `O5`, 7 mit fehlenden `PID_ESS`-Definitionen sowie ein Makro mit mehreren Zeichenbereichen. Hinzu kommen die 35 Seitenmakros. Diese Zahlen nennen jeweils den ersten Fehler je Datei, nicht sämtliche darin enthaltenen Hindernisse.
- `O91` verweist in dieser Sammlung unter anderem auf Bilddateien außerhalb des Archivs. Diese Bilder lassen sich aus dem ZIP allein nicht wiederherstellen. `PID_ESS` ist in den vorhandenen Stammdaten nicht enthalten. Platzhalter-, Prozessplanungs- und Seitenmakroobjekte benötigen zusätzliche Decoder; die bloße Ergänzung der Symbolbibliothek reicht dafür nicht.

Die Regressionen verwenden auf Zeichen- und Platzierungsdaten reduzierte Beispiele. Sie prüfen Kreise/Bögen, gefüllte Polygone, mehrzeilige und übersetzte Texte, vollständige Vorschauen, Anschlusskästen, Ordnerimport, Maßstabswechsel und Speichern/Wiederöffnen. Unbekannte Objekttypen, ungültige Koordinaten und fehlende Bibliothekssymbole werden weiterhin gemeldet.

Der vollständige private Hilfsgeräte-Korpus kann zusätzlich geprüft werden:

```bash
SCHEMATICO_MACRO_FIXTURE=/pfad/zu/Auxiliary.zip npx tsx scripts/test-macro-corpus.ts
```

Es wird die bisherige Standarddarstellung gewählt; andere Darstellungen werden nicht darübergelegt. Erfolgreiche Korpustests sind keine Zusage für beliebige andere XML-Objekte, Bibliotheksversionen oder Binärformate.
