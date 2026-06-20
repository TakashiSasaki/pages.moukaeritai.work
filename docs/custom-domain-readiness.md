# GitHub Pages Auditor - Custom Domain Integration and Verification Guide
Version: `1.5.2` (Public No-Auth E2E & Patch Version Governance Baseline)

This document maps out the operational verification and history for mapping the **GitHub Pages Auditor** Cloud Run service to its production canonical custom domain.

---

## 1. Domain Status Overview

*   **Custom Domain State**: Fully mapped, active, and verified.
*   **Primary Canonical URL**: `https://pages.moukaeritai.work`
*   **Active Fallback Runtime URL**: `https://github-pages-auditor-1042140630327.asia-east1.run.app` (within `asia-east1` region).
*   **Custom Domain Target**: `pages.moukaeritai.work` (subdomain of `moukaeritai.work`)
*   **Current Milestone**: Milestone 1.5.2 (Public No-Auth E2E & Patch Version Governance Baseline)

---

## 2. Cloud Run Custom Domain Mapping Setup

Google Cloud Run allows mapping custom domains to services using Google-managed certificates. Once the mapping is triggered via the Google Cloud Console or `gcloud` CLI:

1.  **Console Mapping Navigation**: Go to Cloud Run -> Manage Custom Domains -> Add Mapping.
2.  **Service Binding**: Bind `pages.moukaeritai.work` directly to the live `github-pages-auditor` Cloud Run service in `asia-east1`.
3.  **DNS Verification**: Google Cloud uses standard Domain Verification (via TXT records or Search Console ownership) to confirm permissions prior to provisioning.

---

## 3. Network & DNS Requirements

After triggering the custom domain mapping, the following DNS adjustments must be performed on your domain registrar/DNS provider:

*   **DNS and Cloud Run mapping are fully applied and verified.**
*   The CNAME record dynamically maps `pages.moukaeritai.work` to the Google Cloud Run infrastructure endpoint.

### DNS Record Setup (Example)
*   **For Subdomain (`pages.moukaeritai.work`)**: Set up a **CNAME** record (Note: Exact DNS values must be confirmed by Cloud Run at the time of assignment):
    ```text
    NAME: pages
    TYPE: CNAME
    VALUE: ghs.googlehosted.com.
    TTL: 3600 (or default)
    ```

---

## 4. HTTPS Certificate Provisioning

*   **SSL Managed Certificates**: Google automatically provisions and renews managed Let's Encrypt SSL certificates for mapped custom domains.
*   **DNS Propagation Timeframe**: Certificate provisioning begins immediately upon DNS record verification. It normally takes between **15 minutes to 24 hours** to fully propagate and resolve worldwide.
*   **Fallback Status**: While SSL is provisioning, use the original default Cloud Run URL to access the site.

---

## 5. Critical Third-Party Settings Updates

To avoid service outages and client runtime crashes once the custom domain resolves, the following configurations **must** be updated concurrently:

### A. Firebase Auth Authorized Domains Update
Every URL that hosts the application must be explicitly allowlisted in your Firebase Project to allow sign-ins (specifically Google Popup or Federated actions):
1.  Navigate to **Firebase Settings** -> **Authentication** -> **Settings** -> **Authorized Domains**.
2.  Click **Add Domain** and input the final custom domain address exactly: `pages.moukaeritai.work`.
3.  *Warning*: Failing to complete this step will trigger immediate `auth/unauthorized-domain` errors upon any sign-in trial from the custom domain.

### B. Environment Variable updates (`APP_URL`)
On the Cloud Run service revision configuration:
1.  Update the **`APP_URL`** environment variable from the default Cloud Run URL to your new custom domain URL (including protocol):
    `APP_URL=https://pages.moukaeritai.work`
2.  Redeploy the service (this spins up a new revision automatically).

---

## 6. Coexistence & Fallback Rollback Plan

*   **Dual Serving**: Google Cloud Run keeps serving the application from both the original default endpoint (`*.run.app`) and the custom domain Mapping. Both endpoints can coexist safely.
*   **Rollback Strategy**: If there are issues with DNS routing, SSL handshake failures, or third-party auth outages, update the DNS record instantly or revert users back to the default `run.app` service address. Nothing is modified inside the container files themselves during this mapping.

---

## 7. Post-Domain Integration Smoke Test Checklist

Once the DNS records are active and the custom domain mapped:
1.  [ ] **DNS Verification**: Run `dig CNAME pages.moukaeritai.work` to verify it returns `ghs.googlehosted.com.` (or the exact value confirmed from Cloud Run).
2.  [ ] **SSL Verification**: Navigate to `https://pages.moukaeritai.work` in your browser. Confirm the padlock icon is green and no SSL certificate warning displays.
3.  [ ] **Redirect / APP_URL Verification**: Check that all internal assets and APIs utilize `/api` paths correctly.
4.  [ ] **Auth Verification**: Click "Sign in with Google". Confirm the OAuth login flow succeeds and doesn't throw auth domain failures.
5.  [ ] **Audit Run Performance**: Run a full PAT validation and audit scan to confirm end-to-end integration is intact.
