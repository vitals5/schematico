# SPS- und Busprojektierung

**Projekt → SPS- und Busprojektierung…** verwaltet CPUs, Baugruppen, E/A-Kanäle sowie dokumentierte Busnetze, Teilnehmer und Portverbindungen. Die Daten liegen unter `Project.automation` in der Projektdatei. Bestehende Projekte benötigen keine Migration.

## Grafischer Arbeitsbereich

Der Einstieg zeigt Steuerungen, zugeordnete aktive Kanäle, Busnetze und Konfigurationshinweise als Übersichtskarten. Über die linke Bereichsnavigation (auf schmalen Bildschirmen über **Bereich**) wechseln Sie zwischen SPS, Busnetzen und KNX. **Grafik / Liste** wechselt die Darstellung; bereits eingegebene Eigenschaften bleiben dabei erhalten.

- **SPS:** Steuerung wählen. Baugruppen erscheinen als Karten auf einer Rack-Leiste, darunter die tatsächlich gespeicherten Kanäle mit Typ, Adresse, Signaltext und Zuordnungsstatus. DI, DO, AI und AO sind farblich und durch Text unterschieden. Die Anzeige erzeugt keine zusätzlichen Kanäle oder Hardware-Steckplätze. **Alle Steuerungen / nicht zugeordnet** zeigt auch Datensätze mit fehlender übergeordneter Zuordnung.
- **Busnetze:** Netz und Protokoll wählen. Die Topologie zeigt dokumentierte Teilnehmer und Verbindungen. Durchgezogene Linien sind gespeicherte Verbindungen, gestrichelte Linien Funkzuordnungen. Gepunktete Linien zeigen Schnittstellenzuordnungen, für die kein eigenes Verbindungssegment dokumentiert ist. Die Darstellung ist keine elektrische Verdrahtung und kein gemessener Funkweg.
- **KNX:** Gruppenadresskarten öffnen eine logische Ansicht **Senden → Gruppenadresse → Empfangen**. Kommunikationsobjekte mit beiden Richtungen erscheinen auf beiden Seiten; es bleibt derselbe Datensatz. Von dort lassen sich auch die beteiligten Geräte bearbeiten.

Karten, Teilnehmer und Topologieverbindungen öffnen den Eigenschaftseditor rechts; auf kleinen Bildschirmen erscheint er unterhalb der Grafik. SVG-Teilnehmer und -Verbindungen lassen sich auch mit Tab und Enter/Leertaste öffnen. Änderungen zunächst mit **Vorschau prüfen** kontrollieren und anschließend mit **Übernehmen** speichern. Rückgängig/Wiederholen und die Prüfung auf einen zwischenzeitlich geänderten Projektstand bleiben verfügbar.

Die Suche und **Nur Hinweise** helfen beim Eingrenzen. Steuerungs-, Netz- und Gruppenadressauswahl gelten für die Grafik; die Liste zeigt alle Datensätze des Bereichs mit dem aktuellen Such-/Hinweisfilter. Große Grafiken werden begrenzt (12 Steuerungen, 24 Baugruppen, 128 Kanalkarten; 80 Busteilnehmer, 240 Verbindungen; 80 KNX-Gruppen, 40 Kommunikationsobjekte je Richtung). Alle Datensätze bleiben über Liste und Suche erreichbar. Die Grafiken zeigen gespeicherte Projektierungsdaten, keine Live-Zustände.

**Daten & Berichte** bündelt AutomationML, Bearbeitungs-CSV, CSV-/PDF-Übersichten und Aktualisieren. Bereichsbezogene Exporte berücksichtigen den Such-/Hinweisfilter der Liste. Der gesonderte KNX-Gruppenadress-XML-Austausch lässt sich im Bereich **KNX-Gruppenadressen → KNX-XML austauschen** aufklappen.

## SPS-Struktur

1. Unter **CPUs / Steuerungen** ein BMK, Anlage, Ort und eine Beschreibung anlegen.
2. Unter **Baugruppen** die CPU auswählen und Rack, Steckplatz, BMK und Beschreibung erfassen.
3. Unter **E/A-Kanäle** die Baugruppe, Kanalnummer, DI/DO/AI/AO, E/A-Adresse und Signaltext festlegen.

Kanalnummern sind innerhalb einer Baugruppe je Kanaltyp eindeutig, Rack/Steckplatz innerhalb einer CPU. Gleiche E/A-Adressen verschiedener CPUs sind unabhängig. Leere Adressen sind noch nicht erfasst. Ein Reservekanal ist ausdrücklich gekennzeichnet und darf keine Anschlussbindungen besitzen.

### Adressprüfung

Numerische E/A-Adressen verwenden einen gemeinsamen Bitbereich für die IEC- und deutschen Kennungen: beispielsweise `%I0.0`, `I0.0` und `E0.0` sowie `%QW2`, `QW2` und `AW2`. Unterstützt werden Bitadressen `.0` bis `.7` und Byte-, Wort- und Doppelwortbereiche `B/W/D`. Ein numerischer Bereich ohne Bitangabe zählt als Byte. Erkannte Adressen müssen zur Ein-/Ausgangsrichtung passen. Auch überlappende Bereiche, etwa `IW0` und `I1.0`, werden innerhalb derselben CPU erkannt.

Symbolischer SPS-Name und Datentyp können zusätzlich im Kanal hinterlegt werden. Andere Adressen bleiben symbolisch. Hier prüft die Anwendung doppelte vollständige Namen innerhalb derselben CPU ohne Beachtung der Groß-/Kleinschreibung; sie zerlegt keine beliebigen Herstellerformate in Speicherbereiche. Hardwareabhängige Adressgrenzen, Bitbelegungen einzelner Geräte und Analogskalierungen werden nicht berechnet.

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

Vor dem Entfernen einer belegten Loxone-Schnittstelle müssen ihre Geräte umgeordnet oder entfernt werden. Der [KNX-Gruppenadress-XML-Austausch](knx-xml.md) ist verfügbar; vollständige Projektimporte aus ETS oder Loxone Config sind noch nicht enthalten. Es gibt keine Programmierung und keine automatische Gebäudeautomations-Schaltungs- oder Busverdrahtung. Bestehende elektrische Netze und Autoconnect bleiben unverändert.

## Bearbeitung und Prüflauf

Jede Änderung erfolgt über **Vorschau prüfen → Übernehmen** und unterstützt Rückgängig/Wiederholen. Veränderte Eingaben verwerfen eine alte Vorschau; zwischenzeitliche Projektänderungen verlangen eine Aktualisierung. Die Prüfung verhindert neu eingeführte Konfigurationsfehler, während vorhandene Altdatenprobleme zur weiteren Bearbeitung sichtbar bleiben.

Das Entfernen einer CPU entfernt ihre Baugruppen und deren Kanäle. CPU-Verweise an Busteilnehmern werden gelöst; die Busteilnehmer bleiben bestehen. Entfernen einer Baugruppe entfernt ihre Kanäle. Entfernen eines Busteilnehmers entfernt seine Busverbindungen und KNX-Objektzuordnungen. Entfernen einer KNX-Gruppe entfernt ihre Objektzuordnungen. Die Vorschau zeigt die Anzahl der betroffenen Datensätze. Gezeichnete Symbole und Leitungen bleiben bestehen.

Der gemeinsame Prüflauf verwendet `plc_configuration` und `bus_configuration` für ungültige Struktur-, Adress-, Anschluss- und Busdaten. Zuordenbare Fundstellen führen zur Zeichnung. Es handelt sich um Daten- und Zuordnungsprüfungen, nicht um eine SPS-Programm- oder Sicherheitsvalidierung.

## Übersichten

Suche und seitenweise Tabellen begrenzen die sichtbaren Datensätze auf 100 pro Ansicht. CSV und PDF exportieren den vollständigen gefilterten Bereich. Bei CPU-Auswahl umfasst der Bericht die CPU mit ihren Baugruppen und Kanälen, bei Baugruppen deren Kanäle. Die übrigen Bereiche exportieren ihre gefilterten Einträge. Die Übersicht enthält Kanaltypen, Adressen, Signaltexte, Rollenanschlüsse, Netz-/Protokoll- und Portdaten sowie Hinweise.

Für die [tabellarische Massenbearbeitung](automation-exchange.md) stehen eigene Bearbeitungs-CSVs mit stabilen IDs, Standprüfung, Änderungsübersicht und atomarem Reimport bereit.

Die Daten werden mit dem Projekt gespeichert. Der [vorlagenbasierte AutomationML-APC-Austausch](automationml.md) unterstützt den geprüften Import und Rückexport von Steuerungen, Baugruppen, Kanälen und zugeordneten Tags. Herstellerübergreifende Neuprojektierung der Hardware, vollständige Busübernahme und Online-Programmierung sind nicht enthalten.
