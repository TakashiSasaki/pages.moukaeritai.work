# GitHub Pages Auditor - UI Regression Test Plan
Version: `1.1.0` (Pre-Production Validation Baseline)

This document contains the requirements and test matrix for the **frontend user interface regression testing**. Since deploying heavier testing frameworks (such as Playwright, Cypress, or Puppeteer) inside sandboxed containerized workspaces introduces runtime execution risks, this plan outlines the exact manual validation and future E2E automation matrix.

---

## 1. UI E2E Test Matrix

### A. Authentication & Landing (Logged-Out Session)
| Test ID | Scenario | Expected Interaction | Successful Outcome |
| :--- | :--- | :--- | :--- |
| **AUT-01** | Landing Page Render | User visits `/`. | Page loads immediately; displays the distinctive dark header visual banner, responsive columns, and zero telemetry noise. |
| **AUT-02** | Google Sign-In Visibility | Page loads in logged-out state. | Employs an exact primary action button styled with the Google logo called "Sign in with Google". |
| **AUT-03** | Guest Mode Visibility | Page loads in logged-out state. | Provides a subtle fallback action with a Ghost icon called "Use Temporary Guest Session". |
| **AUT-04** | Config Outage Notification | `firebase-applet-config.json` fails local parsing. | Replaced by a high-contrast warning banner notifying the developer that Firebase is unprovisioned. |

### B. Navigation & General UI Controls
| Test ID | Scenario | Expected Interaction | Successful Outcome |
| :--- | :--- | :--- | :--- |
| **NAV-01** | Support Help Modal | User clicks "What's this app?". | Opens a clean modal detailing Security & Custom Domain Auditor goals, emphasizing the read-only environment and transient token usage. Modal dismisses on close. |
| **NAV-02** | User Profile Menu | Authenticated user clicks the user circle/portrait. | Displays profile name, ID, provider tag, and a clear "Sign Out" option. |
| **NAV-03** | Sign Out Action | User clicks "Sign Out". | State is immediately cleared; app transitions back to the logged-out landing screen. |

### C. Workspace & GitHub Audit Flow
| Test ID | Scenario | Expected Interaction | Successful Outcome |
| :--- | :--- | :--- | :--- |
| **AUD-01** | Token Submission | User inserts a valid GitHub Personal Access Token (PAT). | Saved feedback appears, active controls unlock, and PAT is stored safely in Firestore (or React state for guest mode). |
| **AUD-02** | Execution Audit | User clicks "Start Audit Scan". | Active loader displays, pagination updates from `/user/repos`, list parses, and individual repo results load dynamically. |
| **AUD-03** | Custom Domain Parsing | Scanning a repository utilizing verified custom domains in Pages. | Correctly tags the row with green Custom Domain verified label. |
| **AUD-04** | Error Classification | Inputting an expired/invalid PAT. | Scrape fails, highlighting the global result tracker card with actionable error tag (`token_invalid_or_expired`). |

### D. Export Exporters
| Test ID | Scenario | Expected Interaction | Successful Outcome |
| :--- | :--- | :--- | :--- |
| **EXP-01** | JSON Schema Match | User clicks "Export JSON". | Downloader triggers presenting conforming file output without leaking Firestore user paths or authorization tokens. |
| **EXP-02** | CSV Injection Defense | Repo with name containing `=SUM(1,2)` is audited. | Exported file cell is sanitarily pre-fixed with double-quotes `"` or escapes to prevent remote formula triggers. |

---

## 2. Standard E2E Playwright Configuration Sketch

For future automation, we recommend configuring Playwright within a dedicated subdirectory. Below is the blueprint configuration:

```typescript
// e2e/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],
});
```
