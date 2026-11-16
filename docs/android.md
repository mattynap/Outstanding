# App Android

L'app Android è il progetto Capacitor in `packages/app/android/` (versionato). Il gioco web viene
compilato in `packages/app/www/` e copiato nell'app da `cap sync`.

## Strumenti

- **JDK 21** (Capacitor 8 lo richiede; il 17 non basta, il 25 è troppo nuovo per Gradle 8.14).
- **Android SDK** con `platform-tools`, `platforms/android-36` e `build-tools/36.1.0`. Basta la
  versione a riga di comando (`cmdline-tools`), Android Studio non serve.
- Il percorso dell'SDK va in `packages/app/android/local.properties` (non versionato):

  ```properties
  sdk.dir=C\:/percorso/android-sdk
  ```

## Comandi

Da `packages/app`, con `JAVA_HOME` che punta al JDK 21:

```bash
pnpm android:apk      # build web, cap sync, APK di debug
pnpm android:assets   # rigenera icona e schermata d'avvio da assets/make-art.mjs
```

L'APK di debug esce in `packages/app/android/app/build/outputs/apk/debug/app-debug.apk`: si
installa sul telefono copiandolo e aprendolo (serve consentire l'installazione da origini
sconosciute) oppure con `adb install -r app-debug.apk`.

## Icona e schermata d'avvio

Disegnate dal codice (`packages/app/assets/make-art.mjs`): la "O" d'oro con il pallone, sul campo
verde a strisce del tema. Lo script produce i PNG sorgente (1024 px l'icona, 2732 px lo splash);
`@capacitor/assets` ne ricava tutte le misure e l'icona adattiva di Android.

## Dati dell'app

- Identificativo: `it.outstanding.calcio` (definitivo: su Google Play non si può più cambiare).
- Versione: `versionName` in `android/app/build.gradle` allineato a `packages/app/package.json`;
  `versionCode` da incrementare a ogni build distribuita.
- Schermo intero: `viewport-fit=cover`; il contenuto delle pagine parte sotto la barra di stato
  (`--padding-top: env(safe-area-inset-top)` su `ion-content.o-page`), la barra in basso sopra la
  barra di navigazione di sistema.

## Non ancora fatto

La pubblicazione su Google Play (chiave di firma, AAB firmato, scheda dello store, verifica dei
nomi inventati sui registri dei marchi) è rimandata su decisione dell'utente.
