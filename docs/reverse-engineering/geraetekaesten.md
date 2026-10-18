# Gerätekästen: Quellenbefund und Umsetzung

Die Untersuchung verwendet das REA-Vorgehen: Artefaktidentität prüfen, vorhandene Evidenz wiederverwenden, spezifische Strukturfragen an Originaldatensätzen beantworten und die Rekonstruktion mit Browser- und Exportprüfungen absichern.

## Wiederverwendete Evidenz

- REA-Artefaktevidenz `ev_de4dc0fb509a8c5e9b4e0f8cea75543cdb07faa07664ed13c6242903550e644b`, Operation `inspect_artifact`.
- SHA-256 des aus beiden Teilen zusammengesetzten Archivs: `6fdf42f60f4728528b87ebfed9fef7b610122d8563f6801a1a0d6e46cd81d028`. Erneut berechnet; identisch mit der gespeicherten Evidenz.
- Direkte Datenprüfung: indizierte aktive Function-/Instance-Datensätze, mitgelieferte Symbolidentitäten und variable Rechteckkonturen; keine BMK-, Namens- oder Seitenheuristik.

## Beobachtungen

119 pinlose Funktionsplatzierungen vom Typ 17 verwenden `SPECIAL:0`. Ihre variablen Rechteckgrenzen stehen in EB1E/EB1F und in einem eingebetteten Grafikobjekt des Typs 0x59. Die physikalischen Anschlüsse sind eigenständige Funktionen; dem Rahmen werden keine zusätzlichen Anschlüsse erfunden.

Die Symbolidentität `SPECIAL:1` in den vorhandenen XML-Makroreferenzen ist ebenfalls ein variabler Gerätekasten. `SPECIAL:2` / Typ 88 bezeichnet im Beispiel einen separaten Strukturkasten und wird nicht als Gerätekasten migriert.

| Beispiel | Objekt-ID | Quellgrenzen in mm, Y nach oben |
|---|---:|---|
| Wohnzimmer 1, M4 | 37010 | (204,140) bis (236,164) |
| Wohnzimmer 1, M3 | 37016 | (204,68) bis (236,92) |
| Server, U61 | 40440 | (164,136) bis (400,152) |
| Server, U66 | 40478 | (124,136) bis (148,152) |

Für diese Fälle liefert Layer 305 eine Konturbreite von 0,25 mm. Der früher dokumentierte direkte PDF-Befund für M4 weist durchgezogene Seiten nach. Die optionalen Felder EBFC und F0D7 sind kein hinreichender Beleg für eine gestrichelte Linie. Ihre allgemeine Semantik bleibt offen; daraus wird kein Strichmuster erfunden.

BMK und ergänzende Texte besitzen getrennte gespeicherte Anker. Bei M4 liegt die BMK-Baseline an der oberen Kante; der Funktionstext steht links außerhalb. U66 enthält Funktionstext „X-Sense“ und Zusatztext „Hub“ mit getrennten Positionen. Diese expliziten Layouts bleiben erhalten. Die automatische Anordnung links ist der Standard für neue Elemente, kein erzwungenes Überschreiben der Quelldaten.

## Umsetzung und Prüfungen

Gerätekästen bleiben reguläre Komponenten mit Bibliotheksreferenz und variablen Platzierungsmaßen. Editor, allgemeines Eigenschaftenfenster, Beschriftungsberechnung, Mehrfachauswahl und PDF verwenden denselben Komponentenpfad. Unveränderte Quellgeometrie verweist weiterhin direkt auf die gemeinsame Definition; Änderungen erzeugen eine abgeleitete Darstellung der einzelnen Platzierung. Größenänderungen erhalten benutzerdefinierte Anker relativ zur festen Rahmenecke.

`NativeDeviceBoxes.test.ts` prüft Anzahl und alle 119 Grenzen gegen die Originaldatensätze, exemplarische Beschriftungsanker, unabhängige Größenänderungen sowie unveränderte Verdrahtung. `DeviceBoxElement.test.ts` deckt Migration, gemeinsame Eigenschaften, alle vier Drehungen, Makros, Verlauf, Klickverhalten und PDF ab. Browserprüfungen öffnen beide Archivteile und zuvor gespeicherte Projekte, bearbeiten Rahmen über die normalen Eigenschaften und exportieren die Serverseite.

Der ursprüngliche PDF-Upload ist im aktuellen Arbeitsverzeichnis nicht mehr verfügbar. Die aktuelle Prüfung bestätigt Originaldatensätze und rekonstruierte Anwendung; der frühere PDF-Befund wird als gespeicherte Referenz verwendet. Eine erneute vollständige visuelle Überlagerung mit dem Original-PDF wird damit nicht behauptet.
