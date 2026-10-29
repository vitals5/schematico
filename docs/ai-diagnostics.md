# Fehlerberichte des KI-Assistenten

Bei einer fehlgeschlagenen Aktion erscheint direkt beim roten Aktionssymbol ein Bereich mit:

- **Fehlerdetails anzeigen**: Fehlermeldung, Aktion, Fehlerphase, Version und Modell. Bei Layoutfehlern zeigt der Kurzbericht die ersten zwölf Befunde.
- **Kurzbericht kopieren**: den sichtbaren Fehlertext in die Zwischenablage übernehmen.
- **Fehlerbericht herunterladen**: vollständigen JSON-Bericht lokal speichern. Diese Datei kann zur Untersuchung des Fehlers weitergegeben werden.

Das funktioniert auch für fehlgeschlagene `create_schematic_draft`-Aufrufe ohne Layoutvorschau sowie für ungültige Werkzeugargumente des Modells und Kommunikationsfehler. Jeder Fehlversuch erhält eine eigene ID. Spätere Versuche überschreiben den vorherigen Bericht nicht. Die letzten zwölf Berichte bleiben im Arbeitsspeicher dieser Sitzung verfügbar. Chatverlauf leeren beziehungsweise die Anwendung neu laden entfernt sie; vorher benötigte Berichte herunterladen.

## Inhalt

Das Format `schematico-ai-diagnostic`, Version 1, enthält:

- App-Version, Zeitpunkt, Anbieter, tatsächlich verwendetes Modell, Aktion und Fehlerphase;
- Fehlermeldung und vorhandenen Stacktrace;
- die Argumente des fehlgeschlagenen Aufrufs, bei ungültigem JSON auch den ursprünglichen Argumenttext;
- Werkzeugergebnis einschließlich vollständiger Layoutbefunde;
- den verfügbaren Projektstand mit Symbolbibliothek zur Nachstellung;
- bei Assistentenaufrufen den Benutzerauftrag und die letzten bis zu zehn Werkzeugschritte.

Die Phasen unterscheiden unter anderem `tool_arguments`, `draft_validation`, `layout_computation`, `layout_validation`, `preview_presentation` und `provider_request`. Fehlschläge vor der Entwurfserstellung lassen sich damit von Layoutfehlern unterscheiden.

## Lokale Daten

Berichte werden nicht automatisch hochgeladen und der Projekt-Snapshot des Berichts wird nicht an das KI-Modell zurückgegeben. Die normalen Werkzeugmeldungen an die KI bleiben kurz. Der Export entfernt die aktuell konfigurierten API-Schlüssel, Zugangsdatenfelder und erkennbare Tokenmuster. Projektinhalte, Kundendaten und der Benutzerauftrag bleiben zur Nachstellung enthalten; die Datei vor dem Teilen prüfen.

Das Erstellen und Exportieren eines Berichts verändert das Projekt nicht. Ein Bericht wird als Daten gelesen und nicht als Anweisung ausgeführt. Die vorhandene Funktion **Entwurf exportieren** in der Layoutvorschau bleibt zusätzlich verfügbar.

## Unvollständige OpenRouter-Werkzeugargumente

Bei ungültigem oder abgeschnittenem JSON wird kein Aufruf aus dem betroffenen Antwortblock ausgeführt. Der Assistent bittet das Modell einmal, den vollständigen Block mit gültigen Werkzeugargumenten erneut zu erzeugen. Er hängt keine fehlenden Klammern automatisch an und ergänzt keine fehlenden Geräte oder Verbindungen selbst. Eine bloße Erfolgsmeldung ohne korrigierten Werkzeugaufruf gilt nicht als erfolgreiche Korrektur. Abbrechen beendet auch den Korrekturversuch.

Meldet der Anbieter das Antwortende `length`, wird der Block selbst bei syntaktisch vollständigem JSON verworfen: Es könnten weitere Aufrufe fehlen. Scheitert die Korrektur, enthält der JSON-Bericht unter `error.argumentAttempts` beide Argumenttexte, die Parsefehler sowie die vom Anbieter gelieferten Felder `finishReason` und `nativeFinishReason`. Fehlende Anbieterangaben bleiben fehlend; ein unerwartetes JSON-Ende allein beweist kein Tokenlimit. Diese zusätzlichen Daten unterliegen derselben Bereinigung von Zugangsdaten wie der übrige Bericht. Der Kurzbericht zeigt die gemeldeten Antwortenden und die Anzahl der automatischen Korrekturversuche.
