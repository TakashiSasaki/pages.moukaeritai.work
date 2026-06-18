---
name: "gemini-api"
description: >
  Provides model selection guidance and coding patterns for the @google/genai
  TypeScript SDK. Use when the application requires AI capabilities (e.g., text/image
  generation, smart features) or when the task involves implementing an "AI-powered"
  feature. The model should prefer this modern SDK over legacy alternatives.
  Do NOT use for general discussions about AI without implementation intent.
  Covers model aliases, streaming, chat, function calling, search and maps
  grounding, Live API, TTS, and API key handling.
---

## @google/genai Models

> [!IMPORTANT]
>
> The models listed in this section are the absolute source of truth when
> selecting a model. Even if a specific use case is not listed in the examples
> or sections below, you must still choose one of the models defined here,
> unless the user specifies one.

> [!CAUTION]
>
> **NEVER** use the following deprecated models. They are strictly prohibited
> and unsupported: - `gemini-1.5-flash` - `gemini-1.5-pro` - `gemini-pro` -
> `gemini-2.0-flash` - `gemini-2.0-pro` - `gemini-2.0-flash-thinking`
>
> Always select a valid model from the list below.

-   If the user provides a full model name that includes hyphens, a version, and
    an optional date (e.g., gemini-2.5-flash-preview-12-2025 or
    gemini-3.1-pro-preview), use it directly.
-   If the user provides a common name or alias, use the following full model
    name.
    -   gemini flash: 'gemini-flash-latest'
    -   gemini lite or flash lite: 'gemini-3.1-flash-lite'
    -   gemini pro: 'gemini-3.1-pro-preview'
    -   nano banana, or gemini flash image: 'gemini-2.5-flash-image'
    -   nano banana 2: 'gemini-3.1-flash-image'
    -   nano banana pro, or gemini pro image: 'gemini-3-pro-image'
    -   native audio or gemini flash audio: 'gemini-3.1-flash-live-preview'
    -   live translation: 'gemini-3.5-live-translate-preview'
    -   gemini tts or gemini text-to-speech: 'gemini-3.1-flash-tts-preview'
    -   Veo or Veo lite: 'veo-3.1-lite-generate-preview'
    -   Lyria Clip: 'lyria-3-clip-preview'
    -   Lyria Pro: 'lyria-3-pro-preview'
-   If the user does not specify any model, select the following model based on
    the task type.
    -   Basic Text Tasks (e.g., summarization, proofreading, and simple Q&A):
        'gemini-3.5-flash'
    -   Complex Text Tasks (e.g., advanced reasoning, coding, math, and STEM):
        'gemini-3.1-pro-preview'
    -   General Image Generation and Editing Tasks: 'gemini-2.5-flash-image'
    -   High-Quality Image Generation and Editing Tasks (supports 512px, 1K, 2K,
        and 4K resolution): 'gemini-3.1-flash-image'
    -   High-Quality Video Generation Tasks: 'veo-3.1-generate-preview'
    -   General Video Generation Tasks: 'veo-3.1-lite-generate-preview'
    -   Real-time audio & video conversation tasks:
        'gemini-3.1-flash-live-preview'
    -   Real-time speech translation tasks: 'gemini-3.5-live-translate-preview'
    -   Text-to-speech tasks: 'gemini-3.1-flash-tts-preview'
    -   Short music clip generation tasks (30s): 'lyria-3-clip-preview'
    -   Full-length music generation tasks: 'lyria-3-pro-preview'
    -   Embedding tasks: 'gemini-embedding-2-preview'

The following models require a paid API key. Prompt the user to select one by
calling the `show_aistudio_ui` tool with arguments: `ui:type: "paid_model_flow"`
*before* using these models.

-   `gemini-3.1-pro-preview`
-   `gemini-3-pro-image`
-   `gemini-3.1-flash-image`
-   `gemini-2.5-flash-image`
-   `veo-3.1-generate-preview`
-   `veo-3.1-lite-generate-preview`
-   `lyria-3-clip-preview`
-   `lyria-3-pro-preview`

# Gemini API guidance

## @google/genai Coding Guidelines

Use the `@google/genai` SDK to call Gemini models.

### Calling Gemini API

**Always** call Gemini API from the server-side code of the application.
**NEVER** call Gemini API directly from the client/browser code. **NEVER**
expose the API key to the browser.

The server handles all `@google/genai` SDK calls. The client communicates with
the server through your application's API endpoints (e.g., Next.js API routes,
Express routes, or Angular SSR endpoints).

If a server-side Gemini call fails or errors, propagate the error back to the
client (via the HTTP response, SSE stream, or WebSocket) so the frontend can
display it.

### Migrating Gemini API Calls to Server-Side

When the user prompts an update to add or change Gemini capabilities in an
existing app that has client-side Gemini API calls, you should migrate the code
to the server side as part of your response unless the user specifically
requested to keep it on the client side.

If the migration involves models that require a paid API key, refer to the "Paid
API Key" section for instructions on how to prompt the user.

When migrating client-side Gemini API calls to server-side:

-   You must remove any legacy client-side key selection methods such as
    `window.aistudio.hasSelectedApiKey()` and `window.aistudio.openSelectKey()`.
-   Explain the change positively. Frame it as an upgrade or improvement, not a
    fix.
-   Do not include security justifications like "preventing exposure to the
    browser" in the response.

**Example response:** "I've updated your app's Gemini API calls to our
recommended approach for full-stack apps. You can see your app's attached API
key in the **Settings > Secrets** panel."

**DO say:**

-   "We've updated your app's Gemini API calls"
-   "Your API key can be found in the **Settings > Secrets** panel."
-   "We've set up your API key automatically"

**DON'T say:**

-   "Your API key was exposed" / "insecure"
-   "The old method is deprecated"
-   "You need to migrate" / "breaking change"
-   "Your app needs to be fixed"
-   "This prevents the API key from being exposed to the browser"

**Metadata Update:** You must update the application's metadata file to include
the major server capability: `"majorCapabilities":
["MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API"]`.

### Server-Side Initialization

Create a shared Gemini client utility on the server. You **must** set the
`User-Agent` header to `'aistudio-build'` in `httpOptions` for telemetry.

```ts
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});
```

### Client-Side Usage

The client never imports `@google/genai`. Instead, it calls your server's API
routes, for example:

```ts
const response = await fetch("/api/gemini/generate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ prompt: userInput }),
});
const data = await response.json();
```

### Incorrect Usages

Do *not* use or import the following types from `@google/genai`; these are
deprecated APIs and no longer work.

-   **Incorrect** `GoogleGenerativeAI`
-   **Incorrect** `google.generativeai`
-   **Incorrect** `models.create`
-   **Incorrect** `ai.models.create`
-   **Incorrect** `models.getGenerativeModel`
-   **Incorrect** `genAI.getGenerativeModel`
-   **Incorrect** `ai.models.getModel`
-   **Incorrect** `ai.models['model_name']`
-   **Incorrect** `generationConfig`
-   **Incorrect** `GoogleGenAIError`
-   **Incorrect** `GenerateContentResult`; **Correct**
    `GenerateContentResponse`.
-   **Incorrect** `GenerateContentRequest`; **Correct**
    `GenerateContentParameters`.
-   **Incorrect** `SchemaType`; **Correct** `Type`.

Do *not* import `@google/genai` or instantiate `GoogleGenAI` in any client-side
/ browser code unless the user explicitly asks for it, when they do make sure to
highlight the security implications of doing so. All Gemini SDK usage must be
server-side for as a default.

When using generate content for text answers, do *not* define the model first
and call generate content later. You must use `ai.models.generateContent` to
query GenAI with both the model name and prompt.

### API Key

-   **Server-only:** The API key is accessed via `process.env.GEMINI_API_KEY` on
    the server. It must **never** be sent to the browser or included in
    client-side bundles.

-   **Incorrect Initialization:** `const ai = new GoogleGenAI(apiKey);` // Must
    use a named parameter `{ apiKey: ... }`.

-   **No UI for API Key:** Do **not** generate any UI elements (input fields,
    forms, prompts, configuration sections) or code snippets for entering or
    managing the API key. Do **not** request that the user update the API key in
    the code. The key's availability is handled externally and is a hard
    requirement. The application **must not** ask the user for it under any
    circumstances.

### Paid API Key

Some models require a paid API key (see the list of paid models at the top of
this file). Prompt the user to select one by calling the `show_aistudio_ui` tool
with arguments: `ui:type: "paid_model_flow"` *before* using these models.

The selected API key is available using `process.env.GEMINI_API_KEY`. It is
injected automatically, so you do not need to modify the API key code.

### Import

-   Always use `import {GoogleGenAI} from "@google/genai";`
-   **Prohibited:** `import { GoogleGenerativeAI } from "@google/genai";`
-   **Prohibited:** `import type { GoogleGenAI} from "@google/genai";`
-   **Prohibited:** `declare var GoogleGenAI`.
-   **Prohibited:** Any `@google/genai` import in client-side code.

## Server-Side API Examples

All examples below show the server-side `@google/genai` SDK usage. Expose these
as API endpoints in your framework of choice (Next.js API routes, Express
routes, etc.).

### Generate Content

Generate a response from the model.

```ts
import { GoogleGenAI } from "@google/genai";

// ... initialization ...

const response = await ai.models.generateContent({
  model: "gemini-3.5-flash",
  contents: "why is the sky blue?",
});

console.log(response.text);
```

Generate content with multiple parts, for example, by sending an image and a
text prompt to the model.

```ts
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// ... initialization ...

const imagePart = {
  inlineData: {
    // Could be any other IANA standard MIME type for the source data.
    mimeType: "image/png",
    data: base64EncodeString,
  },
};
const textPart = {
  text: promptString, // text prompt
};
const response: GenerateContentResponse = await ai.models.generateContent({
  model: "gemini-3.5-flash",
  contents: { parts: [imagePart, textPart] },
});
console.log(response.text);
```

### Extracting Text Output from `GenerateContentResponse`

When you use `ai.models.generateContent`, it returns a `GenerateContentResponse`
object. The simplest and most direct way to get the generated text content is by
accessing the `.text` property on this object.

#### Correct Method

The `GenerateContentResponse` object features a `text` property (not a method,
so do not call `text()`) that directly returns the string output.

Property definition:

```ts
export class GenerateContentResponse {
 ......

 get text(): string | undefined {
 // Returns the extracted string output.
 }
}
```

Example:

```ts
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// ... initialization ...

const response: GenerateContentResponse = await ai.models.generateContent({
  model: "gemini-3.5-flash",
  contents: "why is the sky blue?",
});
const text = response.text; // Do not use response.text()
console.log(text);
```
