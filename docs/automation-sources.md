# Quellenbasis der SPS-, Bus- und Gebäudeautomationsplanung

Die Regeln dokumentieren Projektierungsdaten; sie sind keine Zertifizierung, Inbetriebnahme oder vollständige Protokollimplementierung. Herstellerunterlagen haben einen versions- und geräteabhängigen Geltungsbereich. Die folgenden öffentlich zugänglichen Originalquellen wurden zur Abgrenzung der Modelle und der ergänzten KNX-/Loxone-Prüfungen herangezogen. Geschützte Zeichnungen oder Gerätedatenbanken werden nicht kopiert.

## SPS und industrielle Busse

| Primärquelle | Verwendung und Grenze |
|---|---|
| [Siemens – SIMATIC S7-1500/ET 200MP, Anschluss- und Blockschaltbild einer DI-Baugruppe](https://docs.tia.siemens.cloud/r/simatic_s7_1500_et_200mp_manual_collection_enus_21/device-specific-information/digital-modules/digital-input-modules/digital-input-module-di-16x24...125vuc-hf-6es7521-7eh00-0ab0/wiring/wiring-and-block-diagram?contentId=ZEt8N9i8rP6E3VezCslvlg) | Referenz für getrennte Signal-, Versorgungs- und Bezugsanschlüsse. Keine universelle Klemmenbelegung aus einem einzelnen Gerät ableiten. Die vorhandene generische CPU-/Baugruppen-/Kanalstruktur bleibt bestehen. |
| [AutomationML – Spezifikationen, einschließlich Application Recommendation Automation Project Configuration](https://www.automationml.org/about-automationml/specifications/) | Referenz für den späteren Engineering-Datenaustausch. Noch kein AutomationML-Import/-Export implementiert. |
| [PROFIBUS & PROFINET International – Installationsrichtlinien](https://www.profibus.com/profinet-installation-guidelines) | Referenz für Netze, Geräte und Ports. Die aktuelle Portbelegungsprüfung ersetzt keine Gerätebeschreibungs-, Redundanz- oder Installationsprüfung. |
| [Beckhoff – EtherCAT-Systemdokumentation](https://infosys.beckhoff.com/content/1033/ethercatsystem/2469080715.html) | EtherCAT-Adressierung ist geräte-/modusabhängig. Das bestehende Adressfeld dokumentiert einen Wert, bildet keine vollständige ESI-/Stationsadressierungslogik ab. |
| [Modbus Organization – Spezifikationen](https://www.modbus.org/modbus-specifications) | Vorhandene Teilnehmeradresse 1–247 für Modbus RTU; Broadcast 0 ist kein einzelner Teilnehmer. Noch keine Register-/Funktionscodeprüfung. |

IEC 61082 und IEC 81346 liefern den fachlichen Rahmen für Dokumentation und Kennzeichnung. Ohne vollständige Auswertung der jeweiligen Normtexte wird keine umfassende Normkonformität behauptet.

## KNX

| Primärquelle | Umgesetzte Regel |
|---|---|
| [KNX Association – Geräteeigenschaften](https://support.knx.org/hc/en-us/articles/360008329340-Devices-panel-properties) | Individuelle Adresse Bereich.Linie.Gerät: 0–15 / 0–15 / 0–255; eigene IP-Adresse. Eindeutigkeit im benannten KNX-Netz über TP und IP hinweg, führende Nullen sind keine neue Adresse. Leere Adresse bedeutet noch nicht erfasst. Gerät 0 kann einen Koppler bezeichnen; eine herstellerspezifische Kopplerrollenprüfung ist nicht enthalten. |
| [KNX Association – Gruppenadressdarstellung](https://support.knx.org/hc/en-us/articles/360022260579-Group-Address-Style), [Eigenschaften](https://support.knx.org/hc/en-us/articles/360007619040-Group-Address-panel-properties), [Schneider Electric – Wertebereich](https://productinfo.se.com/spacelogic_knx_ihc/spacelogic-ihc-interface-sw-user-guide/English/BM_IHC_Interface_Plugin_DD01275013.XML.xml/%24/StandardKNXGroupAddresses-E75BFC63) | Zweistufig 0–31 / 0–2047, dreistufig 0–31 / 0–7 / 0–255. Beide Darstellungen werden für die Duplikatprüfung auf denselben 16-Bit-Wert abgebildet. |
| [KNX Association – Gruppenadressbereiche](https://support.knx.org/hc/en-us/articles/115001825304-Group-Address-Ranges) | Gruppenadresse 0 ist reserviert. Ältere Medien/Geräte können kleinere Adressbereiche unterstützen; diese Gerätefähigkeit wird nicht pauschal angenommen. |
| [KNX Association – Gruppenadresspanel](https://support.knx.org/hc/en-us/articles/360007690479-Group-Address-panel) | Gruppenadressen verknüpfen Kommunikationsobjekte, keine physischen Kabelsegmente. Ein Objekt kann mehreren Gruppen zugeordnet werden. DPT-Schreibweise und explizite Widersprüche zwischen Objekt und Gruppen werden geprüft; kein vollständiger DPT-Katalog oder ETS-Flags-Modell. |
| [Siemens – KNX-Installation und technische Details](https://sid.siemens.com/r/A6V13193565/20347804683___en-US_25568984971) | Für dokumentierte TP-Kabelsegmente werden geschlossene Ringe abgewiesen. Linien, Sterne und Bäume bleiben möglich. IP-Verbindungen erhalten diese TP-Regel nicht. |

## Loxone

| Primärquelle | Umgesetzte Regel |
|---|---|
| [Loxone – Link](https://www.loxone.com/enus/kb/link/) | Eigene Link-Schnittstelle eines Miniservers, maximal 30 zugeordnete Extensions, Linie ohne Verzweigung oder Ring. Höchstens 500 m erfasste Datenleitung. 120-Ω-Abschluss am letzten Gerät und GND-Verbindung bei getrennten Netzteilen sind dokumentierte Planungsanforderungen, keine automatisch erzeugten oder hier elektrisch geprüften Verbindungen. |
| [Loxone – Tree Branch](https://www.loxone.com/enus/kb/tree-branch/), [Tree Extension](https://www.loxone.com/enus/kb/tree-extension/) | Maximal 50 Geräte und 500 m Datenleitung je Zweig. Zweige werden als separate Schnittstelleneinträge erfasst und dürfen nicht quer verbunden werden. Verzweigungen sind möglich; keine geschlossenen Ringe. Keine Übertragung dieser Grenzen auf Tree Turbo oder Tree Intercommunication. |
| [Loxone – Air Base Extension, Datenblatt Artikel 100114](https://pim.loxone.com/datasheet/100114-air-base-extension), [Air](https://www.loxone.com/enus/kb/air/) | 128 Geräte nur beim ausdrücklich gewählten Profil Air Base Extension. Andere Air-Schnittstellen bleiben ohne erfasste Datenblattgrenze als ungeklärt sichtbar. Funkzuordnung Gerät↔Schnittstelle statt Kabellänge oder statischer Mesh-Route; keine Reichweitenberechnung. |

Teilnehmergrenzen werden je **Schnittstelleneintrag**, nicht pauschal je Netz oder CPU geprüft. Kleinere manuell erfasste Datenblattgrenzen sind möglich. Bekannte Profilgrenzen dürfen dadurch nicht erhöht werden. Ein physisches Gerät mit mehreren Schnittstellen kann durch mehrere Einträge mit derselben Zeichnungsbindung dokumentiert werden.

Kabellängen sind ausdrücklich erfasste reale Längen, keine Abstände der Symbole im Plan. Fehlende Segmente/Längen und unbekannte Air-Kapazitäten bleiben im Navigator und in Berichten erkennbar. Die 500-m-Prüfung gilt nur für die dokumentierten Datenleitungen, nicht für Spannungsfall oder die Dimensionierung der 24-V-Versorgung.

Implementierung: `src/model/BusProfiles.ts`, `src/model/BuildingAutomation.ts`; Referenz- und Grenzfalltests: `src/model/BuildingAutomation.test.ts`.
