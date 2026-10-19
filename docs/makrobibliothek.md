# Externe Makrobibliothek

## Ordner einstellen

„Projekt → Einstellungen → Externer Makroordner“ oder den Bereich oben im Tab „Makros“ öffnen. In der Desktop-Version einen vollständigen Ordnerpfad eingeben und „Pfad übernehmen“ wählen oder mit „Ordner wählen…“ einen Ordner auswählen. Die Einstellung steht außerhalb der Projektdatei in den Anwendungsdaten (`macro-library.json`) und wird beim nächsten Programmstart wieder geladen. Ein ungültiger neuer Pfad ersetzt den bisherigen Ordner nicht.

Die Web-Version benötigt eine Ordnerfreigabe. Unterstützt der Browser die Verzeichnis-API, wird der Verzeichniszugriff in IndexedDB gespeichert. Falls der Browser nach einem Neustart eine erneute Freigabe verlangt, „Zugriff freigeben“ wählen. Browser ohne diese API bieten die Auswahl des kompletten Ordners als Dateiliste an; diese Auswahl muss nach einem Neustart wiederholt werden. Ein frei eingegebener Betriebssystempfad kann im Browser keinen Dateizugriff gewähren.

## Makros verwenden und Bibliothek aufbauen

Der Ordner wird einschließlich seiner Unterordner nach `.ema`, `.ems`, `.emp` und `.fp1` durchsucht, unabhängig von der Groß-/Kleinschreibung. Im Filter „Externer Ordner“ stehen die lesbaren Dateien getrennt von integrierten Makros und einzeln importierten Kopien. Die Suche berücksichtigt Namen, Beschreibungen und relative Dateipfade. Die große Makroauswahl bietet denselben Bestand mit Vorschau und Herkunftspfad.

Fenster- und Symbolmakros auswählen und mit „Platzieren“ auf dem aktuellen Blatt einfügen. Auch `.ems` wird als Sammlung normaler Elemente mit ihren Leitungen eingesetzt; eine neue Seite wird dabei nicht erzeugt. Texte und Bereichskästen werden editierbare Bibliotheksobjekte, Bilder und Kabeldefinitionen werden mit übernommen. Normblatt, Schriftkopf und Seiteneinstellungen der Makroquelle werden nicht auf die Zielseite übertragen. Die übernommenen Elemente und Leitungen sind normale Projektobjekte; die externe Quelldatei wird dabei nicht verändert. Alle neu eingefügten Elemente sind gemeinsam ausgewählt, lassen sich verschieben und einzeln bearbeiten. Das Einfügen lässt sich in einem Schritt rückgängig machen.

Eigene Schaltungen als Makro exportieren, die Datei im eingestellten Ordner ablegen und „Aktualisieren“ wählen. Neue, veränderte und entfernte Dateien werden bei der nächsten Aktualisierung berücksichtigt. Dateien mit gleichem internem Makronamen oder gleicher Kennung in verschiedenen Unterordnern bleiben einzeln auswählbar. Externe Quelldateien werden aus dieser Ansicht nicht gelöscht; „Trennen“ entfernt nur die gespeicherte Ordnerverknüpfung. Bereits eingefügte Projektobjekte bleiben erhalten.

## Unterstützte Daten und Grenzen

Die Anwendung exportiert vollständige portable JSON-Makrodaten unter den Endungen `.ema` und `.ems`. Diese Exporte erhalten Komponenten, Leitungsstützpunkte, Beschriftungen, Maßstab, Einfügepunkt und eingebettete Symbolbibliotheken. Bereits vorhandene lesbare XML-Makros und Pakete mit unterstützten Makrodaten bleiben importierbar. Der ältere XML-Import unterstützt einen begrenzten Elementumfang; eine Dateiendung allein belegt keine Formatkompatibilität.

Native XML-Makros übernehmen grafische Gruppen, Linien, Rechtecke, Kreise, Kreisbögen, Linienzüge, Polygone, Texte, Bilder und auflösbare elektrische Symbole in die Projektbibliothek. Millimetermaßstab, Anschlussrichtungen, Beschriftungen, Gerätekennzeichen, Artikelnummern und Referenzpunkt bleiben erhalten. Variable Geräte- und Strukturkästen behalten ihre Quellabmessungen; interne Verbindungen entstehen zwischen fluchtenden, einander zugewandten Anschlüssen. Mehrsprachige Texte verwenden eine passende Sprachfassung. Normale Texte bleiben als Beschriftung editierbar. Makrodefinitionsrahmen und Konfigurationsobjekte werden als Quelldaten erhalten und nicht als zusätzliche Bauteile gezeichnet.

**Seitenmakros (`.emp`):** Der gespeicherte XML-Typ entscheidet über die Behandlung. „Seite(n) hinzufügen“ übernimmt alle enthaltenen Seiten als neue bearbeitbare Blätter. „Platzieren“ fügt den Inhalt einer gewählten Quellseite auf dem aktuellen Blatt ein. Bei mehreren Seiten erscheint eine Auswahl; andere Quellseiten werden nicht darübergelegt. Leere Seitenvorlagen können als Seite hinzugefügt werden, haben aber keinen platzierbaren Inhalt. Auch mehrseitige Fensterdateien bieten eine Quellseitenauswahl. Fensterdateien mit Endung `.ems` bleiben normale platzierbare Objekte.

**Konturen (`.fp1`):** Die untersuchte XML-Struktur `ContourDefinition` wird als gruppierte Bibliotheksgrafik übernommen. Andere Dateistrukturen unter derselben Endung sind damit nicht allgemein unterstützt.

**Variablen:** Zugeordnete Platzhaltervariablen erscheinen vor dem Einfügen im Dialog „Makro konfigurieren“. Änderungen werden auf die zugehörigen BMK-, Text- oder Seitenfelder der Kopie angewendet. Unveränderte Eingaben erhalten die gespeicherten Feldinhalte. Gruppierungen und Variablenzuordnungen bleiben beim Platzieren und eigenen Makroexport erhalten. Interne Quellkonfiguration wird getrennt von der sichtbaren Zeichnung gespeichert; ein vollständiger fremder Variablen-/Wertesatzeditor wird nicht zugesagt.

**Bilder und Ansichten:** Hex-kodierte eingebettete PNG-, JPEG-, GIF-, BMP- und WebP-Dateien werden über ihren Quellpfad zugeordnet und als normale verschiebbare, löschbare Bilder übernommen. Fehlt eine Bilddatei tatsächlich, bleiben ein markierter Bildbereich und ein Hinweis erhalten; unter den Bildeigenschaften lässt sich mit „Bild ersetzen…“ eine Datei zuweisen. Gespeicherte 2D-Modellansichten und Berichte werden aus den enthaltenen Vektoren mit ihrer Skalierung und Drehung gelesen. Bemaßungslinien und Maßtexte werden als Grafik übernommen; sie sind keine parametrischen Bemaßungen.

**3D-Quelle:** Für das untersuchte textuelle Mesh-Profil ist eine ausdrücklich gekennzeichnete **2D-Draufsicht (XY-Kantenprojektion)** möglich. Sie verwendet tatsächliche Modellkanten und übergeordnete räumliche Transformationen. Sie ist eine platzierbare Grafik ohne elektrische Anschlüsse. Es gibt keine räumliche Bearbeitung, verdeckte-Kanten-Berechnung oder allgemeine Unterstützung beliebiger 3D-/BRep-Formate. Die Quelldaten werden im eigenen Projekt und Makroexport erhalten.

Bei mehreren Darstellungsarten wird standardmäßig Variante A der Schaltplandarstellung verwendet, ersatzweise eine andere enthaltene Variante A oder die erste Variante. Ein Dialog zur Wahl anderer Darstellungsarten ist noch nicht vorhanden. Bibliothekssymbole werden anhand der ursprünglichen Bibliothek, Symbolnummer und Variante aufgelöst. Passende Stammdaten aus dem geöffneten Projekt haben Vorrang; **250 geprüfte Standarddefinitionen** sind enthalten.

Fehlt eine benötigte Bibliotheksdefinition, lädt der Import die übrigen Inhalte und zeigt das betreffende Objekt ausdrücklich als fehlendes Symbol mit seiner Originalidentität an. Solche markierten Objekte haben **keine erfundenen elektrischen Anschlüsse** und ersetzen keine vollständige Symboldefinition. Im untersuchten gemischten Archiv betrifft das 13 Identitäten aus `PID_ESS` in sieben Dateien. Für die vollständige Darstellung dieser Objekte werden die passenden Bibliotheksstammdaten benötigt. Ohne die Option zur Übernahme fehlender Abhängigkeiten bleibt der programmgesteuerte Import streng und meldet einen Fehler.

Unbekannte Objekttypen, unbekannte binäre Formate, beschädigte Daten oder nicht unterstützte Transformationen werden weiterhin mit Dateiname als nicht geladen gemeldet. Davon getrennt zeigen die Ordnerliste und die einzelne Makrokarte Hinweise zu geladenen Dateien mit fehlenden Abhängigkeiten oder einer 3D-Projektion. Andere lesbare Dateien desselben Ordners bleiben verwendbar. Ergebnisse stehen im [Importbefund](reverse-engineering/makro-import.md).

Die Desktop-Suche folgt keinen symbolischen Verzeichnisverweisen. Einzeldateien über 32 MB sowie Ordner mit mehr als 5000 Makrodateien oder 10000 Unterordnern werden mit einer Meldung begrenzt. Quellen werden ausschließlich gelesen.

## Prüfung

Modellprüfungen decken Unterordner, stabile Dateikennungen, Aktualisierung und Entfernung, Berechtigungswechsel, Neustart, abgebrochene Freigaben und verspätete Leseergebnisse ab. Die Desktop-Prüfung verwendet echte temporäre Ordner und die Main-/Preload-Schnittstellen mit ersetzten Systemdialogen. Die Browserprüfung verwendet echte Verzeichnishandles und IndexedDB mit ersetztem Ordnerdialog sowie die Ordner-Dateiauswahl als Fallback. Ein vollständiger Desktop-Start mit echtem Systemdialog ist in dieser Linux-Arbeitsumgebung nicht geprüft.
