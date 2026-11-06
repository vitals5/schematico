# Artikelwerkzeug und lokale Stammdaten

Unter **Projekt → Artikel und Betriebsmittel…** stehen Artikelbearbeitung, Katalog und Gerätezuordnung gemeinsam zur Verfügung. Das Werkzeug ist außerdem über **Eigenschaften → Artikel → Übernehmen und Artikel verwalten…** erreichbar. Dieser Eigenschaften-Befehl übernimmt zuerst die dortigen Änderungen. Im Prüfbericht öffnen die Artikelaktionen die betroffenen Objekte direkt oder übernehmen die Auswahl aus den aktuell gefilterten Artikelbefunden einschließlich ihrer zugehörigen Fundstellen.

## Mehrteilige Zuordnungen bearbeiten

1. Objekte über Suchtext, Seitenangabe oder BMK auswählen. Die Auswahl bleibt über die Anzeigeseiten hinweg erhalten. **Sichtbare Einträge auswählen** wählt die angezeigten maximal 50 Zeilen aus.
2. Bei einem einzelnen Objekt dessen aktuelle Zuordnung oder ursprüngliche Quellliste laden. Alternativ eine eigene Liste anlegen oder Artikel aus dem Katalog hinzufügen.
3. Artikelnummer, Hersteller, Variante, Menge und Rolle bearbeiten. Es ist höchstens ein Hauptartikel erlaubt; weitere Positionen können Zubehör sein. Mengen sind nicht negativ; `?` bedeutet unbekannt und `0` bleibt ausdrücklich null.
4. **Vorschau berechnen** zeigt für jedes ausgewählte Objekt die vollständige bisherige und künftige Zuordnung sowie die verfügbare Kompatibilitätsprüfung. Bei vorhandenen abweichenden Zuordnungen ist das Ersetzen ausdrücklich in der Vorschau zu bestätigen.
5. **Vorschau übernehmen** übernimmt die gesamte Änderung als einen Rückgängig-Schritt. Zeichnung, Anschlusskoordinaten, Leitungen und Symbolbibliothek werden nicht verändert. Ein inzwischen bearbeitetes Projekt blockiert die Übernahme.

Eine leere manuelle Liste entfernt die aktive Zuordnung. Die ursprünglichen Felder `articleReferences` und `articleImport` bleiben als Quellnachweis erhalten. Manuelle Listen liegen separat unter `articleAssignment`. Katalogeinträge werden als `snapshot` der verwendeten Position gespeichert: Die Projektdatei ist ohne Zugriff auf den lokalen Katalog auswertbar. Spätere Änderungen oder Löschungen im lokalen Katalog ändern diese Projekt-Snapshots nicht. Für eine Aktualisierung ist ein Artikel erneut auszuwählen und die Vorschau zu übernehmen.

Änderungen am bisherigen einzelnen Artikel-/Herstellerfeld haben Vorrang vor einer nicht mehr passenden manuellen Liste. In diesem Fall wird nur die neue einzelne Zuordnung verwendet; eine Leerung aktiviert keine alten Zubehörpositionen. Zum vollständigen Bearbeiten der Liste dient das Artikelwerkzeug. Ein Originalquellen-Abgleich überschreibt keine manuelle Liste.

## Lokaler Katalog

Der Katalog liegt in **IndexedDB**, Datenbank `schematico-articles`, im aktuellen Browserprofil und Ursprung. Die Webversion besitzt dadurch keinen gemeinsamen Serverkatalog. Browserwechsel, ein anderer Ursprung und das Löschen der Websitedaten betreffen diesen Speicher. Die Desktopversion verwendet den Speicher ihres Anwendungsprofils. Für Übertragung und Sicherung dienen die Exportdateien.

- Eigene Artikel lassen sich anlegen, bearbeiten und löschen. **Speichern vorbereiten** und die anschließende Vorschau zeigen neue und abweichende Einträge vor dem Schreiben.
- **Projektartikel übernehmen** liest eingebettete Stammsätze und aktuell verwendete Zuordnungen. Die im Programm enthaltene kleine Startliste ist zusätzlich auswählbar; ihre Funktionsdaten werden nicht als geprüft ausgegeben.
- CSV und JSON können importiert und exportiert werden. Der exakte Schlüssel besteht aus Hersteller, Artikelnummer und Variante. Nummern bleiben Zeichenfolgen, auch mit führenden Nullen. Unterschiedliche Varianten werden nicht zusammengelegt.
- Änderungen und Importe verwenden eine gemeinsame Schreibtransaktion. Hat sich der Katalog seit der Vorschau geändert, ist neu zu laden. Konflikte und Speicherfehler bestätigen keinen erfolgreichen Speichervorgang.
- Eine Änderung des Schlüssels legt einen neuen Artikel an; ein bisheriger Eintrag kann anschließend getrennt entfernt werden.

CSV-Dateien verwenden die Spalten `articleNumber`, `manufacturer`, `variant`, `description` und optional `functions`. Semikolon und Komma als Trenner, zitierte Felder, doppelte Anführungszeichen und Zeilenumbrüche in Beschreibungen werden unterstützt. `functions` enthält bei Bedarf ein zitiertes JSON-Array. JSON verwendet `{ "schema": "schematico-articles", "version": 1, "articles": [...] }`. Importierte Prüfbehauptungen werden auf **ungeprüft** zurückgesetzt. Bereits verwendete Projekt-Snapshots bleiben unverändert.

## Artikelkompatibilität

Eine Spezifikation kann mehrere einzeln benannte Gerätefunktionen enthalten, beispielsweise:

```json
[
  { "id": "coil", "type": "relay_coil", "pins": ["A1", "A2"] },
  { "id": "aux1", "type": "contact_no", "pins": ["13", "14"] }
]
```

Im Artikelwerkzeug können **Funktionsplatz im Artikel** und **dargestellter Funktionstyp** für ausgewählte Darstellungen festgelegt werden. Bibliotheken können den tatsächlichen Typ über `SymbolDefinition.functionDefinition` vorgeben. Allgemeine Katalogfamilien allein gelten nicht als präzise Funktionsdefinition. Unbekannte native Funktionen werden nicht aus ihrer Grafik erraten.

Die Prüfung vergleicht die dargestellte Funktion mit dem zugeordneten Funktionsplatz, die Anschlusszahl und die tatsächlichen Anschlussbezeichnungen einschließlich benutzerdefinierter Anschlussnamen. Mehrdeutige Funktionsplätze, fehlende Spezifikationen, unbekannte Bibliotheksfunktionen und ungeprüfte Daten bleiben als **nicht nachweisbar** erkennbar. Abweichende Anschlusszahlen, Namen, Typen oder ausdrücklich nicht vorhandene Funktionsplätze werden als Widerspruch gemeldet. Unbenutzte Funktionen des Artikels dürfen als Reserve bestehen bleiben. Zubehör ohne eigene Funktionszuordnung wird nicht als elektrisch geprüft behauptet.

Die Regeln `article_incompatible`, `article_spec_unknown` und `invalid_article_assignment` erscheinen auch im gemeinsamen Prüfbericht und in dessen KI-/Import-Abfragen. **Selbst geprüft** bestätigt die eigene Datenerfassung, keine Herstellerfreigabe oder Normenkonformität. Die Prüfung ist keine Bemessung von Strom, Spannung, Schutzwirkung oder Sicherheit.

## Physische Betriebsmittel und Stückliste

Gleiche BMK, gleiche Artikelnummern und gleiche grafische Gruppen beweisen keine gemeinsame physische Identität. Deshalb bleibt die bisherige Zählung bestehen, bis der Benutzer die Darstellungen ausdrücklich als ein Betriebsmittel verknüpft.

Im Abschnitt **Ein physisches Betriebsmittel aus mehreren Darstellungen**:

1. Die zugehörigen Darstellungen auswählen, auch über mehrere Seiten hinweg.
2. Die Hauptdarstellung bestimmen. Anlage, Einbauort und BMK müssen vollständig übereinstimmen; leere BMK und mehrfach verwendete Objektkennungen sind nicht zulässig.
3. Abweichende aktive Artikel auf Nebendarstellungen zuerst klären. Die vollständige Liste liegt auf der Hauptdarstellung; Nebenlisten müssen leer oder semantisch identisch sein.
4. Vorschau prüfen, die selbst geprüfte Geräteidentität bestätigen und übernehmen.

Gespeichert wird eine ausdrückliche `physicalDevices`-Zuordnung mit Hauptdarstellung und adressierten Mitgliedern. Die Stückliste zählt ihre Artikel einschließlich Zubehör und Mengen einmal auf der Hauptdarstellung (`quantityBasis: verified_device`). Ohne bestätigte Zuordnung bleiben die Grundlagen `placement`, `source_function` beziehungsweise `manual_assignment` sichtbar im Datenmodell. Mehrere tatsächliche Geräte mit gleicher Artikelnummer werden weiterhin aufsummiert; Varianten bleiben getrennt. Die PDF-Stückliste verwendet dieselbe Berechnung.

Artikeländerungen dürfen bestätigte Gerätezuordnungen nicht unbemerkt ungültig machen. Bei Konflikten sind Haupt-/Nebendarstellungen gemeinsam zu bearbeiten oder die Verknüpfung zunächst aufzulösen. **Verknüpfungen der Auswahl auflösen** entfernt die vollständigen betroffenen Geräteverknüpfungen als einen rückgängig machbaren Schritt.

Fehlende Mitglieder, doppelte Mitgliedschaften, geänderte Kennzeichnungskontexte oder abweichende Nebenartikel machen eine gespeicherte Zuordnung ungültig. Der Prüflauf meldet dies mit `invalid_physical_device`; eine ungültige Zuordnung wird nicht für die Geräte-Zusammenfassung verwendet. Betroffene Stücklistenmengen erhalten `~` als Kennzeichnung einer vorläufigen Platzierungssumme, beispielsweise `~2x`; das ist keine bestätigte physische Geräteanzahl.

Ein gemeinsamer Katalogserver mit Anmeldung, Teamrechten und Synchronisation ist ein separater Ausbau. Die fünf beschriebenen Funktionen arbeiten lokal und ohne diesen Server.
