# JSON and CSV Export Examples

This directory provides concrete, validated example artifacts generated directly from the production builders of the GitHub Pages Auditor. These samples help external consumers understand the structural schemas and integration payload models.

## Sample Files

The following sample files are located in the `/examples` directory of the repository:

1. **V1 JSON Export Sample**: `examples/github-pages-auditor-export-v1.sample.json`
   - Maps to the **V1** JSON Schema: `schemas/github-pages-auditor-export-v1.schema.json`
   - Stable `$id`/`schemaId`: `urn:uuid:ef46fd93-424a-4e2a-8f5b-df97e28b2be1`
   - Represents the default flat export format.

2. **V2 JSON Export Sample**: `examples/github-pages-auditor-export-v2.sample.json`
   - Maps to the **V2** Draft JSON Schema: `schemas/github-pages-auditor-export-v2.schema.json`
   - Stable `$id`/`schemaId`: `urn:uuid:7d0f98be-8cba-49c5-84dc-66914b5da3f2`
   - Represents the nested, highly-structured machine interchange format candidate.

3. **V1 CSV Export Sample**: `examples/github-pages-auditor-export.sample.csv`
   - Contains exactly 27-column spreadsheet representation derived from the flat V1 data.
   - Built-in defenses against CSV formula injection (prefixed formula trigger characters with a single quote).

---

## Represented Use Cases in Samples

The sample files are generated from the standard fixtures containing representative test cases:

### 1. GitHub Pages Disabled
- **Repository**: `TakashiSasaki/disabled-pages-repo`
- **V1 Fields**: `hasPages: false`, `pagesEnabled: false`, `deploymentMethod: "not_applicable"`
- **V2 Findings**: Contains a `pages_disabled` finding (`category: "pages"`, `severity: "info"`).

### 2. Pages Enabled without Custom Domain
- **Repository**: `TakashiSasaki/no-custom-domain`
- **V2 Details**: Deployed using Git Actions (`deployment.method = "workflow"`). Custom domain config is clean, with no domain configured.
- **V2 Findings**: Pushes `pages_enabled_no_custom_domain` and `pages_deploy_method_workflow` info findings.

### 3. Custom Domain with Blank verification state
- **Repository**: `TakashiSasaki/custom-domain-blank-protected`
- **Normalization**: The raw `protectedDomainState` is empty or undefined, which correctly derives to an app-normalized verification state of `"unknown"`.
- **V2 Findings**: Contains a warning finding: `custom_domain_unknown`.

### 4. Custom Domain with Verified Ownership and Active HTTPS
- **Repository**: `TakashiSasaki/custom-domain-enforced`
- **V2 Details**: Deployed from branch root (`deployment.method = "branch_root"`). Custom domain status is fully verified (`customDomain.verificationState: "verified"`) and HTTPS is enforced (`https.enforced: true`).
- **V2 Findings**: Displays `custom_domain_verified` and `pages_deploy_method_branch_root`.

### 5. Custom Domain with unenforced HTTPS (Problematic)
- **Repository**: `TakashiSasaki/custom-domain-unenforced`
- **V2 Details**: Deployed from docs folder (`deployment.method = "branch_docs"`). Custom domain ownership is verified, but HTTPS enforcement is explicitly disabled (`https.enforced: false`).
- **V2 Findings**: Pushes critical/error findings: `pages_https_not_enforced` and `custom_domain_https_not_enforced`.

---

## Absolute Security Compliance

Every generated scenario strictly implements secret-minimization. No personal access tokens (PATs), Firebase IDs, authorization headers, or database paths are stored or leaked within the schema payloads. All timestamps and run identifiers are safely controlled via execution build contexts.
