# Elemente gruppieren

Mehrere Elemente mit einem Auswahlfenster oder mit **Strg + Klick** markieren. Über **Bearbeiten → Gruppieren**, das Kontextmenü oder **Strg+G** entsteht eine dauerhafte Gruppe.

Ein Klick auf ein Mitglied wählt die ganze Gruppe aus. Beim Ziehen bleiben die Abstände erhalten. Innere Leitungsstützpunkte bewegen sich mit den Bauteilen; Verbindungen nach außen bleiben an den Anschlüssen. Gruppen lassen sich auch per Touch verschieben. Gemeinsame Eigenschaften, etwa BMK- und Verweisschriftgrößen, werden weiterhin über die Mehrfachauswahl bearbeitet.

**Bearbeiten → Gruppierung auflösen**, das Kontextmenü oder **Strg+Umschalt+G** löst die ausgewählten äußeren Gruppen auf. Die Elemente bleiben an ihrer Position und behalten ihre Eigenschaften. Bei verschachtelten Gruppen bleiben die inneren Gruppen erhalten. Auf eine freie Stelle klicken oder **Esc** drücken, um anschließend einzelne Elemente oder innere Gruppen auszuwählen. Strg + Klick nimmt eine ganze Gruppe in die Auswahl auf oder entfernt sie daraus.

Symbole, Gerätekästen, freie Texte, Bilder, Kabeldefinitionen und Strukturkästen können gemeinsam gruppiert werden. Die Gruppe ist eine Zuordnung zu den vorhandenen Objekten; es entsteht kein Bild und kein Ersatzsymbol. Gruppieren, Auflösen, Verschieben und Löschen unterstützen **Rückgängig/Wiederholen**. Gruppen bleiben beim Speichern und erneuten Öffnen sowie in den eigenen Projektarchiven und Makros erhalten. Bei erneutem Einfügen eines Makros entstehen unabhängige Gruppen.

## Import

Beim erneuten Import des Beispielarchivs werden **129 Gruppen** mit vorhandenen bearbeitbaren Mitgliedern übernommen, darunter **16 auf Einspeisung** und **17 auf Server**. Verschachtelte Gruppen bleiben erhalten. Maßgeblich sind die ausdrücklich gespeicherten Elternverweise, nicht gemeinsame BMK oder die Lage innerhalb eines Rahmens. Auch XML-Makros übernehmen gespeicherte Gruppen; deren Grafikmitglieder bleiben einzeln bearbeitbar, sobald die Gruppe aufgelöst wurde.

Bereits früher in der App gespeicherte Projekte enthalten diese bisher nicht importierten Gruppenzuordnungen noch nicht. Das Originalarchiv neu importieren, um sie zu übernehmen. Nicht unterstützte Quellgrafiken werden durch die Gruppierfunktion nicht zusätzlich rekonstruiert. Die App exportiert ihre eigenen bearbeitbaren Projektdaten; ein Rückschreiben der proprietären Quelldatenbank wird damit nicht zugesagt.
