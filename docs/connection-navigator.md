# Verbindungsliste und Verdrahtungsnavigator

Unter **Projekt → Verbindungsliste / Verdrahtungsnavigator…** stehen die Verbindungen aller Projektseiten zur Verfügung. Das Öffnen, Filtern und Exportieren verändert das Projekt nicht.

Die Tabelle zeigt Blatt, Verbindungsnummer bzw. Kennung, Verbindungsart, Quelle, Ziel, Potenzial, Farbe, Querschnitt, Kabel, Ader, ausdrücklich erfasste reale Länge in Millimetern und Hinweise. Quelle und Ziel entsprechen den gespeicherten Anschluss-Endpunkten; sie behaupten keine Stromflussrichtung. Strukturkennzeichen und benutzerdefinierte Anschlussbezeichnungen werden berücksichtigt.

## Auswahl und Navigation

Die Suche kombiniert mehrere Suchwörter. Der Blattfilter berücksichtigt bei logischen Verbindungen auch die Blätter ihrer Endpunkte. **Nur mit Hinweisen** grenzt unauflösbare Anschlüsse und Netze, doppelte Verbindungskennungen sowie widersprüchliche Aderdaten ein. Die Tabelle zeigt jeweils höchstens 100 Zeilen; die gesamte gefilterte Liste bleibt über die Blätter erreichbar.

**Details** zeigt die zusätzlichen Teilnehmer des elektrischen Netzes und bietet **Zur Quelle**, **Zum Ziel** und **Zur Verbindung**. Bei einem Sprung schließt sich der Dialog und der Editor zeigt die Fundstelle. Eine logische Verbindung ohne gezeichnete Leitung bietet nur die auflösbaren Anschlussziele an.

**Aktualisieren** liest den aktuellen Projektstand neu ein. Suche und Filter rechnen auf der eingelesenen Liste und bauen nicht bei jedem Tastendruck das gesamte elektrische Modell neu auf.

## Elektrische Grundlage

Der Navigator verwendet denselben `ProjectIndex` und `ElectricalNetService` wie Prüflauf und Klemmenauswertung. Gleiche Potenzialnamen und kreuzende Zeichnungslinien verbinden keine getrennten Netze. Eine verzweigte Netzstruktur wird nicht in zusätzliche paarweise Verdrahtungen umgedeutet.

Eine Zeile entspricht einer erfassten gezeichneten oder logischen Verbindung, einschließlich Autoconnect und ausdrücklicher Klemmenbrücken. Verbindungselemente können einen Leiter in mehrere Abschnitte teilen. Zeilenzahl und Längensumme sind deshalb keine automatisch bestätigte Anzahl oder Gesamtlänge tatsächlich zu fertigender Drähte. Auflösbare Netzteilnehmer erscheinen ergänzend in den Details.

Kabel-/Aderdaten werden aus ausdrücklichen Leitungszuordnungen übernommen. Mehrere Zuordnungen bleiben sichtbar und erzeugen einen Hinweis. Bei eindeutiger Zuordnung ergänzen Aderfarbe und Ader-/Kabelquerschnitt fehlende Leitungsattribute. Widersprüchliche vorhandene Attribute werden nicht überschrieben. Nicht erfasste Werte erscheinen als Strich, nicht als geschätzte Daten.

## Reale Länge

In den Details kann eine bekannte physische Leiterlänge in **mm** gespeichert oder durch Leeren des Felds wieder entfernt werden. Die Eingabe ist unabhängig von Positionen, Leitungswegen und Zeichnungsmaßstab. Negative und nicht endliche Werte werden abgelehnt. Zwischenzeitliche Projektänderungen verlangen zuerst eine Aktualisierung; eine veraltete Eingabe überschreibt keine neueren Daten.

Jede Übernahme unterstützt Rückgängig/Wiederholen. Die optionale Eigenschaft `Wire.lengthMm` wird mit der Projektdatei gespeichert. Bestehende Projekte benötigen keine Migration.

## Export

**CSV: gefilterte Liste** und **PDF: gefilterte Liste** exportieren alle passenden Treffer, auch außerhalb der gerade sichtbaren Tabellenzeilen. CSV verwendet UTF-8 mit BOM, Semikolon und zitierte Felder; potenziell als Tabellenformel interpretierbare Anfangszeichen werden als Text geschützt. PDF verwendet A3 quer mit umbrochenen Zellen und wiederholten Überschriften auf Folgeseiten. Lange Zeilen werden über Seiten fortgesetzt.

Diese Exporte ergänzen die vorhandenen Klemmen-, Kabel-/Ader- und Brückenlisten.
