import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import type { IncomingMessage, ServerResponse } from "http";

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;

if (!basePath) {
  throw new Error(
    "BASE_PATH environment variable is required but was not provided.",
  );
}

interface RoomPlayer { name: string; phone: string; }
interface Room {
  code: string; bet: number; host: string;
  players: RoomPlayer[];
  state: "waiting" | "playing" | "finished";
  gameState: unknown; updatedAt: number;
}

const rooms = new Map<string, Room>();

function genCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

const roomsApiPlugin: Plugin = {
  name: "rooms-api",
  configureServer(server) {
    server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
      const url = req.url ?? "";
      if (!url.startsWith("/_rooms")) return next();

      res.setHeader("Content-Type", "application/json");
      res.setHeader("Access-Control-Allow-Origin", "*");

      if (req.method === "OPTIONS") { res.statusCode = 200; res.end(); return; }

      const tail = url.replace(/^\/_rooms\/?/, "");
      const parts = tail.split("/").filter(Boolean);

      let body = "";
      req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
      req.on("end", () => {
        try {
          const data = body ? JSON.parse(body) : {};
          const send = (obj: unknown, status = 200) => {
            res.statusCode = status;
            res.end(JSON.stringify(obj));
          };

          if (req.method === "POST" && parts.length === 0) {
            const code = genCode();
            const room: Room = {
              code, bet: Number(data.bet) || 50, host: data.hostPhone ?? "",
              players: [{ name: data.hostName ?? "Host", phone: data.hostPhone ?? "" }],
              state: "waiting", gameState: null, updatedAt: Date.now(),
            };
            rooms.set(code, room);
            send({ success: true, room });

          } else if (req.method === "GET" && parts.length === 1) {
            const room = rooms.get(parts[0].toUpperCase());
            if (!room) { send({ error: "Room not found" }, 404); return; }
            send(room);

          } else if (req.method === "POST" && parts.length === 2 && parts[1] === "join") {
            const room = rooms.get(parts[0].toUpperCase());
            if (!room) { send({ error: "Room not found" }, 404); return; }
            if (!room.players.find((p) => p.phone === data.phone)) {
              room.players.push({ name: data.name ?? "Player", phone: data.phone ?? "" });
            }
            room.updatedAt = Date.now();
            send(room);

          } else if (req.method === "PUT" && parts.length === 1) {
            const room = rooms.get(parts[0].toUpperCase());
            if (!room) { send({ error: "Room not found" }, 404); return; }
            if (data.state !== undefined) room.state = data.state;
            if (data.gameState !== undefined) room.gameState = data.gameState;
            if (data.players !== undefined) room.players = data.players;
            room.updatedAt = Date.now();
            send(room);

          } else if (req.method === "DELETE" && parts.length === 2 && parts[1] === "leave") {
            const room = rooms.get(parts[0].toUpperCase());
            if (!room) { send({ error: "Room not found" }, 404); return; }
            room.players = room.players.filter((p) => p.phone !== data.phone);
            room.updatedAt = Date.now();
            send(room);

          } else {
            next();
          }
        } catch {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: "Server error" }));
        }
      });
    });
  },
};

export default defineConfig({
  base: basePath,
  plugins: [
    roomsApiPlugin,
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
