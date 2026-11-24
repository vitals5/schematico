# Klemmeneditor

**Projekt → Klemmeneditor…** ist der zentrale Ort für die Konfiguration. Derselbe Editor öffnet sich über **Eigenschaften → Schaltzeichen → Im Klemmeneditor bearbeiten…**, die Artikelansicht einer Klemme sowie über Klemmenkarten und Brücken in **Klemmen und Kabel**.

Unter **Einfügen → Klemme / Klemmenreihe…** startet direkt die Anlage mit einer Klemme als Vorgabe; für eine Reihe lässt sich die Anzahl erhöhen. **Einfügen → Klemmeneditor…** öffnet die bestehende Konfiguration. Beide Befehle sind auch im aufklappbaren **Element**-Menü der Werkzeugleiste erreichbar. Das Öffnen und Ausfüllen des Assistenten verändert das Projekt erst nach der geprüften Übernahme.

**Ansicht → Anschlussmarkierungen anzeigen** blendet die blauen Anschluss-Hilfskreise ein oder aus. Derselbe Schalter steht im Raster-Menü der Werkzeugleiste. Die Anzeige wird lokal gespeichert und verändert weder Projekt noch Anschlussbezeichnungen, Verdrahtung oder Autoconnect. Ausgeblendete Anschlüsse bleiben beim Verdrahten anwählbar; die aktive Fangmarkierung zeigt weiterhin das aktuelle Verbindungsziel. Kreise, die Teil des Bibliothekssymbols sind, werden nicht ausgeblendet; die Hilfsmarkierungen sind ohnehin kein Bestandteil des PDF-Exports.

## Klemmenreihe anlegen – ohne Symbolbibliothek

1. Links **＋ Klemmenreihe anlegen** wählen. In einem leeren Projekt ist derselbe Einstieg auch direkt in der Mitte sichtbar.
2. Das vorgeschlagene Kennzeichen (z. B. `-X1`) verwenden oder ändern. Anlage und Einbauort sind mit dem aktuellen Blatt vorbelegt und unter der gleichnamigen Aufklappsektion erreichbar.
3. Klemmentyp, Anzahl und erste Nummer festlegen. Die Anzeige nennt sofort den Nummernbereich. Durchgangs-, PE-, Drei-/Vierleiter-, Mehrstock-, Installations-, Trenn- und Sicherungsklemmen werden aus der normalen Bibliothek erzeugt. Pro Vorgang sind bis zu 100 Klemmen möglich.
4. Die automatische Blattwahl verwenden oder ein bestimmtes normales Stromlaufplanblatt wählen. Die Automatik erzeugt bei Bedarf weitere Blätter; bei einer bestehenden Reihe nutzt sie zuerst deren letzte geeignete Seite. Vorhandene Inhalte werden nicht verschoben. Die Platzierung erzeugt eine durchgehende horizontale Reihe mit gemeinsamer Achse und berücksichtigt Symbol- und Textgrenzen sowie das Raster. Reicht die Breite nicht aus, wird die Reihe auf einem weiteren Blatt fortgesetzt. Das Reihen-BMK steht jeweils an der ersten Klemme; alle Klemmen zeigen ihre Nummer. Die vollständigen BMKs bleiben für Artikel, Verweise und Prüfungen erhalten. Es entstehen keine automatischen Brücken zwischen den neuen Klemmen oder zum Bestand.
5. **Reihe anlegen und prüfen** zeigt die neue Reihe im gemeinsamen Entwurf und öffnet direkt die Änderungsprüfung. **Übernehmen** speichert. Das Blatt der ausgewählten neuen Klemme wird danach angezeigt.

Mit **Zunächst nur eine leere Reihe anlegen** wird nur die Reihe gespeichert; es entstehen weder Schaltzeichen noch neue Blätter. Zum Bestücken die Reihe links wählen und **＋ Klemmen hinzufügen** anklicken. Das funktioniert auch mit bereits vorhandenen Reihen. Die nächste freie fortlaufende Nummer wird vorgeschlagen; bereits vergebene Nummern werden nicht überschrieben. Verschiedene Klemmentypen lassen sich durch wiederholtes Ergänzen kombinieren.

**Abbrechen** verwirft nur die offenen Assistenteneingaben. Bis zur gemeinsamen Übernahme bleibt das Projekt unverändert. Auch angelegte Blätter und Klemmen gehören zum Entwurf und werden bei dessen Verwerfen vollständig zurückgenommen. Nach der Übernahme ist der gesamte Vorgang ein Rückgängig-Schritt. Die Klemmen sind normale editierbare Bibliothekselemente; Artikel können danach im Register **Artikel** zugeordnet werden.

## Orientierung

- **Links:** Klemmenleisten mit Anlage und Einbauort. Gleiche sichtbare Namen in unterschiedlichen Strukturkontexten bleiben getrennt.
- **Mitte:** Grafische Aufbauleiste und Tabelle mit Geräteposition, Klemmennummer, Etage, Haupt-/Nebenfunktion, Anschlusszielen, Artikel und Blatt. Eine Zeile oder Aufbauposition auswählen, um rechts ihre Einstellungen zu sehen.
- **Rechts:** Die Register **Funktion**, **Aufbau**, **Artikel**, **Brücken** und **Prüfung** bearbeiten dieselbe Auswahl und denselben Entwurf.

Die grafische Aufbauleiste stellt die physische Reihenfolge schematisch dar. Sie ist keine maßstäbliche Montagezeichnung. Die Tabelle zeigt 100 Platzierungen je Seite; die Suche berücksichtigt den vollständigen Bestand. Die Grafik ist auf die ersten 100 Positionen begrenzt. Weitere Positionen bleiben über Tabelle und Suche erreichbar. Keine dieser Anzeigegrenzen kürzt den CSV-Export.

## Sicherer Ablauf

1. Klemmenleiste und Klemme auswählen.
2. Gewünschte Einstellungen ändern und mit der passenden Schaltfläche **vormerken**.
3. Weitere Klemmen oder Register bearbeiten. Vorgemerkte Änderungen bleiben gemeinsam im Entwurf.
4. **Änderungen prüfen** zeigt die Unterschiede zum Ausgangsstand und die geänderten Artikelmengen.
5. **Übernehmen** speichert den gesamten Entwurf als einen rückgängig machbaren Projektschritt. Der Editor bleibt für die nächste Bearbeitung geöffnet.

Noch nicht vorgemerkte Eingaben blockieren einen Auswahl- oder Registerwechsel. **Eingaben zurücksetzen** verwirft sie. Die Pfeile im Fußbereich und Strg+Z/Strg+Umschalt+Z beziehungsweise Strg+Y bearbeiten die Entwurfshistorie. **Entwurf verwerfen** setzt alle vorgemerkten Änderungen zurück. Beim Schließen mit offenen Änderungen erscheint die Wahl **Weiter bearbeiten** oder **Verwerfen und schließen**. Ein inzwischen außerhalb des Editors geändertes Projekt wird bei der Übernahme nicht überschrieben.

## Funktion

Hier werden Leiste, Klemmennummer, Etage, Sortierkennung, Funktionstexte und die internen/externen Anschlussseiten gepflegt. Bei einem Symbol mit mehreren Etagen gibt es Beschriftungsfelder je Etage. Die Anschlusslogik stammt weiterhin aus der Bibliotheksdefinition; aus einem identischen BMK entsteht keine elektrische Verbindung.

Bei Teilklemmen gelten Nummer und Etage gemeinsam für alle Teilplatzierungen der logischen Funktion. Eine konfigurierte Klemme kann nicht ohne Klärung ihrer Bestückungszuordnung in eine andere Leiste umbenannt werden.

## Aufbau

**Auf diesem Blatt horizontal anordnen** richtet vorhandene unverdrahtete Klemmen der gewählten Reihe gerade aus und übernimmt die Reihenbeschriftung. Die Änderung wird als Entwurf geprüft; verdrahtete, gedrehte oder gruppierte Platzierungen werden nicht still verschoben.

**Früher / Später** verschiebt die vollständige Geräteposition. **Nach Sortierkennung** sortiert numerisch, hält Etagen zusammen und lässt Zubehör an seinen bisherigen Plätzen. Die Bestückung wird beim ersten benötigten Aufbauvorgang ausdrücklich im Entwurf angelegt; das bloße Öffnen des Editors verändert das Projekt nicht.

**Etagen aufteilen** erzeugt getrennt verschiebbare Schaltzeichen für die Etagen einer Mehrstockklemme. Unterste oder oberste Etage kann Hauptklemme sein. **Teilklemmen erstellen** erzeugt separat platzierbare Anschlusspunkte einer unterstützten Durchgangs-/PE-Klemmenfunktion. Dabei bleiben Anschlusspositionen, Leitungswege und die geprüfte elektrische Netzstruktur erhalten. Der Dialog nennt zugehörige Platzierungen und ihre Blätter.

Zum Zusammenfassen bereits einzeln gezeichneter Etagen die gewünschten Positionen über die Tabellenkästchen markieren. Die Markierung umfasst jeweils alle Mitglieder einer vorhandenen Geräteposition. Anschließend je Funktion eine eindeutige Etage angeben und **Zusammenfassen vormerken** wählen. Widersprüchliche Artikel, Zeichnungsgruppen oder unvollständige Zuordnungen werden zurückgewiesen. **Etagen trennen** löst eine geeignete physische Etagenzuordnung auf. Eine elektrische Teilklemmenfunktion darf dabei nicht still verloren gehen.

**Platzierung auf anderes Blatt verschieben** ist für unverdrahtete Platzierungen vorgesehen. X/Y bezeichnet den Einfügepunkt. Eine Veränderung der elektrischen Netzstruktur wird zurückgewiesen. **Im Schaltplan anzeigen** steht nach der Übernahme zur Navigation bereit.

**Zubehör hinzufügen** erzeugt eine unabhängige Bestückungsposition, beispielsweise einen Endhalter. Katalogauswahl, manuelle Artikeldaten, Menge, Bearbeiten und Entfernen bleiben im selben Editor. Ein mechanisch erfasster Brückenkamm erzeugt keine elektrische Brücke. Unter **Erweiterte Verwaltung** lässt sich eine Bestückung mit den vorhandenen Schutzregeln zurücksetzen; die Vorschau zeigt auch wegfallendes Zubehör.

## Artikel, Brücken und Prüfung

**Artikel** verwaltet Hauptartikel, Zubehör und Mengen für die ganze Geräteposition, auch wenn eine Nebenfunktion ausgewählt ist. Katalogdaten und ihre Nachweise werden beibehalten. Funktionsschablonen werden mit dem Anschlussbild verglichen; unbekannte Daten bleiben ungeprüft. Abweichende Typen oder das Ersetzen einer bestehenden Funktionszuordnung benötigen die ausdrücklich angezeigte Bestätigung. Das Zusammenfassen von Etagen ist kein Hersteller-Kompatibilitätsnachweis.

**Brücken** verbindet ausdrücklich gewählte Anschlussstellen und zeigt die vorhandenen Steck-/Drahtbrücken der Leiste. Bereits verbundene Anschlüsse und widersprüchliche feste Potenziale werden zurückgewiesen; insbesondere ist eine neue N–PE-Verbindung gesperrt. Die Vorschau nennt hinzugefügte beziehungsweise entfernte Brücken. Es werden keine zusätzlichen Leitungszüge über die Blattgrafik erfunden.

**Prüfung** zeigt Klemmenhinweise der ausgewählten Leiste und führt zur betroffenen Auswahl. Dies ersetzt nicht den vollständigen elektrischen Prüflauf. **Leiste als CSV** exportiert alle Klemmenzeilen der gewählten Leiste sowie ihre eigenständigen Zubehörpositionen. Die projektweiten Klemmen-, Kabel-/Ader- und Brückenlisten bleiben unter **Klemmen und Kabel → Daten & Berichte** verfügbar.

Bibliothek, Gerätezuordnung, Netzmodell und Projektdateiformat bleiben die gemeinsamen Grundlagen. Die Beschreibung der [Klemmentypen und Etagenfunktionen](terminal-functions.md) erläutert die elektrische Bedeutung der einzelnen Symbole.

Drei- und vieradrige Durchgangsklemmen verwenden beim Anlegen eine Bibliotheksvariante mit senkrechten Anschlüssen. Die zugehörige Funktionsdefinition und die Anschlusskennungen bleiben erhalten. Zahlen und Reihen-BMK werden in Editor, Vorschau und PDF nach derselben Darstellungsregel ausgegeben.
