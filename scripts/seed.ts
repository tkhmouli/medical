/**
 * Seed script: Creates a demo tenant and admin user.
 * Run with: npx tsx scripts/seed.ts
 */
import { Pool } from 'pg';
import { randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

const SALT_LENGTH = 32;
const KEY_LENGTH = 64;

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return `${salt.toString('hex')}:${derivedKey.toString('hex')}`;
}

async function seed() {
  const client = await pool.connect();

  try {
    // Create demo tenant
    const tenantResult = await client.query(`
      INSERT INTO tenants (id, name, subdomain, is_active, created_at, updated_at)
      VALUES (gen_random_uuid(), 'Demo Clinic', 'demo', true, NOW(), NOW())
      ON CONFLICT (subdomain) DO UPDATE SET name = 'Demo Clinic'
      RETURNING id
    `);
    const tenantId = tenantResult.rows[0].id;
    console.log(`✓ Tenant created: Demo Clinic (subdomain: demo, id: ${tenantId})`);

    // Delete existing users for this tenant to reset passwords
    await client.query(`DELETE FROM sessions WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM users WHERE tenant_id = $1`, [tenantId]);

    // Create admin user with password "admin123"
    const passwordHash = await hashPassword('admin123');
    await client.query(`
      INSERT INTO users (id, tenant_id, email, name, password_hash, role, is_active, created_at, updated_at)
      VALUES (gen_random_uuid(), $1, 'admin@demo.clinic', 'Admin User', $2, 'Admin', true, NOW(), NOW())
    `, [tenantId, passwordHash]);
    console.log('✓ Admin user created: admin@demo.clinic / admin123');

    // Create a doctor user
    const doctorHash = await hashPassword('doctor123');
    await client.query(`
      INSERT INTO users (id, tenant_id, email, name, password_hash, role, is_active, created_at, updated_at)
      VALUES (gen_random_uuid(), $1, 'doctor@demo.clinic', 'Dr. Smith', $2, 'Doctor', true, NOW(), NOW())
    `, [tenantId, doctorHash]);
    console.log('✓ Doctor user created: doctor@demo.clinic / doctor123');

    // Create a medical assistant user
    const maHash = await hashPassword('assistant123');
    await client.query(`
      INSERT INTO users (id, tenant_id, email, name, password_hash, role, is_active, created_at, updated_at)
      VALUES (gen_random_uuid(), $1, 'assistant@demo.clinic', 'Jane Assistant', $2, 'Medical_Assistant', true, NOW(), NOW())
    `, [tenantId, maHash]);
    console.log('✓ Medical Assistant created: assistant@demo.clinic / assistant123');

    console.log('\n✓ Seed complete! You can log in at http://demo.localhost:3000/login');
    console.log('\nCredentials:');
    console.log('  Admin:     admin@demo.clinic / admin123');
    console.log('  Doctor:    doctor@demo.clinic / doctor123');
    console.log('  Assistant: assistant@demo.clinic / assistant123');
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
