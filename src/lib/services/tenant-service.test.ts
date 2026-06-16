import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError } from '@/lib/errors';

// Mock the database module
vi.mock('@/lib/db', () => ({
  getDb: vi.fn(),
}));

import { getDb } from '@/lib/db';
import { TenantService } from './tenant-service';

// Helper to create a chainable mock query builder
function createMockQueryBuilder(results: any[]) {
  const builder = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(results),
  };
  return builder;
}

describe('TenantService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('resolveBySubdomain', () => {
    it('should return tenant data when an active tenant matches the subdomain', async () => {
      const mockTenant = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Clinic',
        subdomain: 'test-clinic',
      };

      const mockDb = createMockQueryBuilder([mockTenant]);
      vi.mocked(getDb).mockReturnValue(mockDb as any);

      const result = await TenantService.resolveBySubdomain('test-clinic');

      expect(result).toEqual(mockTenant);
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.from).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
      expect(mockDb.limit).toHaveBeenCalledWith(1);
    });

    it('should throw NotFoundError when no tenant matches the subdomain', async () => {
      const mockDb = createMockQueryBuilder([]);
      vi.mocked(getDb).mockReturnValue(mockDb as any);

      await expect(
        TenantService.resolveBySubdomain('nonexistent')
      ).rejects.toThrow(NotFoundError);

      await expect(
        TenantService.resolveBySubdomain('nonexistent')
      ).rejects.toThrow('clinic not found');
    });

    it('should throw NotFoundError when tenant exists but is inactive', async () => {
      // The query filters by isActive=true, so inactive tenants return empty results
      const mockDb = createMockQueryBuilder([]);
      vi.mocked(getDb).mockReturnValue(mockDb as any);

      await expect(
        TenantService.resolveBySubdomain('inactive-clinic')
      ).rejects.toThrow(NotFoundError);
    });

    it('should return only id, name, and subdomain fields', async () => {
      const mockTenant = {
        id: 'abc-123',
        name: 'My Clinic',
        subdomain: 'my-clinic',
      };

      const mockDb = createMockQueryBuilder([mockTenant]);
      vi.mocked(getDb).mockReturnValue(mockDb as any);

      const result = await TenantService.resolveBySubdomain('my-clinic');

      expect(Object.keys(result)).toEqual(['id', 'name', 'subdomain']);
    });

    it('should handle empty string subdomain by throwing NotFoundError', async () => {
      const mockDb = createMockQueryBuilder([]);
      vi.mocked(getDb).mockReturnValue(mockDb as any);

      await expect(
        TenantService.resolveBySubdomain('')
      ).rejects.toThrow(NotFoundError);
    });
  });
});
