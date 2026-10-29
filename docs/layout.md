# Automatische Schaltplan-Anordnung

Die KI beschreibt Bibliothekselemente, Anschlüsse und Funktionsgruppen. Die Anwendung berechnet die Geometrie: Die KI muss keine vollständigen Schaltungen durch einzelne Koordinatenaufrufe zeichnen.

## Vorschau und Übernahme

Die Layout-Schaltfläche im KI-Fenster und die Werkzeuge `optimize_schematic_layout` und `distribute_sheet_layout` öffnen eine Vorschau. **Vorher zeigen** wechselt zur Ausgangszeichnung. Die Varianten bevorzugen Lesbarkeit, Kompaktheit oder geringe Veränderung. Die Tabelle zeigt Kollisionen, Blattüberschreitungen, Leitungskreuzungen, Knicke und Leitungslängen in Millimetern.

Objekte oder Gruppen lassen sich in der Vorschau fixieren. **Nur aktuelle Auswahl** begrenzt die Bearbeitung auf die Auswahl; zusammengehörige Gruppen werden gemeinsam behandelt. Bilder und freie Texte bleiben außerhalb bewegter Gruppen fest. Importierte grafische Gruppen behalten ihre inneren Abstände und Formen; sie werden als Einheit verschoben. Nach einer Änderung der Fixierungen **Neu berechnen** wählen.

**Übernehmen** ist eine Benutzeraktion und erzeugt einen rückgängig machbaren Schritt. Abbrechen verändert das Projekt nicht. Wurde das Projekt zwischenzeitlich bearbeitet, ist die Vorschau veraltet und muss neu berechnet werden.

Die Prüfung berücksichtigt Symbolkörper, sichtbare Texte, gedrehte Anschlüsse, Gruppen, Hindernisse und den tatsächlichen Zeichenbereich oberhalb des Schriftfeldes. Symbole und Schriftgrößen werden nicht verkleinert. Anschlussgraph und elektrische Eigenschaften bleiben erhalten. Automatische Verbindungen werden bei Übernahme explizite Leitungen, damit eine spätere geometrische Autoconnect-Neuberechnung sie nicht entfernt.

Automatisch berechnete Querverweise werden bereits vor der Platzierung und Leitungsführung vermessen. Importierte Geräteunterteile ohne gesicherte Haupt-/Nebenfunktionszuordnung werden bei einer zusätzlichen generischen Darstellung nicht als separate Verweisziele interpretiert; vorhandene Quellverweise bleiben erhalten.

## Automatischer Mehrseitenvorschlag

Scheitert die Anordnung auf einem Blatt, berechnet die Vorschau automatisch Aufteilungen auf bis zu zwölf Blätter. Funktionale und native Gruppen werden nicht auseinandergerissen. Die Aufteilung berücksichtigt vorhandene Verbindungen, um Blattwechsel zu vermeiden. Jede Variante wird pro Blatt platziert, geroutet und geprüft; eine reine Flächenschätzung genügt nicht.

Bei koordinatenfreien Entwürfen werden aus überlappenden Nullpositionen keine Kastenzugehörigkeiten abgeleitet. Ohne ausdrückliche Inhaltszuordnung bleiben die Bibliotheksrahmen in ihrer ursprünglichen Größe innerhalb ihrer Gruppen erhalten.

Für jede über die Blattgrenze führende Leitung entsteht ein eindeutiges Abbruchstellenpaar mit gegenseitigem Querverweis. Potential und ursprüngliche Anschlusszuordnung bleiben als logische Verbindung erhalten. Die Vorschau zeigt die Blattanzahl, Verweispaare und eine Blattauswahl. Erst **Übernehmen** legt alle Blätter gemeinsam an; **Rückgängig** nimmt die gesamte Aufteilung zurück.

Die automatische Aufteilung gilt für vollständige Stromlaufplanseiten aus Bauteilen, Leitungen und Gruppen. Bei fixierten Objekten, Teilauswahl oder zusätzlichen freien Grafiken, Texten, Kästen und Kabeldefinitionen bleibt die bisherige Einblattprüfung aktiv. Eine Gruppe, die allein nicht passt oder nicht korrekt geroutet werden kann, wird nicht stillschweigend zerlegt. Auch dann bleibt das Projekt unverändert.

## Fehlgeschlagene Vorschläge

Wenn eine Gruppe nicht platziert werden kann, endet die Platzierungsprüfung an dieser Stelle. Nicht platzierte Entwurfsobjekte werden nicht anschließend als vermeintliche Routing- oder Kollisionsfehler ausgewertet. Die Vorschau zeigt bei einem fehlgeschlagenen Entwurf den unveränderten Blattbestand. **Entwurf exportieren** speichert das vollständige Projekt einschließlich des noch nicht übernommenen Entwurfs, der Layoutoptionen und der Meldungen lokal als JSON für eine reproduzierbare Diagnose.

Die Layout-Engine berechnet Funktionsgruppen getrennt, verwendet für unverbundene Abbruchstellen eine kompakte Anordnung und probiert für serielle Pfade eine Rang-Anordnung. Die Blattpackung nutzt freie Rechtecke und berücksichtigt fixierte Hindernisse. Ein Platzierungsfehler beschreibt eine gescheiterte Variante, keinen mathematischen Beweis, dass die Schaltung grundsätzlich nicht passt.

## KI- und MCP-Werkzeuge

- `duplicate_schematic_page`: exakte zusätzliche Darstellung einer bestehenden Stromlaufplanseite mit neuen Objekt-IDs. Bibliothekssymbole, Anschlüsse, BMK, Beschriftungen, Gruppen, Kabel und Positionen bleiben erhalten. Bestehende Layoutbefunde werden dabei nicht repariert; eine erneute Anordnung ist ein gesonderter Schritt. Dieses Werkzeug ist für „diese Schaltung auf einer neuen Seite nachbauen“ vorgesehen.
- `validate_schematic_layout`: unabhängiger Prüfbericht mit Fehlerarten, Objekt-IDs, Bereichen und Kennzahlen. Keine Änderung der Zeichnung.
- `optimize_schematic_layout`: Kandidaten für `pageId`, optional `lockedIds`, `selectedIds` und explizite Kastenzuordnungen `containers: [{id, members}]`. Eine erfolgreiche Antwort bedeutet eine geprüfte **Vorschau**, keine Übernahme. Nach Zeichenaktionen prüft der Assistent das Layout unabhängig von seiner Modellantwort. Bei Fehlern wird eine optimistische Abschlussmeldung durch den Prüfbericht ersetzt.
- `create_schematic_draft`: vollständiger Entwurf mit `components`, `connections` und optional `groups`. Komponenten enthalten lokale eindeutige IDs und reale `symbolId`-Werte. Verbindungen enthalten `from`/`to` mit `componentId` und `pinId` sowie `potential`. Gruppen verwenden `id`, optional `name` und `members`. Koordinaten sind nicht nötig. Der Entwurf bleibt bis zur Bestätigung außerhalb des Projekts.
- `distribute_sheet_layout`: kompatibler Name für die Vorschau. Frühere feste Spaltenkoordinaten und das sofortige Verschieben werden nicht mehr verwendet.

Bestehende Einzelwerkzeuge behalten Projekt-Zeichnungseinheiten als Koordinatenformat. `get_canvas_state.geometry.unitsPerMm` und `usableAreaMm` geben die Umrechnung und den verfügbaren Bereich an. Symbolbreiten in Zeichnungseinheiten dürfen nicht als Millimeter interpretiert werden.

## Grenzen

Die Optimierung gilt für Stromlaufplanseiten, nicht für Grundrisse, Berichtseiten oder flache Altzeichnungen ohne bearbeitbare Objekte. Bibliothekssymbole müssen vorhanden sein. Individuell skalierte Symbole mit nicht eindeutig skalierter Anschlussgeometrie werden ausdrücklich abgewiesen. Mehrdeutige Kastenzuordnungen, beschädigte Gruppen und fehlende Anschlüsse werden gemeldet.

Es wird kein mathematisch globales Optimum zugesagt. Pro Berechnungslauf im Hintergrund gilt ein Zeitbudget von 15 Sekunden. Fertig geprüfte Varianten werden laufend zwischengespeichert und bleiben erhalten, wenn eine spätere Variante das Zeitbudget überschreitet. Ohne fertige Variante wird der Lauf als erfolglos gemeldet und die reguläre Mehrblatt-Aufteilung kann fortfahren; ein Timeout allein bricht nicht mehr den gesamten Vorschlag ab. Die tatsächliche Gesamtdauer kann bei mehreren Blattaufteilungen höher sein. Bei nicht erfüllbaren Bedingungen bleibt das Projekt unverändert; der Bericht schlägt eine Aufteilung anhand vorhandener Gruppen vor, einschließlich geschätzter Blattzuordnungen und der dafür benötigten blattübergreifenden Anschlussverweise. Jede vorgeschlagene Seite muss vor einer Umsetzung separat geprüft werden. Neue Blätter und blattübergreifende Verbindungen werden nicht automatisch erzeugt.

Die Browserprüfung misst Texte mit den verfügbaren Schriften. Kommandozeilenprüfungen ohne DOM verwenden konservative Schätzwerte und kennzeichnen das im Bericht. Schriftverfügbarkeit kann die berechnete Geometrie zwischen Betriebssystemen beeinflussen. Der Validator prüft geometrische und strukturelle Eigenschaften, ersetzt aber keine elektrotechnische Fachprüfung.

ELK dient der Graphanordnung; ein eigener orthogonaler Router berücksichtigt Hindernisse und Anschlussrichtungen. Der Layout-Worker und die Bibliothek werden bei Bedarf geladen. Lizenz und Quellbezug: [elkjs](../public/licenses/elkjs.txt).

## Strompfad-Variante

Die zusätzliche Variante **Strompfade** ordnet Bauteile anhand ihrer elektrischen Nachbarn statt ausschließlich nach Objekt-ID und richtet verbundene Anschlüsse über mehrere Reihen auf gemeinsamen Achsen aus. Bestehende kompakte Varianten bleiben erhalten. Bei mehreren gültigen Varianten können sie in der Vorschau verglichen werden; Kreuzungen, Knicke und Leitungslänge bleiben messbar. Eine gültige Kollisionsprüfung allein bedeutet weiterhin keine optimale Lesbarkeit.


## Geordnete Strompfade

Die zusätzliche Variante **Geordnete Strompfade** richtet Geräte auf gemeinsamen Symbolkörper-Ebenen aus. Dabei bleibt Platz für vorhandene Beschriftungen. Verbundene Anschlussachsen werden in beiden Richtungen ausgeglichen; mehrpolige Anschlussreihen folgen den tatsächlichen Anschlusspositionen statt der alphabetischen Objekt-ID. Seitliche Abbruchstellen erhalten eigene Übergabespalten, sofern diese innerhalb des Blattes unterzubringen sind. Bei beidseitig anschließbaren Abbruchstellen entscheidet der tatsächlich verwendete Anschluss.

Für gleich aufgebaute mehrpolige Verbindungen versucht der Router, einen bereits gefundenen Leitungsverlauf parallel zu übertragen. Jede Ader durchläuft weiterhin die Hindernis- und Netzprüfung. Ein Leitungsbündel erzeugt keine elektrische Verbindung zwischen seinen Adern. Bei Seiten mit höchstens 80 Layoutobjekten und 120 Leitungen werden drei feste Routing-Reihenfolgen verglichen. Größere Seiten verwenden eine Reihenfolge pro Platzierungsvariante, um den Aufwand zu begrenzen.

Neben Kreuzungen, Knicken und Leitungslängen bewertet die Auswahl nun auch versetzte Anschlussachsen und ungleichmäßige Achsversätze paralleler Verbindungen. Die bisherigen Varianten bleiben als Alternativen erhalten. Eine neue Stilvariante wird nicht allein wegen ihres Namens bevorzugt. Die Regeln leiten keine Stromflussrichtung oder elektrotechnische Funktion aus räumlichen Anschlussrichtungen ab. Bestehende Blattreihenfolgen und elektrische Verbindungen werden dadurch nicht umgedeutet.

## Darstellungsregeln aus Schaltungsbeispielen

Als zusätzliche Referenz wurde das [Eaton-Schaltungsbuch 2023, PU08703001Z-DE](https://www.eaton.com/content/dam/eaton/markets/machinebuilding/eaton-wiring-manual-pu08703001z-de-de-de.pdf) untersucht (korrigierte Ausgabe 10/23, 594 PDF-Seiten). Die PDF und ihre Zeichnungen werden nicht im Repository verteilt. Die folgenden allgemeinen Darstellungsprinzipien sind in eigenen Algorithmen und eigenständig aufgebauten Testschaltungen umgesetzt:

| Fundstelle im Buch | Beobachtung | Umsetzung / Absicherung |
|---|---|---|
| 3-28 bis 3-30 (PDF-Seiten 208–210) | Stromlauf-, Verdrahtungs- und Anordnungspläne verfolgen unterschiedliche Zwecke. | Die automatische Anordnung bearbeitet Stromlaufplangeometrie; aus dem Leitungsdatensatz `from/to` wird keine elektrische Stromrichtung abgeleitet. |
| 3-31 (PDF-Seite 211) | Mehrpolige Leistungspfade behalten Anschlussreihenfolge und gemeinsame Geräteachsen. | Vorhandene Anschlussachsen bleiben maßgebend; die zusätzliche Hauptachsenwahl zählt verbundene Gerätepaare statt einzelne Leiter. Mehrpolige Verbindungen dominieren dadurch nicht allein wegen ihrer Leiterzahl. |
| 3-32 und 3-36 (PDF-Seiten 212 und 216) | Steuerzweige sind als parallele Pfade mit seriellen Abschnitten lesbar. | Eigenständiger Regressionstest für Stopp → parallele Start-/Haltekontakte → Spule. Der Assistent beschreibt Leistungs- und Steuerkreise als getrennte Funktionsgruppen, sofern deren Rollen bekannt sind. |
| 3-35 bis 3-44 (PDF-Seiten 215–224) | Komplexere Motorstarter benötigen erkennbare Pfade und Verzweigungen. | Die Variantenbewertung berücksichtigt zusätzlich rückwärts geführte Anschlussketten. Bestehende Hindernis-, Netz- und Mehrblattprüfungen bleiben verbindlich. |

Die Variante **Geordnete Strompfade** unterstützt nun auch überwiegend horizontale Geräteketten. Sie wählt die Achse anhand gegenüberliegender Anschlüsse innerhalb der jeweiligen Gruppe; Abbruchstellen bestimmen diese Wahl nicht. Bei Gleichstand bleibt die vertikale Variante erhalten. Temporär vertauschte Layoutkoordinaten ermöglichen dieselben Rang- und Abstandsregeln in beiden Achsen. Das dreht weder Bibliothekssymbole noch Texte und verändert keine elektrischen Endpunkte. Die geometrische Leserichtung dient ausschließlich als weiches Bewertungskriterium; sie ist keine Aussage über tatsächlichen Stromfluss oder Energiefluss.

Die Referenz ist keine automatisch ausführbare Bemessungsvorschrift. Aus ihr werden keine Schutzorgane, Leiterquerschnitte, Verriegelungen oder Betriebszustände selbstständig ergänzt. Die Tests sichern Darstellung und Modellerhaltung ab, keine allgemeine Normkonformität oder vollständige Unterstützung sämtlicher Handbuchschaltungen.

### Leitungsraum und geordnete Abgänge

Bei **Geordneten Strompfaden** reserviert die Platzierung zwischen Geräteebenen zusätzlichen Platz für seitlich versetzte Leiter. Überlappende Knickbereiche unabhängiger Netze benötigen getrennte Bahnen. Räumlich getrennte Bereiche können Bahnen wiederverwenden; Zweige desselben tatsächlichen Netzes dürfen gemeinsame Abschnitte verwenden. Gleiche Potentialtexte allein verbinden keine Netze. Bei Auffächerungen und Zusammenführungen wird zusätzlich die notwendige Staffelung der Knicke berücksichtigt. Die Abschätzung ersetzt keine anschließende Routingprüfung.

Die strukturierte Variante wird als zusammenhängende Anordnung auf das Blatt gepackt. Dadurch bleiben berechnete Geräteachsen und Leitungsräume auch ohne ausdrückliche Funktionsgruppe erhalten. Fixierte Objekte bleiben Hindernisse; andere Layoutvarianten behalten ihre bisherige Einzelpackung als Alternative. Wenn der zusammenhängende Bereich nicht passt, gilt diese Variante als gescheitert und die vorhandene Varianten- und Mehrblattsuche entscheidet weiter.

Der Router erkennt gleichgerichtete, geordnete Anschlussbänke mit mindestens drei Leitern. Bei der entsprechenden Routingalternative bearbeitet er äußere Abgänge zuerst und bevorzugt bei ansonsten gleichwertigen Wegen Knicke nahe der schmaleren Anschlussbank. Das gilt auch horizontal und bei umgekehrt gespeicherten Leitungsendpunkten. Absichtlich vertauschte Anschlussreihenfolgen werden nicht als geordnete Bank behandelt oder korrigiert. Die Wegkosten zählen die vollständige Leitung einschließlich ihrer Anschlussstummel, damit gleichwertige Wege dieselbe Knickbewertung erhalten.

Ein Regressionstest mit acht getrennten Abgängen, sichtbaren Beschriftungen und einem fixierten Nachbargerät prüft die gesamte Vorschau und Übernahme. Zusätzliche Geometrietests decken beide Achsen und Richtungen, unveränderte Netze, fehlenden Leitungsraum und deterministische Ergebnisse ab. Diese Regeln garantieren keine kreuzungsfreie Lösung für beliebige Schaltungen; Hindernisse, Abstände und Anschlussrichtungen bleiben harte Bedingungen.

## Verbindungen aufräumen und bearbeiten

**Rechtsklick auf eine Verbindung → Verbindung aufräumen** berechnet nur deren Verlauf neu. Die übrigen Leitungen bleiben dabei unverändert und dienen als Hindernisse. **Bearbeiten → Verbindungen auf dieser Seite aufräumen** sowie der entsprechende Eintrag im Kontextmenü bearbeiten die manuellen Leitungen des aktuellen Stromlaufplanblatts. Autoconnect-Leitungen bleiben erhalten.

Die Berechnung berücksichtigt Symbolkörper, Beschriftungen, Anschlussrichtungen und bestehende Leitungswege. Für voneinander unabhängige Netze reserviert sie parallele Spuren mit mindestens einem Blattraster beziehungsweise 2 mm Abstand. Rechtwinklige Kreuzungen bleiben möglich. Gemeinsame Leitungsabschnitte desselben Netzes bleiben zulässig. Ist kein entsprechender Weg verfügbar, bleibt der bisherige Verlauf erhalten; beim ausdrücklichen Aufräumen wird dies gemeldet. Geräte und elektrische Anschlüsse werden nicht verschoben oder neu verbunden.

Neue manuelle Verbindungen werden beim Fertigstellen automatisch geführt; beim Zeigen auf einen Zielanschluss nutzt bereits die Vorschau diese Berechnung. Beim Verschieben eines Geräts wird die Führung der angeschlossenen Leitungen aktualisiert. Eine ausgewählte manuelle Leitung zeigt Griffe in der Mitte ihrer Abschnitte. Durch Ziehen eines Griffs lässt sich der Abschnitt quer zu seinem Verlauf verschieben. Endanschlüsse bleiben fest, die Leitung bleibt rechtwinklig. Auch bei einer zunächst geraden Leitung können so zusätzliche Knicke entstehen. Die Griffe funktionieren mit Maus und Touch; Escape bricht die laufende Griffverschiebung ab.

Von Hand bearbeitete Wege werden gespeichert und bei späteren Gerätebewegungen als Vorgabe beibehalten; die Enden werden wieder rechtwinklig an die Anschlüsse geführt. **Aufräumen** hebt diese Vorgabe auf und berechnet den Weg neu. Aufräumen, Gerätebewegung einschließlich automatischer Führung und manuelle Griffbearbeitung sind jeweils mit Rückgängig/Wiederholen bearbeitbar.

Jeder neue Layoutvorschlag verwendet diese Abstandsregeln bereits beim Berechnen seiner Verbindungen. Das gilt für alle Varianten und für jedes Blatt einer Mehrblatt-Vorschau. Auch zuvor von Hand festgelegte Leitungswege werden im Vorschlag neu geführt. Die Originalzeichnung bleibt bis **Übernehmen** unverändert; die Übernahme einschließlich der aufgeräumten Verbindungen ist ein gemeinsamer Rückgängig-Schritt. Kann eine Variante die Abstände und Anschlussrichtungen nicht erfüllen, wird sie als ungültig verworfen.
