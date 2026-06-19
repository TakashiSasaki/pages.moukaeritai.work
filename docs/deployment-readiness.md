# GitHub Pages Auditor - Deployment Readiness Baseline
Version: `1.1.0` (Release Candidate Milestone)

This document formalizes the production deployment strategies, architectural targets, and infrastructure requirements for the **GitHub Pages Auditor** application.

---

## 1. Architectural Summary

GitHub Pages Auditor is a full-stack application:
*   **Frontend**: Client-side single-page application (SPA) built with React, TypeScript, Vite, and Tailwind CSS.
*   **Backend**: Light proxy and REST API server implemented in Express.js + Node.js (TypeScript/esbuild).
*   **Database**: Direct Firestore client integration via the Firebase Client SDK.
*   **Auth**: Direct client integration with Firebase Authentication (Google & Anonymous).

Because the backend serves as a secure proxy to handle GitHub API calls (using the temporary `x-temp-pat` header mechanism) and validates incoming Firebase ID tokens, you **cannot** run this application purely on static-site hosting solutions (like basic Firebase Hosting or GitHub Pages) without a dynamic server component.

---

## 2. Intended Deployment Target Option Analysis

### Option A: Cloud Run (Highly Recommended Target)
*   **Description**: Packaged as a standard Docker container running Express, serving both the REST API and the bundled static assets.
*   **Pros**:
    *   Direct matching of the current development, validation, and container runtime environment.
    *   Scale-to-zero capabilities for cost efficiency.
    *   Simplified container security and environment variable injection behind Google Cloud Secret Manager.
*   **Configuration**: Standard port 3000 ingress target with CJS server runtime entry `node dist/server.cjs`.

### Option B: Firebase App Hosting
*   **Description**: Next-generation hosting from Firebase built specifically for full-stack framework-driven workflows (supporting Node.js, NextJS, Vite servers natively).
*   **Pros**:
    *   Full-stack builds managed automatically from Git repos.
    *   Simplified configuration under a unified billing boundary.

### Option C: Firebase Hosting + Cloud Run Rewrites
*   **Description**: Static UI assets deployed directly to Firebase CDN, with all `/api/*` calls routed asynchronously to an Express backend running on Cloud Run.
*   **Pros**:
    *   Blazing-fast frontend asset loads from CDN edge caching.
    *   Lower server loads since Express only processes API requests.

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
