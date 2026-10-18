# Externe Makrobibliothek

## Ordner einstellen

„Projekt → Einstellungen → Externer Makroordner“ oder den Bereich oben im Tab „Makros“ öffnen. In der Desktop-Version einen vollständigen Ordnerpfad eingeben und „Pfad übernehmen“ wählen oder mit „Ordner wählen…“ einen Ordner auswählen. Die Einstellung steht außerhalb der Projektdatei in den Anwendungsdaten (`macro-library.json`) und wird beim nächsten Programmstart wieder geladen. Ein ungültiger neuer Pfad ersetzt den bisherigen Ordner nicht.

Die Web-Version benötigt eine Ordnerfreigabe. Unterstützt der Browser die Verzeichnis-API, wird der Verzeichniszugriff in IndexedDB gespeichert. Falls der Browser nach einem Neustart eine erneute Freigabe verlangt, „Zugriff freigeben“ wählen. Browser ohne diese API bieten die Auswahl des kompletten Ordners als Dateiliste an; diese Auswahl muss nach einem Neustart wiederholt werden. Ein frei eingegebener Betriebssystempfad kann im Browser keinen Dateizugriff gewähren.

## Makros verwenden und Bibliothek aufbauen

Der Ordner wird einschließlich seiner Unterordner nach `.ema` und `.ems` durchsucht, unabhängig von der Groß-/Kleinschreibung. Im Filter „Externer Ordner“ stehen die lesbaren Dateien getrennt von integrierten Makros und einzeln importierten Kopien. Die Suche berücksichtigt Namen, Beschreibungen und relative Dateipfade. Die große Makroauswahl bietet denselben Bestand mit Vorschau und Herkunftspfad.

Makros beider Dateitypen auswählen und mit „Platzieren“ auf dem aktuellen Blatt einfügen. Auch `.ems` wird als Sammlung normaler Elemente mit ihren Leitungen eingesetzt; eine neue Seite wird dabei nicht erzeugt. Texte und Bereichskästen werden editierbare Bibliotheksobjekte, Bilder und Kabeldefinitionen werden mit übernommen. Normblatt, Schriftkopf und Seiteneinstellungen der Makroquelle werden nicht auf die Zielseite übertragen. Die übernommenen Elemente und Leitungen sind normale Projektobjekte; die externe Quelldatei wird dabei nicht verändert. Alle neu eingefügten Elemente sind gemeinsam ausgewählt, lassen sich verschieben und einzeln bearbeiten. Das Einfügen lässt sich in einem Schritt rückgängig machen.

Eigene Schaltungen als Makro exportieren, die Datei im eingestellten Ordner ablegen und „Aktualisieren“ wählen. Neue, veränderte und entfernte Dateien werden bei der nächsten Aktualisierung berücksichtigt. Dateien mit gleichem internem Makronamen oder gleicher Kennung in verschiedenen Unterordnern bleiben einzeln auswählbar. Externe Quelldateien werden aus dieser Ansicht nicht gelöscht; „Trennen“ entfernt nur die gespeicherte Ordnerverknüpfung. Bereits eingefügte Projektobjekte bleiben erhalten.

## Unterstützte Daten und Grenzen

Die Anwendung exportiert vollständige portable JSON-Makrodaten unter den Endungen `.ema` und `.ems`. Diese Exporte erhalten Komponenten, Leitungsstützpunkte, Beschriftungen, Maßstab, Einfügepunkt und eingebettete Symbolbibliotheken. Bereits vorhandene lesbare XML-Makros und Pakete mit unterstützten Makrodaten bleiben importierbar. Der ältere XML-Import unterstützt einen begrenzten Elementumfang; eine Dateiendung allein belegt keine Formatkompatibilität.

Native XML-Fenstermakros übernehmen grafische Gruppen, Linien und Rechtecke sowie auflösbare elektrische Bibliothekssymbole mit ihrer Originalgeometrie in die Projektbibliothek. Millimetermaßstab, Anschlussrichtungen, Beschriftungen, Gerätekennzeichen, Artikelnummern und Referenzpunkt bleiben erhalten. Geräteboxen verwenden ihre variablen Quellabmessungen; interne Verbindungen entstehen zwischen fluchtenden, einander zugewandten Anschlüssen. Makrodefinitionsrahmen werden als Strukturinformationen gelesen und nicht als zusätzliche Bauteile gezeichnet. Der interne XML-Typ wird auch bei abweichender Dateiendung berücksichtigt.

Bei mehreren Darstellungsarten wird standardmäßig Variante A der Schaltplandarstellung verwendet, ersatzweise eine andere enthaltene Variante A oder die erste Variante. Andere Darstellungsarten werden nicht darübergelegt. Ein Variantenwahldialog ist noch nicht vorhanden. Bibliothekssymbole werden anhand der ursprünglichen Bibliothek, Symbolnummer und Variante aufgelöst. Passende Stammdaten aus dem geöffneten Projekt haben Vorrang; für Gerätebox, seitliche Geräteanschlüsse, T-Verbindung und Schützspule sind die geprüften Standarddefinitionen enthalten. Weitere Symbole benötigen passende Projektstammdaten. Reine Grafikmakros erhalten keine erfundenen elektrischen Anschlüsse. Nicht verfügbare Symbole und nicht unterstützte native Objekttypen führen zu einer Fehlermeldung statt zu einer Ersatzdarstellung. Ist keine auflösbare Linienbreite enthalten, wird die Standardbreite von 0,25 mm verwendet. Ein Quellreferenzpunkt außerhalb der Grafik bleibt erhalten; dadurch kann die Grafik beim Platzieren einen Abstand zum Mauszeiger haben.

Unbekannte binäre Makrovarianten, beschädigte Dateien und fehlende Bibliothekssymbole werden mit Dateiname im aufklappbaren Hinweisbereich aufgeführt und nicht als Ersatzschaltung angelegt. Die Ordneranbindung erweitert den Dateizugriff; sie führt keinen vollständigen Decoder für alle binären Varianten ein. Andere lesbare Dateien desselben Ordners bleiben verwendbar.

Die Desktop-Suche folgt keinen symbolischen Verzeichnisverweisen. Einzeldateien über 32 MB sowie Ordner mit mehr als 5000 Makrodateien oder 10000 Unterordnern werden mit einer Meldung begrenzt. Quellen werden ausschließlich gelesen.

## Prüfung

Modellprüfungen decken Unterordner, stabile Dateikennungen, Aktualisierung und Entfernung, Berechtigungswechsel, Neustart, abgebrochene Freigaben und verspätete Leseergebnisse ab. Die Desktop-Prüfung verwendet echte temporäre Ordner und die Main-/Preload-Schnittstellen mit ersetzten Systemdialogen. Die Browserprüfung verwendet echte Verzeichnishandles und IndexedDB mit ersetztem Ordnerdialog sowie die Ordner-Dateiauswahl als Fallback. Ein vollständiger Desktop-Start mit echtem Systemdialog ist in dieser Linux-Arbeitsumgebung nicht geprüft.
