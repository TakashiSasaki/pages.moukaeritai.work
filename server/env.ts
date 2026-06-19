import fs from 'fs';
import path from 'path';

export interface BackendEnv {
  NODE_ENV: string;
  ALLOW_DUMMY_AUTH: boolean;
  hasFirebaseConfig: boolean;
  projectId: string | null;
}

/**
 * Validates the backend runtime environment, checking dummy auth gating,
 * Firebase config status, and initialization capability.
 */
export function validateBackendEnv(): BackendEnv {
  const NODE_ENV = process.env.NODE_ENV || 'development';
  const ALLOW_DUMMY_AUTH = process.env.ALLOW_DUMMY_AUTH === 'true';

  let hasFirebaseConfig = false;
  let projectId: string | null = null;

  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      projectId = config.projectId || config.firebaseProjectId || null;
      if (projectId) {
        hasFirebaseConfig = true;
      }
    }
  } catch (error) {
    console.warn("WARNING: Unable to parse firebase-applet-config.json.", error);
  }

  // Actionable warnings and state validation
  if (!hasFirebaseConfig) {
    const errorMsg = [
      "==============================================================================",
      "🚨 FIREBASE CONFIGURATION INCOMPLETE",
      "==============================================================================",
      "The 'firebase-applet-config.json' file is missing, empty, or lacks a mapping",
      "for 'projectId' / 'firebaseProjectId'.",
      "",
      "👉 TO RESOLVE:",
      "Execute the AI Studio 'set_up_firebase' tool. This will provision your database,",
      "initialize security rules, and generate 'firebase-applet-config.json' automatically.",
      "",
      "⚠️ DEPLOYMENT IMPACT:",
      NODE_ENV === 'production' 
        ? "CRITICAL: Under production node settings, backend API token verifications will FAIL." 
        : "DEVELOPMENT: Falling back to local authentication bypass if enabled via ALLOW_DUMMY_AUTH.",
      "=============================================================================="
    ].join('\n');

    console.warn(errorMsg);
  } else {
    console.log(`✅ Firebase loaded successfully. Project: "${projectId}"`);
  }

  if (ALLOW_DUMMY_AUTH && NODE_ENV === 'production') {
    console.warn("⚠️ SECURITY WARNING: ALLOW_DUMMY_AUTH is enabled in production! This bypasses security checks and should be disabled.");
  } else if (ALLOW_DUMMY_AUTH) {
    console.log("ℹ️ INFO: ALLOW_DUMMY_AUTH is active. Client bypass using 'dummy-token' is permitted.");
  }

  return {
    NODE_ENV,
    ALLOW_DUMMY_AUTH,
    hasFirebaseConfig,
    projectId,
  };
}
