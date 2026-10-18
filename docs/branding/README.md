# Schematico-Branding

Die vom Projektinhaber bereitgestellte [Originalvorlage](brand-sheet.png) enthält Logo- und Iconvarianten auf transparentem Hintergrund.

| Verwendung | Datei |
| --- | --- |
| README, helle Hintergründe | `public/branding/logo.png` |
| README im Dunkelmodus, Über-Dialog | `public/branding/logo-dark.png` |
| Programmkopf | `public/branding/icon-64.png` neben dem Namen |
| Browser-Tabs | `public/favicon.ico`, `public/branding/icon-16.png` und `icon-32.png` |
| Installierte Web-App | `public/branding/icon-192.png` und `icon-512.png` |
| Android mit runder oder anderer Iconmaske | `public/branding/icon-maskable-512.png` |
| iPhone/iPad-Startbildschirm | `public/branding/apple-touch-icon.png` |
| Windows-EXE, Installer und Deinstallation | `build/icon.ico` |
| Desktop-Fenster und nativer Über-Dialog | `public/branding/icon-256.png` im gepackten `dist/` |

Das App-Icon und das Logo für helle Hintergründe stammen aus der Originalvorlage. Die Variante für dunkle Hintergründe wurde mit Bildbearbeitung als helle Silber/Blau-Fassung abgeleitet; ihre [Quelldatei](logo-dark-source.png) bleibt ebenfalls erhalten. Im schmalen Programmkopf steht das Symbol neben normalem Text, damit der Name auch bei kleinen Bildschirmgrößen gut lesbar bleibt.

Die Icons behalten ihr Seitenverhältnis und haben einen transparenten Rand. Die gesonderte maskierbare Variante besitzt einen deckenden Hintergrund und zusätzlichen Sicherheitsabstand. Das Windows-ICO enthält 16, 24, 32, 48, 64, 128 und 256 Pixel große Darstellungen.

Alle fertigen Assets sind eingecheckt; normale npm- und Windows-Builds benötigen keine Bildbearbeitungswerkzeuge. Zum erneuten Erzeugen der Varianten wird **ImageMagick 7** benötigt:

```bash
bash scripts/prepare-branding.sh
```

Web- und Desktop-Version verwenden dieselben Assets. Relative Pfade unterstützen sowohl die Veröffentlichung unter `/schematico/` als auch die lokale Desktop-App.
