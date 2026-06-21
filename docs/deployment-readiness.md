# GitHub Pages Auditor - Deployment Readiness Baseline
Version: `1.6.21` (Organization Scan Contract & Baseline Hardening)

This document formalizes the production deployment status, custom domain readiness, and infrastructure requirements for the **GitHub Pages Auditor** application.

---

## 1. Architectural Summary

GitHub Pages Auditor is a full-stack application:
*   **Frontend**: Client-side single-page application (SPA) built with React, TypeScript, Vite, and Tailwind CSS.
*   **Backend**: Light proxy and REST API server implemented in Express.js + Node.js (TypeScript/esbuild).
*   **Database**: Direct Firestore client integration via the Firebase Client SDK.
*   **Auth**: Direct client integration with Firebase Authentication (Google & Anonymous).

Because the backend serves as a secure proxy to handle GitHub API calls (using the temporary `x-temp-pat` header mechanism) and validates incoming Firebase ID tokens, you **cannot** run this application purely on static-site hosting solutions (like basic Firebase Hosting or GitHub Pages) without a dynamic server component. Firebase Hosting alone cannot run the Express backend.

---

## 2. Active Deployment Target: Cloud Run (Live Runtime)

The application is already running on **Google Cloud Run** in containerized production. This is the active, live runtime environment.

*   **Current Live Production URL**: [https://github-pages-auditor-1042140630327.asia-east1.run.app](https://github-pages-auditor-1042140630327.asia-east1.run.app)
*   **Region**: `asia-east1`
*   **Status**: Active & Live
*   **Active Custom Domain**: `pages.moukaeritai.work`
*   **Custom Domain Status**: Active and canonical.
*   **Current Milestone**: Milestone 1.6.21 (Organization Scan Contract & Baseline Hardening)

### Deployment Runtime Details:
*   **Container Image**: Dual-stage light Alpine build with Node.js 20.
*   **Configuration**: Standard port 3000 ingress target, binding dynamically via `process.env.PORT` in the container.
*   **Startup command**: `node dist/server.cjs` (standard standalone JS output compiled by `esbuild`).

---

## 3. Required Pre-Deployment Configuration Steps

Before performing a final production deployment, the following setup must be fully completed:

### A. Environment Variable Checklist
Ensure your hosting environment (Cloud Run, App Hosting, etc.) securely defines:
1.  `NODE_ENV`: Set to `"production"`.
2.  `ALLOW_DUMMY_AUTH`: Ensure this is set to `"false"` (or completely omitted) to enforce strict, cryptography-backed Firebase ID Token signature verification.
3.  `APP_URL`: Set to the public-facing URL of your deployed application (e.g., `https://gpa-auditor.web.app`).

### B. Firebase / Firestore Configuration
*   **Database Provisioning**: Ensure a Firestore Database instance is active.
*   **Client Configuration**: Ensure the React frontend is successfully loaded with client details (stored in `./firebase-applet-config.json` inside the repository) by executing `set_up_firebase`.
*   **Rules Enforcement**: Deploy the baseline `firestore.rules` file to restrict third-party and cross-tenant access.

---

## 4. How to Deploy the Rules

You can deploy the Firestore security rules to production using the Firebase CLI:

```bash
# Install Firebase CLI if not already installed
npm install -g firebase-tools

# Login to your Google account
firebase login

# select the correct Firebase project (if .firebaserc contains it, otherwise use option)
firebase use <your-firebase-project-id>

# Deploy only the Firestore rules
firebase deploy --only firestore:rules
```

---

## 5. Deployment Verification Instructions

1.  **Boot Up**: Build the production bundle with `npm run build` and run `npm run start`.
2.  **Verify Asset Serving**: Navigate to the homepage, confirm CSS compiles correctly and the logged-out login layout is responsive.
3.  **Confirm Firebase Setup Warning**: If Firebase is not provisioned or `firebase-applet-config.json` is missing/corrupted, verify that a red banner displays a clean warning in both logged-out and header slots of the page without crashing the DOM.
4.  **Enforce Safe API Proxy Scope**: Test any non-allowlisted endpoint through the backend proxy. Verify that requests fail fast with `400 Bad Request` or throw strict block errors before making any outward network requests.
