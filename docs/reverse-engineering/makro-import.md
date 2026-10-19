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

Der erste Importausbau (Version 1.2.6) las alle 36 Hilfsgeräte, aber nur 24 der 137 Fensterdateien aus dem gemischten Archiv. Die Folgeuntersuchung erklärt die weiteren Daten anhand ihrer XML-Struktur:

| Datentyp | Nachgewiesener Inhalt und Umsetzung |
| --- | --- |
| `O30/O52/O83`, `O31/O32/O34/O89` | Texte, Linien, Kreise/Bögen, Linienzüge/Polygone und Rechtecke; Koordinaten in Millimetern, Y-Spiegelung und Sprachauflösung |
| `O17/O42/O59/O70/O88/O93/O130/O231/O234/O241` | Bibliotheksreferenzen und Platzierungen; Unterbrechungen, Potenziale und variable Kästen bleiben normale Bibliotheksobjekte |
| `O26/O132/O169/O200` | Gruppen und Konturcontainer; verschachtelte Zuordnung einschließlich Bilder bleibt erhalten |
| `O106` | Nichtdruckende Platzhalterkonfiguration; `S109x1895/R1906` verweist auf das Zielobjekt, `S115x1904` ordnet Feld und Variablentext zu |
| `O5` mit `O144/O191` | Tatsächlich gespeicherte Vektoransichten; Zuordnung über `R9` oder `A65`, Transformation aus `S40x1201` |
| `O3/O190` | Bericht-/Ansichtscontainer und ihre Grafikunterobjekte; keine zusätzliche elektrische Funktion |
| `O97` | Messpunkte, Hilfslinien, Maßlinie, Pfeile und gespeicherter Maßtext |
| `O91/ExternalFile` | Bildbereich und eingebettete hex-kodierte Bilddatei; Zuordnung über normalisierte Pfade |
| `O37/O98/O161/O212/O217/O218/O219` | Nichtdruckende Konfigurations-/Geometriedaten, getrennt erhalten |
| `O174/O176/O180` mit `O161/Stream 62491` | Dreidimensionale Mesh-Körper; das untersuchte Textprofil enthält Vertexlisten, Normalen, Dreiecke und indizierte Flächenrandkurven |
| `O170/R2481` | Bezugssysteme für räumliche Platzierungen; Transformationen entlang der expliziten Elternreferenzen |

Die vorherige Vermutung über fehlende Bilder war unvollständig: Die zugehörigen Bilddateien sind in diesem Archiv als `ExternalFile Coding="Hex"` eingebettet. Alle 57 verwendeten Bilder werden jetzt aufgelöst; es bleiben in diesem Korpus keine fehlenden Bilddateien. Die drei `.fp1`-Dateien haben den XML-Typ `ContourDefinition`; sie sind Konturen und keine Formulare.

Die Standardbibliothek umfasst 250 aus verfügbaren Originalstammdaten dekodierte Identitäten. Die zusätzlichen 24 Definitionen übernehmen tatsächliche Geometrie, Einfügepunkte und Anschlüsse. Es wurden keine Anschlussbilder aus Gerätenamen abgeleitet. Projektstammdaten haben Vorrang. `PID_ESS` fehlt weiterhin in den vorhandenen Stammdaten: Diese 13 Identitäten werden ausdrücklich markiert, ohne elektrische Anschlüsse zu erfinden.

## Verifikation

Die vollständigen privaten Archive wurden ohne heuristische Geräteerzeugung durch Import, externe Ordnerbibliothek, skaliertes Platzieren, Export und Wiederöffnen geprüft. Bei fehlenden Abhängigkeiten ist die ausdrückliche Übernahme markierter Objekte aktiviert.

| Korpus | Dateien geladen | Komponenten bei Inhaltsplatzierung | Interne Verbindungen | Gruppen |
| --- | ---: | ---: | ---: | ---: |
| Hilfsgeräte einschließlich verschachteltem ZIP | 36/36 | 565 | 17 | 51 |
| Gemischte Sammlung | 175/175 | 11.364 | 2.072 | 295 |

Die gemischte Sammlung enthält 137 Fensterdateien, 35 Seitenmakrodateien mit insgesamt 43 Seiten und drei Konturdateien. Ein Fenster enthält ausschließlich 3D-Körper und wird als gekennzeichnete 2D-Kantenprojektion gelesen. **Sieben geladene Dateien benötigen für die vollständige Symbolgrafik 13 fehlende `PID_ESS`-Definitionen.** Erfolgreiches Laden bedeutet bei diesen Dateien keine vollständige elektrische Rekonstruktion.

Komponenten- und Gruppenzahlen beziehen sich auf die standardmäßig gewählte Inhaltsseite je Datei; die gesonderte Seitenprüfung durchläuft alle 43 enthaltenen Seiten. Die Prüfung kontrolliert frische Objektkennungen, gültige Anschluss-/Gruppenreferenzen, Variablenzuordnungen, unveränderte Quelldaten, eingebettete Bilder und portable Makro-Roundtrips. Synthetische Regressionen prüfen zusätzlich leere Seiten, fehlende Bilder und Symboldefinitionen, Koordinaten mit ausgelassenen Nullwerten, gecachte Skalierung/Drehung sowie ungültige Mesh-Indizes und zyklische 3D-Bezüge.

```bash
SCHEMATICO_MACRO_FIXTURE=/pfad/zu/makros.zip npx tsx scripts/test-macro-corpus.ts
```

Die XML-Feldanalyse und Regressionen sind statische Daten- und Anwendungstests. Es fand kein visueller Vergleich gegen eine laufende Quellsystem-Installation statt. REA-Evidenz belegt die Archive, nicht eine solche Laufzeitbeobachtung.

Die Produktions-Web-App wurde zusätzlich in Chromium geprüft: externe Ordner mit 36 bzw. 175 Dateien, Vorschau, Platzierung, mehrzeilige Textbearbeitung, Rückgängig/Wiederholen, Variablenkonfiguration, Quellseitenauswahl, Hinzufügen aller Seiten mit einem Rückgängig-Schritt, Ersetzen eines fehlenden Bildes sowie Platzieren der 14 Objekte aus der gekennzeichneten 3D-Projektion. Dabei traten keine Browserfehler auf. Ein echter Windows-Systemdialog und eine laufende Quellsystem-Installation wurden nicht geprüft.

## Grenzen

- Eine vollständige Symbolgrafik benötigt die passende Definition. Markierte fehlende Symbole sind ausdrücklich keine Ersatzschaltung.
- 3D-Unterstützung bedeutet hier eine XY-Kantenprojektion des geprüften Mesh-Profils; keine räumliche Bearbeitung oder allgemeine BRep-Dekodierung.
- Bemaßungen bleiben Grafik und Text; Änderungen lösen keine parametrische Neuberechnung aus.
- Gespeicherte Berichtsvektoren werden importiert; Berichte werden nicht aus Quelldatenbanken neu berechnet.
- Quellkonfiguration bleibt erhalten, wird aber nicht vollständig durch einen Wertesatz-/Prozessplanungseditor bedient.
- Standardmäßig wird eine Darstellungsvariante gewählt; weitere werden nicht darübergelegt. Unbekannte Objektprofile und Transformationen bleiben explizite Importfehler.

Die Originalarchive, ihre vollständigen Projektmetadaten und zugehörige Bildsammlungen bleiben außerhalb des Repositorys.
