# Gemeinsamer Projektindex

`ProjectIndex` bildet einen abgeleiteten, rein lesenden Blick auf das aktuelle Projekt. Er wird pro Vorgang neu aufgebaut. Eine Bearbeitung benötigt damit weder eine Cache-Invalidierung noch eine Migration bestehender JSON-Dateien. Der Index selbst wird nicht gespeichert.

Er enthält Seiten und Platzierungen, die zugehörigen Bibliothekssymbole und Anschlüsse, vorhandene lokale und logische Verbindungen sowie Struktur-, BMK- und Artikelzuordnungen. Anschlussbezeichnungen berücksichtigen die am Element eingestellten Texte. Mehrdeutige Komponenten-IDs werden bei der Verbindungsauflösung nicht willkürlich ausgewählt.

## Kennzeichnung und Zuordnung

- Für Betriebsmittel gilt der Schlüssel aus Anlage, Ort und getrimmtem BMK. Elementangaben überschreiben Seitenangaben; ein ausdrücklich leerer Elementwert bleibt leer. Optionale führende Strukturzeichen `=` und `+` werden vereinheitlicht. Groß-/Kleinschreibung bleibt erhalten.
- Leere BMK erhalten keinen Betriebsmittelschlüssel. Bei bekannten normalen Symbolen werden sie gezielt als fehlende Kennzeichnung gemeldet.
- Spulen und Kontakte werden nur innerhalb desselben Strukturkontexts zugeordnet. Mehrere Hauptfunktionen erzeugen eine Mehrdeutigkeitsmeldung; die Engine wählt keine beliebige Spule aus.
- Abbruchstellen werden nach Anlage und Signalbezeichnung zugeordnet und können unterschiedliche Orte verbinden. Ihre bisherige Ersatzbezeichnung aus dem Funktionstext bleibt unterstützt.
- Wiederholte importierte Darstellungen werden konservativ behandelt. Aus einem gemeinsamen BMK folgt noch kein Nachweis einer physischen Geräteidentität.
- Artikelzuordnungen beruhen auf tatsächlich eingetragenem Hersteller und Artikelnummer. Sie liefern keine automatische Mengenbereinigung für mehrfach dargestellte Geräte.

Der Plausibilitätsdialog und das MCP-Werkzeug `get_project_index` verwenden dieselbe Prüffunktion. Sie melden unter anderem doppelte Seiten-/Komponenten-IDs, fehlende BMK und mehrdeutige Funktionszuordnungen. Verbindungssymbole und Strukturgrafiken werden nicht pauschal als unbenannte, unverdrahtete Geräte behandelt.

## Klemmenbericht

Gleich benannte Leisten in unterschiedlichen Strukturkontexten bleiben getrennt und werden bei Bedarf mit Anlage/Ort bezeichnet. Ein explizites BMK `-X1:7` liefert Leiste `-X1` und Nummer `7`. Für ältere Daten bleiben die bisherigen Ersatznummern aus Funktionstext oder Reihenfolge erhalten; `numberSource` kennzeichnet ihre Herkunft.

Direkte lokale und logische Verbindungsziele verwenden denselben Anschlussindex. Mehrere Ziele werden aufgelistet. Ziele in einem anderen Strukturkontext erhalten Anlage/Ort zur Unterscheidung. Der Bericht verfolgt noch keine vollständigen Netze durch T-Stücke oder interne Geräteverbindungen; die bisherige Innen-/Außenzuordnung über Anschluss `1` bleibt bestehen.

## MCP-Abfrage

`get_project_index({offset: 0, limit: 100})` liefert Zähler, Identitätsbefunde, Kennzeichnungsgruppen und Plausibilitätsmeldungen. `offset` gilt für beide Ergebnislisten; `limit` liegt zwischen 1 und 500. `total` ermöglicht das seitenweise Nachladen. Identitätsbefunde bleiben vollständig enthalten. Der Aufruf verändert das Projekt nicht.

`physicalDeviceCountKnown: false` macht ausdrücklich kenntlich, dass Kennzeichnungsgruppen keine geprüfte Geräteanzahl darstellen. Ein vollständiger Netzservice, stabile fachliche Geräte-/Funktions-IDs, unplatzierte Geräte und ein Klemmenleistenkonfigurator sind weitere Ausbauschritte.
