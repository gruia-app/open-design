import { resolve } from "node:path";
import { loadConfig } from "./config.js";
import { PostgresAuthorizationRepository } from "./authorization.js";
import { createGatewayServer, GatewayCore } from "./gateway.js";
import { SqliteSessionStore } from "./session-store.js";

process.umask(0o077);

const configPath = process.env.GRUIA_GATEWAY_CONFIG;
if (!configPath) throw new Error("GRUIA_GATEWAY_CONFIG must name the protected gateway JSON file");
const config = loadConfig(resolve(configPath));
const core = new GatewayCore(config, new SqliteSessionStore(config.databasePath, config.sessionSecret), new PostgresAuthorizationRepository(config.postgresUrl));
const server = createGatewayServer(core);
server.listen(config.port, config.bindHost, () => process.stdout.write(`Gruia gateway listening on ${config.bindHost}:${config.port}\n`));
const stop = (): void => { server.close(() => { void core.close().finally(() => process.exit(0)); }); };
process.once("SIGINT", stop); process.once("SIGTERM", stop);
