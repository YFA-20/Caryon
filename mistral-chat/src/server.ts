import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Mistral } from "@mistralai/mistralai";

const SRC_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SRC_DIR, "..");
const PUBLIC_DIR = path.join(ROOT_DIR, "public");

const envPath = path.join(ROOT_DIR, ".env");
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

const apiKey = process.env.MISTRAL_API_KEY;
const MODEL = process.env.MISTRAL_MODEL ?? "mistral-large-4";
const parsedPort = Number.parseInt(process.env.PORT ?? "3001", 10);
const PORT = Number.isNaN(parsedPort) ? 3001 : parsedPort;

if (!apiKey) {
  console.error(
    "MISTRAL_API_KEY est introuvable : copiez .env.example en .env puis renseignez votre clé (https://console.mistral.ai)."
  );
  process.exit(1);
}

const client = new Mistral({ apiKey });

type ChatRole = "system" | "user" | "assistant";

interface ChatMessage {
  role: ChatRole;
  content: string;
}

const ROLES: ReadonlySet<string> = new Set(["system", "user", "assistant"]);
const MAX_BODY_BYTES = 64 * 1024;
const MAX_MESSAGES = 50;
const MAX_CONTENT_CHARS = 8000;

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "HttpError";
  }
}

const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
};

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...SECURITY_HEADERS,
  });
  res.end(JSON.stringify(payload));
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new HttpError(413, "Corps de requête trop volumineux."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
    req.on("error", reject);
  });
}

function parseChatMessages(payload: unknown): ChatMessage[] {
  if (typeof payload !== "object" || payload === null) {
    throw new HttpError(400, "Corps JSON invalide.");
  }
  const raw = (payload as { messages?: unknown }).messages;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_MESSAGES) {
    throw new HttpError(
      400,
      `Le champ "messages" doit contenir entre 1 et ${MAX_MESSAGES} messages.`
    );
  }
  return raw.map((entry, index) => {
    if (typeof entry !== "object" || entry === null) {
      throw new HttpError(400, `Message #${index} invalide.`);
    }
    const { role, content } = entry as { role?: unknown; content?: unknown };
    if (typeof role !== "string" || !ROLES.has(role)) {
      throw new HttpError(400, `Message #${index} : rôle attendu parmi system, user, assistant.`);
    }
    if (typeof content !== "string" || content.length === 0 || content.length > MAX_CONTENT_CHARS) {
      throw new HttpError(
        400,
        `Message #${index} : contenu texte requis (1 à ${MAX_CONTENT_CHARS} caractères).`
      );
    }
    return { role: role as ChatRole, content };
  });
}

function extractText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "object" && part !== null && "text" in part) {
          const text = (part as { text: unknown }).text;
          return typeof text === "string" ? text : "";
        }
        return "";
      })
      .join("");
  }
  return "";
}

async function handleChat(req: IncomingMessage, res: ServerResponse): Promise<void> {
  let messages: ChatMessage[];
  try {
    const body = await readBody(req);
    messages = parseChatMessages(JSON.parse(body.toString("utf8")));
  } catch (err) {
    if (err instanceof HttpError) {
      sendJson(res, err.status, { error: err.message });
      return;
    }
    if (err instanceof SyntaxError) {
      sendJson(res, 400, { error: "Corps JSON invalide." });
      return;
    }
    throw err;
  }
  try {
    const completion = await client.chat.complete({ model: MODEL, messages });
    const reply = extractText(completion.choices[0]?.message?.content);
    sendJson(res, 200, { reply, model: completion.model });
  } catch (err) {
    console.error("Échec de l'appel à l'API Mistral :", err);
    sendJson(res, 502, { error: "L'appel à l'API Mistral a échoué." });
  }
}

async function serveStatic(res: ServerResponse, pathname: string): Promise<void> {
  const rel = pathname === "/" ? "index.html" : pathname.slice(1);
  const filePath = path.join(PUBLIC_DIR, rel);
  if (!filePath.startsWith(PUBLIC_DIR + path.sep)) {
    sendJson(res, 403, { error: "Accès interdit." });
    return;
  }
  try {
    const data = await readFile(filePath);
    res.writeHead(200, {
      "Content-Type":
        MIME_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream",
      "Cache-Control": "no-store",
      ...SECURITY_HEADERS,
    });
    res.end(data);
  } catch {
    sendJson(res, 404, { error: "Ressource introuvable." });
  }
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  void (async () => {
    if (req.method === "GET" && url.pathname === "/api/health") {
      sendJson(res, 200, { ok: true, model: MODEL });
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/chat") {
      await handleChat(req, res);
      return;
    }
    if (req.method === "GET" || req.method === "HEAD") {
      await serveStatic(res, url.pathname);
      return;
    }
    sendJson(res, 405, { error: "Méthode non autorisée." });
  })().catch((err: unknown) => {
    console.error("Erreur interne :", err);
    if (!res.headersSent) {
      sendJson(res, 500, { error: "Erreur interne du serveur." });
    }
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Chat Mistral démarré : http://localhost:${PORT} (modèle : ${MODEL})`);
  console.log("MISTRAL_API_KEY est lu uniquement côté serveur (.env) et jamais envoyé au client.");
});
