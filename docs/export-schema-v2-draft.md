# GitHub Pages Auditor - Proposed V2 Export Schema Architecture

This document designs and drafts the **Version 2 (v2)** data interchange schema, registered under `github-pages-auditor.export.v2`. 

While the **V1** schema (current default) utilizes a flat, single-level dictionary optimised for CSV grids, the **V2** design (draft/interchange candidate) leverages deeply nested, domain-focused JSON sub-objects to achieve structural clarity and clean machine readability.

### Samples and Tooling
External consumer tools and developers can evaluate V2 payloads by inspecting:
- `examples/github-pages-auditor-export-v2.sample.json`
- The definition schema located at `schemas/github-pages-auditor-export-v2.schema.json`

For referencing the stable `$id` and schema version, a local schema manifest is maintained in `schemas/schema-identifiers.json`. Please note that the identifier takes the form of a stable URN (`urn:uuid:...`), but remote schema lookups or registry resolution are out of scope. Validation should be performed locally using the files provided.

---

## 1. Why Transition to V2?
*   **Structural Honesty**: Prevents namespaces pollution by grouping raw GitHub properties and local app classifications into domain-isolated maps.
*   **Decoupled Findings**: Replaces multi-purpose tag array fields (`classification[]`, `errorClassification`) with a unified, structured `findings[]` registry.
*   **Strict String Typings**: Implements formalized RFC-3339 constraints and URI matching patterns across dates and links.
*   **No Silent Failures**: Fully separates unknown values (such as cases where GitHub API doesn't report CNAME protection) from explicitly unverified/denied handshakes.

---

## 2. Structural Composition

The JSON tree of a V2 export adopts the following hierarchy:
```
{
  "$schema": "...",
  "schemaVersion": "github-pages-auditor.export.v2",
  "exportedAt": "2026-06-19T13:00:00Z",
  "application": { ... },
  "auditRun": { ... },
  "summary": { ... },
  "repositories": [
    {
      "repository": { ... },
      "pages": {
        "deployment": { ... },
        "customDomain": { ... },
        "https": { ... },
        "healthCheck": { ... }
      },
      "findings": [ ... ]
    }
  ]
}
```

---

## 3. Sub-Object Specification

### A. Repository Definition (`repositories[].repository`)
Separates raw repository fields.
```json
{
  "githubId": "104214",
  "githubIdNumber": 104214,
  "ownerLogin": "TakashiSasaki",
  "name": "GitHub-Pages-Auditor",
  "fullName": "TakashiSasaki/GitHub-Pages-Auditor",
  "htmlUrl": "https://github.com/TakashiSasaki/GitHub-Pages-Auditor",
  "visibility": "public",
  "isPrivate": false,
  "isArchived": false,
  "isDisabled": false,
  "isFork": false,
  "defaultBranch": "main",
  "githubHasPagesRaw": true,
  "createdAt": "2026-01-01T12:00:00Z",
  "updatedAt": "2026-06-19T03:00:00Z",
  "pushedAt": "2026-06-19T03:15:00Z"
}
```

### B. Pages Configuration & Deployment (`repositories[].pages.deployment`)
Combines raw settings with local strategy analysis.
```json
{
  "enabled": true,
  "statusRaw": "built",
  "htmlUrl": "https://takashisasaki.github.io/GitHub-Pages-Auditor/",
  "settingsUrl": "https://github.com/TakashiSasaki/GitHub-Pages-Auditor/settings/pages",
  "publicRaw": true,
  "deployment": {
    "method": "branch_docs",
    "githubBuildTypeRaw": "legacy",
    "sourceBranch": "main",
    "sourcePath": "/docs",
    "displaySummary": "main:/docs"
  }
}
```

### C. Custom Domain Handshake (`repositories[].pages.customDomain`)
Separates GitHub's raw fields from derived verification state, preventing unverified locks from being conflated with blank/unreported values.
```json
{
  "configured": true,
  "cnameRaw": "auditor.sasaki.dev",
  "hostname": "auditor.sasaki.dev",
  "githubProtectedDomainStateRaw": null,
  "verificationState": "unknown",
  "pendingUnverifiedAt": null,
  "stateSource": "derived"
}
```

### D. HTTPS and Transport Security (`repositories[].pages.https`)
Tracks transport encryption settings and SSL states.
```json
{
  "enforced": false,
  "certificate": {
    "stateRaw": "approved",
    "description": "Certificate is approved",
    "domains": ["auditor.sasaki.dev"],
    "expiresAt": "2026-09-19T13:00:00Z"
  }
}
```

---

## 4. Uniform Findings Engine (`findings[]`)

Rather than relying on loosely typed classification arrays, the v2 schema translates alerts into granular observation components:

```json
[
  {
    "code": "pages_https_not_enforced",
    "category": "https",
    "severity": "error",
    "source": "github_pages_api",
    "message": "HTTPS redirection is not enforced despite having an active static Pages site configuration.",
    "evidence": {
      "github_https_enforced_raw": false
    }
  },
  {
    "code": "custom_domain_https_not_enforced",
    "category": "custom_domain",
    "severity": "error",
    "source": "app_derived",
    "message": "Custom domain is registered but HTTPS transport redirection is disabled.",
    "evidence": {
      "cname": "auditor.sasaki.dev",
      "https_enforced": false
    }
  }
]
```

---

## 5. Strict Type & Format Metadata Constraints
To guarantee schema tooling validation (e.g., validator engines downstream):
1.  **Format RFC-3339 Date-Time**: Fields including `exportedAt`, `startedAt`, `finishedAt`, `createdAt`, `updatedAt`, `pushedAt`, `expiresAt`, and `pendingUnverifiedAt` must validate against `"format": "date-time"`.
2.  **URIs matching**: External URLs (`htmlUrl`, `pagesUrl`, `settingsUrl`) must strictly match `"format": "uri"`.
3.  **Large IDs Precautions**: `githubId` is serialized as a string value in addition to the numeric `githubIdNumber` to avoid precision truncation inside target architectures lacking 64-bit float representations.
