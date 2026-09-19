import http from "node:http";
import { pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
if (existsSync(new URL(".env", import.meta.url)))
  process.loadEnvFile(new URL(".env", import.meta.url));
import { readFile } from "node:fs/promises";
import { evaluate } from "./lib/api.js";
import { compilerDescriptor, lower, DESCRIPTORS } from "./lib/semantic.js";
const port = Number(process.env.PORT || 4173);
export function createApp({ evaluateRequest = evaluate } = {}) {
  let active = 0;
  return http.createServer(async (req, res) => {
    const send = (status, data) => {
      res.writeHead(status, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(data));
    };
    try {
      const url = new URL(req.url, "http://localhost");
      const boundPort = req.socket.localPort;
      if (
        !["localhost:" + boundPort, "127.0.0.1:" + boundPort].includes(
          req.headers.host,
        )
      )
        return send(403, { error: "Host rejected" });
      if (
        req.method === "POST" &&
        [
          "/api/proxy/compile",
          "/api/proxy",
          "/api/compile",
          "/api/judge",
        ].includes(url.pathname)
      ) {
        if (
          req.headers.origin &&
          ![
            "http://localhost:" + boundPort,
            "http://127.0.0.1:" + boundPort,
          ].includes(req.headers.origin)
        )
          return send(403, { error: "Origin rejected" });
        if (active >= 4)
          return send(429, { error: "Please wait for current judgments" });
        let raw = "";
        for await (const chunk of req) {
          raw += chunk;
          if (raw.length > 20000)
            return send(413, { error: "Request too large" });
        }
        const body = JSON.parse(raw);
        active++;
        try {
          if (["/api/proxy/compile", "/api/compile"].includes(url.pathname)) {
            const descriptor = compilerDescriptor(body.request),
              result = await evaluateRequest(descriptor);
            return send(200, {
              program: lower(descriptor, result),
              descriptor,
              result,
            });
          }
          if (
            typeof body.message !== "string" ||
            body.message.length > 500 ||
            !body.message.trim()
          )
            throw Error("Message must be 1–500 characters");
          const descriptorId = body.descriptorId ?? 0;
          if (
            !Number.isInteger(descriptorId) ||
            !Object.hasOwn(DESCRIPTORS, descriptorId)
          )
            throw Error("Unknown descriptor");
          const instruction = body.instruction ?? "JUDGE";
          const required = { CHOOSE: "choice", SCORE: "score", TEST: "noul" }[
            instruction
          ];
          const template = DESCRIPTORS[descriptorId];
          if (
            !["JUDGE", "CHOOSE", "SCORE", "TEST"].includes(instruction) ||
            (required &&
              (Object.keys(template.questions).length !== 1 ||
                Object.values(template.questions)[0].type !== required))
          )
            throw Error("Instruction/descriptor mismatch");
          const descriptor = {
            ...structuredClone(template),
            state: { message: body.message },
          };
          return send(200, await evaluateRequest(descriptor));
        } finally {
          active--;
        }
      }
      if (req.method !== "GET")
        return send(405, { error: "Method not allowed" });
      let path = url.pathname;
      const allowed = {
        "/": "public/index.html",
        "/app.js": "public/app.js",
        "/style.css": "public/style.css",
        "/lib/vm.js": "lib/vm.js",
        "/lib/semantic.js": "lib/semantic.js",
        "/docs/isa.md": "docs/isa.md",
        "/demo.json": "public/demo.json",
      };
      if (!allowed[path]) return send(404, { error: "Not found" });
      const data = await readFile(allowed[path]);
      res.writeHead(200, {
        "Content-Type": path.endsWith(".js")
          ? "text/javascript"
          : path.endsWith(".css")
            ? "text/css"
            : path.endsWith(".json")
              ? "application/json"
              : path.endsWith(".md")
                ? "text/plain"
                : "text/html",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(data);
    } catch (e) {
      send(400, { error: e.message });
    }
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  createApp().listen(port, "127.0.0.1", () =>
    console.log(`JRISC http://localhost:${port}`),
  );
