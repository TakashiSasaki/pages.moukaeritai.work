# Full Report Table UI Design (v1.7.29)

Version: `1.7.29` (Full Report Table UI Stabilization)

## 1. Purpose and Scope
This document governs the layout, design, and structural requirements of the Full Report table utilized in the `/results/:auditId/report` view (primarily implemented inside `src/components/Dashboard.tsx`).
Any future updates to this view, the table, or its surrounding virtual scroll container must strictly adhere to the rules outlined here to prevent layout/column weight regressions.

---

## 2. Design Principles
To maintain a high-density, professional, and visually stable dashboard, we enforce the following layout rules:
- **Deterministic Column Widths**: Column widths are mathematically defined in code and must remain identical regardless of active filters, visible row count, or empty states.
- **Content-Independence**: No cell value, filter control box, or error classification badge may resize any column. Column widths must never fluctuate.
- **Mobile Viewport Behavior & Horizontal Scrolling**: We design with desktop-first precision but expect mobile viewing around 375px. Rather than stretching or compressing columns to squeeze them into view, we allow the table to naturally overflow its parent box, exposing a horizontal scroll bar.
- **Repository Name Wrapping**: While security statuses, custom domains, and deploy sources truncate gracefully, repository names are permitted to wrap natively to prevent critical names from being cut off.
- **Compact Auxiliary Columns**: Non-repository columns must remain compact and utilize text truncation on overflow.

---

## 3. Column Width Model
To prevent content-based dimension calculations, we avoid using Tailwind's `w-max`, `w-full` on tables, or raw percentage weights on headers. Instead, we use a single source of truth for column widths:

### Single Source of Truth
The exact layout configuration is defined using a constant like `REPORT_TABLE_COLUMNS` and its corresponding CSS style mapping:
- **`--report-col-index`**: `50px` (Index serial numbers)
- **`--report-col-repository`**: `330px` (Allows wrapping repository titles and meta badges)
- **`--report-col-pages`**: `180px` (Compact Pages active status badge)
- **`--report-col-deploy`**: `170px` (Publishing source and branch)
- **`--report-col-domain`**: `240px` (CNAME configurations and verification indicators)
- **`--report-col-https`**: `240px` (Enforcement and SSL certificate diagnostics status)

The cumulative width (`1210px`) is set explicitly on the table block:
```ts
const reportTableStyle = {
  width: '1210px',
  // Individual columns derive their widths directly from CSS variables
};
```

We utilize HTML `<colgroup>` and `<col>` elements directly paired with these CSS properties to guarantee strict column enforcement at the browser-engine level before laying out dynamic content.

---

## 4. Filter UI Model
To keep the layout deterministic, all interactive filter controls (including search bars, Pages Status select boxes, Custom Domain dropdowns, and HTTPS configuration selectors) must remain **fully separated from the table header**.
- **The Problem**: Native `<select>` boxes have variable intrinsic minimum widths dictated by their longest options, translated text, or browser vendor platforms. If placed inside a table header, they will instantly force that column to stretch, destroying the alignments.
- **The Solution**: All filters must participate only in a high-density toolbar positioned *above* or *outside* the table's scrollable view boundary. The actual table headers contain only text labels.

---

## 5. Header Help-Button Model
- **Header labels wrapping**: Header labels can wrap natively. Header height is not artificially constrained, nor does it have fixed height limits.
- **Mobile Stacking Behavior**: On mobile (viewports below `sm` break point), the label and help button "?" are stacked vertically (`flex-col`, `gap-0.5`). This prevents the wide label and button layout from consuming valuable horizontal width space or forcing the column wider on mobile layouts.
- **Desktop/Tablet Layout**: On `sm` and larger screens, labels and help "?" buttons align horizontally (`sm:flex-row`, `sm:items-center`, `gap-1`), keeping them compact and elegant.
- **Sticky Layout Alignment**: If any multi-row header element is ever introduced in future phases, the second rows must compute dynamic positions using `ResizeObserver` or inline calculations rather than fixed pixel assumptions (such as avoiding hardcoated `top-[31px]` offsets) to prevent overlaps.

---

## 6. Filter Help-Button Model
- **Filter Toolbar Layout**: Standard filter labels on the toolbar include a small `HelpCircle` "?" button next to them to grant equal descriptive accessibility.
- **Unified Action Modals**: These help buttons call the same underlying `setColumnGuideModal(...)` handlers as the table header cells.
- **No Help Content Duplication**: The application reuses the unified `COLUMN_HELP` and modal views, avoiding duplication and maintaining a single source of help text truth.

---

## 7. Row Content Model
- **Repository Wrap Pattern**: Repository anchors are styled using `whitespace-normal break-words [overflow-wrap:anywhere] min-w-0 max-w-full leading-tight`. This enables natural wrapping within the strict `330px` boundary.
- **Auxiliary Column Truncation**: Status badges and text elements utilize text truncation (`truncate`, `max-w-full`, and `min-w-0` on wrapping flex layouts) to guarantee they do not stretch their parents.
- **Compact Meta Bubbles**: Error classifications or small state annotations are rendered as inline-block elements that fit within standard high-density paddings.

---

## 8. Virtualization and Scroll Consolidation
The Full Report table leverages a high-performance, deterministic virtual scroll rendering engine to seamlessly support thousands of repositories:
- **Fixed `ROW_HEIGHT` Assumption**: Virtual row layouts operate under a fixed row height assumption. If dynamic variable-height rows are required, the virtual list calculation will require a complete redesign.
- **Scroll State Reset on Filter Mutation**: Changing search terms, custom domain settings, or status filters completely changes the subset of matching rows. To prevent a bug where users are left looking at an apparently "empty table" due to the container being scrolled past the newly updated subset height:
  - Reset `currentPage` to the default first page.
  - Reset both React representation state (`scrollTop`) and direct DOM nodes (`scrollContainerRef.current.scrollTop`) directly to `0`.
- **Harden Range Guards**: Clamping calculations on low-result and zero-result lists prevent underflows or empty screens by constraining virtual bounds recursively.

---

## 9. Regression Checklist
When introducing changes, verification operators must run through the following checks:
- [ ] **No filters active**: Table is completely populated; custom domain column behaves regularly at `240px` and repository column wraps long strings correctly.
- [ ] **Search string applied**: Matches filter targets; serial indexes are serial starting from `1`; column widths do not change.
- [ ] **Dropdown filters selected**: Selecting 'Errored' status or 'Unverified' domains filters rows correctly; no changes in layout margins or widths.
- [ ] **Zero-result state**: Enter an impossible search query; verify the placeholder graphics mount properly and do not break column definitions.
- [ ] **Low-result state**: Match exact rows (e.g. 1-3); check that the grid behaves perfectly and stays aligned.
- [ ] **Mobile viewport (375px)**: Simulate a small screen; check that horizontal scrolling is smooth, stable, and allows fully reading all report segments.
- [ ] **Header help buttons stacked below labels on mobile**: In widths below `640px` (375px viewport), verify "? " help icons sit neatly below the header text and do not push columns wider.
- [ ] **Filter toolbar help buttons open the same modal content**: Verify clicking "?" beside filter toolbar labels loads the exact corresponding helper modal.
- [ ] **Filter adjustments while scrolled down**: Scroll to the bottom of a large list, modify a filter, and verify the container immediately snaps back to top position rather than staying empty.
- [ ] **Release validation compliance**:
  - Run `npm run lint` and confirm zero errors are displayed.
  - Run `npm run build` and ensure production compiler outputs bundle correctly.
