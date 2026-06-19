import * as fs from 'fs';
import * as path from 'path';

const v2Path = path.join(process.cwd(), 'schemas/github-pages-auditor-export-v2.schema.json');

export const V2_UUID = 'urn:uuid:7d0f98be-8cba-49c5-84dc-66914b5da3f2';

export function applyMetadata(schemaObj) {
  const uuid = V2_UUID;
  const { $schema, ...rest } = schemaObj;
  return {
    $schema,
    $id: uuid,
    ...rest
  };
}

function run() {
  // Only execute directly if this script is executed via node/npx
  const isDirect = process.argv[1] && (
    process.argv[1].endsWith('applySchemaMetadata.js') || 
    process.argv[1].includes('/applySchemaMetadata.js')
  );
  if (!isDirect) {
    return;
  }
  
  if (fs.existsSync(v2Path)) {
    const rawV2 = fs.readFileSync(v2Path, 'utf-8');
    const enriched = applyMetadata(JSON.parse(rawV2));
    fs.writeFileSync(v2Path, JSON.stringify(enriched, null, 2) + '\n');
    console.log(`✅ Applied $id: ${V2_UUID} to schemas/github-pages-auditor-export-v2.schema.json`);
  }
}

run();
