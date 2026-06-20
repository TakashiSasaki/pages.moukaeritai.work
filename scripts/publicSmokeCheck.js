/**
 * Lightweight, Read-Only Public Smoke Checker for pages.moukaeritai.work
 * 
 * Mode differences:
 * - Informational (Default / Non-Strict): Prints warm warning messages on failures/timeouts and exits with code 0.
 *   This is ideal for local/offline environments where external domain checks may fail due to connectivity.
 * - Strict Mode (SMOKE_STRICT=true or --strict): Fails fast during critical server and landing routing downtime,
 *   exiting with code 1 on failed endpoints. This is suited for deployment pipelines or automated active telemetry.
 */

const CANONICAL_URL = 'https://pages.moukaeritai.work';
const FALLBACK_URL = 'https://github-pages-auditor-1042140630327.asia-east1.run.app';

const isStrict = process.env.SMOKE_STRICT === 'true' || process.argv.includes('--strict');

async function verifyEndpoint(url) {
  // Short timeout for fast liveness/readiness probes (3500ms)
  const timeoutMs = 3500;
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms for ${url}`)), timeoutMs)
  );

  console.log(`Checking public endpoint: ${url}...`);
  try {
    // Strictly unauthenticated request - no PATs, Firebase tokens, or credentials sent
    const fetchPromise = fetch(url, { headers: { 'User-Agent': 'GitHub-Pages-Auditor-Smoke-Check/1.5.0' } });
    const response = await Promise.race([fetchPromise, timeoutPromise]);
    
    if (!response.ok) {
      console.warn(`⚠️ Warning: Endpoint returned non-ok status ${response.status} for ${url}`);
      return false;
    }
    
    const text = await response.text();
    if (url.endsWith('/healthz') || url.endsWith('/api/health')) {
      try {
        const json = JSON.parse(text);
        if (json && json.ok === true) {
          console.log(`✅ ${url} is running and healthy:`, text.trim());
          return true;
        } else {
          console.warn(`⚠️ Warning: Health probe returned unexpected response format:`, text.trim());
          return false;
        }
      } catch (jsonErr) {
        console.warn(`⚠️ Warning: Non-JSON response for healthz:`, text.trim().slice(0, 100));
        return false;
      }
    }

    console.log(`✅ ${url} is healthy (status ${response.status}, length: ${text.length})`);
    return true;
  } catch (err) {
    console.error(`❌ Error probing ${url}:`, err.message);
    return false;
  }
}

async function run() {
  console.log(`=== STARTING PUBLIC OPERATIONAL SMOKE VALIDATION (${isStrict ? 'STRICT' : 'INFORMATIONAL'} MODE) ===`);
  
  // Probe healthz endpoints first
  const canonicalHealth = await verifyEndpoint(`${CANONICAL_URL}/healthz`);
  const fallbackHealth = await verifyEndpoint(`${FALLBACK_URL}/healthz`);
  
  // Probe root landing layouts
  const canonicalRoot = await verifyEndpoint(CANONICAL_URL);
  
  console.log('\n--- SMOKE SUMMARY ---');
  const allPassed = canonicalHealth && fallbackHealth && canonicalRoot;

  if (allPassed) {
    console.log('✅ All public system endpoints are live, responsive, and healthy.');
    process.exit(0);
  } else {
    if (isStrict) {
      console.error('❌ Error: Public validation failed in strict mode. Exiting with non-zero code.');
      process.exit(1);
    } else {
      console.log('⚠️ Some public checks failed or warned. This can happen if executing offline. Exiting 0 (informational mode).');
      process.exit(0);
    }
  }
}

run();
