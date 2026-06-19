import fs from 'fs';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

function run() {
  const identifiers = JSON.parse(fs.readFileSync('schemas/schema-identifiers.json', 'utf8'));
  const ajv = new Ajv({ allErrors: true });
  addFormats(ajv);

  for (const info of identifiers.schemas) {
    if (info.schemaVersion === 'github-pages-auditor.export.v2') {
      const schema = JSON.parse(fs.readFileSync(info.path, 'utf8'));
      const sample = JSON.parse(fs.readFileSync('examples/github-pages-auditor-export-v2.sample.json', 'utf8'));
      if (sample.schemaId !== info.schemaId) throw new Error('V2 schemaId mismatch');
      if (sample.schemaVersion !== info.schemaVersion) throw new Error('V2 schemaVersion mismatch');
      const validate = ajv.compile(schema);
      if (!validate(sample)) throw new Error('V2 validation failed: ' + ajv.errorsText(validate.errors));
    }
  }

  const forbiddenPatterns = ['ghp_', 'github_pat_', 'Bearer', 'githubPagesAuditorV1', 'users/', 'anonymousSessions/', 'Authorization', 'firebase', 'refreshToken'];
  const files = ['examples/github-pages-auditor-export-v2.sample.json', 'examples/github-pages-auditor-export.sample.csv'];
  
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    for (const forbidden of forbiddenPatterns) {
      if (content.includes(forbidden)) {
        throw new Error('Forbidden pattern ' + forbidden + ' found in ' + file);
      }
    }
  }
  
  console.log('Examples validation passed successfully.');
}

run();
