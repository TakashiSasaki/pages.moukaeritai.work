---
name: "google-maps-platform"
description: >
  Provides architectural guidance and generates production-ready code for
  applications using Google Maps Platform. Specializes in building
  software with location APIs and SDKs such as Places API (New), Routes API, and Address
  Validation API, utilizing modern React patterns. Dynamically retrieves
  documentation and code context via the rpc_action tool to provide accurate
  implementation details. Use this skill
  when you need to implement any location-based application task or solution,
  such as a Store Locator, Checkout/shipping experiences with address
  validation, data visualizations on maps, or directions routing logic in a React
  application.
---

## Objective

Provide production-ready code patterns for Google Maps Platform integrations.
The goal is to help users go from zero to a working, polished map application
using modern GMP APIs, ensuring clean and minimal code.

## API Product Mapping

Use this use-case-to-product mapping to pick the right GMP products for common
mapping scenarios:

| Use Case                        | Products                                 |
| ------------------------------- | ---------------------------------------- |
| Store locator / local discovery | Map + Places API (New) — Nearby Search + |
|                                 | Routes API + AdvancedMarkers             |
| Address entry / checkout        | Places API (New) — Autocomplete          |
|                                 | (PlaceAutocompleteElement) + Address     |
|                                 | Validation API                           |
| Data visualization (heatmaps,   | Map + deck.gl overlay (via               |
| clusters)                       | `@deck.gl/google-maps`)                  |
| Directions / routing            | Map + Routes API (Route.computeRoutes) + |
|                                 | createPolylines()                        |
| Place search / details          | Places API (New) — Text Search / Place   |
|                                 | Details via useMapsLibrary('places')     |

## Dynamic Documentation & Code Search

When you need the latest GMP code patterns, library versions, or specific API
implementation details that are not covered in your static knowledge, you MUST
use the `rpc_action` tool.

**Technical Details for `rpc_action`:**

-   **service_name:** "gmp"
-   **method_name:** "RetrieveCodeAssistContext"
-   **arguments:** `{ "query": "string" }` (e.g., `{ "query": "React Advanced Markers clickable example" }`)

**Usage Guidelines:** 1. Identify the specific technical gap (e.g., "How do I use the new Places Autocomplete in React?"). 2. Call `rpc_action` with `service_name="gmp"` and `method_name="RetrieveCodeAssistContext"`. 3. Use the returned context to generate accurate, up-to-date code.

## Knowledge Synthesis

The `rpc_action` tool provides general, up-to-date documentation for Google Maps
Platform. However, you MUST always prioritize and apply the environment-specific
rules defined in the **Constitution** and **Critical Failures** sections of this
skill.

For example: If the RPC tool provides a code sample using legacy
`DirectionsService` or omitting the AI Studio Vite config, you MUST refactor
that code to use `Route.computeRoutes` and include the required Vite config as
specified in this skill.

## Constitution

SYSTEM RULES — Violating any rule produces a broken app:

1.  **API KEY SETUP (MANDATORY — EVERY FIRST RESPONSE MUST DO ALL THREE):** When
    the user has not yet provided an API key, you MUST do ALL THREE of the
    following. Skipping any one causes the user to get stuck:

    **A) TRIGGER THE "ENTER YOUR ENVIRONMENT VARIABLE TO CONTINUE" POPUP:** To
    enable the "Enter your environment variable to continue" popup, you MUST
    FIRST create the vite.config.ts file (see Vite Config skeleton) to expose
    the environment variable to the browser. THEN, your application code MUST
    reference process.env.GOOGLE_MAPS_PLATFORM_KEY. Without the vite.config.ts
    in place first, the process.env variable will be undefined in the browser,
    and the key from AI Studio Secrets will be invisible.

    **B) INCLUDE SETUP INSTRUCTIONS IN YOUR TEXT REPLY:** Your chat response
    MUST also include these instructions in case the popup doesn't appear:

    > **To add your API key:** 1. Get an API key:
    > https://console.cloud.google.com/google/maps-apis/start?utm_campaign=gmp-code-assist-ais
    > 2. When the **"Enter your environment variable to continue"** popup
    > appears, paste your API key and press **Enter**. 3. Or manually: Open
    > **Settings** (⚙️ gear icon, top-right corner) → **Secrets** → type
    > `GOOGLE_MAPS_PLATFORM_KEY` → **Enter** → paste key → **Enter**. 4. The app
    > rebuilds automatically - no page reload needed.

    **C) RENDER SPLASH SCREEN IN CODE:** The app MUST display a splash screen
    with setup instructions when `hasValidKey` is false (see 2D Map skeleton).

    **CRITICAL:** AIS secrets are injected at **build time**. After adding a
    secret, the user presses Enter and the app rebuilds automatically. Do NOT
    include a "reload page" button — a browser reload will NOT pick up the new
    key.

2.  **ATTRIBUTION:** ALL code MUST include `internalUsageAttributionIds` with
    value `gmp_mcp_codeassist_v1_aistudio` on every `<Map>` component.

3.  **FRAMEWORK POLICY:**

    -   React → MUST use `@vis.gl/react-google-maps` (never `google-map-react`
        or `@react-google-maps/api`).
    -   Angular → MUST use `@angular/google-maps`
        (https://github.com/angular/components/tree/main/src/google-maps).
    -   Always use `version="weekly"`.

4.  **COST AWARENESS:** GMP is pay-as-you-go with per-SKU free usage caps:

    -   Essentials: 10K free calls/month (map loads, geocoding, basic place
        fields)
    -   Pro: 5K free calls/month (places with ratings/hours/phone)
    -   Enterprise: 1K free calls/month (places with reviews, atmosphere data)
    -   Places API (New) fields determine billing tier — request only what you
        need (see Places API (New) Field Reference).
    -   Pricing: https://developers.google.com/maps/billing-and-pricing/pricing

5.  **NO LLM PLACE DATA:** All place data MUST come from GMP APIs, not LLM
    knowledge. DO NOT call any LLM to summarize or search for places.

## Critical Failures

MEMORIZE — These are the top runtime-error vectors. Violating ANY rule causes
silent failure or crash:

CF1 — CORS TRAP: Client-side `fetch()` to `googleapis.com` is BLOCKED by CORS.
ALWAYS use SDK wrappers (e.g., `importLibrary('places')`,
`importLibrary('routes')`).

CF2 — MAP HEIGHT COLLAPSE: `<Map>` (and `<gmp-map>`) needs explicit CSS height
(e.g., `height: '100vh'`). It silently collapses to 0x0 otherwise.

CF3 — INVISIBLE MARKERS: Custom HTML markers need explicit CSS sizing (`width:
40px; height: 40px;`). Without it they render at 0x0.

CF4 — SCHEMA HALLUCINATION: Places API (New) — Place Details uses `displayName`
(NOT `name`), `formattedAddress` (NOT `formatted_address`), `location` (NOT
`geometry.location`). `displayName` is a string in the JS SDK (unlike REST where
it's `{text, languageCode}`).

CF5 — LATLNG TRAP: Prefer POJO `{lat, lng}` literals. When class instance
required, use `new google.maps.LatLng(lat, lng)`. `LatLng` is from
`importLibrary("core")`, NOT `"maps"`.

CF6 — DEPRECATED PROPERTY TRAP: `PinElement.element` deprecated → use
`marker.appendChild(pin)`. `PinElement.glyph` deprecated → use `glyphText` or
`glyphSrc`. `AdvancedMarkerElement.content` (property setter) deprecated → use
`.appendChild()`. Use `addEventListener('gmp-click')` with `gmpClickable: true`
(GA since v3.62).

CF7 — DEPRECATED APIS: - NEVER use `DirectionsService` or `DirectionsRenderer`.
Use `Route.computeRoutes()` via `useMapsLibrary('routes')` in React or
`importLibrary('routes')` in vanilla JS. - NEVER use `HeatmapLayer` from the
visualization library (deprecated May 2025, removal May 2026). Use deck.gl
`HeatmapLayer` via `@deck.gl/aggregation-layers` with `GoogleMapsOverlay`.

CF8 — WEB COMPONENT PROPERTY vs ATTRIBUTE TRAP: React doesn't pass props as
properties to Web Components — it stringifies them into HTML attributes. For any
GMP web component used in React (e.g., `PlaceAutocompleteElement`), mount it
imperatively via `useRef` + `useEffect` and set properties directly on the DOM
element. NEVER pass complex objects (Circle, LatLngBounds, arrays) as JSX
attributes.

CF9 — PLACES API (NEW) FIELDS REQUIRED: `fetchFields()` (Place Details),
`searchByText()` (Text Search), `searchNearby()` (Nearby Search) all require a
`fields` array. Properties are `undefined` until fetched. Only request fields
you need (affects billing tier — see Places API (New) Field Reference below).

CF10 — NEARBY SEARCH REQUIRES `locationRestriction` with `{center, radius}` (max
50,000m). It does NOT accept `locationBias`. This is for `Place.searchNearby()`
only.

CF11 — TEXT SEARCH uses `textQuery` (NOT `query` or `text`). This is for
`Place.searchByText()` only.

CF12 — PHOTOS TRAP: Photos use `place.photos[0].getURI({maxWidth: 400})` — it's
`getURI()` NOT `getUrl()`. Photos are available via Place Details
`fetchFields({fields: ['photos']})`.

CF13 — ROUTE.COMPUTEROUTES FIELDS: `Route.computeRoutes()` requires a `fields`
array. Use `['path']` for basic polyline, `['speedPaths']` for traffic-colored
polylines. Must also pass `travelMode` (string: `'DRIVING'`, `'WALKING'`,
`'BICYCLING'`, `'TRANSIT'`).

CF14 — VITE ENV VARIABLE: process.env.GOOGLE_MAPS_PLATFORM_KEY will be undefined
in the browser, and the API key from AI Studio Secrets will NOT be accessible,
UNLESS vite.config.ts is created with the correct define block: define: {
'process.env.GOOGLE_MAPS_PLATFORM_KEY':
JSON.stringify(process.env.GOOGLE_MAPS_PLATFORM_KEY || '') }. This file MUST be
created FIRST for all React apps
