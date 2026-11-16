# Makroparameter und Wertesätze

Im Makroauswahldialog öffnet **Parameter & Wertesätze…** den Konfigurationseditor. Beim Platzieren eines Makros mit eigenen oder importierten Parametern erscheint derselbe Dialog. Änderungen erfolgen an einer Kopie; die externe Quelldatei wird nicht geschrieben.

## Eigene Parameter

Unter **Parameter und Bindungen bearbeiten**:

1. Einen eindeutigen Namen und einen Standardwert angeben, beispielsweise `Leistung` und `5,5`.
2. Ein enthaltenes Element und seine Eigenschaft wählen, beispielsweise **Technische Daten**.
3. Die Vorlage eingeben, beispielsweise `<Leistung> kW`.
4. **Parameter / Bindung übernehmen** wählen.

Derselbe Parameter kann mehrere Elemente oder unterschiedliche Eigenschaften beschriften. Eine bestehende Bindung lässt sich über denselben Namen, dasselbe Ziel und dieselbe Eigenschaft mit einer neuen Vorlage ersetzen. Eigene Parameter lassen sich entfernen. Vorlagen mit mehreren Parametern sind möglich, sobald alle enthaltenen Namen definiert sind. Widersprüchliche Vorlagen derselben Zieleigenschaft und fehlende Zielobjekte werden abgelehnt.

Unterstützt werden BMK, Funktionstext, Zusatztext, technische Daten, Gerätebezeichnung, Anlage, Ort und bei Seitenmakros der Blatttitel. Standardwerte werden über die Wertespalte bearbeitet und beim lokalen Speichern übernommen. Leere Werte sind zulässig. Parameternamen unterscheiden Groß-/Kleinschreibung.

## Benannte Wertesätze

Die aktuellen Parameterwerte lassen sich unter einem Namen speichern. **Als neuen Wertesatz anlegen** erzeugt eine weitere Auswahl, **Wertesatz speichern/aktualisieren** ersetzt den ausgewählten Satz, und **Wertesatz entfernen** löscht ihn aus der Entwurfskopie. Gleiche Namen sind nicht mehrfach zulässig.

Die Auswahl **Standard / eigene Werte** lädt die Parameterstandards; ein benannter Satz lädt dessen gespeicherte Werte. Anschließend können einzelne Werte vor dem Einfügen überschrieben werden. **Vorschau prüfen** zeigt die resultierenden Elementtexte. **Mit diesen Werten platzieren** startet die normale Makroplatzierung mit dieser Kopie. Bei mehrseitigen Quellen bleibt die Auswahl der einzufügenden Quellseite erhalten; der vorhandene Befehl zum Hinzufügen ganzer Makroseiten verwendet dieselben Werte.

Wertesätze konfigurieren Texte und Strukturkennzeichnungen. Sie berechnen keine elektrischen Bemessungswerte und schalten keine geometrischen Schaltungsvarianten um. Die normalen BMK-Eindeutigkeitsregeln bei der Platzierung gelten weiterhin.

## Speichern und Austausch

**Konfiguration lokal speichern** ist ausdrücklich erforderlich, damit Parameter und Wertesätze nach dem Schließen erhalten bleiben. Bei eigenen lokalen Makros wird der Eintrag aktualisiert. Bei mitgelieferten Vorlagen, externen Makros und Artikelpaketen entsteht eine eigene lokale Kopie. Zwischenzeitlich geänderte lokale Makros werden nicht still überschrieben; Speicherfehler werden angezeigt.

Parameterbindungen und Wertesätze liegen am Makro unter `configuration`. Der normale Makroexport und JSON-basierte Reimport erhalten diese Daten. Sie werden nicht automatisch in einen gemeinsamen Katalog veröffentlicht. Bereits platzierte Schaltungen werden durch spätere Änderungen der Makrobibliothek nicht verändert.

## Importierte Variablen

Vorhandene native Variablen erscheinen mit ihren Bindungen in derselben Wertetabelle. Ihre Quellbindungen bleiben erhalten; eigene Bindungen verwenden eigene Parameternamen. Unveränderte importierte Standards werden nicht erneut auf Zieltexte angewendet, weil bei komplexen Vorlagen nicht immer ein zuverlässiger Einzelstandard aus den Quelldaten ableitbar ist. Änderungen bekannter Quellfelder werden wie bisher übernommen. Unbekannte Quellfelder bleiben als Metadaten erhalten und erzeugen einen sichtbaren Hinweis.

Die Anwendung führt keine Formeln, Skripte oder beliebigen Eigenschaftspfade aus. Geometrie, Anschlüsse und Leitungswege bleiben bei der Parameterkonfiguration erhalten. Importierte oder eigene vollständige Makrogeometrien werden weiterhin als normale editierbare Elemente platziert.
