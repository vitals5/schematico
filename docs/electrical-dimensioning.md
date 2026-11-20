# Elektrische Dimensionierung

**Auswerten → Elektrische Dimensionierung…** verwaltet ausdrücklich angelegte Stromkreise. Der Verbindungsnavigator bietet zusätzlich **Elektrisch dimensionieren** an. Der Planbezug wird anhand der konkreten Verbindung und ihrer Anschlüsse gespeichert; eine Zeichnungslinie wird dadurch nicht automatisch zum vollständigen Stromkreis erklärt. Mehrere Berechnungen zum selben Bezug bleiben getrennte Datensätze.

Die Daten liegen unter `Project.dimensioning` und bleiben in den eigenen Projektformaten erhalten. Eingaben werden erst mit **Eingaben übernehmen** ins Projekt geschrieben; die Übernahme unterstützt Rückgängig/Wiederholen. Die Vorschau berechnet Änderungen sofort. Ein veralteter Projektstand wird vor einer Übernahme oder Ausgabe abgewiesen.

## Last und Spannungsfall

Unterstützt werden Gleichstrom mit zwei Leitern, einphasiger Wechselstrom und ein symmetrischer Drehstromkreis. Zu erfassen sind Spannung, einfache reale Leitungslänge, Querschnitt, Cu/Al und Leiterbetriebstemperatur. Bei Drehstrom ist die Spannung zwischen Außenleitern gemeint. Als Lastangabe dienen entweder der Betriebsstrom oder die abgegebene Wirkleistung mit Wirkungsgrad; bei AC kommt der Leistungsfaktor hinzu. Für eine rein elektrische Last wird der Wirkungsgrad ausdrücklich mit 1 angesetzt.

Eine AC-Reaktanz ist ausdrücklich anzugeben. `0` bedeutet bewusst vernachlässigt; ein leeres Feld wird nicht als Null interpretiert. Der zulässige Spannungsfall wird ebenfalls ausdrücklich eingegeben. Es gibt keinen erfundenen pauschalen Normgrenzwert.

Mit L in km, S in mm², R und X in Ohm/km:

- DC: `Ib = Pab / (U · eta)`; `DeltaU = 2 · L · Ib · R`.
- AC einphasig: `Ib = Pab / (U · eta · cos(phi))`; `DeltaU = 2 · L · Ib · (R · cos(phi) ± X · sin(phi))`.
- Drehstrom: `Ib = Pab / (sqrt(3) · U · eta · cos(phi))`; `DeltaU = sqrt(3) · L · Ib · (R · cos(phi) ± X · sin(phi))`.
- Induktive Last verwendet Plus, kapazitive Last Minus. Die Prüfung vergleicht den Betrag des prozentualen Spannungsfalls mit der eingegebenen Grenze und erfasst damit auch eine Spannungsanhebung.
- `Rtheta = R20 · (1 + alpha20 · (theta − 20))`.
- Bei fehlender Datenblattangabe wird `R20 = 1000 · rho20 / S` verwendet: Cu `rho20 = 0,0175`, Al `0,0282 Ohm·mm²/m`; `alpha20` Cu `0,00393`, Al `0,00403 /K`. Dies sind gekennzeichnete Planungswerte, keine garantierten maximalen Hersteller-Leiterwiderstände. Ein eingegebenes Datenblatt-R20 hat Vorrang.
- Ohmsche Leitungsverluste: `2 · Ib² · Rtheta · L`, bei Drehstrom `3 · Ib² · Rtheta · L`.

Hin- und Rückleiter verwenden denselben Querschnitt und dieselbe Temperatur. Das Modell berücksichtigt die Längskomponente des Spannungsfalls bei Grundschwingung und symmetrischer Belastung; es berechnet keinen vollständigen Lastfluss, keine Oberschwingungen und keine Neutralleiterüberlast bei unsymmetrischen Drehstromlasten.

**Gespeicherte reale Länge / Querschnitt ausdrücklich übernehmen** kopiert vorhandene eindeutige Angaben der Bezugslinie. Zeichnungsabstände werden nie in reale Meter umgerechnet. Die übernommenen Quelldaten bleiben als Nachweis gespeichert; spätere Änderungen an der Linie erzeugen einen Klärungsbefund. Der Anwender prüft weiterhin, ob die Strecke den vollständigen zu berechnenden Stromkreis beschreibt.

## Optionale Prüfbereiche

Jeder Bereich wird ausdrücklich beauftragt. Nicht beauftragte Bereiche stehen als **Nicht beauftragt** im Ergebnis und im Bericht.

### Strombelastbarkeit und Überlastschutz

Eingaben: belegter Tabellenwert Iz0 mit Verlegebedingungen/Quelle, Temperatur-, Häufungs- und weiterer Faktor sowie Schutzgeräte-Bemessungsstrom In, konventioneller Auslösestrom I2 und deren Quelle.

`Iz = Iz0 · kt · kg · k`; geprüft werden `Ib ≤ In ≤ Iz` und `I2 ≤ 1,45 · Iz`. Die App wählt keine Verlegeart, Tabelle, Schutzgerätekennlinie oder Korrekturfaktoren anhand eines Artikelnamens aus. Die zur Anwendung gehörenden Tabellen- und Schutzgerätedaten müssen vorliegen.

### Fehlerstrom, Abschaltbedingung und Ausschaltvermögen

Vorhandene kleinste Fehler- und größte Kurzschlussströme lassen sich aus einer Netzberechnung oder Messung übernehmen. Alternativ berechnet das **Schleifenverfahren** den einpoligen Fehlerstrom aus einer ausdrücklich eingegebenen vollständigen Fehlerschleife:

`Ik,min = cmin · U0 / Zs,max`; maximaler **einpoliger Schleifen-Fehlerstrom** `= cmax · U0 / Zs,min`. Für Ausschaltvermögen und Selektivität ist zusätzlich der maßgebende maximale **Netzkurzschlussstrom über alle relevanten Fehlerfälle** mit eigener Quelle einzugeben. Er darf nicht kleiner als die bereits berechneten Fehlerströme sein. Der einpolige Schleifenwert ersetzt diesen Nachweis nicht.

U0 ist die Spannung gegen Erde. Zs umfasst die gesamte Fehlerschleife einschließlich Quelle und muss zu den jeweiligen Minimal-/Maximalbedingungen passen. Spannungsfaktoren werden nicht pauschal vorgegeben. Das Verfahren ersetzt keine dreipolige Kurzschluss- oder allgemeine Netzberechnung.

Geprüft werden `Ik,min ≥ Ia`, `t(Ia) ≤ geforderte Abschaltzeit` sowie `Ik,max ≤ Ausschaltvermögen`. Ia und t(Ia) stammen aus dem dokumentierten relevanten Kennlinienbereich. Die App leitet Ia nicht ungeprüft aus einem Buchstaben wie B/C/D ab. Die Abschaltprüfung bezieht sich auf das eingegebene Überstromschutzmodell; eine RCD-Auslöse- oder Erdungsanlagenprüfung wird dadurch nicht erzeugt.

### Thermischer Kurzschlussschutz

`I²t ≤ k² · S²` mit ausdrücklich belegten Leiter-/Isolationskennwerten und Durchlassenergie für den relevanten Fehlerstrombereich. Die zugehörige Fehlerdauer muss positiv und höchstens 5 s sein. Es gibt keine automatisch angenommene Durchlassenergie oder aus einer beliebigen Abschaltzeit erfundene Schutzgerätekennlinie.

### Selektivität

Geprüft wird `Ik,max ≤ bestätigte Hersteller-Selektivitätsgrenze`. Erforderlich sind die konkrete vor-/nachgeschaltete Gerätepaarung und ihr Herstellerbeleg für die verwendeten Betriebsbedingungen. Aus dem Verhältnis zweier Bemessungsströme wird keine Selektivität behauptet. Eine Grenzwertverletzung bedeutet, dass die eingegebene Grenze für diesen Fehlerstrom nicht ausreicht; es wird kein günstigerer Ersatzartikel erfunden.

## Ergebnisse und Prüflauf

Die Vorschau unterscheidet **Beauftragte Prüfungen erfüllt**, **Grenzwert verletzt** und **Angaben fehlen**. „Erfüllt“ bezieht sich auf die aktivierten Rechenprüfungen anhand ihrer Eingaben, nicht auf eine vollständige Anlagenprüfung. Ungültige Zahlen, fehlende Quellen, widersprüchliche Bereiche und beschädigte Planbezüge bleiben sichtbar. Ergebnisse werden aus den Eingaben neu berechnet und nicht als veraltete Gut-/Schlecht-Werte gespeichert.

Der gemeinsame elektrische Prüflauf meldet `dimensioning_limit` bei verletzten Grenzen und `dimensioning_input` bei fehlenden Angaben. **Elektrische Dimensionierung…** am Befund öffnet die zugehörige Berechnung direkt. Der KI-Prüfdienst erhält dieselben Meldungen und strukturierten Rechenergebnisse.

JSON enthält alle Eingaben, Ergebnisse, Methodenkennung und Annahmen. CSV und PDF enthalten Eingaben, Quellen, Ergebnisse, Formeln, Prüfstatus und nicht beauftragte Bereiche. Der gemeinsame PDF-Export bietet den Abschnitt **Elektrische Dimensionierung**. Alle PDF-Seiten verwenden Querformat und den Projektplankopf. Mathematische Zeichen werden vor der PDF-Tabellenmessung lesbar ausgeschrieben, beispielsweise `Ohm`, `phi`, `sqrt(3)`, `<=` und `>=`; JSON/CSV behalten die ursprünglichen Zeichen.

Die Implementierung ist eine transparente parametergestützte Rechen- und Vergleichsfunktion. Die Auswahl anwendbarer Normen, Netzformen, Verlegebedingungen und Herstellerkennwerte wird nicht durch eine Zertifizierungsbehauptung ersetzt. Automatische Tabellen-/Kennlinienbeschaffung und eine allgemeine mehrpolige Netzkurzschlussrechnung sind nicht enthalten.


## Wann verwenden und wie Artikel zuordnen?

Die Funktion ist eine optionale Auslegungshilfe: für neue Abgänge, geänderte Verbraucher, längere Leitungswege oder einen Wechsel von Leitung/Schutzgerät. Für die reine Dokumentation eines bereits nachgewiesenen Stromkreises ist kein neuer Rechendatensatz nötig. Sie ersetzt keine allgemeine Anlagenabnahme.

Der Bereich **Stromkreis aufbauen · Geräte und Artikel** ordnet Leitung, Schutzgerät, Verbraucher und vorgeschaltetes Schutzgerät getrennt zu. Ein vorhandenes Projektgerät übernimmt seinen tatsächlichen Hauptartikel. Alternativ stehen Projektartikel und der geladene gemeinsame/lokale Katalog zur Suche bereit; Artikelnummern und Varianten bleiben exakt erhalten. Ein Auslegungsartikel ohne Projektgerät ist eine dokumentierte Planung, kein zusätzlicher Stücklistenposten.

Die Kataloge besitzen derzeit nicht für alle Artikel strukturierte elektrische Bemessungsdaten. Deshalb werden aus Beschreibungstexten keine Werte wie B16, Ausschaltvermögen oder Iz abgeleitet. Die Liste nennt die jeweils relevanten Kennwerte: im Berechnungsformular aus dem Datenblatt eintragen, Quelle erfassen und **Formularwerte an Artikel binden** wählen. Diese Werte bleiben mit dem genauen Artikel im Stromkreis gespeichert. **Gespeicherte Kennwerte übernehmen** kopiert sie gezielt in die Rechnung; bekannte Profile desselben Artikels und derselben Rolle aus gespeicherten Stromkreisen können wiederverwendet werden.

Ändert sich ein gebundener Formularwert oder stimmt der Artikel nicht mehr mit dem Projektgerät überein, meldet die Prüfung Klärungsbedarf. **Artikel im Plan bearbeiten** öffnet nach Speicherung der Rechnung das vorhandene Artikelwerkzeug. Erst dort werden Projektartikel/BOM geändert; eine reine Auslegungszuordnung ändert keine Geräte oder Verbindungen. Artikelzuordnungen und Kennwertquellen stehen auch im Dimensionierungsbericht.

Betriebstemperatur, Häufung, Verlegebedingungen und reale Leitungslänge sind weiterhin installationsabhängige Angaben. Eine Selektivitätsgrenze gehört zur konkreten Gerätepaarung; sie wird nicht aus den Einzelartikeln berechnet.

## Strukturierte elektrische Artikeldaten

Im Artikelkatalog besitzt jeder Artikel optional den Bereich **Elektrische Kennwerte** mit einer ausdrücklich gewählten Funktion: Leitung/Kabel, Schutzgerät oder Verbraucher. Dazu gehören Bemessungsspannung und Stromart, Polzahl, In/I2, Ausschaltvermögen und Bemessungsdifferenzstrom, Leiterquerschnitt/Aderzahl/Material/R20/X/Iz0/k sowie Verbraucherleistung, Strom, Wirkungsgrad und Leistungsfaktor. Nicht ausgefüllte Felder bleiben unbekannt; es werden keine Herstellerdaten aus Beschreibungen abgeleitet.

Eine Quelle ist erforderlich. Für Tabellen-Strombelastbarkeit und Hersteller-Kennlinienpunkte müssen die Geltungsbedingungen hinterlegt sein. Kennlinienpunkte bestehen aus Strom, minimaler und maximaler Zeit und sind streng nach Strom aufsteigend zu erfassen. Sie werden gespeichert und im Katalogvergleich angezeigt; eine automatische Interpolation oder ein Selektivitäts-/Abschaltnachweis aus diesen Punkten ist noch nicht enthalten.

Die optionale Datenstruktur `CatalogArticle.electrical` hat Version 1. Sie bleibt in lokalen Artikeln, JSON-/CSV-Katalogen, Projektsnapshots und neuen gemeinsamen Katalogeinreichungen erhalten. Bestehende Kataloge ohne diesen Bereich bleiben gültig. Bei CSV ist `electrical` eine zusätzliche JSON-Spalte. Einträge im gemeinsamen Katalog werden durch eine anonyme Neueinreichung nicht überschrieben; lokale Kennwertergänzungen können wie andere Artikeländerungen gespeichert werden.

Bei der Auswahl in der Dimensionierung stehen vorhandene Artikelkennwerte über **Gespeicherte Kennwerte übernehmen** bereit. Das ist eine ausdrückliche Aktion. Der Querschnitt und das Material stammen dann aus dem gewählten Leitungsartikel; Länge, Temperatur und Verlegefaktoren bleiben Angaben zur konkreten Installation. Eine andere Stromart, unzureichende Bemessungsspannung oder ein abweichendes Leitermaterial erzeugen einen Befund.

## Stromkreis-Assistent

1. **Auswerten → Elektrische Dimensionierung → Stromkreis-Assistent** öffnen.
2. Spannung, Last, einfache reale Leitungslänge, Temperatur und zulässigen Spannungsfall eingeben. Unter **Strombelastbarkeit und Überlastschutz** die zutreffenden Korrekturfaktoren eintragen. Es gibt keine stillschweigend angenommenen Faktoren.
3. Leitung und Schutzgerät getrennt suchen und **Leitung und Schutzgerät vergleichen** wählen. Verglichen werden höchstens 40 Leitungen × 40 Schutzgeräte, mit bis zu 24 angezeigten Kombinationen. Eine Begrenzung wird angezeigt; die Suche kann eingegrenzt werden.
4. Der Vergleich prüft Spannungsfall, Überlastbedingungen und die zusätzlich beauftragten Prüfungen sowie Stromart, Bemessungsspannung, Polzahl und verfügbare Aderzahl. Angezeigte Tabellen-/Verlegebedingungen müssen zur Installation passen. Fehlende Daten bleiben als solche sichtbar. Die Reihenfolge bevorzugt erfüllte Rechenprüfungen, dann kleinere Querschnitte und Bemessungsströme; sie ist keine allgemeine wirtschaftliche oder normative Optimalitätsaussage.
5. **Kennwerte und Bedingungen übernehmen** übernimmt genau die gewählte Paarung in die Berechnung. Alte paarungsabhängige Selektivitätsbelege und Schutzgeräte-Energieangaben werden entfernt. Eine unvollständige Kombination kann zum Weiterbearbeiten übernommen werden; für einen Planvorschlag müssen die Rechenprüfungen erfüllt sein.
6. Optional einen Verbraucherartikel zuordnen und dessen Daten ausdrücklich übernehmen. **Neue Planseite als Autoconnect-Vorschau** erzeugt einen neuen Auslegungsdatensatz und eine neue A3-Querformatseite im Entwurf. Die erste Fassung unterstützt einphasige Steckdosen-/Motorabgänge und dreiphasige Motorabgänge. Ein Schutzgeräteartikel braucht ein hinterlegtes Bibliothekssymbol mit passender Polzahl. Ein Verbraucherartikel verwendet sein eigenes Symbol; ohne Artikel wird die ausdrücklich gewählte Verbrauchervorlage benutzt. Nicht unterstützte Anschlussbilder und DC-Planvorlagen werden verständlich abgewiesen.
7. Erst **Übernehmen** in der Layoutvorschau schreibt Planseite, Geräteartikel und Berechnung gemeinsam als rückgängig machbare Projektänderung. Änderungen am Projekt seit der Vorschau sperren die Übernahme. Alle vorgeschlagenen Verbindungen müssen durch den Autoconnect-Prüfer bestätigt sein; geroutete Restverbindungen sperren den Vorschlag.

Die Versorgung wird über Abbruchstellen dargestellt. L/N/PE beziehungsweise L1/L2/L3/PE werden getrennt aufgebaut; die Vorlage setzt keine zusätzlich vorhandene FI- oder vorgeschaltete Schutzeinrichtung als nachgewiesen voraus. Der Schutzgeräteartikel und ein gewählter Verbraucherartikel werden ihren tatsächlichen Symbolen zugeordnet. Der Kabelartikel bleibt im Auslegungsdatensatz; daraus wird derzeit keine zusätzliche Kabeldefinition oder Kabel-Stücklistenposition erzeugt. Reale Leitungslänge wird nicht auf geometrische Teilstücke vervielfacht. Symbolanschlüsse, berechnete Werte und erforderliche zusätzliche Schutzmaßnahmen bleiben prüfbar.

### Artikelauswahl und gezielter Vergleich

Die Rollen Leitung, Schutzgerät und Verbraucher besitzen eigene Auswahlkarten. **Artikel auswählen / wechseln** öffnet eine Suche mit Hersteller-, Projekt- und Kennwertfilter. Hersteller, Artikelnummer und Variante werden getrennt angezeigt. Die Detailansicht zeigt die tatsächlich hinterlegten Kennwerte, Quelle, Geltungsbedingungen und das Plansymbol. **Artikel / Kennwerte bearbeiten** öffnet den Artikelkatalog; gespeicherte lokale Änderungen erscheinen danach auch in der geöffneten Auswahl.

Bekannte andere Artikelfunktionen werden aus der jeweiligen Rolle ausgefiltert. Abweichende Stromarten, unzureichende Bemessungsspannung, Ader- oder Polzahl werden ausgewiesen; über **Auch abweichende Artikel zeigen** lassen sie sich ansehen, aber nicht übernehmen. Artikel ohne Kennwerte bleiben für die manuelle Bearbeitung auswählbar. **Grunddaten passen** bedeutet einen passenden Datenbestand für diese Rolle, nicht eine vollständige Stromkreis- oder Installationsprüfung.

**Nur Artikel auswählen** ordnet die Identität zu. **Artikel und Kennwerte übernehmen** kopiert die dokumentierten Werte ausdrücklich in die Berechnung. Bei Verbrauchern wird passend zu den vorhandenen Daten auf Betriebsstrom oder Leistungsangabe umgestellt; fehlende Werte werden nicht erfunden. Erweiterte Projektgerätebindungen und manuelle Kennwertquellen bleiben unter **Zuordnung und Kennwerte bearbeiten** erreichbar.

Standardmäßig hält der Vergleich bereits ausgewählte Leitungs- und Schutzgeräteartikel anhand ihrer exakten Identität fest, einschließlich Hersteller und Variante. **Ausgewählte Leitung und Schutzgerät beim Vergleich festhalten** ausschalten, um Alternativen zu vergleichen. Die zusätzlichen Suchfelder grenzen dann die nicht festgelegten Rollen ein. Eine festgelegte Auswahl wird auch berücksichtigt, wenn sie außerhalb der sonst auf 40 Artikel je Rolle begrenzten Katalogmenge liegt. Bei einem Artikelwechsel werden veraltete Gerätebindungen und paarungsabhängige Nachweise verworfen; Projektgeräte und Stückliste werden dadurch nicht automatisch geändert.

## Grafische Schutzkoordination

**Schutzkoordination** in der linken Leiste öffnet den gemeinsamen Zeit-Strom-Vergleich für das nachgeschaltete und das vorgeschaltete Schutzgerät. Die Ansicht verwendet die Artikelsnapshots des aktuellen Stromkreises. Über **Artikel / Kennwerte auswählen** können beide Rollen gewählt oder im Katalog bearbeitet werden.

Im Artikelkatalog werden Kennlinien jetzt als Tabelle mit Strom [A], minimaler Zeit [s] und maximaler Zeit [s] erfasst. Zeilen lassen sich hinzufügen, entfernen und ausdrücklich nach Strom sortieren; die JSON-Bearbeitung bleibt unter der erweiterten Ansicht verfügbar. Die Kennlinienart muss ausdrücklich festgelegt werden. Nur **Überstrom · Leiterstrom** wird gemeinsam dargestellt. Differenzstromkennlinien und ältere Punkte ohne Kennlinienart bleiben erhalten und werden mit einem Hinweis aus dem Überstromvergleich ausgeschlossen.

Beide Achsen sind logarithmisch. Die Ansicht zeigt die unteren und oberen Zeitgrenzen aus den Herstellerstützpunkten und verbindet sie ausschließlich als Lesehilfe. Beim Anklicken oder Auswählen eines Stromwerts werden nur tatsächlich hinterlegte Stützpunkte angezeigt. Es gibt kein rechnerisches Interpolieren, Extrapolieren oder Ableiten einer Herstellerkennlinie aus einer Bezeichnung wie B/C/D. Zoom und Verschieben innerhalb des Diagramms erleichtern das Ablesen auch auf kleinen Bildschirmen.

Betriebsstrom, belegte Fehlerstromwerte, geforderte Abschaltzeit und eine ausdrücklich erfasste Hersteller-Selektivitätsgrenze können als Markierungen erscheinen. Eine optische Trennung oder Überlagerung der Kennlinien erzeugt keinen Abschalt-, Selektivitäts- oder Backup-Nachweis. Quellen, Geltungsbedingungen, fehlende Daten und Unterschiede zur Berechnung bleiben daneben sichtbar. Der vorhandene parametergestützte Selektivitätsvergleich bleibt eine getrennte Prüfung des eingegebenen Paarbelegs.

Die Ansicht ändert weder Projekt noch elektrische Nachweise. Ihr JSON-/CSV-/PDF-Export dokumentiert die dargestellten Daten; nicht übernommene Dialogeingaben sind als Vorschau gekennzeichnet. PDF enthält das Vektordiagramm sowie einen vollständigen Kennlinienbericht mit Quellen, Bedingungen und sämtlichen dargestellten Punkten. Der gemeinsame Projekt-PDF-Export bietet gespeicherte Kennlinienvergleiche separat zur Auswahl an. Diagramm und Bericht verwenden A3/A4 im Querformat und den Projektplankopf.
