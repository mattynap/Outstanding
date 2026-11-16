---
name: android-build
description: "Come si compila l'APK Android su questa macchina, icona dell'app e insidie trovate (JDK 21, sdk.dir, gradlew.bat)"
metadata:
  node_type: memory
  type: project
  originSessionId: ba3e7028-a690-4902-a1e6-0b641b622f63
  modified: 2026-11-16T20:38:52.721Z
---

L'app Android (Capacitor 8) sta in `packages/app/android/` ed è versionata; istruzioni per chiunque
in `docs/android.md`. Decisione dell'utente (2026-11-16): **creare l'app, non pubblicarla** finché
non lo chiede.

**Su questa macchina:**
- SDK: `C:\Users\User\tools\android-sdk` (cmdline-tools, platform-tools, `platforms/android-36`,
  `build-tools/36.1.0`). Il nuovo `sdkmanager` vuole i nomi con `/` (`platforms/android-36`), non `;`.
- JDK: `C:\Users\User\tools\jdk-21.0.13+9`. Capacitor 8 vuole Java 21 come toolchain; il JDK 17
  (JAVA_HOME di sistema) e il 25 (nel PATH) non vanno.
- Comando (Git Bash): `export JAVA_HOME='C:\Users\User\tools\jdk-21.0.13+9'
  ANDROID_HOME='C:\Users\User\tools\android-sdk'; pnpm android:apk` da `packages/app`.
  JAVA_HOME va in forma Windows, non `/c/...`, perché lo legge `gradlew.bat`.
- `android/local.properties` (non versionato): `sdk.dir=C\:/Users/User/tools/android-sdk` — con le
  barre normali; i backslash nel file properties sono caratteri di escape.
- APK: `packages/app/android/app/build/outputs/apk/debug/app-debug.apk`; copia per l'utente in
  `C:\Users\User\Desktop\Outstanding.apk`.

**Insidie risolte:**
- Lo script npm usa cmd: serve `.\gradlew.bat`, non `gradlew`.
- `.gitattributes` forza CRLF per `*.bat` (con LF gli script .bat di Windows si rompono).
- ESLint e Prettier ignorano `android/` (contiene JS generato da Capacitor).
- Schermo intero (`viewport-fit=cover`): `ion-content.o-page` ha
  `--padding-top: env(safe-area-inset-top)` per non finire sotto la barra di stato.

**Icona** (`packages/app/assets/make-art.mjs`, rigenerare con `pnpm android:assets`): pallone
classico crema/nero dentro un anello d'oro (la "O" di Outstanding) su campo verde a strisce, colori
del tema (`#0b1f15`, `#f2b830`, `#f1ebdd`). Lo splash usa lo stesso marchio più piccolo. All'utente
sono state offerte alternative (stemma, figurina, prima pagina): in attesa di risposta.

Collegato: [[progress]], [[app-design]], [[tooling]].
