---
name: "github-import-rewrite"
description: >-
  Cross-framework rewrite for GitHub repositories imported into AI Studio.
  Rewrites the imported project from its source framework to a different
  target framework while preserving core features and business logic.
---

You are asked to rewrite an imported GitHub project to a **target runtime** and
**target framework** specified in the user's message. The container has already
been provisioned with the correct target runtime — you do not need to detect or
configure it. Focus on building a new app in the target framework.

## CRITICAL RULES

1.  **DO NOT delete original source files until the new app compiles.** Build
    the entire new app first, verify with `compile_applet`, THEN clean up.
2.  Port 3000 on host `0.0.0.0` is the ONLY accessible port (web targets).
3.  npm only. No yarn, pnpm, bun.
4.  Preserve the app's existing features — do NOT add features that didn't
    exist.
5.  Do NOT restyle the application.

--------------------------------------------------------------------------------

## Step 1: Analyze Source Project

Read the full project structure. Understand before writing:

1.  Data models and schemas
2.  UI screens and components — the 3–5 most important features
3.  API routes and endpoints
4.  State management patterns
5.  External services (databases, APIs, auth)

--------------------------------------------------------------------------------

## Step 2: Build New App

The user's message tells you the target framework. Create the new project in the
root directory alongside the original files.

### Web Targets (React / Next.js / Angular)

**Runtime constraints:**

-   Node.js 22, npm only
-   Dev server MUST listen on port 3000, host `0.0.0.0`
-   `npm run dev` must start the app
-   Filesystem is ephemeral — no persistent local storage
-   HTTP(S) outbound only, no direct TCP to databases

**Project setup:**

-   Create `package.json` with correct deps and `"dev"` script
-   Set up TypeScript configuration
-   Standard directory structure (`src/`, `public/`, etc.)

**Framework-specific dev scripts:**

-   React (Vite): `"dev": "vite --host 0.0.0.0 --port 3000"`
-   Next.js: `"dev": "next dev -p 3000 -H 0.0.0.0"`
-   Angular: `"dev": "ng serve --host 0.0.0.0 --port 3000"`

### Android Targets

**Runtime constraints:**

-   Kotlin + Jetpack Compose, Gradle (Kotlin DSL)
-   JDK 21, Android SDK 36, AGP 9.1.1, Gradle 9.3.1
-   `compile_applet` triggers `assembleDebug`
-   APK at `app/build/outputs/apk/debug/app-debug.apk`
-   No product flavors. No `debug.keystore` modifications.
-   Debug signing: `storeFile = file("${rootDir}/debug.keystore")`, password
    `android`, alias `androiddebugkey`
-   Secrets: use Secrets Gradle Plugin reading `.env` / `.env.example`

### Implementation Priority

Work through features in this order:

1.  Layout, navigation, app shell
2.  Primary 1–3 screens (most important views)
3.  Data models (TypeScript interfaces / Kotlin data classes)
4.  CRUD operations
5.  Secondary screens
6.  Error states and edge cases

### External Dependencies

-   **Databases**: In-memory store, localStorage (web), or Room (Android)
-   **Third-party APIs**: Keep if accessible, mock if not
-   **Auth**: Stub with mock user or integrate Firebase

--------------------------------------------------------------------------------

## Step 3: Verify

Run `compile_applet`. If it fails:

1.  Read the error carefully
2.  Fix the specific issue
3.  Re-run `compile_applet`
4.  Repeat up to 3 times

If it fails 3 times: STOP and explain the error to the user.

--------------------------------------------------------------------------------

## Step 4: Clean Up Original Files (AFTER successful compile)

**Only after `compile_applet` succeeds**, delete ALL original source files that
belong to the source framework. Keep only reusable static assets (images, fonts,
data files, LICENSE, README.md).

Files to delete by source type:

-   **Python**: `*.py`, `requirements.txt`, `Pipfile`, `pyproject.toml`,
    `manage.py`, `alembic/`, `migrations/`
-   **Flutter/Dart**: `*.dart`, `pubspec.yaml`, `pubspec.lock`, `android/`,
    `ios/`, `macos/`, `linux/`, `windows/`, `web/`, `lib/`, `test/`
-   **Ruby**: `*.rb`, `Gemfile`, `Gemfile.lock`, `Rakefile`, `config.ru`,
    `config/`, `db/`
-   **PHP**: `*.php`, `composer.json`, `composer.lock`
-   **Java/Spring**: `*.java`, `pom.xml`, `build.gradle`, `src/main/java/`
-   **Go**: `*.go`, `go.mod`, `go.sum`
-   **Swift/iOS**: `*.swift`, `*.xcodeproj/`, `*.xcworkspace/`, `Podfile`,
    `Pods/`, `Supportive_Files/`
-   **Vue/Svelte**: `*.vue`, `*.svelte` and their config files
-   **Docker**: `Dockerfile`, `docker-compose.yml` (scan for env vars first)
-   **macOS**: `.DS_Store` files (recursive)

Also update `README.md` to describe the new project, not the original.

--------------------------------------------------------------------------------

## Completion

Output a summary:

-   What features were ported
-   What was stubbed or omitted (with TODOs)
-   Any known limitations
