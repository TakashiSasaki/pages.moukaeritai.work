import fs from 'fs';
import path from 'path';
import { liveExportSampleRows } from '../tests/fixtures/liveExportRows';
import { buildJsonExport, buildCsvExport } from '../src/export/exportBuilders';
import { buildJsonExportV2 } from '../src/export/exportBuildersV2';

async function generate() {
  const examplesDir = path.join(process.cwd(), 'examples');
  if (!fs.existsSync(examplesDir)) {
    fs.mkdirSync(examplesDir);
  }

  const context = {
    auditRunId: 'sample-audit-run-id',
    auditCreatedAt: '2026-06-19T04:00:00Z',
    exportedAt: '2026-06-19T04:05:00Z',
    userMode: 'google' as const,
    tokenType: 'fine_grained' as const,
    githubLogin: 'TakashiSasaki',
    appEnvironment: 'production'
  };

  // 1. Generate V1 JSON
  const v1Json = buildJsonExport(liveExportSampleRows, context);
  fs.writeFileSync(
    path.join(examplesDir, 'github-pages-auditor-export-v1.sample.json'),
    JSON.stringify(v1Json, null, 2),
    'utf-8'
  );

  // 2. Generate V2 JSON
  const v2Json = buildJsonExportV2(liveExportSampleRows, context);
  fs.writeFileSync(
    path.join(examplesDir, 'github-pages-auditor-export-v2.sample.json'),
    JSON.stringify(v2Json, null, 2),
    'utf-8'
  );

  // 3. Generate CSV
  const csvData = buildCsvExport(liveExportSampleRows, context);
  fs.writeFileSync(
    path.join(examplesDir, 'github-pages-auditor-export.sample.csv'),
    csvData,
    'utf-8'
  );

  console.log('Successfully generated sample artifacts in examples/ directory.');
}

generate().catch(err => {
  console.error('Failed to generate sample artifacts:', err);
  process.exit(1);
});
