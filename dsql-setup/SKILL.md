---
name: dsql-setup
description: Bootstrap a new Next.js project with Aurora DSQL + Prisma 7 using the multi-schema pattern. Sets up all required files, packages, and configuration for environment isolation via separate PostgreSQL schemas (dev/preview/prod) on a single DSQL cluster.
---

# DSQL Setup

Scaffolds a complete Aurora DSQL + Prisma 7 integration for Next.js projects on Vercel, using the **multi-schema pattern** where each environment (development, preview, production) gets its own PostgreSQL schema on a shared DSQL cluster.

## When to use

- User asks to "set up DSQL", "add Aurora DSQL", "configure Prisma with DSQL"
- Starting a new Next.js project that needs serverless Postgres on Vercel
- Migrating an existing project from traditional Postgres to DSQL

## Starting from the official starter

The fastest path is cloning the starter repo directly:

```bash
npx create-next-app --example https://github.com/bankrate-prototypes/v0-prisma-dsql-starter my-app
```

Then customize `PGSCHEMA` in your Vercel environment variables (see Step 4 below).

The starter includes the full guide at `/guide` and all files described below.

---

## What it creates

### 1. Package dependencies

Add to `package.json`:

```json
{
  "dependencies": {
    "@aws-sdk/dsql-signer": "^3.798.0",
    "@prisma/adapter-pg": "^7.5.0",
    "@prisma/client": "^7.5.0",
    "@vercel/functions": "^3.4.3",
    "pg": "^8.16.3"
  },
  "devDependencies": {
    "@aws/aurora-dsql-prisma-tools": "^0.1.0",
    "prisma": "^7.6.0"
  },
  "scripts": {
    "postinstall": "prisma generate && aurora-dsql-prisma migrate prisma/schema.prisma -o prisma/migrations/001_init/migration.sql",
    "build": "prisma generate && next build"
  }
}
```

### 2. `prisma.config.ts`

At project root:

```typescript
import { defineConfig } from "prisma/config";

// The URL here is ONLY used by Prisma CLI tooling (prisma migrate diff /
// aurora-dsql-prisma migrate) for SQL dialect detection.
// It is never used at runtime — connections are built via DsqlSigner in lib/db.ts.
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL ?? "postgresql://localhost/prisma",
  },
});
```

### 3. `prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider     = "postgresql"
  relationMode = "prisma"  // Required: DSQL has no FK constraint support
}

// Example model — customize for project needs
model Todo {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  title       String   @db.VarChar(255)
  completed   Boolean  @default(false)
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @default(now()) @map("updated_at")  // no @updatedAt — set manually

  @@map("todos")
}
```

**DSQL schema rules:**
- `relationMode = "prisma"` — DSQL has no foreign key support
- UUIDs for PKs: `@id @default(dbgenerated("gen_random_uuid()")) @db.Uuid`
- No `@updatedAt` — use `@default(now())` and set manually in code
- `provider = "prisma-client-js"` (not `prisma-client`)

### 4. `lib/schema.ts`

Schema name is always `{prefix}_{env}`. Set `PGSCHEMA` in Vercel to customize the prefix;
defaults to `app` if not set.

```typescript
/**
 * Returns the active PostgreSQL schema name for the current environment.
 *
 * The schema name is always "{prefix}_{suffix}" where:
 *   - prefix: PGSCHEMA env var if set, otherwise "app"
 *   - suffix: derived from the current environment
 *       NODE_ENV=development  → "dev"
 *       VERCEL_ENV=preview    → "preview"
 *       VERCEL_ENV=production → "prod"
 *
 * Examples with PGSCHEMA=myapp: myapp_dev, myapp_preview, myapp_prod
 * Examples without PGSCHEMA:       app_dev,    app_preview,    app_prod
 *
 * Schema names must use underscores, not dashes (PostgreSQL constraint).
 */
export function getActiveSchema(): string {
  const prefix = process.env.PGSCHEMA ?? "app";

  if (process.env.NODE_ENV === "development") return `${prefix}_dev`;

  const vercelEnv = process.env.VERCEL_ENV;
  if (vercelEnv === "preview") return `${prefix}_preview`;
  if (vercelEnv === "production") return `${prefix}_prod`;

  return `${prefix}_dev`;
}
```

### 5. `lib/db.ts`

Prisma client with DSQL adapter and schema isolation:

```typescript
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { DsqlSigner } from "@aws-sdk/dsql-signer";
import { awsCredentialsProvider } from "@vercel/functions/oidc";
import { attachDatabasePool } from "@vercel/functions";
import { getActiveSchema } from "./schema";

declare global {
  var __prisma: PrismaClient | undefined;
}

async function createPrismaClient(): Promise<PrismaClient> {
  const host = process.env.PGHOST;

  if (!host) {
    throw new Error(
      "PGHOST is not set. The Aurora DSQL integration must be configured in your Vercel project."
    );
  }

  const schema = getActiveSchema();

  const signer = new DsqlSigner({
    credentials: awsCredentialsProvider({
      roleArn: process.env.AWS_ROLE_ARN!,
      clientConfig: { region: process.env.AWS_REGION },
    }),
    region: process.env.AWS_REGION!,
    hostname: host,
    expiresIn: 900,
  });

  const pool = new Pool({
    host,
    user: process.env.PGUSER ?? "admin",
    database: process.env.PGDATABASE ?? "postgres",
    password: () => signer.getDbConnectAdminAuthToken(),
    port: 5432,
    ssl: true,
    max: 20,
  });

  attachDatabasePool(pool);

  // Pass schema as second arg — PrismaPg surfaces it via getConnectionInfo().schemaName,
  // which Prisma uses to issue SET search_path before each query internally.
  // Note: options: --search_path does NOT work on Aurora DSQL. This is the correct approach.
  const adapter = new PrismaPg(pool, { schema });
  return new PrismaClient({ adapter });
}

let prismaPromise: Promise<PrismaClient>;

export default function getPrisma(): Promise<PrismaClient> {
  if (global.__prisma) return Promise.resolve(global.__prisma);
  if (!prismaPromise) {
    prismaPromise = createPrismaClient().then((client) => {
      if (process.env.NODE_ENV !== "production") global.__prisma = client;
      return client;
    });
  }
  return prismaPromise;
}
```

### 6. `app/api/admin/migrate/route.ts`

Migration runner API route:

```typescript
import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import path from "path";
import { Pool } from "pg";
import { DsqlSigner } from "@aws-sdk/dsql-signer";
import { awsCredentialsProvider } from "@vercel/functions/oidc";
import { getActiveSchema } from "@/lib/schema";

const MIGRATIONS = [
  {
    name: "001_init",
    filePath: path.join(process.cwd(), "prisma/migrations/001_init/migration.sql"),
  },
  // Add new migrations here as you create them
];

export async function GET() {
  const schema = getActiveSchema();
  const pool = buildPool();
  const client = await pool.connect();
  try {
    const applied = await bootstrapAndGetApplied(client, schema);
    return NextResponse.json({
      schema,
      migrations: MIGRATIONS.map((m) => ({ name: m.name, applied: applied.has(m.name) })),
    });
  } finally {
    client.release();
    await pool.end();
  }
}

export async function POST(req: Request) {
  const { name } = await req.json();
  const migration = MIGRATIONS.find((m) => m.name === name);
  if (!migration) return NextResponse.json({ error: "Unknown migration" }, { status: 400 });

  const schema = getActiveSchema();
  const sql = readFileSync(migration.filePath, "utf-8");
  const pool = buildPool();
  const client = await pool.connect();
  try {
    const applied = await bootstrapAndGetApplied(client, schema);
    if (applied.has(name)) {
      return NextResponse.json({ success: true, message: "Already applied." });
    }
    await client.query(sql);
    await client.query("BEGIN");
    await client.query(
      "INSERT INTO _prisma_migrations (migration_name) VALUES ($1) ON CONFLICT DO NOTHING",
      [name]
    );
    await client.query("COMMIT");
    return NextResponse.json({ success: true, message: `Applied ${name} to "${schema}"` });
  } finally {
    client.release();
    await pool.end();
  }
}

async function bootstrapAndGetApplied(client: any, schema: string): Promise<Set<string>> {
  await client.query(`SET search_path TO ${schema}`);
  await client.query("BEGIN");
  await client.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
  await client.query("COMMIT");
  await client.query("BEGIN");
  await client.query(`
    CREATE TABLE IF NOT EXISTS _prisma_migrations (
      migration_name VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await client.query("COMMIT");
  const result = await client.query("SELECT migration_name FROM _prisma_migrations");
  return new Set(result.rows.map((r: any) => r.migration_name));
}

function buildPool() {
  const host = process.env.PGHOST!;
  const signer = new DsqlSigner({
    credentials: awsCredentialsProvider({ roleArn: process.env.AWS_ROLE_ARN! }),
    region: process.env.AWS_REGION!,
    hostname: host,
    expiresIn: 900,
  });
  return new Pool({
    host,
    user: process.env.PGUSER ?? "admin",
    database: process.env.PGDATABASE ?? "postgres",
    password: () => signer.getDbConnectAdminAuthToken(),
    port: 5432,
    ssl: true,
    max: 1,
  });
}
```

### 7. Example API route

```typescript
import { NextResponse } from "next/server";
import getPrisma from "@/lib/db";

export async function GET() {
  const prisma = await getPrisma();
  const todos = await prisma.todo.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(todos);
}

export async function POST(req: Request) {
  const { title } = await req.json();
  const prisma = await getPrisma();
  const todo = await prisma.todo.create({
    data: { title, updatedAt: new Date() },  // set updatedAt manually
  });
  return NextResponse.json(todo, { status: 201 });
}
```

## After setup

1. **Install dependencies**: `pnpm install` (runs `postinstall` automatically)
2. **Install Vercel DSQL integration** in project settings → Integrations → Aurora DSQL
3. **(Optional) Set `PGSCHEMA`** in Vercel environment variables to a custom prefix (e.g. `myapp`). If not set, defaults to `app`.
4. **Deploy to Vercel** — environment variables are injected automatically
5. **Run migrations** for each environment via the `/admin` panel or:
   ```bash
   curl -X POST https://your-url.vercel.app/api/admin/migrate -H "Content-Type: application/json" -d '{"name":"001_init"}'
   ```

## Critical constraints

- **No SERIAL/autoincrement** — use UUID PKs with `gen_random_uuid()`
- **No `@updatedAt`** — set `updatedAt: new Date()` manually
- **No foreign keys** — use `relationMode = "prisma"`
- **No synchronous indexes** — `aurora-dsql-prisma migrate` adds `ASYNC` automatically
- **One DDL per transaction** — the migration tool handles this
- **`options: --search_path` ignored by DSQL** — use `PrismaPg(pool, { schema })` instead

## Reference

- Starter repo: https://github.com/bankrate-prototypes/v0-prisma-dsql-starter
- Full guide: `/guide` route on any deployment, or download the MDX via `/api/guide`
- Raw guide source: https://github.com/bankrate-prototypes/v0-prisma-dsql-starter/blob/main/features/guide/guide-content.mdx
