# Klemmenleisten-Konfigurator

Unter **Projekt → Klemmen und Kabel → Klemmen → Leiste konfigurieren** oder über **Daten & Berichte → Klemmenleisten-Konfigurator** wird die physische Bestückung einer vorhandenen Leiste bearbeitet. Anlage, Ort und Leistenkennzeichen bilden gemeinsam ihre Identität. Gleiche sichtbare Kennzeichen in unterschiedlichen Strukturkontexten bleiben getrennt.

## Bestand übernehmen und anordnen

**Bestückung aus Bestand übernehmen** erzeugt zunächst eine Vorschau. Nach **Übernehmen** sind stabile Bestückungspositionen in der Projektdatei gespeichert. Vorhandene bestätigte Geräte werden als vollständige Einheit übernommen, soweit sie vollständig zu dieser Klemmenleiste gehören. Aus gleichen Nummern oder benachbarten Symbolen entsteht keine automatische Gerätezuordnung.

Positionen lassen sich über die Pfeilschaltflächen oder den Griff ziehen. Die Änderung wird zuerst als Vorschau gezeigt. **Übernehmen** speichert; **Vorschau verwerfen** stellt den Ausgangsstand wieder dar. Die Reihenfolge gilt für die Bestückung sowie den Klemmenbericht und dessen PDF-/CSV-Ausgabe. Sie verändert keine Zeichnungskoordinaten, Anschlüsse oder Leitungen. Die grafische Übersicht zeigt die Bestückungsnummer zusätzlich an.

Die Bestückung ist unabhängig von der Nummerierung: Eine verschobene Klemme behält ihr BMK und ihre Anschlussbezeichnungen. Nachträglich in der Zeichnung angelegte Klemmen erscheinen im normalen Klemmenbericht hinter den konfigurierten Positionen. Sie werden durch Zurücksetzen und erneute Bestandsübernahme in die Bestückung aufgenommen. Der Konfigurator zeigt 24 Positionen pro Seite; Suche und Seitennavigation erschließen den vollständigen Bestand.

## Etagen zusammenfassen

Mindestens zwei Klemmenpositionen auswählen, die physisch denselben mehrstöckigen Artikel darstellen. Für jede enthaltene Darstellung wird eine eindeutige Etagenbezeichnung vorgeschlagen und vor der Übernahme angezeigt. Elektrische Nummern müssen vorhanden sein. Andere vorhandene Artikelzuordnungen müssen vorab geklärt werden; widersprüchliche Artikel werden nicht still verworfen.

Die Übernahme bestätigt ausdrücklich **ein physisches Gerät** mit mehreren Darstellungen. Auch unterschiedliche Klemmennummern dürfen dazugehören, solange Leiste, Anlage und Ort übereinstimmen. Jede Etage behält ihre eigenen Bibliotheksanschlüsse und elektrischen Netze. Es werden keine Etagen miteinander elektrisch verbunden.

Die vorhandene Betriebsmittelverwaltung zählt den gemeinsamen Artikel und sein zugeordnetes Zubehör einmal in der Stückliste. Die Vorschau zeigt die tatsächlichen Mengenänderungen. Der vollständige Änderungsbericht lässt sich als JSON herunterladen; lange Tabellen werden auf dem Bildschirm auf 50 Zeilen begrenzt. Die Artikel der ursprünglichen Platzierungen bleiben erhalten; es wird keine Herstellerkompatibilität aus einer Gruppierung abgeleitet. **Etagen vereinzeln** löst diese Gerätezuordnung und erzeugt einzelne Bestückungspositionen. Danach werden deren Artikel wieder unabhängig gezählt.

Zeichnungsgruppen besitzen eine eigene Artikelhoheit. Eine dort enthaltene Klemme kann erst nach Klärung dieser Gruppenartikel oder Auflösen der Zeichnungsgruppe neu als physische Etagenklemme zusammengefasst werden.

## Artikel und Zubehör

**Artikel & Zubehör bearbeiten** öffnet denselben Artikel- und Betriebsmitteldialog wie bei sonstigen Elementen, mit Katalog, Hauptartikel, Zubehör, Mengen, Quellnachweisen, Vorschau und Übernahme. Bei einer bestätigten Etagenklemme sind sämtliche Darstellungen gemeinsam ausgewählt und die aktuelle Artikelliste ist geladen. Abweichende Änderungen an nur einer Nebendarstellung werden weiterhin abgefangen.

**Zubehörposition hinzufügen** ergänzt eigenständige physische Zubehörpositionen, beispielsweise Endhalter, Endplatten, Trennplatten, Markierer oder Brückenkämme. Artikel können aus dem vorhandenen Katalog gewählt oder manuell erfasst werden. Eine positive ganzzahlige Menge ist erforderlich. Gespeicherte Katalog-Snapshots behalten ihren Prüfstatus. Diese Positionen erscheinen in der Stückliste und in der Bestückungs-CSV; sie erzeugen keine zusätzliche Platzierung auf der Zeichnung.

Ein als Zubehör erfasster Brückenkamm erzeugt keine elektrische Verbindung. Elektrische Steck-/Drahtbrücken werden weiterhin über die geprüfte Brückenfunktion des Klemmenwerkzeugs angelegt. Eine herstellerspezifische mechanische Kompatibilitäts-, Breiten- oder Stromtragfähigkeitsprüfung ist nicht enthalten.

## Berichte und Prüfung

**Bestückung als CSV exportieren** enthält die geordnete Bestückung mit Positionen, Darstellungen, Etagen und Artikeldaten. Die drei bisherigen Fertigungslisten bleiben verfügbar. Die Klemmenberichte listen elektrische Klemmen in konfigurierter Reihenfolge; Zubehör wird in der Stückliste und im gesonderten Bestückungsexport aufgeführt.

Fehlende Klemmen, mehrfache Positions-/Mitgliedszuordnungen, Strukturwechsel und ungültige Gerätezuordnungen werden unter `terminal_strip_configuration` geprüft. Eine ungültige Etagenzuordnung darf keine Platzierung aus der Stückliste unterdrücken. Ein Wechsel der Klemmenleiste wird bei konfigurierten Klemmen abgefangen; vorher muss die Bestückung ausdrücklich aufgelöst werden.

**Bestückung zurücksetzen** entfernt diese Konfiguration, ihre neu angelegten Gerätezuordnungen und die zugehörigen Zubehörpositionen. Bereits vor der Bestandsübernahme bestätigte Geräte bleiben erhalten, solange ihre gemeinsame Kennzeichnung weiterhin gültig ist. Zeichnungselemente, Leitungen und Artikel an den Platzierungen bleiben erhalten. Die Vorschau zeigt die Mengenänderungen, bevor gespeichert wird. Dies ist auch ein Weg, veraltete Verweise nach manuellen Löschungen zu bereinigen.

Alle übernommenen Änderungen unterstützen Rückgängig/Wiederholen. Ein zwischenzeitlich geänderter Projektstand wird nicht überschrieben; **Aktualisieren** liest ihn neu ein und verwirft offene Vorschauen. Die Daten liegen unter `Project.terminalStrips`; bestätigte Etagen-Geräte verwenden `physicalDevices` mit einem geprüften Verweis auf ihre Bestückungsposition. Ältere Projekte ohne Bestückungsdaten behalten ihre bisherige Berichtsreihenfolge und benötigen keine Migration.
