import { createLogger, transports, format, Logform } from "winston";
import LokiTransport from "winston-loki"
import DiscordTransport from "./logger-discord.ts";

const GRAFANA_URL = process.env.GRAFANA_LOKI_URL ? new URL(process.env.GRAFANA_LOKI_URL) : null;
const DISCORD_ALERTS_WEBHOOK = process.env.DISCORD_ALERTS_WEBHOOK;

const createLokiTransport = (grafanaUrl: URL) => {
  return new LokiTransport({
    host: `${grafanaUrl.protocol}//${grafanaUrl.host}`,
    basicAuth: `${grafanaUrl.username}:${grafanaUrl.password}`,
    json: true,
    interval: 1,
    format: format.simple(),
    labels: {
      app: "soul-engine-cloud",
    },
    onConnectionError: (err) => {
      console.error("Error connecting to Loki", err);
    }
  })
};

const createDiscordTransport = (webhook: string) => {
  return new DiscordTransport({
    webhook,
    level: "info",
    format: format.simple(),
    filter: (info: any) => info.alert === true,
  })
};

function errorForLogging(err: any): any {
  if (err === null || err === undefined) {
    return err
  }

  if (err instanceof Error) {
    return { ...err, message: err.message, stack: err.stack || undefined, cause: errorForLogging(err.cause) }
  } else {
    return err
  }
}

const enhancedErrorFormatter = format((info: Logform.TransformableInfo) => {
  if (info.level === "error" && typeof info.alert === "undefined") {
    info.alert = true;
  }
  if (info.error && info.error instanceof Error) {
    info.error = errorForLogging(info.error);
  }

  return info;
});

export const logger = createLogger({
  transports: [
    new transports.Console(),
    ...(GRAFANA_URL ? [createLokiTransport(GRAFANA_URL)] : []),
    ...(DISCORD_ALERTS_WEBHOOK ? [createDiscordTransport(DISCORD_ALERTS_WEBHOOK)] : [])
  ],
  format: format.combine(
    format.timestamp(),
    enhancedErrorFormatter(),
    format.simple(),
  )
});
