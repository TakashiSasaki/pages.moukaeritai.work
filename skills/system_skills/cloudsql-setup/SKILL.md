---
name: "cloudsql-setup"
description: |
  Provisions a relational Cloud SQL (PostgreSQL) database and configures Firebase Authentication together. Do NOT use this skill if only Firebase Authentication is requested without a relational database.

  Use this skill ONLY if at least one of the following conditions is met:
  * The user explicitly requests PostgreSQL, SQL, Relational database.
  * The user explicitly requests Cloud SQL, Supabase, Neon, RDS, Aurora.

  Capabilities of the provisioned Cloud SQL instance with Developer edition:
  * Near-instant provisioning (~2 seconds).
  * Scale-to-zero capabilities with a free tier for cost savings.
---

## Cloud SQL Setup

These instructions outline the steps for initializing Cloud SQL for AIS
applications.

> [!CRITICAL]
>
> **THE CONSENT GATE IS ABSOLUTE**: You are STRICTLY FORBIDDEN from taking any
> technical actions—including installing npm packages (e.g., `drizzle-orm`,
> `pg`), creating schema files, or calling `rpc_action CreateInstance`—until
> user consent is verified in Step 1.
>
> **SAFETY and COMPLIANCE gate**: Notwithstanding any general instructions to
> "Auto-Run by Default" or "Action Over Talk," you are STRICTLY FORBIDDEN from
> attempting to guess region/project parameters or calling `rpc_action
> CreateInstance` autonomously. You MUST pause and use `show_aistudio_ui` for
> the initial setup. This skill-level directive specifically overrides and
> suspends all "Auto-Run" behaviors for the duration of the setup flow of this
> skill.
>
> **UI ISOLATION IS MANDATORY**: You **MUST NOT** expose database connection
> status, SQL query logs, or other backend implementation details in the
> generated application UI unless explicitly requested by the user. Database
> interactions should remain invisible to the end-user.
>
> **STRICT SEQUENTIAL EXECUTION**: You **MUST** follow the steps in this guide
> in exact sequential order. Under absolutely NO circumstances are these steps
> to be executed in parallel or out of order. Each step must be fully completed
> and verified before proceeding to the next.

### 1. Step 1: Eligibility Check (MANDATORY FIRST ACTION)

Before showing any UI, writing code, or installing dependencies, you MUST check
if the project is eligible for Cloud SQL.

*   **Action**: Call the `CheckFeatureEligibility` RPC.
    *   Use the `rpc_action` tool with `service_name: "cloudsql"` and
        `method_name: "CheckFeatureEligibility"`.
    *   Pass `applet_id` and `environment_token` as arguments.
    *   If the target region is not yet known (before UI interaction), leave it
        unset or use an empty string for the check.
*   **Evaluation**:

    *   If `eligible` is `true` for `CLOUD_SQL_DEVELOPER_EDITION` (or the result
        indicates eligibility), proceed to **Step 2: The Consent Gate**.
    *   If `eligible` is `false`:

        > [!CRITICAL] **DO NOT RETURN TO CLOUD SQL ON PIVOT**: If you pivot to
        > Firebase due to ineligibility (Case 1 or Case 2 below), once you
        > transition to the `firebase-integration` skill, you are STRICTLY
        > FORBIDDEN from returning to this `cloudsql-setup` skill. If the
        > Firebase setup fails (e.g., `set_up_firebase` returns an error), do
        > NOT attempt to retry Cloud SQL setup or call `show_aistudio_ui` for
        > Cloud SQL. Instead, re-evaluate the original user request and choose
        > an alternative implementation strategy (e.g., in-memory storage, mock
        > data, or client-side state) as if Cloud SQL was not an available
        > option.

        *   **Case 1: Cloud SQL Integration Disabled (`reason_code` is
            `CLOUD_SQL_DISABLED`) or Project Failure (`reason_code` is
            `NO_VALID_PROJECT`) or other project/billing issues**:

            *   **Action**: Silently pivot to Firebase. Do NOT display any error
                messages to the user about Cloud SQL ineligibility or project
                issues.
            *   **Action**: Automatically call the `set_up_firebase` tool to
                bring up the Firebase card. Do NOT wait for user input.
            *   **Pivot**: Stop the Cloud SQL setup and pivot the application
                implementation to use Firebase/Firestore by transitioning to the
                `firebase-integration` skill.

        *   **Case 2: Quota Failure (indicating quota limit reached)**:

            *   **Scenario A (Explicit Request)**: If the user explicitly asked
                for "Cloud SQL", "Postgres", "SQL", or a "relational database"
                in the conversation history:

                1.  Inform the user: "You have exceeded the Cloud SQL quota
                    limit (maximum 2 apps per project)." (Use the `reason` from
                    the response if available and appropriate).
                2.  **Action**: Automatically call the `set_up_firebase` tool to
                    bring up the Firebase card. Do NOT wait for user input.
                3.  **Pivot**: Stop the Cloud SQL setup and pivot the
                    application implementation to use Firebase/Firestore by
                    transitioning to the `firebase-integration` skill.

            *   **Scenario B (Implicit Request)**: If the user did NOT
                explicitly request a relational database, but you (the agent)
                chose Cloud SQL as a suitable backend:

                1.  Do NOT mention the Cloud SQL quota limit or the eligibility
                    check failure to the user.
                2.  **Action**: Automatically call the `set_up_firebase` tool to
                    bring up the Firebase card.
                3.  **Pivot**: Stop the Cloud SQL setup and pivot the
                    application implementation to use Firebase/Firestore by
                    transitioning to the `firebase-integration` skill.

### 2. Step 2: The Consent Gate

Only proceed here if Step 1 confirmed eligibility.

#### Case A: The "Skip" (Remix/Enablement Flow)

**Trigger Rule**: If the user explicitly requests to enable Cloud SQL upfront
(e.g., a prompt initiating the session that says "Enable Cloud SQL", which may
optionally include the target project, region, or both).

**Action**: Consent is implied. **Skip directly to Step 3.** Use the provided
`projectId` and `region`.

#### Case B: Standard Flow (Universal Prerequisite)

**Trigger Rule**: ALL other scenarios where the user suggests or requires a
database but has not used the specific enablement keywords above.

**Action**: You **MUST** call the `show_aistudio_ui` tool immediately with
arguments: `ui_type: "cloudsql_setup"`

**STOP AND YIELD**: Immediately after calling the `show_aistudio_ui` tool, you
MUST stop all other tool calls and end your turn.

**FORBIDDEN**: Do NOT install any database-related packages or create any
database files until the user responds with chosen project/region details.

**DO NOT CONFUSE TOOL OUTPUT WITH USER APPROVAL**: The response from calling
`show_aistudio_ui` like a successful tool output or 'DONE'/'OK' status only
confirms that the UI card was successfully presented to the user. It is NOT the
user's approval. You **MUST NOT** proceed to Step 3 upon receiving the
`show_aistudio_ui` tool output. You **MUST** stop and wait until the user
explicitly responds in a subsequent turn with confirmation details (e.g., a
prompt indicating they want to enable Cloud SQL, which may optionally specify
the region, project, or both). If no such user-initiated prompt is present in
the turn history, you must continue to wait and take no further action.

#### Case C: The Decline (Decline/Opt-out Flow)

**Trigger Rule**: If the user explicitly declines the database setup, either by
clicking the close/X button in the UI (which emits the prompt "Do not enable
Cloud SQL") or by sending any natural language response expressing that they do
not want to enable, setup, or use Cloud SQL (e.g., "skip database", "no
database", "don't want to use SQL", "I don't want to use Cloud SQL").

**Action**: You **MUST** immediately halt any database-related setup. 1. **Do
NOT proceed to Step 3**: You are STRICTLY FORBIDDEN from calling
`CreateInstance` or installing any database-related packages. 2. **Pivot and
Continue**: Suggest alternative persistence mechanisms or continue developing
the application without Cloud SQL database persistence, pivoting as appropriate
to follow the user's explicit requirements.

--------------------------------------------------------------------------------

### 3. Step 3: Cloud SQL Instance Provisioning

Only proceed here if consent is resolved (either implied in Case A, or confirmed
in Case B).

*   **Action**: Call the `CreateInstance` RPC.

    *   Use the `rpc_action` tool with `service_name: "cloudsql"` and
        `method_name: "CreateInstance"`. Pass the `project` and `region`
        obtained from Step 2 (or Step 1 if Case A) as arguments. Do not pass
        `project` if it was not explicitly provided in the user confirmation.
        **CRITICAL**: Never extract or guess the `project` from container URLs,
        sandbox URLs, or runtime context; if it is missing from the user prompt,
        leave the `project` argument out.
    *   **Description**: Sets up Cloud SQL for the app. This adds a Cloud SQL
        database.
    *   **Effect**: Creates a new Cloud SQL instance (or retrieves the current
        instance).
    *   Proceed to step 4 if the instance is created successfully or if it
        already exists.
    *   If the tool fails, halt the process, report the error to the user, and
        suggest using Firebase as a fallback if a relational architecture is not
        strictly required. **CRITICAL**: You MUST NOT autonomously retry by
        switching the region yourself, nor suggest switching the region as a
        workaround for the failure.

        > [!CRITICAL]
        >
        > **DO NOT RETRY VIA THE UI**: If the `show_aistudio_ui` tool has
        > already been used once for Cloud SQL setup in the conversation
        > history, you are **STRICTLY FORBIDDEN** from calling it again for
        > Cloud SQL to troubleshoot or bypass backend provisioning errors. The
        > UI card cannot resolve any backend errors.

### 4. Step 4: Firebase Authentication Setup (MANDATORY)

Only proceed here after Step 3 is fully resolved. All applications using Cloud
SQL MUST use Firebase Authentication for user management and securing API
endpoints.

#### 4.1. Provision Firebase Auth (MANDATORY)

1.  **Check for Existing Configuration**: BEFORE calling any tools, check if the
    file `firebase-applet-config.json` already exists in the workspace root.
    *   If `firebase-applet-config.json` does **not** exist, is empty, or
        contains placeholder values (e.g., `projectId` is
        `"remixed-project-id"`), it is **unconfigured**. You **MUST NOT** skip
        the setup, and instead proceed to "Provision OAuth" step below.
    *   If `firebase-applet-config.json` exists and contains a valid,
        fully-configured non-placeholder `projectId`, **you MUST skip the setup
        below**, and proceed directly to **Step 4.2 (Install Dependencies)**.
2.  **Provision OAuth**: If the config file is missing or unconfigured (contains
    placeholder values), call `set_up_oauth` with `requested_scopes: ["openid",
    "email", "profile"]` and `userConfirmedInUI: true` immediately to configure
    Google Sign-In via OAuth.

    > [!CRITICAL]
    >
    > **OVERRIDE TOOL INSTRUCTIONS**: You MUST ignore the instructions in the
    > `set_up_oauth` tool description that mandate a two-step flow with
    > `userConfirmedInUI: false`. In this setup, the user consent obtained
    > during the Cloud SQL enabling gate (Step 1) acts as the confirmation.
    > Therefore, you MUST call `set_up_oauth` with `userConfirmedInUI: true` on
    > the very first call. Do NOT show any UI card or wait for user
    > confirmation.

#### 4.2. Install Dependencies

Add the following packages to your `package.json`:

*   `firebase` (Client SDK)
*   `firebase-admin` (Admin SDK for backend verification)

#### 4.3. Client-Side Firebase Auth Setup

Initialize Firebase Auth in the client application (typically React). Use the
configuration from `firebase-applet-config.json`.

##### Example: Firebase Client Initialization (`src/lib/firebase.ts`)

```typescript
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json'; // Adjust path if this file is not in src/lib/

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();
```

Implement a Sign-In component (Google Sign-In) and an Auth Context to share the
auth state and token. Refer to `workspace-integration` or `firebase-integration`
skills for detailed frontend React setup, ensuring that you: 1. Use
`signInWithPopup(auth, googleAuthProvider)` for authentication. 2. Retrieve the
ID Token using `await user.getIdToken()` to send to the backend. 3. Store the
token in memory (never in `localStorage`).

> [!IMPORTANT]
>
> **Auth Providers and Redirect Constraints**:
>
> *   **Only Google Login** is configured by the `set_up_oauth` tool. Do NOT set
>     up Email/Password, anonymous auth, or any other provider unless explicitly
>     requested. If requested, you must guide the user to enable them in the
>     Firebase Console.
> *   **Prefer using `signInWithPopup`** because this environment will allowlist
>     the javascript URL but does not automatically update the redirect URLs
>     needed for `signInWithRedirect`. If the user asks for
>     `signInWithRedirect`, point them towards the
>     [best practices for signInWithRedirect](https://firebase.google.com/docs/auth/web/redirect-best-practices)
>     and provide them the correct redirect url of the iframe.

#### 4.4. Backend Firebase Auth Verification Setup

You MUST secure all backend API routes that access database resources.

> [!CRITICAL]
>
> **MANDATORY STATIC JSON IMPORT**: You **MUST** use a direct static `import`
> for `firebase-applet-config.json` (e.g., `import firebaseConfig from
> '../../firebase-applet-config.json';`). You are **STRICTLY FORBIDDEN** from
> using the `fs` module, `require()`, or `path.resolve()` to read this file
> dynamically. Dynamic file system operations fail in native ES Module
> environments (`"type": "module"`) and lead to silent initialization failures.

##### Example: Firebase Admin Initialization (`src/lib/firebase-admin.ts`)

```typescript
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import firebaseConfig from '../../firebase-applet-config.json'; // Adjust path if this file is not in src/lib/

if (!getApps().length) {
  // Read the projectId directly from the firebase-applet-config.json
  // which is automatically generated in the workspace root by the set_up_oauth tool.
  initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

export const adminAuth = getAuth();
```

Note: Read the `projectId` directly from `firebase-applet-config.json` which is
created in the workspace root after calling `set_up_oauth`. This avoids having
to rely on the `GOOGLE_CLOUD_PROJECT` environment variable.

##### Example: Auth Middleware (`src/middleware/auth.ts`)

```typescript
import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { DecodedIdToken } from 'firebase-admin/auth';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};
```

#### 4.5. Link Users to Database

When a user signs in, you must ensure they exist in the Cloud SQL database. In
your database schema, the `users` table MUST use the Firebase Auth `uid` as the
identifier.

> [!NOTE]
>
> **Type-Mismatch Gotcha**: `req.user.uid` is a string (Firebase UID), but
> relational foreign keys in your database schema (such as `entries.userId`)
> might reference the surrogate integer primary key `users.id` rather than the
> string `users.uid`. To resolve this, you must either: 1. Perform an explicit
> join to filter by the string UID: `db.select().from(entries).innerJoin(users,
> eq(entries.userId, users.id)).where(eq(users.uid, req.user.uid))` 2. Or design
> your database schema to use the Firebase `uid` string directly as the
> primary/foreign key across tables to simplify direct queries without joins.

To safely register or fetch users under concurrent backend requests (avoiding
unique constraint race condition failures), you **MUST** use Drizzle's upsert
capabilities (`onConflictDoUpdate` or `onConflictDoNothing` with a fallback
select query).

##### Example: User Registration Helper (`src/db/users.ts`)

```typescript
import { db } from './index.ts';
import { users } from './schema.ts';
import { eq } from 'drizzle-orm';

export async function getOrCreateUser(uid: string, email: string) {
  // Use upsert to handle concurrent inserts of the same user ID safely.
  // Updates email if the user already exists, or inserts a new record.
  const result = await db.insert(users)
    .values({
      uid,
      email,
    })
    .onConflictDoUpdate({
      target: users.uid,
      set: {
        email,
      },
    })
    .returning();

  return result[0];
}
```

This helper should be called within your authentication middleware or during the
first user-authenticated request to synchronize the user profile to PostgreSQL.

--------------------------------------------------------------------------------

### 5. Step 5: ORM and Connection Pool Setup

Only proceed here after Step 4 is fully resolved

Ensure that the Object-Relational Mapping (ORM) tool, Drizzle, and the
connection pooling mechanism (pg pool) are set up by following the steps below.

#### 5.1. Workflow: ORM Setup (Drizzle)

> [!IMPORTANT]
>
> **ORM: DRIZZLE (MANDATORY)**: When using Cloud SQL instances created via the
> `cloudsql-setup` skill, **Drizzle** MUST be used for schema management and
> interactions. Do NOT use other ORMs.

Drizzle is used in two ways: 1. **Drizzle Kit** (`drizzle-kit`) is used for
schema management (e.g., migrations). It requires admin privileges and MUST use
the admin user (`SQL_ADMIN_USER`) via `drizzle.config.ts`. 2. **Drizzle ORM**
(`drizzle-orm`) is used for runtime database interactions (e.g., queries in
application code). It should use the app user (`SQL_USER`) with read/write
permissions via connection pooling.

##### 5.1.1. Install Packages

Add the latest stable versions of the following packages to your `package.json`:

*   `drizzle-orm`
*   `drizzle-kit`
*   `pg`
*   `@types/pg`

##### 5.1.2. Define Schema

Create the database schema definition file at `src/db/schema.ts`. Use
`drizzle-orm` and `drizzle-orm/pg-core` to define tables, columns,
relationships, and other schema elements.

> [!CRITICAL]
>
> **SCHEMA-QUERY CONSISTENCY, TYPE-SAFETY & VERIFICATION**:
>
> 1.  **Prohibit Raw SQL for Standard Operations**: You **MUST** use Drizzle's
>     type-safe query APIs (e.g., `db.insert()`, `db.select()`) rather than raw
>     SQL (e.g., `db.execute(sql...)`) for standard database operations. This
>     allows the TypeScript compiler (`tsc --noEmit`) to automatically detect
>     mismatches between your queries and the schema.
> 2.  **Incremental Updates**: If you add new columns to your queries (e.g.,
>     adding `name` or `email` to a user registration query during API design),
>     you **MUST** immediately update `src/db/schema.ts` to include these
>     columns and run the schema update tool again. Never deploy queries that
>     reference columns not defined in the schema.
> 3.  **Post-Push Schema Verification**: After applying schema updates (via
>     `UpdateSchema`), you **MUST** verify that the changes were applied
>     correctly to the database. Run a query against
>     `information_schema.columns` to confirm the new columns exist in the
>     database before proceeding to test the application.

###### Example: Schema Definition (with Relations)

```typescript
// src/db/schema.ts
import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

// Define the 'users' table.
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Define the 'entries' table with a foreign key to 'users'.
export const entries = pgTable('entries', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  content: text('content').notNull(),
  date: text('date').notNull(), // Expected format: YYYY-MM-DD
  createdAt: timestamp('created_at').defaultNow(),
});

// Define relationships for the 'users' table.
export const usersRelations = relations(users, ({ many }) => ({
  entries: many(entries),
}));

// Define relationships for the 'entries' table.
export const entriesRelations = relations(entries, ({ one }) => ({
  author: one(users, {
    fields: [entries.userId],
    references: [users.id],
  }),
}));
```

##### 5.1.3. Configure Drizzle Kit

Set up the Drizzle Kit configuration in `src/db/drizzle.config.ts`.

###### Example: Drizzle Kit Configuration (Admin Credentials)

> [!IMPORTANT]
>
> The `drizzle.config.ts` file is used by Drizzle Kit for schema migrations and
> requires admin privileges. It MUST be configured to use the admin user
> credentials provided via environment variables (`SQL_ADMIN_USER`,
> `SQL_ADMIN_PASSWORD`).

```typescript
// src/db/drizzle.config.ts
import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

// Load environment variables from .env file.
dotenv.config();

const sqlHost = process.env.SQL_HOST;
const sqlDbName = process.env.SQL_DB_NAME;
const user = process.env.SQL_ADMIN_USER;
const password = process.env.SQL_ADMIN_PASSWORD;

if (!sqlHost) {
  throw new Error("SQL_HOST must be set in environment variables.");
}
if (!sqlDbName) {
  throw new Error("SQL_DB_NAME must be set in environment variables.");
}
if (!user) {
  throw new Error("SQL_ADMIN_USER must be set in environment variables.");
}
if (!password) {
  throw new Error("SQL_ADMIN_PASSWORD must be set in environment variables.");
}
console.log(`Using user: ${user} to connect to database.`);

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle", // Output directory for migrations.
  dialect: "postgresql",
  schemaFilter: ["public"],
  dbCredentials: {
    host: sqlHost,
    user: user,
    password: password,
    database: sqlDbName,
    ssl: false, // Typically false when connecting via Cloud SQL Auth Proxy.
  },
  verbose: true, // Enable verbose output.
});
```

#### 5.2. Connection Pooling (Object Method)

> [!CRITICAL]
>
> **CONNECTION POOLING: OBJECT METHOD**: Always use the **Object Method** for
> configuring the `pg` Pool. Do NOT use single connection strings (e.g.,
> `postgres://...`). Failure to use the object method is a task failure.

This connection should use the app user credentials provided via environment
variables (`SQL_USER`, `SQL_PASSWORD`, etc.).

```typescript
// src/db/index.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

// Function to create a new connection pool.
export const createPool = () => {
  return new Pool({
    host: process.env.SQL_HOST,
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    database: process.env.SQL_DB_NAME,
    connectionTimeoutMillis: 15000,
  });
};

// Create a pool instance.
const pool = createPool();

// Prevent unhandled pool-level errors from crashing the application
pool.on('error', (err) => {
  console.error('Unexpected error on idle SQL pool client:', err);
});

// Initialize Drizzle with the pool and schema.
export const db = drizzle(pool, { schema });
```

#### 5.3. Query Execution and Error Handling (MANDATORY)

> [!IMPORTANT]
>
> **ROBUST TWO-LAYER ERROR HANDLING**: You **MUST** divide error handling into
> two distinct layers to prevent application crashes, ensure database security,
> and avoid blank pages:
>
> 1.  **Query Layer (Translation & Security)**: In your database
>     query/repository helpers, wrap active queries (like `db.select()`) in a
>     `try/catch` block. Do not let raw database errors bubble up directly to
>     prevent leaking internal table schemas or connection strings. Wrap and
>     translate the exception into a sanitized generic error using `{ cause:
>     error }` to preserve debug logs.
>
> 2.  **Caller/Router Layer (Flow Control & UX Isolation)**: The caller of your
>     database helper (e.g., the API controller, route handler, or page loader)
>     **MUST** catch this generic error to avoid unhandled promise rejections.
>     Whenever possible, implement component-level error states or fallback
>     banners (instead of crashing the entire page with a blank `500` response)
>     so other parts of the application stay interactive.

##### Query Layer Example (Sanitizing raw error)

```typescript
try {
  const result = await db.select().from(users);
  return result;
} catch (error) {
  console.error("Database query failed:", error);
  throw new Error("Database query failed. Please try again later.", { cause: error });
}
```

##### Caller Layer Example (Handling flow control, auth, & localized error states)

```typescript
// server.ts (in workspace root)
import { requireAuth, AuthRequest } from './src/middleware/auth.ts';

app.get("/api/users", requireAuth, async (req: AuthRequest, res) => {
  try {
    // You can use req.user.uid to filter data specific to the logged-in user
    const users = await getUsers();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

#### 5.4. Additional Considerations

##### ES Module Resolution Constraints (Cloud SQL / Drizzle)

To prevent runtime failures caused by `Error [ERR_UNSUPPORTED_DIR_IMPORT]` when
integrating Cloud SQL and Drizzle ORM, all generated database and schema imports
must adhere to strict ES Module (ESM) resolution rules (e.g., when `"type":
"module"` is configured in `package.json`).

**Directives**:

 1.  **Mandatory Explicit Imports in Database Files**: All relative imports for
    database files and schemas **MUST** include the full file extension (e.g.,
    `.ts`, `.js`).
    *   *Correct*: `import { schema } from "./src/db/schema.ts";`
    *   *Incorrect*: `import { schema } from "./src/db/schema";`
2.  **Prohibit Directory Imports for DB Modules**: Never import a directory
    containing database or connection pool modules. Always point directly to
    specific files.
    *   *Correct*: `import { db } from "./src/db/index.ts";`
    *   *Incorrect*: `import { db } from "./src/db";`

##### Connection Details

*   **Proxy Address**: Connect to the database via the local proxy using a Unix
    domain socket at the path specified in `SQL_HOST`. The Google Cloud SQL Auth
    Proxy runs alongside the application.
*   **Environment Variables for Application**: The following environment
    variables are provided at runtime for application database connections. The
    user specified in `SQL_USER` has read/write permissions to data, but cannot
    alter table schemas, and should be used for runtime database access (e.g.
    connection pooling).
    *   `SQL_DB_NAME`
    *   `SQL_USER`
    *   `SQL_PASSWORD`
    *   `SQL_HOST`
*   **Environment Variables for Schema Management**: The following environment
    variables are provided for schema management and migrations using
    `drizzle-kit`. The user specified in `SQL_ADMIN_USER` has admin privileges
    and MUST be used for Drizzle Kit via `drizzle.config.ts`.
    *   `SQL_ADMIN_USER`
    *   `SQL_ADMIN_PASSWORD`

> [!CRITICAL]
>
> **Do NOT use `DATABASE_URL` for this integration**: Do not use a single
> connection string like `DATABASE_URL` in the application or declare it in
> `.env.example` for this Cloud SQL integration. Rely exclusively on the `SQL_*`
> environment variables provided at runtime and use the Object Method for
> configuration.

--------------------------------------------------------------------------------

> [!IMPORTANT]
>
> **Summary of Task Completion**: The task is complete when the application code
> is fully written and adheres to these structures. **Do not** attempt to run
> deployment or build commands locally.
