# External Consumer Guide
Version: `1.4.0` (Documentation Consistency & Active Domain Baseline)

This document provides instructions for external systems and users consuming data exported by the GitHub Pages Auditor. The application supports exporting audit data in JSON and CSV formats.

## Schema Identification
All exported JSON files are defined by a JSON Schema. You can identify the schema identity and version using two fields located at the root of the exported JSON:
- `schemaVersion`: A human-readable identifier of the schema (e.g., `github-pages-auditor.export.v2`).
- `schemaId`: A stable and opaque machine identifier mapping to a specific JSON Schema version. It takes the form of a UUID standard URN: `urn:uuid:7d0f98be-8cba-49c5-84dc-66914b5da3f2`.

### Available Schema Versions
1. **Version 2 (V2) - Current Default JSON:** Deeply-nested structure designed for system-to-system interchange. `schemaVersion: "github-pages-auditor.export.v2"`.
2. **CSV - Separate Format:** A flat export format targeting spreadsheet ingestion. CSV is NOT V1 JSON, and is an entirely separate flat export mechanism.

For JSON exports, you will find `schemaId` inside the exported payload, which must strictly match the `$id` of the actual JSON Schema definitions. These schema documents are self-contained and version-controlled alongside this application.

## Sample Assets and Validation
Sample datasets that emulate different repository configurations—such as disabled pages, workflow deployments, and unverified custom domains—are provided under the `examples/` directory inside this project:
- `examples/github-pages-auditor-export-v2.sample.json`
- `examples/github-pages-auditor-export.sample.csv`

The `schemas/schema-identifiers.json` file is a local manifest that binds a human-readable `schemaVersion` to its absolute `schemaId` and the relative `path` for its definition file.

To validate your consumption toolchain correctly handles these outputs, point your JSON Schema validator (e.g., Ajv) at the schemas listed in `schemas/*.schema.json`.

## Crucial Constraints (What NOT to assume)
External consumers MUST be aware of the following architectural constraints:
- **No Remote Schema Resolver**: We do not provide a remote schema hosting or dereferencing lookup endpoint. Your application cannot fetch the schemas over the network simply by parsing the URN. `schemaId` is considered an opaque identifier.
- **No Schema Registry**: There is no live registry. Schema validation should rely on resolving schemas statically from files during compilation or ingestion.
- **No OAuth or GitHub App Integrations**: The provided raw data is collected using Personal Access Tokens (PATs) exclusively. The application performs strict, read-only queries. 
- **No Secret Fields**: Export packages are explicitly designed for safe transmission. They do not leak backend contexts, Authorization headers, PATs, Database UIDs, or raw tokens. Token contexts might carry a "tokenType" value (e.g., `"classic"`) but never the sensitive payload.

## Payload interpretation
Here is a functional translation of the most important concepts found inside standard nested representations (`schemas/github-pages-auditor-export-v2.schema.json`):

- **`repository`**: Summarized metadata reflecting the GitHub target project (Visibility, Fork state, Archived state).
- **`pages`**: Configuration flags corresponding to whether GitHub pages are completely disabled (`enabled: false`), or built (`status`).
- **`deployment`**: Describes how the pages site gets constructed. The "workflow" build method denotes GitHub Actions execution, while the "legacy" pipeline uses Git source paths (either "branch_root" or "branch_docs").
- **`customDomain`**: The `cname` config mapped by the user. An `unverified` status means the domain config sits in the UI but lacks DNS verification confirming ownership. 
- **`https`**: Certificates issued and managed for custom domains. Pay special attention to the `httpsEnforced` boolean.
- **`findings`**: Derived signals injected autonomously to simplify data aggregation for compliance.

### Severity and Actionability
The `findings` output array is automatically aggregated (V2) or heavily encoded (V2's customDomainVerificationState columns).
Findings carry a `severity` property, typically `info`, `warning`, or `error`. An error indicates actionable, insecure issues (e.g., HTTPS not enforced, unverified domains) that need to be prioritized. Warnings denote edge conditions (such unknown legacy states) that require manual review.

## Handling Future Configurations
Always consume the payload strictly looking at `schemaId`. Breaking changes or restructuring will result in a completely new URN UUID, ensuring your pipelines fail safely instead of silently corrupting data imports during major schema transitions.
