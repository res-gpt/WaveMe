# WaveMe – Starterprojekt

Ein lokaler, mobiler Prototyp für scrollenden Text. Der MVP hat keine Anmeldung, kein Backend und keine Cloud-Datenbank. Mit Capacitor kann die Web-Oberfläche als Android-App gebündelt werden.

## Enthalten

- Scrollender Text mit Start/Stopp
- Geschwindigkeit und Schriftgrösse einstellbar
- Farbwahl
- Vollbild-Schaltfläche (abhängig von Browser/WebView)
- Keine Server-Aufrufe der App-Logik
- TypeScript + Vite + Capacitor

## Voraussetzungen

- Node.js LTS (npm ist enthalten)
- Android Studio für den Android-Build
- Android-Gerät mit aktivierten Entwickleroptionen/USB-Debugging, oder Emulator

## Lokal im Browser starten

```bash
npm install
npm run dev
```

Vite zeigt eine lokale URL an. Für den Test auf dem Handy im selben WLAN die vom Terminal angezeigte Netzwerkadresse verwenden, sofern Firewall und WLAN das erlauben. Für einen verlässlichen Offline-Test besser die native Android-App bauen.

## Android-App erzeugen

Im Projektverzeichnis:

```bash
npm install
npm run build
npx cap add android
npx cap sync android
npx cap open android
```

Falls `android/` bereits existiert, `npx cap add android` überspringen und stattdessen `npx cap sync android` ausführen.

Android Studio öffnet das Projekt. Ein Gerät verbinden und in Android Studio **Run** drücken. Das erste Gradle-Setup kann etwas dauern.

Nach Änderungen am Web-Code:

```bash
npm run build
npx cap sync android
```

Dann in Android Studio erneut starten.

## GitHub

1. Auf GitHub ein leeres Repository `waveme` erstellen.
2. Im entpackten Ordner:

```bash
git init
git add .
git commit -m "Initial WaveMe starter"
git branch -M main
git remote add origin https://github.com/DEIN-BENUTZERNAME/waveme.git
git push -u origin main
```

`DEIN-BENUTZERNAME` durch deinen GitHub-Benutzernamen ersetzen. Zugangsdaten nicht in Dateien committen.

## Offline-Hinweis

Die native App enthält die gebauten Web-Dateien lokal. Die App-Logik benötigt kein Backend. Die Schriftdatei wird aktuell über Google Fonts angefragt; wenn das Gerät offline ist, greift eine lokale System-Fallback-Schrift. Für einen vollständig netzwerkfreien Build kann die Google-Fonts-Importzeile in `src/style.css` entfernt werden.

## Bewusste Grenzen des ersten Prototyps

- Noch kein Accelerometer-/Gyroskop-Code und kein POV-Effekt.
- Kein automatisches Sperren des Bildschirms oder systemweites Immersive Mode.
- Das Scrollen ist ein erster Prototyp; unterschiedliche Displays und WebViews müssen getestet werden.
- iOS kann später mit Xcode auf einem Mac hinzugefügt und gebaut werden.

## Nächste sinnvolle Schritte

1. Auf dem Android-Gerät prüfen: Scrollfluss, lange Texte, Vollbild, Orientierung.
2. Offline-Test im Flugmodus.
3. Danach Gerätesensoren über eine passende Capacitor-Integration hinzufügen und den POV-Effekt separat evaluieren.
