# Optionaler Teamkatalog

Der Teamkatalog ist ein separat startbarer Dienst für einen gemeinsamen Artikelbestand. Er verwendet dieselbe Datensatzprüfung wie die Anwendung und benötigt **Node.js ab 22.13**. SQLite ist Bestandteil dieser Node-Version; zusätzliche Pakete und `npm install` sind für den Dienst nicht erforderlich. Pro Dienstinstanz gibt es einen Teamkatalog mit einer eigenen Datenbank und Benutzerliste.

## Einrichten

Im Repository beziehungsweise entpackten Dienstpaket:

```sh
node server/catalog-admin.mjs /persist/schematico-catalog
SCHEMATICO_CATALOG_CONFIG=/persist/schematico-catalog/config.json node server/catalog.mjs
```

Der Einrichtungsbefehl erzeugt Konfiguration und persönlichen Admin-Zugangsschlüssel als Dateien mit Berechtigung `600` im gewählten Ordner. Er gibt den Schlüssel nicht aus. Der Ordner liegt außerhalb des Repositorys und muss für einen dauerhaft erhaltenen Bestand auf persistentem Speicher liegen. Der Schlüssel steht in `admin-token.txt`; für die Anwendung wird dessen Inhalt verwendet. Die Konfiguration enthält nur den SHA-256-Hash des Schlüssels.

Weitere persönliche Zugänge mit unterschiedlichen Rechten:

```sh
node server/catalog-admin.mjs /persist/schematico-catalog anna reader
node server/catalog-admin.mjs /persist/schematico-catalog ben editor
```

Anschließend den Dienst neu starten. `reader` darf Daten, frühere Stände und Verlauf lesen; `editor` und `admin` dürfen zusätzlich neue Katalogversionen schreiben. Benutzer werden über die private Konfigurationsdatei verwaltet; der Dienst stellt keinen öffentlichen Benutzerverwaltungs-Endpunkt bereit. Jeder Benutzer besitzt einen eigenen Schlüssel und erscheint mit seiner Kennung im Änderungsverlauf. Das Entfernen eines Benutzers aus der Konfiguration mit anschließendem Neustart entzieht dessen Zugriff.

Der Standard ist `127.0.0.1:4785`. Für gemeinsame Nutzung wird der Dienst hinter einem HTTPS-Reverse-Proxy betrieben; Host und Port sind konfigurierbar. Der Proxy muss `/v1/` weiterleiten, `Authorization` und `If-Match` erhalten und die Inhaltsgröße auf höchstens 20 MiB begrenzen. Die Benutzeroberfläche akzeptiert unverschlüsseltes HTTP ausschließlich für Loopback-Adressen.

`allowedOrigins` nennt die ausdrücklich zugelassenen Web-Ursprünge, beispielsweise `https://vitals5.github.io`. Für eine Desktopinstallation kann deren Datei-Ursprung `null` zusätzlich erlaubt werden. Es gibt keine pauschale Freigabe für alle Ursprünge. Nichtbrowser-Clients benötigen ebenfalls einen gültigen Zugangsschlüssel.

Für automatischen Start ist der Prozess als Systemdienst mit einem eigenen Betriebssystembenutzer und `SCHEMATICO_CATALOG_CONFIG` als Pfadvariable zu betreiben. Konfiguration, Schlüsseldateien und SQLite-Bestand gehören in die Datensicherung. SQLite verwendet WAL und Transaktionen; zur Sicherung bei laufendem Dienst ist die SQLite-Backup-Funktion oder ein konsistenter Snapshot einschließlich WAL erforderlich. Die hier bereitgestellte Einrichtung veröffentlicht keinen Server und konfiguriert keine Domain oder Zertifikate.

## Synchronisation in der App

**Projekt → Artikel und Betriebsmittel… → Lokaler Artikelkatalog → Teamkatalog synchronisieren…**

1. Dienstadresse und persönlichen Zugangsschlüssel eingeben. Schlüssel bleiben im Arbeitsspeicher dieses Dialogs und werden beim Schließen verworfen. Sie werden weder in Projektdateien noch im Browser-Katalog oder den Synchronisationsmetadaten gespeichert.
2. **Verbinden und vergleichen** lädt den Serverstand, die Benutzerrolle und den Versionsverlauf. Der Vergleich verwendet den letzten gemeinsam bekannten Stand, den aktuellen lokalen Katalog und den aktuellen Serverbestand. Lokale und entfernte Löschungen sind Teil des Vergleichs.
3. Bei beidseitig abweichenden Änderungen ausdrücklich lokalen oder entfernten Stand wählen. Eine leere Seite der Vorschau bedeutet Löschung. Ohne Entscheidung aller Konflikte ist keine Übernahme möglich.
4. **Nur herunterladen** verhindert Änderungen am Server; für Leser ist diese Option verbindlich. Beibehaltene, noch nicht hochgeladene lokale Änderungen bleiben für einen späteren Vergleich erkennbar.
5. **Vorschau übernehmen** prüft die Serverversion erneut und schreibt bei Bedarf mit `If-Match`. Ein zwischenzeitlich geänderter Serverstand blockiert die Übernahme. Der lokale Bestand und sein Vergleichsstand werden gemeinsam in einer IndexedDB-Transaktion gespeichert.

Das Netz kann eine gemeinsame Transaktion über Server und Browser nicht garantieren. Sollte der Server eine Änderung speichern, während der lokale Katalog inzwischen geändert wurde oder nicht beschreibbar ist, meldet die Oberfläche ausdrücklich diesen Teilabschluss. Sie überschreibt den lokalen Bestand nicht; ein neuer Vergleich setzt die Bearbeitung fort.

Heruntergeladene Funktionsdaten sind zunächst lokal ungeprüft. Bereits selbst geprüfte, unveränderte lokale Daten behalten ihren Status. Diese getrennten Vergleichsstände verhindern künstliche Konflikte allein wegen des lokalen Prüfstatus. Änderungen am Katalog verändern weiterhin keine bereits im Projekt gespeicherten Artikel-Snapshots.

## API und Verlauf

Alle Endpunkte benötigen `Authorization: Bearer …`:

- `GET /v1/catalog`: Teamkennung, Benutzerrolle, Revision und aktueller Bestand.
- `PUT /v1/catalog`: neuer vollständiger Bestand mit `If-Match: <Revision>`; nur schreibberechtigte Benutzer. Ungültige Datensätze und doppelte Artikelidentitäten werden vollständig abgelehnt.
- `GET /v1/history`: die letzten 100 Revisionsmetadaten mit Autor und Zeitpunkt.
- `GET /v1/versions/<Revision>`: unveränderter früherer Bestand. Frühere Versionen werden bei einer neuen Revision nicht überschrieben. Im Versionsverlauf der App kann jeder Stand als importierbare Katalogdatei heruntergeladen werden.

Die erste Revision ist `0`. Jede erfolgreiche Änderung erzeugt eine neue Revision in derselben SQLite-Transaktion. Vergangene Stände bleiben lesbar, auch wenn Artikel später gelöscht werden. Eine Wiederherstellung erfolgt durch bewusstes Übernehmen eines früheren Bestands als neue Revision; bestehende Revisionen werden nicht zurückgeschrieben.

Das Dienstpaket wird separat als `schematico-team-catalog.zip` veröffentlicht. Es ist unabhängig von der Windows-/Linux-Desktopanwendung und der Webversion betreibbar.
