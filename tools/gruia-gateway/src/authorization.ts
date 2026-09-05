import { Pool } from "pg";
import type { AuthorizationRepository, GatewayIdentity, GatewayLoginUser } from "./types.js";

const FIND_CANONICAL_LOGIN_USER = `
  SELECT u.id::text AS "userId", u.hashed_password AS "hashedPassword",
         om.organization_id::text AS "organizationId", om.role::text AS role
  FROM public.users AS u
  JOIN public.organization_members AS om ON om.user_id = u.id
  WHERE lower(u.email) = lower($1)
    AND u.is_active = TRUE
    AND lower(u.account_status::text) = 'active'
    AND om.organization_id::text = ANY($2::text[])
`;
const RESOLVE_CANONICAL_USER_MEMBERSHIP = `
  SELECT u.id::text AS "userId", om.organization_id::text AS "organizationId", om.role::text AS role
  FROM public.users AS u
  JOIN public.organization_members AS om ON om.user_id = u.id
  WHERE u.id::text = $1
    AND u.is_active = TRUE
    AND lower(u.account_status::text) = 'active'
    AND om.organization_id::text = ANY($2::text[])
`;

/** Read-only canonical-user and membership authority. */
export class PostgresAuthorizationRepository implements AuthorizationRepository {
  private readonly pool: Pool;
  constructor(postgresUrl: string) { this.pool = new Pool({ connectionString: postgresUrl, max: 5, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 5_000 }); }
  async findLoginUser(email: string, allowedOrganizations: readonly string[]): Promise<GatewayLoginUser | null> {
    if (!email || allowedOrganizations.length === 0) return null;
    const result = await this.pool.query<GatewayIdentity & { hashedPassword: string }>(FIND_CANONICAL_LOGIN_USER, [email, allowedOrganizations]);
    const first = result.rows[0];
    if (!first || !first.hashedPassword || result.rows.some((row) => row.userId !== first.userId || row.hashedPassword !== first.hashedPassword)) return null;
    return Object.freeze({ userId: first.userId, hashedPassword: first.hashedPassword, identities: result.rows.map((row) => Object.freeze({ userId: row.userId, organizationId: row.organizationId, role: row.role })) });
  }
  async resolveUser(userId: string, allowedOrganizations: readonly string[]): Promise<readonly GatewayIdentity[]> {
    if (!userId || allowedOrganizations.length === 0) return [];
    const result = await this.pool.query<GatewayIdentity>(RESOLVE_CANONICAL_USER_MEMBERSHIP, [userId, allowedOrganizations]);
    return result.rows.map((row) => Object.freeze({ userId: row.userId, organizationId: row.organizationId, role: row.role }));
  }
  async close(): Promise<void> { await this.pool.end(); }
}
