import { resolve } from "node:path";
import { loadConfig } from "./config.js";
import { PostgresAuthorizationRepository } from "./authorization.js";
import { createGatewayServer, GatewayCore, shutdownGateway } from "./gateway.js";
import { SqliteSessionStore } from "./session-store.js";

process.umask(0o077);

// `gruia-gateway audit [--db <path>] [--days N] [--org <id>]` — operator-only
// auth activity report over the audit table. Read-only; runs where only the
// database file is reachable (no config or Postgres needed).
if (process.argv[2] === "audit") {
  const { buildAuditReport } = await import("./audit-report.js");
  const args = process.argv.slice(3);
  const flag = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
  const databasePath = flag("--db");
  const report = buildAuditReport(databasePath ?? loadConfig(resolve(process.env.GRUIA_GATEWAY_CONFIG!)).databasePath, { days: flag("--days") === undefined ? undefined : Number(flag("--days")), organizationId: flag("--org") });
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  process.exit(0);
}

const configPath = process.env.GRUIA_GATEWAY_CONFIG;
if (!configPath) throw new Error("GRUIA_GATEWAY_CONFIG must name the protected gateway JSON file");
const config = loadConfig(resolve(configPath));
const core = new GatewayCore(config, new SqliteSessionStore(config.databasePath, config.sessionSecret), new PostgresAuthorizationRepository(config.postgresUrl));
const server = createGatewayServer(core);
server.listen(config.port, config.bindHost, () => process.stdout.write(`Gruia gateway listening on ${config.bindHost}:${config.port}\n`));
const stop = (): void => { void shutdownGateway(server).then(() => core.close()).finally(() => process.exit(0)); };
process.once("SIGINT", stop); process.once("SIGTERM", stop);
