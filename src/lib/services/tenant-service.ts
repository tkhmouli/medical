import { eq, and } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { tenants } from '@/lib/db/schema';
import { NotFoundError } from '@/lib/errors';

export interface ResolvedTenant {
  id: string;
  name: string;
  subdomain: string;
}

export const TenantService = {
  /**
   * Resolves a tenant by subdomain.
   * Only returns active tenants. Throws NotFoundError if
   * the subdomain is unregistered or the tenant is inactive.
   */
  async resolveBySubdomain(subdomain: string): Promise<ResolvedTenant> {
    const db = getDb();

    const result = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        subdomain: tenants.subdomain,
      })
      .from(tenants)
      .where(and(eq(tenants.subdomain, subdomain), eq(tenants.isActive, true)))
      .limit(1);

    if (result.length === 0) {
      throw new NotFoundError('clinic');
    }

    return result[0];
  },
};
