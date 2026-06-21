# GitHub Pages Auditor - UI Regression Test Plan
Version: `1.7.5` (Organization Scan Contract & Baseline Hardening)

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

### E. Launcher & Visual Presentation
| Test ID | Scenario | Expected Interaction | Successful Outcome |
| :--- | :--- | :--- | :--- |
| **LAU-01** | Launcher Rendering Stability | Launcher cards render with custom sorting and spacing. | No NaN zIndex values produced during calculation. |
| **LAU-02** | Card Z-Index Ordering | User long-presses or expands a specific card detail state. | The active card is securely elevated in z-index; it must not be visually occluded by adjacent cards. |
| **LAU-03** | Launcher Persisted Order | Order changes are applied to the active arena layout. | Card ordering must remain stable after refresh and navigation through Firestore `launcherLayout` (v3) persistence. |
| **LAU-04** | Launcher Settings Persistence | User adjusts Animation Speed or Visible Icons Range. | Settings are saved to Firestore; reloading the page or switching views restores the user's custom presentation preferences. |
| **LAU-05** | Compact Metadata Bubble | User long-presses over a launcher tile. | A dense, compact metadata bubble appears. Release or drag closes the bubble correctly. No visual regression on adjacent tiles. |
| **LAU-06** | External Link Safety | User clicks launching links for target GitHub Pages. | External links must open gracefully with `target="_blank"` and `rel="noopener noreferrer"` attributes. |
| **LAU-07** | Self-Contained Assets | Network inspector check during launcher render. | No requests are made to `transparenttextures.com` or other unapproved external UI asset domains. |
| **LAU-08** | Repository-Name Default Pages Badge | View circular text for default GitHub Pages project URLs. | Circular text correctly displays the repository name in green. Branch names are not used. Custom-domain sites still use domain text. Repository name does not overflow badly. |
| **LAU-09** | Direct-DOM Physics Rendering | User actively drags a launcher tile. | Dragging remains visually smooth. Cards settle accurately. Direct transform updates do not break click/drag behavior. Final order persistence still works after drag end. No NaN zIndex. |
| **LAU-10** | Precise Observer Boundary | User scrolls launcher cards in and out of the viewport. | Circular badge animation runs when visible, and pauses exactly when exiting the viewport outside of the absolute bounds (no preload margin). Resumes on exact re-entry. Dragging does not get stuck. |

### F. Release Gate Integrity
| Test ID | Scenario | Expected Interaction | Successful Outcome |
| :--- | :--- | :--- | :--- |
| **REL-01** | Maintenance Contract Index Alignment | Run `npm run release:check`. | Contract index exists; release gate validates key contracts; docs do not drift from package version; Launcher contracts remain covered. |

---

## 2. Automated Testing Scope

Full authenticated browser E2E (e.g. Playwright, Cypress) is **deselected from the current maintenance roadmap** and must **not** be added by coding agents.

The accepted automated public check is **public no-auth smoke** (`npm run smoke:public`). This script asserts that the application starts, binds to the expected port, and serves the core unauthenticated UI routes correctly without injecting API tokens or attempting browser automation.
