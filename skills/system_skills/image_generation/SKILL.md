---
name: "image-generation"
description: >
  Use when the application needs to generate or update images — hero banners, illustrations, icons, backgrounds,
  avatars, product photos, or any visual asset. Covers image selection strategy
  (using tools vs assets vs placeholders) and runtime generation using Gemini
  models.
---

# Images

## Selection Strategy

Choose images that reinforce the app's purpose and visual identity.

-   **Important Assets (Hero images, etc.):** Use the `generate_image` tool to
    create these, especially if the request is specific. The name will have a
    timestamp in it. Make sure asset name and path you are referring to actually
    match. Aim for ~5 generated images per app or less. Use standard aspect
    ratios (16:9, 1:1, etc.) as detailed below in the prompt guidelines.
-   **Prefer known assets:** Attempt to use official, high-quality, publicly
    accessible CDN URLs or well-known asset repositories for the rest of the
    images.
-   **Fallback:** Use `https://picsum.photos/seed/test/{width}/{height}` for
    placeholder images if no known assets available.

## Implementation

Always use `<img>` elements with the following requirements:

-   **`referrerPolicy="no-referrer"`**: Required on every `<img>` tag to prevent
    broken images from referrer-restricted hosts.

```tsx
<img
  src="https://picsum.photos/seed/vibrant/1920/1080?blur=4"
  alt="Vibrant from Picsum"
  referrerPolicy="no-referrer"
/>
```

## Image Configuration

-   `aspectRatio`: Changes the aspect ratio of the generated image. Supported
    values are "1:1", "3:4", "4:3", "9:16", and "16:9", "1:4", "1:8",
    "4:1","8:1". The default is "1:1".

### Aspect Ratio Selection

Choose aspect ratio based on where the image will be used:

Use Case           | Aspect Ratio
------------------ | ------------
Hero / banner      | 16:9
Avatar / profile   | 1:1
Card thumbnail     | 4:3
Mobile full-screen | 9:16
Portrait           | 3:4

## Edit Images

-   To edit images using the tool, you can prompt with text, images or a
    combination of both.

## Prompt Guidelines

Write detailed, descriptive prompts for better image quality:

-   **Be specific**: "A serene mountain landscape at golden hour with
    snow-capped peaks reflected in a still alpine lake, photorealistic" — not
    "mountain".
-   **Include style**: photorealistic, watercolor, flat design, 3D render,
    minimalist, isometric, line art, pixel art, etc.
-   **Specify composition**: close-up, wide-angle, bird's-eye view, centered,
    rule-of-thirds, negative space.
-   **Match the app's theme**: if the app uses a dark theme with neon accents,
    describe that. If it's playful and colorful, reflect that in the prompt.
-   **Context-appropriate**: hero banners should be expansive landscapes or
    abstract patterns; product cards should be focused on a single subject;
    avatars should be portraits or icons.
