# Database Migrations

This directory contains Drizzle ORM migration files for the clinic-saas-platform.

## Prerequisites

Ensure you have a PostgreSQL database running and the `DATABASE_URL` environment variable set:

```bash
export DATABASE_URL="postgresql://user:password@localhost:5432/clinic_saas"
```

## Commands

### Generate migrations from schema changes

```bash
npx drizzle-kit generate
```

### Apply migrations to the database

```bash
npx drizzle-kit migrate
```

### Open Drizzle Studio (visual database browser)

```bash
npx drizzle-kit studio
```

### Push schema directly (development only, no migration files)

```bash
npx drizzle-kit push
```

## Workflow

1. Modify the schema in `src/lib/db/schema.ts`
2. Run `npx drizzle-kit generate` to create a new migration
3. Review the generated SQL in `drizzle/` directory
4. Run `npx drizzle-kit migrate` to apply to your database
