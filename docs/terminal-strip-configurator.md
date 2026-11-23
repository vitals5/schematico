# Klemmenleisten konfigurieren

Die bisher getrennten Dialoge für Bestückung, Etagen und Teilklemmen sind im **[Klemmeneditor](terminal-editor.md)** zusammengeführt. Öffnen über **Projekt → Klemmeneditor…** oder über die Eigenschaften einer Klemme.

Im Register **Aufbau** werden Gerätepositionen, Reihenfolge, Haupt-/Nebenklemmen, Mehrstockklemmen und eigenständige Zubehörpositionen bearbeitet. **Artikel** enthält die gemeinsame Artikel- und Funktionszuordnung. **Brücken** verwaltet die ausdrücklichen elektrischen Verbindungen. Alle Register verwenden denselben Entwurf mit gemeinsamer Prüfung, Übernahme und Rückgängig-Funktion.

Bestehende Daten unter `Project.terminalStrips`, `physicalDevices` und `distributedTerminalFunctions` werden weiterverwendet. Es ist keine Migration notwendig. Gleiche Kennzeichen und benachbarte Symbole erzeugen keine automatische Geräte- oder elektrische Zuordnung. Ältere Projekte ohne Bestückungsdaten bleiben beim Öffnen unverändert; die Bestückung wird erst mit einer vorgemerkten Aufbauoperation angelegt.

Die [Bedienungsanleitung](terminal-editor.md) beschreibt die einzelnen Arbeitsschritte, Grenzen und Exporte.
