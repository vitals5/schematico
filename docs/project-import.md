# Native Projektsicherungen importieren

Der Import erkennt die Komprimierung anhand der Dateisignatur. Native `.zw1`-Sicherungen können ZIP- oder 7z-komprimiert sein. Die normale Dateiauswahl führt beide Varianten in denselben Datenbankimporter. Ein zur Übermittlung verwendetes äußeres Archiv muss dafür nicht importiert werden.

## Versionsabhängige Tabellengrößen

Die Datensatzlänge wird bei bekannten nativen Indexköpfen aus der zugehörigen `.eox`-Datei gelesen. Die bisher festgelegten Längen bleiben als Rückfall für ältere Indexvarianten erhalten. Projekttabellen verwenden einen fünf Byte langen Abschluss, eingebettete Symboltabellen einen ein Byte langen Abschluss. Eine angelegte, leere Tabelle mit einem einzelnen Nullbyte wird nur bei einem passenden Indexkopf und einem gespeicherten Datensatzzähler von null als leer behandelt.

Die Erkennung verwendet keine geratenen Dateiteiler. Der gesamte Datenteil muss zur deklarierten Länge passen. Aufgenommene Datensätze müssen weiterhin über Indexzeile, Objektkennung und Typ mit ihrem tatsächlichen Nutzdatenkopf übereinstimmen. Gelöschte oder lediglich im Datenbereich gefundene Datensätze werden nicht wiederhergestellt. Unvollständige komprimierte Daten bleiben ausdrücklich als Präfix gekennzeichnet.

Seiten, Funktionen, Anschluss-/Potenzialobjekte, Grafikinstanzen und Verbindungen verwenden denselben Leser wie eingebettete Symbolbibliotheken und Artikelquellen. Nicht lesbare optionale Artikel- oder Formularressourcen werden nicht durch erfundene Daten ersetzt. Der Import öffnet bevorzugt eine Stromlaufplanseite mit Inhalt, damit eine leere Auswertungsseite am Projektanfang nicht den Eindruck eines fehlgeschlagenen Imports erzeugt.

Der Import vorhandener 2D-Schaltzeichen und Leitungen bedeutet keine vollständige Rekonstruktion nativer 3D-Aufbauten oder automatisch erzeugter Auswertungsformulare. Solche Ressourcen benötigen eigene unterstützte Datenmodelle; fehlende Inhalte werden nicht aus dem Namen einer Seite abgeleitet.

## Prüfen

`npm test` enthält synthetische Tests für wechselnde Kapazitäten, beide Abschlussvarianten, leere Tabellen, komprimierte und unkomprimierte Daten, gelöschte Zeilen sowie widersprüchliche und beschädigte Eingaben. `SCHEMATICO_BACKUP_FIXTURE=/absoluter/pfad/projekt.zw1 npx tsx src/packages/ProjectArchive.test.ts` prüft zusätzlich einen extern bereitgestellten Import einschließlich Bibliothekszuordnungen und Leitungsanschlüssen. Private oder fremde Projektarchive werden nicht im Repository mitgeliefert.
