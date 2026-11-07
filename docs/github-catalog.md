# Gemeinsamer Artikelkatalog auf GitHub

Der gemeinsame Artikelbestand liegt unter [`catalog/articles.json`](../catalog/articles.json). Diese Datei ist die zentrale Datenquelle. Beim Programmstart lädt Schematico sie von GitHub und hält einen getrennten lokalen Offline-Zwischenspeicher bereit. Ein Datenbankserver ist dafür nicht erforderlich.

Der Anfangsbestand enthält die 15 bereits vorhandenen Startartikel. Deren technische Funktionen werden nicht nachträglich erfunden oder als geprüft ausgegeben. Neue öffentliche Einträge bleiben ebenfalls **ungeprüft**.

## Bedienung

**Projekt → Artikel und Betriebsmittel… → Werkzeuge → Artikelkatalog** öffnet den Katalog. Der GitHub-Datenbestand und sein Ladezustand erscheinen oben. Die Einträge kennzeichnen ihre Herkunft als GitHub, lokal, lokale Kopie oder Startbibliothek. **Aktualisieren** lädt den gemeinsamen Bestand erneut.

Lokale Änderungen überschreiben den zentralen Datensatz nicht. Bereits verwendete Artikel bleiben als Snapshots in den Projektdateien gespeichert. Eine Änderung auf GitHub ändert daher keine vorhandenen Projekte automatisch. Die bestehenden Vorschauen und Werkzeuge zum gezielten Aktualisieren der Projekt-Snapshots bleiben maßgeblich.

Zum Einreichen eines neuen Artikels:

1. **Neuen Artikel anlegen**, Hersteller, Artikelnummer, Variante, Beschreibung und bei Bedarf Funktionsdaten erfassen.
2. **Zentral veröffentlichen…** öffnen und die öffentliche Vorschau prüfen.
3. Die anonyme Bestätigung durchführen und **Artikel einreichen** wählen. Ein GitHub-Konto ist nicht erforderlich.
4. Die App bestätigt zunächst die Einreichung. Die GitHub Action validiert den Datensatz erneut und ergänzt die gemeinsame JSON-Datei. Anschließend den Katalog aktualisieren.

In der Desktopanwendung und auf extern gehosteten Webkopien öffnet sich dafür die feste HTTPS-Veröffentlichungsseite von Schematico im Browser. Die Artikeldaten werden im URL-Fragment übertragen, nicht als Anfrageparameter an den Webserver. Die Seite entfernt das Fragment nach dem Einlesen. Bei umfangreichen Desktop-Datensätzen verhindert eine ausdrückliche Kopieren-und-Einfügen-Übergabe das Überschreiten der URL-Grenze des Betriebssystems. Die Zwischenablage wird erst durch die beschriftete Benutzeraktion überschrieben; im Browser sind automatisches Übernehmen und manuelles Einfügen möglich. Erst das ausdrückliche Einreichen sendet die Daten an den Einreichungsdienst. Auf der offiziellen Webversion erscheint die Veröffentlichung direkt als Dialog.

Öffentliches Einreichen erlaubt **neue** Datensätze. Vorhandene Kombinationen aus Hersteller, Artikelnummer und Variante werden nicht anonym überschrieben. Eine identische Wiederholung ist idempotent; abweichende Daten desselben Schlüssels werden abgelehnt. Bestehende zentrale Artikel kann ein Repository-Mitarbeiter weiterhin kontrolliert über GitHub ändern. Lokale Kopien bleiben in der App bearbeitbar.

## Einmalige Aktivierung des Einreichungsdienstes

GitHub Actions besitzt keinen anonym aufrufbaren Schreibendpunkt. Ein kleiner Cloudflare Worker nimmt die Einreichungen entgegen und löst die Action aus. Er speichert keine Artikel und verwendet keine eigene Datenbank. Im ausgelieferten Programm befindet sich kein GitHub-Schreibtoken.

Solange der Worker nicht eingerichtet und seine öffentliche Adresse nicht in der Katalogdatei eingetragen ist, funktioniert das Laden des Katalogs. Die zentrale Veröffentlichung ist dann ausdrücklich deaktiviert.

### 1. Cloudflare vorbereiten

- Ein Cloudflare-Konto mit Workers einrichten. Der Dienst heißt standardmäßig `schematico-catalog-submissions`; seine `workers.dev`-Adresse ergibt sich aus dem Konto-Unterbereich.
- Ein Turnstile-Widget für den Host **vitals5.github.io** erstellen. Der Site Key ist öffentlich, der Secret Key bleibt serverseitig. Der Dienst prüft zusätzlich die Aktion `catalog-submit` und den Hostnamen.
- Einen für dieses Konto begrenzten Cloudflare-API-Token zum Bearbeiten von Workers erstellen. Die Account ID notieren.

Der Worker und seine Ratenbegrenzung sind unter [`workers/catalog-submissions`](../workers/catalog-submissions) vollständig vorbereitet. Seine Konfiguration wurde mit Wrangler als Build ohne Veröffentlichung geprüft.

### 2. GitHub-Zugang serverseitig einrichten

Ein dafür vorgesehener GitHub-Zugang benötigt für **vitals5/schematico** die Berechtigung **Contents: write**, um `repository_dispatch` auszulösen. Dies kann ein eng begrenzter Fine-grained Token eines berechtigten Kontos sein. Sein Ablauf muss berücksichtigt und bei Bedarf der Token erneuert werden. Er gehört weder in die JSON-Datei noch in das Programm oder einen Chat.

Unter **Repository → Settings → Secrets and variables → Actions** diese vier Secrets hinterlegen:

| Name | Inhalt |
| --- | --- |
| `CATALOG_CLOUDFLARE_API_TOKEN` | Für den Worker begrenzter Cloudflare-API-Token |
| `CATALOG_CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID |
| `CATALOG_DISPATCH_TOKEN` | GitHub-Zugang für Dispatch in dieses Repository |
| `CATALOG_TURNSTILE_SECRET` | Geheimer Schlüssel des Turnstile-Widgets |

### 3. Bereitstellung starten

Unter **Actions → Deploy Catalog Submission Service → Run workflow** die HTTPS-Ursprungsadresse des Workers und den öffentlichen Turnstile Site Key eintragen. Der Workflow:

- prüft die erforderlichen Secrets,
- baut und veröffentlicht den Worker einschließlich serverseitiger Secrets,
- ergänzt anschließend nur die öffentliche Dienstadresse und den Site Key in der Katalogdatei.

Die App erkennt die Konfiguration beim nächsten Aktualisieren. Ein weiterer App-Build ist dafür nicht erforderlich. `GET /health` meldet, ob der Dienst konfiguriert ist; Secret-Werte werden nicht ausgegeben. Standardmäßig akzeptiert der Dienst die offizielle Webherkunft. Desktopbenutzer verwenden die offizielle Veröffentlichungsseite im Browser.

Alternativ kann ein Administrator im Worker-Verzeichnis `wrangler deploy` und `wrangler secret put GITHUB_DISPATCH_TOKEN` sowie `wrangler secret put TURNSTILE_SECRET` verwenden und die öffentliche Konfiguration kontrolliert in `catalog/articles.json` ergänzen:

```json
"submission": {
  "url": "https://schematico-catalog-submissions.DEIN-UNTERBEREICH.workers.dev/submit",
  "siteKey": "OEFFENTLICHER_TURNSTILE_SITE_KEY"
}
```

## Verarbeitung und Grenzen

Die Veröffentlichung verwendet einen festen Repository-, Branch- und Dateipfad. Übermittelte Daten können diese Ziele nicht ändern. Sowohl Dienst als auch Action validieren die Datensätze. Die Action führt keine Anweisungen aus Artikeltexten aus. Tokens bleiben in serverseitigen Secrets beziehungsweise im kurzlebigen Workflow-Zugang.

Ratenbegrenzung und Turnstile schützen den anonymen Eingang. Der Server normalisiert öffentliche Datensätze auf **ungeprüft**. Die Action schreibt mit dem aktuellen Datei-SHA und wiederholt konkurrierende Änderungen begrenzt, damit gleichzeitige Ergänzungen nicht verloren gehen. Sie startet keine App-Neubuilds für jeden Artikel; die App liest direkt aus der zentralen Datei auf `main`.

Aktuell sind höchstens 50.000 Artikel und 20 MiB Kataloggröße vorgesehen. Größere GitHub-Dateien werden über die Blob-API gelesen; die 1-MiB-Grenze der eingebetteten Contents-API-Antwort beendet die Veröffentlichung daher nicht vorzeitig. Wenn der Bestand deutlich darüber wächst, kann der statische Katalog später nach Herstellern aufgeteilt werden. Eine unbegrenzt große einzelne JSON-Datei wird nicht versprochen.

Der bisherige private Teamkatalog bleibt eine zusätzliche, optionale Möglichkeit. Er wird für den gemeinsamen GitHub-Katalog nicht benötigt.
