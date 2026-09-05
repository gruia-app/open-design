import { Pool } from "pg";
import type { AuthorizationRepository, GatewayIdentity } from "./types.js";

const RESOLVE_CANONICAL_WORKOS_MEMBERSHIP = `
  SELECT ui.user_id::text AS "userId", ui.provider_subject AS subject,
         om.organization_id::text AS "organizationId", om.role::text AS role
  FROM public.user_identities AS ui
  JOIN public.users AS u ON u.id = ui.user_id
  JOIN public.organization_members AS om ON om.user_id = u.id
  WHERE ui.provider = 'workos'
    AND ui.provider_subject = $1
    AND u.is_active = TRUE
    AND om.organization_id::text = ANY($2::text[])
`;

/** The only identity authority: no email lookup and no identity/user writes. */
export class PostgresAuthorizationRepository implements AuthorizationRepository {
  private readonly pool: Pool;
  constructor(postgresUrl: string) { this.pool = new Pool({ connectionString: postgresUrl, max: 5, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 5_000 }); }
  async resolve(subject: string, allowedOrganizations: readonly string[]): Promise<readonly GatewayIdentity[]> {
    if (!subject || allowedOrganizations.length === 0) return [];
    const result = await this.pool.query<GatewayIdentity>(RESOLVE_CANONICAL_WORKOS_MEMBERSHIP, [subject, allowedOrganizations]);
    return result.rows.map((row) => Object.freeze({ userId: row.userId, subject: row.subject, organizationId: row.organizationId, role: row.role }));
  }
  async close(): Promise<void> { await this.pool.end(); }
}
