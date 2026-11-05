# Anschluss- und Netzservice

`ElectricalNetService` baut aus dem aktuellen `ProjectIndex` einen projektweiten, statischen Leitergraphen. Er verändert weder das Projekt noch dessen Bibliotheksdaten. Layout und Netzservice verwenden denselben geometrieunabhängigen `PortGraph` und dieselbe Auswertung der internen Anschlussgruppen.

## Was eine Verbindung herstellt

- Gespeicherte Leitungen, einschließlich echter Autoconnect-Leitungen, und explizite projektweite `logicalConnections` verbinden ihre angegebenen Anschlüsse.
- `SymbolDefinition.electrical.permanentConnections` beschreibt dauerhaft leitende Anschlussgruppen. Eine Gruppe verbindet nur die darin aufgeführten Anschluss-IDs. Verschiedene Gruppen bleiben getrennt.
- `conditionalConnections` beschreibt schaltbare oder entfernbare Verbindungen. Der statische Leitergraph schließt diese **nicht**. Das gilt auch für Öffner im gezeichneten Ruhezustand: Eine Schaltzustandssimulation ist eine andere Aufgabe.
- Bekannte, benannte Abbruchstellen setzen das Signal innerhalb derselben Anlage über Seiten und Orte fort. Ein mehrpoliges Abbruchstellensymbol wird nur dann über seinen Namen verbunden, wenn seine Anschlüsse ausdrücklich einen gemeinsamen Leiter bilden. Kontakte/Spulen mit gleichem BMK bilden keine solche Signalverbindung.

Koordinaten, Leitungskreuzungen, Texte und gleiche `wire.potential`-Namen erzeugen keine zusätzlichen Verbindungen. Zwei unverbundene Leiter mit dem Namen `N` behalten unterschiedliche Identitäten. Eine Kreuzung ohne Verbindungspunkt hat zwei getrennte Durchgänge; die Kreuzung mit Verbindungspunkt verbindet alle vier Anschlüsse.

Es werden keine ungespeicherten Autoconnect-Leitungen aus der Geometrie hinzugedacht. Die tatsächliche Erkennung und Materialisierung bleibt Aufgabe des Editors beziehungsweise der geprüften Layoutkonstruktion.

## Bibliotheksdaten

Die Standardbibliothek enthält ausdrückliche Gruppen für Verbindungselemente, Durchgangs-/PE-Klemmen, getrennte Etagen, Phasenschienen und Potenzialverteiler. Beispielsweise hat der dreiphasige Kupferverteiler jeweils eine Gruppe für L1, L2 und L3. Trenn- und Sicherungsklemmen sowie der Neutralleiter-Trennschieber werden als bedingte Verbindungen behandelt. Schützspulen und Verbraucher werden nicht als permanente Drahtbrücken interpretiert.

`PinDefinition.electricalRole` kann `power`, `neutral`, `protective_earth`, `signal` oder `unknown` sein. Gedruckte oder benutzerdefinierte Anschlussbezeichnungen verändern diese Rolle nicht. Ein Beispiel für eine Bibliotheksdefinition ist:

```json
{
  "electrical": {
    "permanentConnections": [["L1-IN", "L1.1", "L1.2"], ["L2-IN", "L2.1"]],
    "conditionalConnections": [["13", "14"]]
  }
}
```

Die referenzierten Anschlüsse müssen im Symbol definiert sein. Ungültige Gruppen werden als Ganzes verworfen und gemeldet; die gültigen Teilstücke werden nicht stillschweigend verbunden.

Bestehende JSON-Dateien benötigen keine Migration. Ältere Standardsymbole mit bekanntem Bibliotheks-ID und passendem Anschlussbestand erhalten eine abgeleitete Kompatibilitätsdefinition. Bekannte Routingprimitive der Importbibliothek bleiben unterstützt. Unbekannte Importe werden nicht anhand ihres Aussehens, ihrer Kategorie oder ihrer Beschriftung intern verbunden. `knowledge` kennzeichnet die Herkunft als `explicit`, `legacy` oder `unknown`. Fehlende Anschlussrollen bleiben `unknown`.

## Identität und Layoutprüfung

Ein Anschluss wird durch Komponenten-ID und Anschluss-ID identifiziert. Netzkennungen werden deterministisch an einem vorhandenen Betriebsmittelanschluss verankert; reine Routinghilfen werden nach Möglichkeit nicht als Anker verwendet. Koordinaten, Winkel, Wegpunkte, BMK und die Reihenfolge der Zeichnungsobjekte sind kein Bestandteil der Kennung. Das Verschieben zwischen Seiten mit entsprechend erhaltenen logischen Verbindungen ändert die Anschlussidentität ebenfalls nicht.

Die Kennungen sind abgeleitete Leiteridentitäten, **keine dauerhaft gespeicherten Potenzial-/Signal-UUIDs**. Bei einer fachlichen Zusammenführung oder Aufteilung eines Netzes beziehungsweise beim Ersetzen seines Ankeranschlusses kann sich seine Kennung ändern. Eine Funktions-/Geräteidentität unabhängig von der Platzierung bleibt ein späterer Ausbauschritt.

Vor der Layoutübernahme wird die Erreichbarkeit und Trennung aller ursprünglichen Anschlüsse projektweit verglichen. Zusätzliche Verbindungselemente und neue Blätter sind erlaubt; unbeabsichtigte Zusammenführungen und Unterbrechungen werden zurückgewiesen. Diese Prüfung bezieht sich auf die bekannten gespeicherten Daten. Sie bestätigt keine unbekannten internen Verbindungen eines Imports.

## Berichte, Meldungen und MCP

Der Klemmenbericht verfolgt jede Seite einer Klemme separat durch Verbindungselemente und Blattübergänge bis zum nächsten Betriebsmittel. Er überschreitet dabei nicht die eigene interne Klemmenbrücke, um Innen- und Außenziele zu vermischen. Die genaue Ebenen-/Seitennummerierung und konfigurierte Klemmenbrücken benötigen weiterhin das künftige Klemmenmodell.

Der Plausibilitätsdialog meldet fehlende/mehrdeutige Verbindungsenden und ungültige Anschlussgruppen. Ein tatsächlich leitender Zusammenhang von Anschlüssen mit den Rollen N und PE erzeugt einen Prüfhinweis, keine pauschale Aussage über die Zulässigkeit einer PEN-Aufteilung. Unbekannte Rollen werden nicht aus frei bearbeitbaren Texten erraten.

`get_electrical_nets({pageId, offset: 0, limit: 25})` liefert Leitergruppen, Anschlussrollen, Leitungs-IDs, Potenzial-/Verweisnamen, unbekannte Komponenten und dieselben Projektmeldungen wie die Oberfläche. Der optionale Seitenfilter begrenzt die ausgewählten Netze; ihre Mitglieder auf anderen Seiten bleiben enthalten. `offset` gilt für Netz- und Meldungsliste, `limit` für beide Listen (1–100). Je Netz werden maximal 500 Anschlüsse ausgegeben; `portCount` zeigt den vollständigen Umfang. Die Liste unbekannter Komponenten ist auf 500 begrenzt, ihr Gesamtzähler bleibt vollständig.

`knowledgeIncomplete` bezeichnet fehlende oder ungültige interne Topologiedaten. Die Anschlussrollen stehen separat zur Verfügung und können auch bei bekannter Topologie unbekannt sein. Der Dienst ist keine elektrische Simulation, Last-/Kurzschlussberechnung oder vollständige Normenprüfung.
