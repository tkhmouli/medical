import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './auth-service';

describe('AuthService - Password Hashing', () => {
  it('should hash a password and produce a salt:hash format', async () => {
    const hash = await hashPassword('mySecret123');
    expect(hash).toContain(':');

    const [salt, derivedKey] = hash.split(':');
    // Salt should be 32 bytes = 64 hex chars
    expect(salt).toHaveLength(64);
    // Key should be 64 bytes = 128 hex chars
    expect(derivedKey).toHaveLength(128);
  });

  it('should produce different hashes for the same password (random salt)', async () => {
    const hash1 = await hashPassword('samePassword');
    const hash2 = await hashPassword('samePassword');
    expect(hash1).not.toEqual(hash2);
  });

  it('should verify a correct password', async () => {
    const password = 'correctHorse42!';
    const hash = await hashPassword(password);
    const result = await verifyPassword(password, hash);
    expect(result).toBe(true);
  });

  it('should reject an incorrect password', async () => {
    const hash = await hashPassword('originalPassword');
    const result = await verifyPassword('wrongPassword', hash);
    expect(result).toBe(false);
  });

  it('should reject when stored hash format is invalid (no colon)', async () => {
    const result = await verifyPassword('anyPassword', 'invalidhashformat');
    expect(result).toBe(false);
  });

  it('should reject when stored hash has empty parts', async () => {
    const result = await verifyPassword('anyPassword', ':');
    expect(result).toBe(false);
  });

  it('should handle empty password hashing', async () => {
    const hash = await hashPassword('');
    expect(hash).toContain(':');
    const result = await verifyPassword('', hash);
    expect(result).toBe(true);
  });

  it('should handle unicode passwords', async () => {
    const password = '密码测试🔐';
    const hash = await hashPassword(password);
    const result = await verifyPassword(password, hash);
    expect(result).toBe(true);
  });

  it('should handle long passwords', async () => {
    const password = 'a'.repeat(1000);
    const hash = await hashPassword(password);
    const result = await verifyPassword(password, hash);
    expect(result).toBe(true);
  });

  it('should reject a password that differs by one character', async () => {
    const hash = await hashPassword('password123');
    const result = await verifyPassword('password124', hash);
    expect(result).toBe(false);
  });
});
