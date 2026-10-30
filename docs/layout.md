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

Die Option **Bei Platzmangel mehrere Blätter erstellen** ist in der Vorschau standardmäßig aktiviert und kann vor **Neu berechnen** umgestellt werden. Über KI/MCP lässt sie sich mit `multiPage` steuern. Die automatische Aufteilung gilt für vollständige Stromlaufplanseiten aus Bauteilen, Leitungen und Gruppen, auch mit freien Texten und Bildern. Diese Zusatzinhalte bleiben einmalig auf der Ausgangsseite erhalten und werden dort mit geprüft; Inhalt, Bilddaten und Darstellungseigenschaften bleiben unverändert. Bei fixierten Objekten, Teilauswahl, Gruppen mit Zusatzobjekten, importierten Hintergrundzeichnungen, Kästen oder Kabeldefinitionen bleibt die Einblattprüfung aktiv. Der Fehlerbericht nennt dann den Grund, weshalb kein Mehrblattversuch möglich war. Eine Gruppe, die allein nicht passt oder nicht korrekt geroutet werden kann, wird nicht stillschweigend zerlegt. Auch dann bleibt das Projekt unverändert.

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

### Parallele Zweige unterschiedlicher Länge

Parallele Zweige müssen nicht gleich viele Geräte enthalten. Die Rang-Anordnung behandelt gemeinsame Eingangs- und Ausgangsebenen deshalb als Ausrichtungswünsche. Vor jeder Zusammenfassung prüft sie, ob die bereits bekannten seriellen Pfade dadurch einen Widerspruch erhalten würden. Gemeinsame Eingangsebenen werden zuerst berücksichtigt. Eine unvereinbare Ausgangsausrichtung wird ausgelassen; die Verbindung selbst bleibt bestehen und wird über den benötigten Ebenenabstand geführt. Echte gerichtete Zyklen bleiben ein Grund, diese Rang-Variante zu verwerfen und andere Varianten zu prüfen.

Gleichgerichtete seitliche Anschlüsse erzwingen keine gemeinsame vertikale Ebene. Die Achsausrichtung serieller Geräte berücksichtigt nur die gegenüberliegenden Anschlüsse entlang der Hauptachse. Rückverbindungen zwischen parallelen Zweigen ziehen einen längeren seriellen Pfad dadurch nicht in eine Zickzacklinie. Bei überwiegend horizontalen Schaltungen gelten dieselben Regeln in der vertauschten Layoutachse.

Die Regressionstests umfassen parallele Pfade mit einem, zwei und vier seriellen Geräten, unterschiedlich große Beschriftungsbereiche, beide Achsen, vertauschte Eingabereihenfolge, echte Zyklen und seitliche Verbindungen. Ein vollständiger Bibliothekstest prüft zusätzlich sichtbare Querverweise, Leitungsführung, unveränderte elektrische Daten, isolierte Vorschau und Rückgängig. Die Layoutberechnung fügt keine Kontakte oder Verriegelungen hinzu und bewertet nicht deren elektrotechnische Eignung.

### Durchgehende Spalten für serielle Geräteketten

Die lokale Reihenoptimierung wird durch eine gemeinsame Berechnung eindeutiger serieller Ketten ergänzt. Wo ein Gerät genau einen nachfolgenden und dieses genau einen vorhergehenden Nachbarn entlang der Hauptachse hat, können beide dieselbe Anschlussachse erhalten. Bei mehrpoligen Verbindungen müssen die benötigten Achsversätze aller Leiter übereinstimmen; unterschiedliche Polabstände werden nicht durch Skalierung oder veränderte Anschlüsse ausgeglichen.

Für diese Ketten gelten gemeinsame Spaltenpositionen über alle Geräteebenen. Abstandsbedingungen berücksichtigen die vollständigen Beschriftungsbereiche in jeder Ebene. Die Spaltenreihenfolge folgt dem ersten Auftreten der Pfade; die vorgelagerte Sortierung verwendet dabei die physischen Anschlussachsen statt der linken Textbereichsränder. So verändert eine längere Beschriftung weder die Reihenfolge der Abgänge noch zieht sie nachfolgende Geräte in eine Zickzacklinie. Horizontale Ketten nutzen dieselbe Berechnung mit vertauschter Layoutachse.

Diese Ausrichtung kann mehr Breite benötigen als eine versetzte Anordnung. Die bestehenden Blattgrenzen, alternativen Varianten und die Mehrblattprüfung bleiben daher maßgebend. Symbole und Schriftgrößen werden nicht verkleinert. Tests decken unterschiedlich lange Ketten und Beschriftungen, Abstände jeder Ebene, physische Anschlussreihenfolge, beide Achsen, unveränderte Eingabedaten und inkompatible mehrpolige Geometrien ab. Ein Bibliothekstest mit drei Abgängen und insgesamt 13 Geräten prüft zusätzlich die geroutete Vorschau und die Erhaltung aller elektrischen Endpunkte bei der Übernahme.

### Verzweigungen aus tatsächlichen Netzen erkennen

Gemeinsame Geräteebenen werden anhand elektrisch verbundener Anschlüsse ermittelt. Die Verbindung zwischen zwei parallelen Eingängen kann direkt gespeichert sein oder sternförmig über einen vorgelagerten Ausgang verlaufen. Beide Darstellungen liefern denselben Wunsch nach einer gemeinsamen Eingangsebene. Explizit bekannte interne Anschlussbrücken (`joinedPins`) gehen in diese Auswertung ein. Verschiedene Anschlüsse eines gewöhnlichen Geräts und gleiche Potentialtexte werden dagegen nicht automatisch elektrisch verbunden.

Die Ausrichtung bleibt eine weiche Vorgabe: Serielle Reihenfolgen und die vorhandene Zyklusprüfung haben Vorrang. Innerhalb eines Netzes werden verträgliche Teilgruppen gebildet, damit eine unvereinbare Verbindung nicht sämtliche übrigen Ausrichtungswünsche blockiert. Die Auswertung verändert keine Leitungsendpunkte, ergänzt keine Brücken und ersetzt den gespeicherten Leitungsbaum nicht. Die reale Leitungsführung wird anschließend für die ursprünglichen Verbindungen berechnet und geprüft.

Tests decken direkte und sternförmige Verzweigungen, unterschiedliche Rückverbindungen, ausdrücklich gebrückte und getrennte Anschlüsse, beide Layoutachsen und umgekehrt gespeicherte Leitungsrichtungen ab. Zusätzliche Bibliothekstests prüfen gemeinsame Kontaktebenen, kollisionsfreie Leitungsführung und die Erhaltung aller ursprünglichen Endpunkte. Diese Regeln garantieren keine pixelgleichen Koordinaten verschiedener Verdrahtungsdarstellungen; Leitungsräume, zusätzliche Verbindungssymbole und Textmaße werden weiterhin anhand des jeweiligen Bestands berücksichtigt.

### T-Stücke und lineare Verteilstränge im Leitungsraum

Die strukturierte Variante kann einzelne leitend verbundene T-Stücke aus der normalen Geräte-Ebenenbildung herausnehmen und anschließend im Leitungsraum zwischen ihren Nachbarn platzieren. Für die Geräteanordnung entsteht vorübergehend eine virtuelle Verbindung entlang des vorhandenen Symboldurchgangs. Der seitliche Zweig liefert einen Hinweis auf die Spaltenreihenfolge: Ein nach links gerichteter Abgang bevorzugt den zugehörigen Nachbarn links, ein rechter rechts. Die bestehenden Kettenachsen bleiben dabei erhalten. Die Anwendung dreht das Symbol nicht.

Der Leitungsraum berücksichtigt das vollständige gemessene Rechteck des Verbindungssymbols einschließlich sichtbarer Beschriftungen und zusätzlicher Abstände. Die endgültige Zeichnung enthält weiterhin das ursprüngliche Bibliothekssymbol und sämtliche ursprünglichen Leitungen. Virtuelle Planungskanten und Platzreservierungen werden nicht als Projektverbindungen gespeichert. Anschlüsse, Drehung, Beschriftungen und elektrische Eigenschaften bleiben erhalten; die anschließende echte Leitungsführung und Validierung müssen bestehen.

Zusätzlich werden lineare Stränge aus mehreren direkt verbundenen T-Stücken gemeinsam platziert. Die Kette muss durch gegenüberliegende Durchgangsanschlüsse verlaufen und innerhalb derselben Layoutgruppe liegen. Ihre gemessenen Symbol- und Beschriftungsbereiche bestimmen den Platzbedarf. Die Berechnung richtet die Durchgänge auf einer Achse aus, reserviert Abstand zwischen den Symbolen und berücksichtigt das tatsächliche Blattraster. Seitliche Abgänge werden entlang des Strangs gestaffelt, damit der Router unnötige Kreuzungen vermeiden kann. Linke und rechte Abgänge sowie horizontale Stränge behalten ihre vorhandene Orientierung.

Ein solcher Strang wird nur vorübergehend als gemeinsamer Platzierungsbereich behandelt. Vor dem anschließenden Routing wird er wieder in seine ursprünglichen, einzeln editierbaren Bibliothekselemente aufgelöst. Interne und externe Originalleitungen bleiben vollständig erhalten; es entsteht weder ein zusätzliches Gerätekasten-Element noch eine neue Projektgruppe.

Ein freies Durchgangsende ist ebenfalls zulässig, wenn am anderen Ende ein geeigneter realer Anschluss und passende angeschlossene Seitenzweige vorhanden sind. Als zusätzlicher Bezug dient dann ein tatsächlich angeschlossener Seitenzweig. Dieser Bezug ordnet die Geräteebenen, erzwingt aber keine gemeinsame Achse zwischen Einspeisung und seitlichem Verbraucher. Ein eigener seitlicher Korridor hält den Strang einschließlich seiner Beschriftungen von den vollständigen Geräte- und Textbereichen frei, auch über verschiedene Ebenen hinweg. Die tatsächlichen Leitungen werden weiterhin ausschließlich zu ihren ursprünglichen Anschlüssen geführt. Ein unbenutzter Anschluss bleibt unbenutzt; es werden keine Quelle, Abschlussklemme, Abbruchstelle oder zusätzliche Projektleitung angelegt.

Die zusätzliche Platzierung ist bewusst begrenzt: Sie benötigt einen erkennbaren Durchgang, ausdrücklich verbundene Pins und passende benachbarte Geräte innerhalb derselben Layoutgruppe. Fixierte Symbole, Kreuzungen, mehrpolige Klemmen, Symbole ohne ausreichend verbundene Nachbarn, beidseitig offene Stränge ohne verlässlichen Durchgangsbezug, verzweigte Hilfssymbolnetze, geschlossene Hilfssymbolschleifen, Verbindungen über seitliche statt durchgehende Anschlüsse und nicht passend unterzubringende Geometrien behalten die bisherige Berechnung. Native starre Gruppen werden nicht aufgelöst. Es wird keine interne elektrische Verbindung aus der bloßen Darstellung eines Kreuzes abgeleitet.

Tests prüfen linke und rechte Abgänge, horizontale Anordnung, sichtbare Beschriftungen, gemessene Abstände, unveränderte elektrische Topologie und die sichere Rückkehr zur regulären Variante bei nicht unterstützten Fällen. Widersprüchliche Spaltenhinweise werden vor einer teilweisen Verschiebung verworfen.

Die Strangtests ergänzen ein bis drei verbundene T-Stücke, feine Raster, umgekehrte Leitungsrichtungen und Eingabereihenfolgen, sichtbare Beschriftungen sowie fixierte, elektrisch getrennte, offene und zyklische Varianten. Offene Anfänge und Enden, beide Seiten und Achsen sowie die Rückgängig-Funktion sind abgedeckt. Die Tests prüfen insbesondere, dass nach der Übernahme ausschließlich die ursprünglichen Symbole und Leitungen im Projekt stehen und freie Pins keine erfundene Verbindung erhalten.

### Sammelleitungen mit rechtwinklig abgehenden Gerätespalten

Für eine einzelne lineare Sammelleitung innerhalb einer Layoutgruppe gibt es eine zusätzliche strukturierte Berechnung. Sie berücksichtigt waagerechte Leitungen mit Abgängen nach oben oder unten sowie senkrechte Leitungen mit seitlichen Abgängen. Durchgangs- und Geräteanschlüsse müssen einander zugewandt sein. Ein frei endender Strang ist möglich, solange mindestens ein tatsächlich angeschlossener Durchgangsnachbar vorhanden ist.

Zuerst werden die Abgangsgeräte und ihre nachfolgenden Schaltungen entlang ihrer eigenen Anschlussrichtung angeordnet. Danach folgen die Positionen der T-Stücke den tatsächlichen Eintrittsachsen dieser Geräte. Die Reihenfolge des ursprünglichen Strangs bleibt erhalten. Die Platzreservierung einer Gerätespalte umfasst sowohl das Gerät als auch das zugehörige T-Stück einschließlich sichtbarer Beschriftungen. So können unterschiedlich lange Texte größere Abstände erzeugen, ohne Symbol- oder Schriftgrößen zu verändern.

Einzeln angeschlossene Durchgangsnachbarn werden an den Enden angedockt. Die Sammelleitung erhält einen gemessenen Streifen außerhalb der Abgangsschaltung. Die endgültige Leitungsführung arbeitet anschließend mit sämtlichen Originalanschlüssen und Originalleitungen; vorübergehende Reihenfolge- und Platzierungskanten werden nicht gespeichert. Die Standardbibliothek und ihre vorhandenen Einfügepunkte bleiben unverändert.

Die Berechnung für eine einzelne Schiene benötigt eine eindeutige Zuordnung eines Abgangsgeräts zu jedem T-Stück und gemeinsame Eintrittsebenen. Mehr als zwei Schienen, gemischte Abgangsseiten innerhalb einer Schiene, mehrfach belegte Stationen, starre Makro-Innengeometrien, fixierte Nachbarn oder weiter vernetzte Durchgangsnachbarn behalten die bisherigen Varianten. Passt die gemessene Anordnung nicht auf das Blatt, bleiben die bestehenden Alternativen und die Mehrblattprüfung aktiv. Es werden keine Kontakte ergänzt und keine Geräte gespiegelt oder gedreht.

Regressionstests prüfen beide Achsen und Seiten, lange Stationsbeschriftungen, offene Enden, nachgeschaltete Gerätekaskaden, unveränderte elektrische Topologie und Rückgängig. Ein gerader Abgang ist ein Ergebnis der berechneten Geometrie; sämtliche Leitungswege müssen zusätzlich die normale Hindernis- und Anschlussprüfung bestehen.

### Gegenüberliegende Versorgungs- und Rückleiterschienen

Zwei parallele lineare Sammelleitungen können gemeinsam angeordnet werden, wenn ihre Abgänge einander zugewandt sind. Zuerst werden die tatsächlichen Geräteschaltungen zwischen den Schienen berechnet. Anschließend folgen beide Schienen den physischen Anschlussachsen der zugehörigen Geräte. Ihre Beschriftungen und die der Abgangsgeräte reservieren gemeinsam Platz. Das funktioniert für obere/untere sowie linke/rechte Schienen; die Bezeichnungen im Projekt entscheiden nicht über ihre elektrische Bedeutung.

Die Reihenfolge beider ursprünglichen Stationsketten bleibt verbindlich. Widersprüchliche Reihenfolgen, nicht gemeinsame Anschlussebenen, unpassende Anschlussrichtungen, fixierte Nachbarn und mehr als zwei Schienen behalten die allgemeinen Layoutalternativen. Eine Schiene benötigt weiterhin mindestens einen tatsächlich angeschlossenen Durchgangsnachbarn. Die Berechnung ergänzt keine Rückleitung, legt keine Brücke an und ändert keine Anschlussbelegung. Nach der Platzierung gelten weiterhin die vollständige Leitungs-, Kollisions- und Blattprüfung sowie gegebenenfalls die Mehrblattberechnung.

Regressionstests prüfen drei Gerätespalten zwischen zwei Schienen mit unterschiedlichen Beschriftungsbreiten, beide Achsen, umgekehrte Eingabereihenfolge und Leitungsrichtungen, widersprüchliche Stationsreihenfolgen, unveränderte Topologie und Rückgängig. Die Tests messen auch Kreuzungen und Knicke der endgültigen Originalleitungen.

### Außenkorridore für lange Rückführungen

Lange Verbindungen zwischen gleichgerichteten Anschlüssen erhalten eine zusätzliche geometrische Routingpräferenz. Liegt mindestens ein weiteres tatsächlich verbundenes Gerät zwischen ihren Anschlussebenen, berücksichtigt der Router zwei Außenkorridore des zusammenhängenden Schaltungsbereichs. Dessen gemessene Geräte- und Beschriftungsbereiche bestimmen die Grenzen. Kurze Verbindungen, gegenüberliegende Anschlüsse und nur räumlich benachbarte, unverbundene Geräte lösen diese Präferenz nicht aus. Die Erkennung ist keine Aussage über Stromrichtung oder elektrische Funktion.

Die Außenbahnen folgen dem Raster. Lange parallele Abschnitte innerhalb der Schaltungsfläche erhalten zusätzliche Wegkosten; Länge, Knicke und Kreuzungen bleiben weitere Kriterien. Hindernisse, Blattgrenzen, echte Netze, Leiterabstände und Anschlussrichtungen bleiben verbindlich. Ein äußerer Weg ist daher keine Pflicht: Bei blockierten oder ungünstigen Außenbahnen kann ein zulässiger innerer Weg gewinnen. Die Präferenz gilt für automatische Layoutwege und die gemeinsame Routingfunktion beim manuellen Aufräumen. Sie fügt weder Leitungen noch elektrische Verbindungen hinzu und verändert keine Gerätepositionen.

Tests prüfen beide Achsen und gespeicherten Leitungsrichtungen, gesperrte Außenkorridore mit innerer Ausweichroute, unveränderte Endpunkte sowie die Abgrenzung kurzer, gegenüberliegender und unverbundener Fälle.

### Gleichmäßige Abstände äquivalenter Steuerzweige

Drei oder mehr eindeutige serielle Zweige können einen gemeinsamen Achsabstand erhalten, wenn sie an denselben tatsächlichen Eingangs- und Ausgangsnetzen liegen und dieselben Geräteebenen belegen. Jeder Zweig muss aus mindestens zwei durchgehend ausgerichteten Geräten mit jeweils genau zwei gegenüberliegenden Anschlüssen bestehen. Die Erkennung verwendet weder BMK-Texte noch gleichlautende Potentialbezeichnungen als Netzbrücke. Sie ergänzt keine Kontakte oder Verriegelungen und bewertet nicht die elektrische Eignung der Schaltung.

Der gemeinsame Abstand berücksichtigt die vollständigen Symbol- und Beschriftungsbereiche jeder Geräteebene und wird auf das Layout-Raster aufgerundet. Die ursprüngliche Spaltenreihenfolge und die geraden Achsen innerhalb jedes Zweigs bleiben erhalten. Ein ausschließlich an diese Zweige angeschlossenes gemeinsames Einspeise- oder Rückleitergerät kann über der Mitte der äußeren Zweigachsen ausgerichtet werden; weitere externe Verbindungen, unpassende Anschlussrichtungen oder fixierte Geräte schließen diese zusätzliche Verschiebung aus. Andere Nachbargeräte bleiben Hindernisse: Passt eine Gruppe nicht, wird sie vollständig bei ihrer bisherigen Anordnung belassen. Fixierte Geräte, mehrpolige Anschlussbänke, unterschiedliche Zweiglängen und durch Sammelleitungsstationen vorgegebene Spaltenordnungen erhalten diese zusätzliche Umordnung nicht. Blattgrenzen und endgültige Leitungsprüfung gelten anschließend unverändert; bei Platzmangel bleiben andere Varianten und Mehrblattberechnung verfügbar.

Tests decken unterschiedliche Beschriftungsbreiten, beide Hauptachsen, umgekehrte Eingabereihenfolgen und Leitungsrichtungen, gleiche Achsabstände sowie geroutete Bibliothekssymbole mit erhaltenen Querverweisen ab. Ausschlussfälle prüfen getrennte Netze, fixierte und mehrpolige Geräte, zu kurze Zweige, Nachbarhindernisse und das Ausbleiben teilweiser Verschiebungen. Vorschau, elektrische Topologie und Rückgängig bleiben abgesichert.

### Strompfade bei der Blattaufteilung zusammenhalten

Die Mehrblattsuche versucht zunächst, eindeutige serielle Geräteketten gemeinsam auf einem Blatt unterzubringen. Erkannt werden Geräte mit genau zwei gegenüberliegenden Anschlüssen, wenn entlang der Anschlussrichtung genau ein Nachfolger und genau ein Vorgänger bestehen. Gemeinsame Einspeisungen und Rückleiter verschmelzen dadurch nicht sämtliche parallelen Abgänge zu einem großen Block. Vorhandene ausdrückliche Gruppen bleiben weiterhin unteilbar. BMK und Potentialtexte sind keine Grundlage dieser Zusammenfassung.

Diese Strompfadblöcke sind eine Präferenz für die Zuordnung, keine neue Projektgruppe. Für jede untersuchte Blattzahl wird bei geeigneten Ketten zunächst eine zusammenhängende Zuordnung berechnet und vollständig platziert, geroutet und geprüft. Scheitert sie, bleibt die bisherige feinere Zuordnung aus den ursprünglichen Gruppen verfügbar. Zu große Ketten verhindern damit keine notwendige Aufteilung. Die Variantenbewertung berücksichtigt zusätzlich die Anzahl benötigter Blattverbindungen. Es handelt sich weiterhin um eine begrenzte heuristische Suche, nicht um eine Garantie der minimalen Blattzahl.

Ein Test mit zwei unabhängigen breiten Geräteketten prüft einen gültigen Zweiblattvorschlag ohne Trennung innerhalb der Ketten und ohne zusätzliche Abbruchstellen. Weitere Tests sichern gemeinsame Einspeisungen, ausdrückliche Gruppen, fixierte und mehrpolige Geräte sowie umgekehrt gespeicherte Leitungsrichtungen ab. Die bestehende Mehrblattprüfung kontrolliert die Originalgeräte, Originalanschlüsse, Leitungen, Verweispaare und Rückgängig; zu große Einzelketten behalten ihren feineren Ausweichweg.

### Anschlussgerechte Abbruchstellen an Blattübergängen

Neue Abbruchstellen eines Mehrblattvorschlags folgen der tatsächlichen Anschlussrichtung des jeweils ursprünglichen Geräts einschließlich seiner gespeicherten Drehung. Ein unterer Anschluss erhält beispielsweise eine nach unten gerichtete Abbruchstelle mit gegenüberliegendem Anschluss; ein oberer Anschluss eine nach oben gerichtete. Seitliche Anschlüsse werden entsprechend behandelt. Beide Seiten werden unabhängig bestimmt: Die gespeicherte Reihenfolge `from/to` ist keine angenommene Stromrichtung. Bestehende Gerätesymbole, deren Drehungen und ursprüngliche elektrische Endpunkte bleiben unverändert.

Die Prüfung vor der Übernahme erwartet die aus dem Originalanschluss abgeleiteten Bibliothekssymbole, unveränderte Verweisnamen und ungedrehte neue Abbruchstellen. Manipulierte Symbolvarianten oder Drehungen werden zurückgewiesen. Die vorhandene paarweise Querverweisnavigation und die logischen Verbindungen bleiben erhalten. Tatsächliche Leitungswege werden anschließend wie bisher auf Anschlussrichtungen, Hindernisse und Blattgrenzen geprüft; die passende Symbolrichtung garantiert allein noch keinen geraden Leitungsweg.

Tests decken beide Anschlüsse eines Geräts bei 0°, 90°, 180° und 270° sowie eine vollständig berechnete Dreiblattaufteilung ab. Letztere erhält zwei navigierbare Verweispaare ohne zusätzliche Leitungsknicke; Symbol- und Drehungsmanipulationen werden vor der Projektänderung abgelehnt. Rückgängig und Wiederholen bleiben abgesichert.

## Verbindungen aufräumen und bearbeiten

**Rechtsklick auf eine Verbindung → Verbindung aufräumen** berechnet nur deren Verlauf neu. Die übrigen Leitungen bleiben dabei unverändert und dienen als Hindernisse. **Bearbeiten → Verbindungen auf dieser Seite aufräumen** sowie der entsprechende Eintrag im Kontextmenü bearbeiten die manuellen Leitungen des aktuellen Stromlaufplanblatts. Autoconnect-Leitungen bleiben erhalten.

Die Berechnung berücksichtigt Symbolkörper, Beschriftungen, Anschlussrichtungen und bestehende Leitungswege. Für voneinander unabhängige Netze reserviert sie parallele Spuren mit mindestens einem Blattraster beziehungsweise 2 mm Abstand. Rechtwinklige Kreuzungen bleiben möglich. Gemeinsame Leitungsabschnitte desselben Netzes bleiben zulässig. Ist kein entsprechender Weg verfügbar, bleibt der bisherige Verlauf erhalten; beim ausdrücklichen Aufräumen wird dies gemeldet. Geräte und elektrische Anschlüsse werden nicht verschoben oder neu verbunden.

Neue manuelle Verbindungen werden beim Fertigstellen automatisch geführt; beim Zeigen auf einen Zielanschluss nutzt bereits die Vorschau diese Berechnung. Beim Verschieben eines Geräts wird die Führung der angeschlossenen Leitungen aktualisiert. Eine ausgewählte manuelle Leitung zeigt Griffe in der Mitte ihrer Abschnitte. Durch Ziehen eines Griffs lässt sich der Abschnitt quer zu seinem Verlauf verschieben. Endanschlüsse bleiben fest, die Leitung bleibt rechtwinklig. Auch bei einer zunächst geraden Leitung können so zusätzliche Knicke entstehen. Die Griffe funktionieren mit Maus und Touch; Escape bricht die laufende Griffverschiebung ab.

Von Hand bearbeitete Wege werden gespeichert und bei späteren Gerätebewegungen als Vorgabe beibehalten; die Enden werden wieder rechtwinklig an die Anschlüsse geführt. **Aufräumen** hebt diese Vorgabe auf und berechnet den Weg neu. Aufräumen, Gerätebewegung einschließlich automatischer Führung und manuelle Griffbearbeitung sind jeweils mit Rückgängig/Wiederholen bearbeitbar.

Jeder neue Layoutvorschlag verwendet diese Abstandsregeln bereits beim Berechnen seiner Verbindungen. Das gilt für alle Varianten und für jedes Blatt einer Mehrblatt-Vorschau. Auch zuvor von Hand festgelegte Leitungswege werden im Vorschlag neu geführt. Die Originalzeichnung bleibt bis **Übernehmen** unverändert; die Übernahme einschließlich der aufgeräumten Verbindungen ist ein gemeinsamer Rückgängig-Schritt. Kann eine Variante die Abstände und Anschlussrichtungen nicht erfüllen, wird sie als ungültig verworfen.

### Getrennte Schaltungsbereiche mit eigener Leserichtung

Die Variante **Geordnete Strompfade** kann bis zu zwölf elektrisch getrennte Teilkreise innerhalb derselben Layoutgruppe als eigene gemessene Bereiche anordnen, sofern jeder Teilkreis mindestens zwei Layoutobjekte enthält. Einzelne unverbundene Symbole behalten die gemeinsame Berechnung. Die Zuordnung verwendet die tatsächlichen Leitungsendpunkte der vorhandenen Schnittstellen. Gleiche BMK, Potentialnamen oder Querverweise verbinden diese Bereiche nicht. Insbesondere können ein Leistungspfad und die zugehörige Steuerung ihre jeweils eigene horizontale oder vertikale Anordnung behalten. Eine elektrische Rollenbestimmung allein anhand der Symbolbezeichnung erfolgt nicht.

Jeder Teilkreis wird mit vollständigen Geräte- und Beschriftungsbereichen berechnet. Die Bereiche werden mit zusätzlichem Abstand nebeneinander und bei fehlender Breite in weiteren Reihen angeordnet. Vorhandene starre Gruppen werden dabei nicht aufgelöst. Scheitert die Teilkreisberechnung, bleibt die gemeinsame Berechnung verfügbar. Blattgrenzen und die abschließende Leitungs- und Kollisionsprüfung gelten weiterhin. Die Gruppierung ist rein vorübergehend; sie ergänzt keine Projektobjekte und ändert keine elektrischen Verbindungen.

Ein Bibliothekstest prüft getrennte Leistungs- und Steuerbereiche mit gemeinsamem Gerätekennzeichen, verschiedenen Leserichtungen, geraden Anschlussachsen, unveränderter Verdrahtung und Rückgängig.

### Leistungsbereiche vor Steuerbereichen anordnen

Bei der Anordnung elektrisch getrennter Bereiche berücksichtigt **Geordnete Strompfade** optional die ausdrücklich hinterlegte Bibliothekseigenschaft `layoutRole`. Die Standardzeichen für dreipolige Leistungsschaltglieder und Drehstrommotoren sind als `power` markiert; Schützspule, Schließertaster und Not-Halt-Taster als `control`. Andere Definitionen werden ohne solche Angaben nicht anhand von Namen, Kennzeichen, Kategorien oder Potentialtexten eingestuft. Projektspezifische Definitionen erhalten keine nachträgliche Rolle allein aufgrund ihrer ID.

Ein Bereich mit ausschließlich bekannten Leistungsrollen steht vor neutralen beziehungsweise unbekannten Bereichen; eindeutig als Steuerung markierte Bereiche folgen danach. Enthält ein Bereich beide Rollen, bleibt er neutral. Innerhalb gleicher Priorität gilt eine stabile Reihenfolge. Elektrische Verbindungen, Gerätezugehörigkeit und Querverweise werden dadurch nicht verändert, und es werden keine Leistungs- oder Steuerkreise ergänzt. Die bestehenden Regeln für Bereichsgrenzen, Gruppen, Abstände und die abschließende Prüfung bleiben maßgebend.

Ein eigenständig aufgebauter Dreiphasen-Test mit Leistungsschaltglied, Motor, Taster und Schützspule prüft die Reihenfolge gegen absichtlich entgegengesetzte Objekt-IDs. Er deckt neutrale Definitionen, umgekehrte Eingabereihenfolgen und Leitungsendpunkte, unveränderte elektrische Daten, geroutete Vorschau und Rückgängig ab. Die Regel unterstützt die getrennte Darstellung aus den Schaltungsbeispielen; sie ist keine automatische Funktions- oder Sicherheitsprüfung.
