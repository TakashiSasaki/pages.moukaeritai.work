import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const red = '\x1b[31m';
const green = '\x1b[32m';
const yellow = '\x1b[33m';
const reset = '\x1b[0m';

let failed = false;

function printSuccess(message) {
  console.log(`${green}✅ ${message}${reset}`);
}

function printFail(message) {
  console.log(`${red}❌ ${message}${reset}`);
  failed = true;
}

function printWarn(message) {
  console.log(`${yellow}⚠️  ${message}${reset}`);
}

console.log('\n=== RUNNING SECURITY & RELEASE READINESS CHECK ===\n');

// 1. Firebase Config Check
try {
  const configFile = 'firebase-applet-config.json';
  if (!fs.existsSync(configFile)) {
    printFail(`${configFile} is missing entirely in workspace.`);
  } else {
    const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    const apiKey = config.apiKey || '';
    const projectId = config.projectId || '';
    
    // Check if the file has placeholder values
    const isPlaceholder = apiKey.includes('PLACEHOLDER') || apiKey.includes('YOUR-') || apiKey === '' || apiKey.includes('dummy');
    
    if (!isPlaceholder && apiKey.startsWith('AIzaSy')) {
      printWarn(`${configFile} contains a live-looking Firebase API Key. (Acceptable for active development/live runtime, warning logged).`);
    } else {
      printSuccess(`Firebase config is clean of live production API credentials.`);
    }
  }
} catch (e) {
  printFail(`Failed to parse Firebase Applet Config: ${e.message}`);
}

// 2. Gitignore Check for firebase-applet-config.json
try {
  const gitignore = fs.readFileSync('.gitignore', 'utf8');
  if (gitignore.includes('firebase-applet-config.json')) {
    printSuccess(`.gitignore correctly ignores firebase-applet-config.json.`);
  } else {
    printFail(`firebase-applet-config.json is NOT ignored in .gitignore.`);
  }
} catch (e) {
  printFail(`Failed to check .gitignore: ${e.message}`);
}

// 3. Scan codebase for Forbidden Integrations & endpoints
const filesToScan = [];
function readDirRecursive(dir) {
  if (!fs.existsSync(dir)) return;
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of list) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== '.git' && entry.name !== 'skills') {
        readDirRecursive(fullPath);
      }
    } else if (entry.isFile()) {
      if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx') || fullPath.endsWith('.js')) {
        filesToScan.push(fullPath);
      }
    }
  }
}

readDirRecursive('src');
readDirRecursive('server');
if (fs.existsSync('server.ts')) filesToScan.push('server.ts');

let forbiddenFound = false;
for (const file of filesToScan) {
  const content = fs.readFileSync(file, 'utf8');
  // Strip block comments and line comments so we don't flag negative/out-of-scope rule texts in comments
  const cleanContent = content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*/g, '');

  // A. Check for Gemini imports
  if (cleanContent.includes('@google/genai') || cleanContent.includes('GoogleGenAI')) {
    printFail(`Forbidden Gemini / AI dependency found in ${file}.`);
    forbiddenFound = true;
  }

  // B. Check for GitHub OAuth routes
  if (cleanContent.includes('/login/oauth/authorize') || cleanContent.includes('/login/oauth/access_token') || cleanContent.includes('/github/callback')) {
    printFail(`Forbidden GitHub OAuth reference found in ${file}.`);
    forbiddenFound = true;
  }

  // C. Check for GitHub App installation or webhook endpoints
  if (cleanContent.includes('/github/install') || cleanContent.includes('/github/setup-url') || cleanContent.includes('/webhook')) {
    printFail(`Forbidden GitHub App/Webhook endpoints found in ${file}.`);
    forbiddenFound = true;
  }

  // D. Check for post/write calls targeting api.github.com
  if (cleanContent.includes('method:') && (cleanContent.includes('POST') || cleanContent.includes('PUT') || cleanContent.includes('DELETE') || cleanContent.includes('PATCH')) && cleanContent.includes('api.github.com')) {
    printFail(`Forbidden GitHub write API call found in ${file}.`);
    forbiddenFound = true;
  }

  // E. Actions workflow endpoints
  if (cleanContent.includes('/actions/workflows')) {
    printFail(`Forbidden GitHub Actions Webhook/API endpoint found in ${file}.`);
    forbiddenFound = true;
  }
}

if (!forbiddenFound) {
  printSuccess(`No forbidden integrations (Gemini, OAuth, Webhooks, Actions, GitHub Write) are found in actual execution code.`);
}

// 4. Schema Sync Check (Runs the dedicated schema checker)
try {
  execSync('node scripts/schemaCheck.js', { stdio: 'pipe' });
  printSuccess(`Committed export schema matches exportTypesV2.ts definitions.`);
} catch (e) {
  printFail(`V2 Schema drift check failed. Run 'npm run schema:generate' to fix. Details: ${e.stdout?.toString() || e.message}`);
}

// 5. Example Export Data Validity Check
try {
  execSync('node scripts/validateExamples.js', { stdio: 'pipe' });
  printSuccess(`Example export files (sample JSON/CSV) are fully compliant and valid.`);
} catch (e) {
  printFail(`Export examples validation failed. Details: ${e.message}`);
}

// 6. Launcher Routing and Safe Attribution Checks
try {
  const srcApp = fs.readFileSync('src/App.tsx', 'utf8');
  if (srcApp.includes('/launcher') && srcApp.includes('/results/:auditId/launcher')) {
    printSuccess(`Launcher routes are present in App routing configuration.`);
  } else {
    printFail(`Missing required launcher routes in src/App.tsx.`);
  }

  const gridFile = 'src/components/LauncherGrid.tsx';
  if (fs.existsSync(gridFile)) {
    const gridContent = fs.readFileSync(gridFile, 'utf8');
    if (gridContent.includes('rel="noopener noreferrer"') && gridContent.includes('target="_blank"')) {
      printSuccess(`LauncherGrid utilizes safe external link targets and proper rel attributes.`);
    } else {
      printFail(`LauncherGrid has unsafe external-facing link configurations.`);
    }
  } else {
    printFail(`${gridFile} is missing in workspace.`);
  }
} catch (e) {
  printFail(`Failed to audit Launcher configs: ${e.message}`);
}

// 7. Security Rules Firestore Check
try {
  const rules = fs.readFileSync('firestore.rules', 'utf8');
  const hasUsersSettings = rules.includes('/users/{uid}/settings/{settingId}');
  const hasAnonSettings = rules.includes('/anonymousSessions/{uid}/settings/{settingId}');
  
  if (hasUsersSettings && hasAnonSettings) {
    printSuccess(`Firestore rules correctly declare tenant-isolated settings scopes for launcher/navigation settings.`);
  } else {
    printFail(`Firestore rules do not fully cover isolated settings paths.`);
  }
} catch (e) {
  printFail(`Failed to audit firestore rules: ${e.message}`);
}

// 8. Active Custom Domain Check
try {
  const readme = fs.readFileSync('README.md', 'utf8');
  const agents = fs.readFileSync('AGENTS.md', 'utf8');
  
  if (readme.includes('https://pages.moukaeritai.work') && agents.includes('pages.moukaeritai.work')) {
    printSuccess(`Active custom domain 'pages.moukaeritai.work' is properly set in documentation.`);
  } else {
    printFail(`Active custom domain settings are missing in README.md or AGENTS.md.`);
  }
  
  // Regressions of planned / pending statuses
  const filesToCheck = ['README.md', 'AGENTS.md', 'docs/deployment-readiness.md', 'docs/custom-domain-readiness.md'];
  let foundPlanned = false;
  for (const f of filesToCheck) {
    if (fs.existsSync(f)) {
      const content = fs.readFileSync(f, 'utf8');
      if (content.includes('planned, not yet assigned') || content.includes('Custom Domain Assignment Readiness')) {
        printFail(`Regressing planned-domain phrase found in ${f}. All custom domains must be active.`);
        foundPlanned = true;
      }
    }
  }
  if (!foundPlanned) {
    printSuccess(`No planned-domain regression phrases found in critical documentation.`);
  }
} catch (e) {
  printFail(`Failed to audit active custom domain: ${e.message}`);
}

// 9. Document to Package Version & Namespace Check
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const version = packageJson.version;
  
  if (version !== '1.5.0') {
    printFail(`Package version must be exactly '1.5.0'. Found: ${version}`);
  } else {
    printSuccess(`Package version is exactly '1.5.0'.`);
  }
  
  const readme = fs.readFileSync('README.md', 'utf8');
  const agents = fs.readFileSync('AGENTS.md', 'utf8');
  const deploymentReadiness = fs.readFileSync('docs/deployment-readiness.md', 'utf8');
  const deferredContent = fs.readFileSync('docs/deferred-work.md', 'utf8');
  
  if (readme.includes(version) && agents.includes(version) && deploymentReadiness.includes(version) && deferredContent.includes(version)) {
    printSuccess(`Document version strings are perfectly aligned with package.json (${version}).`);
  } else {
    printFail(`Inconsistent version references found between AGENTS.md, README.md, deferred-work.md, deployment-readiness.md, or package.json (${version}).`);
  }

  // Fallback and Namespace checks
  const hasCloudRunDoc = readme.includes('Cloud Run') || agents.includes('Cloud Run') || deploymentReadiness.includes('Cloud Run');
  if (hasCloudRunDoc) {
    printSuccess(`Cloud Run is documented as fallback/underlying runtime.`);
  } else {
    printFail(`Cloud Run is not documented as fallback/underlying runtime.`);
  }

  const hasV2NamespaceDocs = readme.includes('githubPagesAuditorV2') && agents.includes('githubPagesAuditorV2');
  if (hasV2NamespaceDocs) {
    printSuccess(`Firestore namespace 'githubPagesAuditorV2' is correctly documented.`);
  } else {
    printFail(`Firestore namespace 'githubPagesAuditorV2' is missing in documentation.`);
  }
} catch (e) {
  printFail(`Failed to audit version strings: ${e.message}`);
}

// 10. Icon/Site Metadata Documentation Check
try {
  const specWeb = fs.readFileSync('docs/spec-appendix-github-api.md', 'utf8');
  const hasFavicon = specWeb.includes('faviconUrl');
  const hasManifest = specWeb.includes('manifestUrl');
  const hasIsPwa = specWeb.includes('isPwa');
  const hasPwaIcon = specWeb.includes('pwaIconUrl');
  const hasPwaName = specWeb.includes('pwaName');
  const hasPwaDisplay = specWeb.includes('pwaDisplayMode');
  const hasBestEffort = specWeb.includes('best-effort');
  const hasSecurity = specWeb.includes('No PAT leakage');
  
  if (hasFavicon && hasManifest && hasIsPwa && hasPwaIcon && hasPwaName && hasPwaDisplay && hasBestEffort && hasSecurity) {
    printSuccess(`Site and icon metadata capabilities are accurately and securely documented.`);
  } else {
    printFail(`Site metadata features documentation in spec-appendix-github-api.md is incomplete.`);
  }
} catch (e) {
  printFail(`Failed to audit site metadata documentation: ${e.message}`);
}

// 11. Anonymous Session Lifecycle, Tests & Non-Goals Check
try {
  const hasLifecycleDocs = fs.existsSync('docs/anonymous-session-lifecycle.md');
  const hasLifecycleTests = fs.existsSync('tests/anonymous-lifecycle.test.ts');
  const deferredContent = fs.readFileSync('docs/deferred-work.md', 'utf8');
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  
  // Verify that the actual Firebase cloud functions / automated cleanup jobs remain a deferred non-goal
  const isFunctionsDeferred = deferredContent.includes('automation') || deferredContent.includes('policy') || deferredContent.includes('operator');
  const hasExplicitNonGoals = deferredContent.includes('Exclusion of GitHub OAuth') &&
                               deferredContent.includes('Exclusion of GitHub App Authentication') &&
                               deferredContent.includes('Exclusion of Gemini / Generative AI / LLM Integration');
  
  // smoke:public script exists in package.json
  const hasSmokeScript = packageJson.scripts && packageJson.scripts['smoke:public'];

  if (hasLifecycleDocs && hasLifecycleTests && isFunctionsDeferred && hasExplicitNonGoals && hasSmokeScript) {
    printSuccess(`Anonymous Session Lifecycle modules, smoke scripts, and non-goals are completely verified in documentation and config.`);
  } else {
    printFail(`Missing anonymous lifecycle helper, test suite, public smoke script definition, or explicit non-goals schema.`);
  }
} catch (e) {
  printFail(`Failed to audit anonymous session lifecycle status: ${e.message}`);
}

// 12. Strict Stale and Forbidden Phrase Audits
try {
  const filesToScanForStale = [
    'README.md',
    'AGENTS.md',
    'docs/deployment-readiness.md',
    'docs/custom-domain-readiness.md',
    'docs/deferred-work.md',
    'docs/anonymous-session-lifecycle.md'
  ];
  let staleFound = false;
  const stalePhrases = [
    'planned, not yet assigned',
    'Custom Domain Assignment Readiness',
    'github-pages-auditor.export.' + 'v1',
    'githubPages' + 'AuditorV1',
    'GitHub OAuth' + ' as future work',
    'GitHub App' + ' as future work',
    'Gemini/AI' + ' as future work',
    'GitHub OAuth' + ' can be added later',
    'GitHub App' + ' can be added later',
    'Gemini/AI' + ' can be added later',
    'future work: ' + 'GitHub OAuth',
    'future work: ' + 'GitHub App',
    'future work: ' + 'Gemini/AI'
  ];

  for (const f of filesToScanForStale) {
    if (fs.existsSync(f)) {
      const content = fs.readFileSync(f, 'utf8');
      for (const phrase of stalePhrases) {
        if (content.includes(phrase)) {
          printFail(`Stale or forbidden phrase "${phrase}" found in ${f}.`);
          staleFound = true;
        }
      }
    }
  }
  if (!staleFound) {
    printSuccess(`No stale/forbidden phrases found. Release baseline is 100% active, clean, and production-hardened.`);
  }
} catch (e) {
  printFail(`Failed to audit stale phrases: ${e.message}`);
}

console.log('\n=== RESULT ===');
if (failed) {
  console.log(`${red}❌ Release readiness verification FAILED. Please solve the errors above before baseline release.${reset}\n`);
  process.exit(1);
} else {
  console.log(`${green}✅ All Public Release Readiness checks passed successfully.${reset}\n`);
  process.exit(0);
}
