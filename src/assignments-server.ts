import { createHash, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { assignmentsPath, loadAssignments } from "./assignments.js";

export const assignmentsRoute = "/assignments";

function portFromEnv(): number {
  const raw = process.env.PORT?.trim();
  if (!raw) return 3000;
  if (!/^\d+$/.test(raw)) {
    throw new Error("PORT muss eine ganze Zahl sein.");
  }
  const port = Number(raw);
  if (port > 65535) {
    throw new Error("PORT muss zwischen 0 und 65535 liegen.");
  }
  return port;
}

function authorizationHeader(req: IncomingMessage): string {
  const value = req.headers.authorization;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0] ?? "";
  return "";
}

function bearerToken(req: IncomingMessage): string {
  const match = /^Bearer\s+(\S+)$/i.exec(authorizationHeader(req).trim());
  return match?.[1] ?? "";
}

function tokensMatch(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;
  const providedHash = createHash("sha256").update(provided, "utf8").digest();
  const expectedHash = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(providedHash, expectedHash);
}

function authorized(req: IncomingMessage): boolean {
  const expected = process.env.ASSIGNMENTS_READ_TOKEN?.trim() ?? "";
  return tokensMatch(bearerToken(req), expected);
}

function pathnameOf(url: string | undefined): string {
  const raw = url && url.startsWith("/") ? url : "/";
  try {
    return new URL(raw, "http://127.0.0.1").pathname;
  } catch {
    return "/";
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

async function handle(
  req: IncomingMessage,
  res: ServerResponse,
  filePath: string,
): Promise<void> {
  req.resume();
  try {
    if (pathnameOf(req.url) !== assignmentsRoute) {
      sendJson(res, 404, { error: "not_found" });
      return;
    }
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      sendJson(res, 405, { error: "method_not_allowed" });
      return;
    }
    if (!authorized(req)) {
      res.setHeader("WWW-Authenticate", "Bearer");
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }
    const records = await loadAssignments(filePath);
    sendJson(res, 200, records);
  } catch {
    console.error("Zuweisungen lesen fehlgeschlagen.");
    if (!res.headersSent) {
      sendJson(res, 500, { error: "read_failed" });
    }
  }
}

export function startAssignmentsServer(options?: {
  filePath?: string;
  port?: number;
  host?: string;
}): Server {
  const filePath = options?.filePath ?? assignmentsPath;
  const port = options?.port ?? portFromEnv();
  const host = options?.host ?? "0.0.0.0";

  const server = createServer((req, res) => {
    void handle(req, res, filePath);
  });

  server.listen(port, host, () => {
    const address = server.address();
    const bound =
      address && typeof address === "object" ? String(address.port) : String(port);
    console.log(`Lese-Endpunkt: http://${host}:${bound}${assignmentsRoute}`);
    if (!process.env.ASSIGNMENTS_READ_TOKEN?.trim()) {
      console.log(
        "ASSIGNMENTS_READ_TOKEN fehlt — Anfragen an /assignments erhalten 401.",
      );
    }
  });

  return server;
}
