const { Pool } = require('pg');
const { scrypt, randomBytes } = require('crypto');
const { promisify } = require('util');
const s = promisify(scrypt);

async function hashPassword(p) {
  const salt = randomBytes(32);
  const k = await s(p, salt, 64);
  return salt.toString('hex') + ':' + k.toString('hex');
}

async function main() {
  const pool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_85fPCmuNLqMa@ep-cool-dream-ap6u6i1y.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require'
  });

  const adminHash = await hashPassword('admin123');
  await pool.query('UPDATE users SET password_hash=$1 WHERE email=$2', [adminHash, 'admin@demo.clinic']);
  console.log('Admin password reset');

  const doctorHash = await hashPassword('doctor123');
  await pool.query('UPDATE users SET password_hash=$1 WHERE email=$2', [doctorHash, 'doctor@demo.clinic']);
  console.log('Doctor password reset');

  const assistantHash = await hashPassword('assistant123');
  await pool.query('UPDATE users SET password_hash=$1 WHERE email=$2', [assistantHash, 'assistant@demo.clinic']);
  console.log('Assistant password reset');

  await pool.end();
  console.log('All passwords reset successfully');
}

main().catch(e => { console.error(e); process.exit(1); });
