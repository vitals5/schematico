# SPS- und Busprojektierung

**Projekt → SPS- und Busprojektierung…** verwaltet CPUs, Baugruppen, E/A-Kanäle sowie dokumentierte Busnetze, Teilnehmer und Portverbindungen. Die Daten liegen unter `Project.automation` in der Projektdatei. Bestehende Projekte benötigen keine Migration.

## SPS-Struktur

1. Unter **CPUs / Steuerungen** ein BMK, Anlage, Ort und eine Beschreibung anlegen.
2. Unter **Baugruppen** die CPU auswählen und Rack, Steckplatz, BMK und Beschreibung erfassen.
3. Unter **E/A-Kanäle** die Baugruppe, Kanalnummer, DI/DO/AI/AO, E/A-Adresse und Signaltext festlegen.

Kanalnummern sind innerhalb einer Baugruppe eindeutig, Rack/Steckplatz innerhalb einer CPU. Gleiche E/A-Adressen verschiedener CPUs sind unabhängig. Leere Adressen sind noch nicht erfasst. Ein Reservekanal ist ausdrücklich gekennzeichnet und darf keine Anschlussbindungen besitzen.

### Adressprüfung

Numerische E/A-Adressen verwenden einen gemeinsamen Bitbereich für die IEC- und deutschen Kennungen: beispielsweise `%I0.0`, `I0.0` und `E0.0` sowie `%QW2`, `QW2` und `AW2`. Unterstützt werden Bitadressen `.0` bis `.7` und Byte-, Wort- und Doppelwortbereiche `B/W/D`. Ein numerischer Bereich ohne Bitangabe zählt als Byte. Erkannte Adressen müssen zur Ein-/Ausgangsrichtung passen. Auch überlappende Bereiche, etwa `IW0` und `I1.0`, werden innerhalb derselben CPU erkannt.

Andere Adressen bleiben symbolisch. Hier prüft die Anwendung doppelte vollständige Namen innerhalb derselben CPU ohne Beachtung der Groß-/Kleinschreibung; sie zerlegt keine beliebigen Herstellerformate in Speicherbereiche. Hardwareabhängige Adressgrenzen, Bitbelegungen einzelner Geräte und Analogskalierungen werden nicht berechnet.

### Kanalorientierte Anschlusszuordnung

Signal, Versorgung und Bezug/Masse können getrennt tatsächlichen Bibliotheksanschlüssen zugeordnet werden. Dazu Blatt, Element und Anschluss wählen und die jeweilige Zuordnung aktivieren. Signalanschlüsse dürfen nicht mehreren Kanälen zugeordnet sein. Versorgung und Bezug dürfen von mehreren Kanälen gemeinsam verwendet werden, innerhalb eines Kanals müssen die drei Rollen aber unterschiedliche Anschlüsse besitzen.

Die Zuordnung erzeugt keine Verdrahtung. Signaltext und SPS-Adresse bleiben strukturierte Kanaldaten; sie überschreiben weder Anschlussbezeichnungen noch Funktionstexte vorhandener Elemente. **Zur Zeichnung** öffnet den zugeordneten Signalanschluss bzw. das Busgerät.

## Busnetze und Teilnehmer

Unter **Busteilnehmer** werden Name, Netzname, Protokoll und Adresse erfasst. Angeboten werden PROFINET, EtherCAT, Modbus TCP, Modbus RTU und Other. Eine CPU-Zuordnung und ein zugeordnetes Gerät in der Zeichnung sind optional. Gleiche Netz-/Protokollkontexte dürfen keine doppelten Namen oder ausgefüllten Adressen enthalten. Modbus-RTU-Adressen sind auf 1–247 begrenzt. IP-Adressen können als Adresse dokumentiert werden; daraus entsteht keine Netzwerkkonfiguration.

**Busverbindungen** dokumentiert zwei unterschiedliche Teilnehmer samt beider Portbezeichnungen. Teilnehmer müssen im selben Netz/Protokoll liegen. Doppelte Verbindungen werden abgelehnt. Bei PROFINET, EtherCAT und Modbus TCP wird ein Port nur einmal verwendet; Modbus RTU und Other erlauben gemeinsame Ports zur Dokumentation mehrpunktfähiger Netze.

Dies ist eine dokumentierte Kommunikationstopologie. Es gibt keine Geräteabfrage, Paketübertragung, Echtzeitprüfung, physische Verkabelungsfreigabe oder Simulation von Buszuständen. Busverbindungen werden nicht als elektrische Leiter in den Netzgraphen eingefügt.

## Bearbeitung und Prüflauf

Jede Änderung erfolgt über **Vorschau prüfen → Übernehmen** und unterstützt Rückgängig/Wiederholen. Veränderte Eingaben verwerfen eine alte Vorschau; zwischenzeitliche Projektänderungen verlangen eine Aktualisierung. Die Prüfung verhindert neu eingeführte Konfigurationsfehler, während vorhandene Altdatenprobleme zur weiteren Bearbeitung sichtbar bleiben.

Das Entfernen einer CPU entfernt ihre Baugruppen und deren Kanäle. CPU-Verweise an Busteilnehmern werden gelöst; die Busteilnehmer bleiben bestehen. Entfernen einer Baugruppe entfernt ihre Kanäle. Entfernen eines Busteilnehmers entfernt seine Busverbindungen. Die Vorschau zeigt die Anzahl der betroffenen Datensätze. Gezeichnete Symbole und Leitungen bleiben bestehen.

Der gemeinsame Prüflauf verwendet `plc_configuration` und `bus_configuration` für ungültige Struktur-, Adress-, Anschluss- und Busdaten. Zuordenbare Fundstellen führen zur Zeichnung. Es handelt sich um Daten- und Zuordnungsprüfungen, nicht um eine SPS-Programm- oder Sicherheitsvalidierung.

## Übersichten

Suche und seitenweise Tabellen begrenzen die sichtbaren Datensätze auf 100 pro Ansicht. CSV und PDF exportieren den vollständigen gefilterten Bereich. Bei CPU-Auswahl umfasst der Bericht die CPU mit ihren Baugruppen und Kanälen, bei Baugruppen deren Kanäle. Die übrigen Bereiche exportieren ihre gefilterten Einträge. Die Übersicht enthält Kanaltypen, Adressen, Signaltexte, Rollenanschlüsse, Netz-/Protokoll- und Portdaten sowie Hinweise.

Die Daten werden mit dem Projekt gespeichert. Ein bidirektionaler Austausch mit SPS-Engineeringsoftware oder AutomationML ist in diesem Schritt noch nicht enthalten.
