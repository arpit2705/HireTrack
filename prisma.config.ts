// Prisma 7 config — connection URL lives here, not in schema.prisma.
// Prisma no longer auto-loads .env, hence the explicit dotenv import.
//
// The placeholder fallback matters: @prisma/client's postinstall runs
// `prisma generate` during `npm ci`, which on a fresh clone happens BEFORE
// .env exists — a hard throw here breaks the quick start. Generate never
// connects; commands that do will fail with a clear connection error.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://pending:pending@localhost:5432/pending?sslmode=disable",
  },
});
