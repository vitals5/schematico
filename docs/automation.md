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

Unter **Busteilnehmer** werden Name, Netzname, Protokoll und Adresse erfasst. Angeboten werden PROFINET, EtherCAT, Modbus TCP, Modbus RTU, KNX TP/IP, Loxone Link/Tree/Air und Other. Für KNX liegen individuelle Adresse und IP-Adresse getrennt vor. Eine CPU-Zuordnung und ein zugeordnetes Gerät in der Zeichnung sind optional. Gleiche Netz-/Protokollkontexte (KNX TP und IP bilden einen gemeinsamen KNX-Adressraum) dürfen keine doppelten Namen oder ausgefüllten Adressen enthalten. Modbus-RTU-Adressen sind auf 1–247 begrenzt. IP-Adressen können als Adresse dokumentiert werden; daraus entsteht keine Netzwerkkonfiguration.

**Busverbindungen** dokumentiert zwei unterschiedliche Teilnehmer samt beider Portbezeichnungen. Teilnehmer müssen im selben Netz/Protokoll liegen. Doppelte Verbindungen werden abgelehnt. Bei PROFINET, EtherCAT und Modbus TCP wird ein Port nur einmal verwendet; Modbus RTU, KNX TP, Loxone Link/Tree und Other erlauben gemeinsame Ports zur Dokumentation mehrpunktfähiger Netze.

Dies ist eine dokumentierte Kommunikationstopologie. Es gibt keine Geräteabfrage, Paketübertragung, Echtzeitprüfung, physische Verkabelungsfreigabe oder Simulation von Buszuständen. Busverbindungen werden nicht als elektrische Leiter in den Netzgraphen eingefügt.

## KNX und Loxone

Die Regeln und ihre Grenzen sind im [Quellenverzeichnis](automation-sources.md) den offiziellen Hersteller-/Verbandsunterlagen zugeordnet.

### KNX

1. Unter **Busteilnehmer** KNX TP oder KNX IP wählen, Netzname und individuelle Adresse (z. B. `1.1.10`) erfassen. Der Netzname bezeichnet das gemeinsame KNX-Projekt; TP/IP nutzen denselben individuellen Adressraum.
2. Unter **KNX-Gruppenadressen** Netzname, Gruppenname, Adresse und optional Datenpunkttyp (z. B. `1.001`) erfassen. `1/2/3` und `1/515` sind dieselbe Adresse; `0/0/0` ist reserviert.
3. Unter **KNX-Kommunikationsobjekte** Teilnehmer, Objektnummer, Gruppenadresse, Richtung und optional DPT zuordnen. Ein Objekt kann über mehrere Zeilen mehrere Gruppenadressen verwenden. Widersprüchliche explizite DPTs werden abgewiesen; unbekannte Typen werden nicht erfunden.

Busverbindungen dokumentieren die physischen Segmente, Gruppenadressen die logischen Verknüpfungen. Ein TP-Ring wird abgewiesen. Linien, Sterne und Bäume dürfen gemeinsame Busports nutzen.

### Loxone

1. Unter **Busteilnehmer** zuerst mit Rolle **Schnittstelle / Tree-Zweig** einen Link-, Tree- oder Air-Schnittstelleneintrag anlegen. Für zwei Tree-Zweige derselben Extension zwei Einträge verwenden. Sie können dasselbe Gerät in der Zeichnung referenzieren.
2. Geräte mit Rolle **Gerät / Extension** der passenden Schnittstelle im selben Netz und Protokoll zuordnen.
3. Unter **Busverbindungen / Funkzuordnungen** die dokumentierten Segmente eintragen. Link verlangt eine Linie ab der Schnittstelle, Tree erlaubt Verzweigungen, jedoch keine Verbindung zwischen Zweigen und keine Ringe.
4. Bei Air nur Gerät und Schnittstelle zuordnen. Port- und Kabellängenfelder werden ausgeblendet. Dies dokumentiert die Zuordnung, nicht den tatsächlichen Funk-/Mesh-Pfad.

Link erlaubt 30 Extensions pro Schnittstelle, Tree 50 Geräte pro Zweig, das Profil **Air Base Extension** 128 Air-Geräte. Bei anderen Air-Schnittstellen eine Grenze laut Datenblatt erfassen; andernfalls bleibt sie sichtbar ungeklärt. Kleinere geräteabhängige Grenzen sind möglich. Für Link/Tree werden ausdrücklich erfasste Kabellängen aufsummiert und gegen 500 m geprüft. Unvollständige Topologie, fehlende Längen und unklare Kapazitäten erscheinen im Status der Schnittstelle und in CSV/PDF; sie werden nicht als vollständig geprüft dargestellt.

Vor dem Entfernen einer belegten Loxone-Schnittstelle müssen ihre Geräte umgeordnet oder entfernt werden. Es gibt noch keinen Import aus ETS oder Loxone Config, keine Programmierung und keine automatische Gebäudeautomations-Schaltungs- oder Busverdrahtung. Bestehende elektrische Netze und Autoconnect bleiben unverändert.

## Bearbeitung und Prüflauf

Jede Änderung erfolgt über **Vorschau prüfen → Übernehmen** und unterstützt Rückgängig/Wiederholen. Veränderte Eingaben verwerfen eine alte Vorschau; zwischenzeitliche Projektänderungen verlangen eine Aktualisierung. Die Prüfung verhindert neu eingeführte Konfigurationsfehler, während vorhandene Altdatenprobleme zur weiteren Bearbeitung sichtbar bleiben.

Das Entfernen einer CPU entfernt ihre Baugruppen und deren Kanäle. CPU-Verweise an Busteilnehmern werden gelöst; die Busteilnehmer bleiben bestehen. Entfernen einer Baugruppe entfernt ihre Kanäle. Entfernen eines Busteilnehmers entfernt seine Busverbindungen und KNX-Objektzuordnungen. Entfernen einer KNX-Gruppe entfernt ihre Objektzuordnungen. Die Vorschau zeigt die Anzahl der betroffenen Datensätze. Gezeichnete Symbole und Leitungen bleiben bestehen.

Der gemeinsame Prüflauf verwendet `plc_configuration` und `bus_configuration` für ungültige Struktur-, Adress-, Anschluss- und Busdaten. Zuordenbare Fundstellen führen zur Zeichnung. Es handelt sich um Daten- und Zuordnungsprüfungen, nicht um eine SPS-Programm- oder Sicherheitsvalidierung.

## Übersichten

Suche und seitenweise Tabellen begrenzen die sichtbaren Datensätze auf 100 pro Ansicht. CSV und PDF exportieren den vollständigen gefilterten Bereich. Bei CPU-Auswahl umfasst der Bericht die CPU mit ihren Baugruppen und Kanälen, bei Baugruppen deren Kanäle. Die übrigen Bereiche exportieren ihre gefilterten Einträge. Die Übersicht enthält Kanaltypen, Adressen, Signaltexte, Rollenanschlüsse, Netz-/Protokoll- und Portdaten sowie Hinweise.

Für die [tabellarische Massenbearbeitung](automation-exchange.md) stehen eigene Bearbeitungs-CSVs mit stabilen IDs, Standprüfung, Änderungsübersicht und atomarem Reimport bereit.

Die Daten werden mit dem Projekt gespeichert. Ein nativer bidirektionaler Austausch mit SPS-Engineeringsoftware oder AutomationML ist in diesem Schritt noch nicht enthalten.
