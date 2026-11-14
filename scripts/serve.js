import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const port = Number(process.env.PORT || 4173);
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
};

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer from 1 to 65535.");
}

const server = createServer(async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }

  try {
    const url = new URL(request.url, "http://localhost");
    const pathname = decodeURIComponent(url.pathname);
    const segments = pathname.split("/");
    const file = resolve(
      root,
      `.${pathname === "/" ? "/index.html" : pathname}`,
    );
    const contentType = contentTypes[extname(file)];
    const isPrivate = segments.some(
      (part) =>
        part.startsWith(".") ||
        ["node_modules", "tests", "scripts"].includes(part),
    );

    if (
      !file.startsWith(root.endsWith(sep) ? root : `${root}${sep}`) ||
      isPrivate ||
      !contentType
    ) {
      response.writeHead(404).end("Not found");
      return;
    }

    const body = await readFile(file);
    response.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": body.length,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(request.method === "HEAD" ? undefined : body);
  } catch (error) {
    response.writeHead(
      error.code === "ENOENT" || error.code === "EISDIR" ? 404 : 400,
    );
    response.end("Not found");
  }
});

server.on("error", (error) => {
  console.error(`Could not start the local server: ${error.message}`);
  process.exitCode = 1;
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Quiet List: http://127.0.0.1:${port}`);
});
