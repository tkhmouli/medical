@echo off
set DATABASE_URL=postgresql://neondb_owner:npg_85fPCmuNLqMa@ep-cool-dream-ap6u6i1y.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require
npx tsx scripts/seed.ts
