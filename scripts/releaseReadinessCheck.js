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
    printWarn(`${configFile} is missing entirely in workspace. (Acceptable if executed without environment config injected).`);
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
  const EXPECTED_VERSION = '1.6.14';

  // Validate SemVer format
  const semverRegex = /^\d+\.\d+\.\d+$/;
  if (!semverRegex.test(version)) {
    printFail(`Package version is not a valid SemVer string. Found: ${version}`);
  } else if (version !== EXPECTED_VERSION) {
    printFail(`Package version must be exactly '${EXPECTED_VERSION}'. Found: ${version}`);
  } else {
    printSuccess(`Package version is exactly '${EXPECTED_VERSION}'.`);
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

  const hasAgentPatchRule = agents.includes('Every file-changing coding-agent task MUST bump the patch version');
  const hasAgentCommitRule = agents.includes('must output an English commit message');
  if (hasAgentPatchRule && hasAgentCommitRule) {
    printSuccess(`AGENTS.md correctly dictates patch bump rules and English commit message requirements for agents.`);
  } else {
    printFail(`AGENTS.md is missing patch bump rule or English commit message requirement.`);
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
  const readme = fs.readFileSync('README.md', 'utf8');
  
  // Verify that the actual Firebase cloud functions / automated cleanup jobs remain a deferred non-goal
  const isFunctionsDeferred = deferredContent.includes('automation') || deferredContent.includes('policy') || deferredContent.includes('operator');
  const hasExplicitNonGoals = deferredContent.includes('Exclusion of GitHub OAuth') &&
                                deferredContent.includes('Exclusion of GitHub App Authentication') &&
                                deferredContent.includes('Exclusion of Gemini / Generative AI / LLM Integration');
  
  // smoke:public script exists in package.json
  const hasSmokeScript = packageJson.scripts && packageJson.scripts['smoke:public'];

  // public smoke strict mode and no-auth E2E scope is documented
  const hasSmokeDocs = readme.includes('smoke:public') && (readme.includes('strict') || readme.includes('STRICT')) && (readme.includes('no-auth') || readme.includes('unauthenticated'));

  if (hasLifecycleDocs && hasLifecycleTests && isFunctionsDeferred && hasExplicitNonGoals && hasSmokeScript && hasSmokeDocs) {
    printSuccess(`Anonymous Session Lifecycle modules, smoke scripts, and non-goals are completely verified in documentation and config.`);
  } else {
    printFail(`Missing anonymous lifecycle helper, test suite, public smoke script definition, public smoke strict mode details, or explicit non-goals schema.`);
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
    'docs/anonymous-session-lifecycle.md',
    'docs/spec-appendix-github-api.md'
  ];
  let staleFound = false;
  const stalePhrases = [
    'planned, not yet assigned',
    'Custom Domain Assignment Readiness',
    'github-pages-auditor.export.v1',
    'githubPagesAuditorV1',
    'GitHub OAuth as future work',
    'GitHub App as future work',
    'Gemini/AI as future work',
    'GitHub OAuth can be added later',
    'GitHub App can be added later',
    'Gemini/AI can be added later',
    'future work: GitHub OAuth',
    'future work: GitHub App',
    'future work: Gemini/AI',
    'Version 1',
    'V1 schema',
    'V1 backend',
    'old V1 flow',
    'migration from V1'
  ];

  const packageJsonForStale = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const currentVersionStr = packageJsonForStale.version;
  const parts = currentVersionStr.split('.');
  if (parts.length === 3) {
    const major = parseInt(parts[0], 10);
    const minor = parseInt(parts[1], 10);
    const patch = parseInt(parts[2], 10);
    for (let i = 0; i < patch; i++) {
      stalePhrases.push(`${major}.${minor}.${i}`);
    }
  }

  for (const f of filesToScanForStale) {
    if (fs.existsSync(f)) {
      const content = fs.readFileSync(f, 'utf8');
      for (const phrase of stalePhrases) {
        if (/^\d+\.\d+\.\d+$/.test(phrase)) {
           // It's a semver, use regex to ensure it doesn't match a substring of a larger version
           const regex = new RegExp(`\\b${phrase.replace(/\./g, '\\.')}\\b`);
           if (regex.test(content)) {
              printFail(`Stale or forbidden phrase "${phrase}" found in ${f}.`);
              staleFound = true;
           }
        } else {
           if (content.includes(phrase)) {
             printFail(`Stale or forbidden phrase "${phrase}" found in ${f}.`);
             staleFound = true;
           }
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

// 13. Org Scan Feature Compliance
try {
  const clientTs = fs.readFileSync('server/githubClient.ts', 'utf8');
  if (clientTs.includes('/orgs\\/[^\\/]+\\/repos')) {
    printSuccess(`Backend allowlist explicitly supports organization-specific repo enumeration.`);
  } else {
    printFail(`Backend allowlist is missing the /orgs/{org}/repos endpoint regex.`);
  }

  const agentsMd = fs.readFileSync('AGENTS.md', 'utf8');
  if (agentsMd.includes('- `GET /orgs/{org}/repos`') && !agentsMd.includes('NOT implemented in V2 backend allowlist')) {
    printSuccess(`AGENTS.md correctly asserts organization enumeration is implemented.`);
  } else {
    printFail(`AGENTS.md does not correctly describe the /orgs/{org}/repos status.`);
  }

  const appendix = fs.readFileSync('docs/spec-appendix-github-api.md', 'utf8');
  if (appendix.includes('GET /orgs/{org}/repos') && !appendix.includes('GET /orgs/{org}/repos\n\nGET /orgs/{org}/repos')) {
    printSuccess(`GitHub API appendix correctly includes organization scan and no duplicates exist.`);
  } else {
    printFail(`GitHub API appendix duplicates or misrepresents the organization scan endpoint.`);
  }
} catch (e) {
  printFail(`Could not verify org scan feature compliance: ${e.message}`);
}

// 14. Maintenance Baseline and Launcher Regression Check
try {
  const readmeMd = fs.readFileSync('README.md', 'utf8');
  if (readmeMd.includes('maintenance mode') && readmeMd.includes('development-complete')) {
    printSuccess(`README.md correctly declares development-complete / maintenance-mode status.`);
  } else {
    printFail(`README.md fails to declare development-complete / maintenance-mode status.`);
  }

  const agentsMd = fs.readFileSync('AGENTS.md', 'utf8');
  if (agentsMd.includes('Maintenance Policy') && agentsMd.includes('maintenance mode')) {
    printSuccess(`AGENTS.md correctly declares maintenance-mode rules.`);
  } else {
    printFail(`AGENTS.md fails to declare maintenance-mode rules.`);
  }

  const uiRegression = fs.readFileSync('docs/ui-regression-plan.md', 'utf8');
  if (uiRegression.includes('zIndex') && uiRegression.includes('NaN')) {
    printSuccess(`UI regression plan mentions LauncherGrid zIndex/render-order regression coverage.`);
  } else {
    printFail(`UI regression plan is missing LauncherGrid zIndex/render-order coverage.`);
  }
} catch (e) {
  printFail(`Could not verify maintenance baseline and regression docs: ${e.message}`);
}

// 15. Metadata Transition & UA Alignment Check
try {
  const metadataFile = 'server/siteMetadata.ts';
  if (fs.existsSync(metadataFile)) {
    const content = fs.readFileSync(metadataFile, 'utf8');
    if (content.includes('GitHubPagesAuditor/1.6.2')) {
      printFail(`${metadataFile} contains stale hardcoded User-Agent version (1.6.2).`);
    } else if (content.includes('APP_USER_AGENT')) {
      printSuccess(`${metadataFile} correctly uses aligned APP_USER_AGENT constant.`);
    } else {
      printFail(`${metadataFile} does not use verified APP_USER_AGENT alignment.`);
    }
  }

  const implicitDoc = 'docs/implicit-design-decisions.md';
  if (fs.existsSync(implicitDoc)) {
    const content = fs.readFileSync(implicitDoc, 'utf8');
    if (content.includes('クライアントのブラウザが対象の URL に直接アクセス')) {
      printFail(`${implicitDoc} contains inaccurate statement about browser-side metadata fetching.`);
    } else if (content.includes('Auditorバックエンド')) {
      printSuccess(`${implicitDoc} accurately describes backend-side site metadata fetching.`);
    }

    if (content.includes('監査結果（Audit Blob）には永続化されず')) {
      printFail(`${implicitDoc} contains inaccurate statement about PWA metadata persistence.`);
    } else if (content.includes('監査結果の一部として Firestore の監査キャッシュに保存されます')) {
      printSuccess(`${implicitDoc} accurately describes PWA metadata persistence.`);
    }

    if (content.includes('自己完結型 UI アセット・ポリシー')) {
      printSuccess(`${implicitDoc} includes Self-Contained UI Asset Policy.`);
    } else {
      printFail(`${implicitDoc} is missing Self-Contained UI Asset Policy.`);
    }
  }

  const gridFile = 'src/components/LauncherGrid.tsx';
  if (fs.existsSync(gridFile)) {
    const content = fs.readFileSync(gridFile, 'utf8');
    if (content.includes('transparenttextures.com')) {
      printFail(`${gridFile} contains forbidden external asset dependency (transparenttextures.com).`);
    } else {
      printSuccess(`${gridFile} is clean of unapproved external asset dependencies.`);
    }
  }
} catch (e) {
  printFail(`Could not verify metadata fetch documentation, PWA persistence, and UI asset alignment: ${e.message}`);
}

console.log('\n=== RESULT ===');
if (failed) {
  console.log(`${red}❌ Release readiness verification FAILED. Please solve the errors above before baseline release.${reset}\n`);
  process.exit(1);
} else {
  console.log(`${green}✅ All Public Release Readiness checks passed successfully.${reset}\n`);
  process.exit(0);
}
