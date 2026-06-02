import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [
    react(),
    tailwindcss(),
    // Anthropic SDK v0.100+ ships agent-toolset with heavy Node.js deps we don't use.
    // Provide stubs so production bundle can compile.
    {
      name: "stub-node-builtins",
      enforce: "pre" as const,
      resolveId(id: string) {
        if (id.startsWith("node:")) return `\0${id}`;
      },
      load(id: string) {
        if (!id.startsWith("\0node:")) return;
        const noop = "() => {}";
        const asyncNoop = "async () => {}";
        if (id === "\0node:crypto") return `
          export const randomUUID = () => crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
          export const createHash = () => ({ update: ${noop}, digest: () => "" });
          export default { randomUUID, createHash };
        `;
        if (id === "\0node:fs/promises") return `
          export const realpath = ${asyncNoop}; export const lstat = ${asyncNoop};
          export const readlink = ${asyncNoop}; export const readdir = async () => [];
          export const readFile = async () => ""; export const writeFile = ${asyncNoop};
          export const mkdir = ${asyncNoop}; export const stat = ${asyncNoop};
          export const unlink = ${asyncNoop}; export const rm = ${asyncNoop};
          export const open = async () => ({ read: ${asyncNoop}, write: ${asyncNoop}, close: ${asyncNoop} });
          export const rename = ${asyncNoop}; export const copyFile = ${asyncNoop};
          export const access = ${asyncNoop}; export const appendFile = ${asyncNoop};
          export default {};
        `;
        if (id === "\0node:fs") return `
          export const existsSync = () => false; export const readFileSync = () => "";
          export const writeFileSync = ${noop}; export const mkdirSync = ${noop};
          export const readdirSync = () => []; export const statSync = () => ({});
          export const createReadStream = ${noop}; export const createWriteStream = ${noop};
          export default {};
        `;
        if (id === "\0node:path") return `
          export const resolve = (...a) => a.filter(Boolean).join("/");
          export const dirname = (p) => p.split("/").slice(0,-1).join("/") || "/";
          export const basename = (p, e) => { const b = p.split("/").pop() || ""; return e && b.endsWith(e) ? b.slice(0,-e.length) : b; };
          export const join = (...a) => a.filter(Boolean).join("/").replace(/\\/+/g,"/");
          export const isAbsolute = (p) => p.startsWith("/");
          export const extname = (p) => { const m = p.match(/\\.[^.]*$/); return m ? m[0] : ""; };
          export const relative = (_, t) => t; export const normalize = (p) => p;
          export const sep = "/"; export const delimiter = ":"; export const posix = {};
          export default { resolve, dirname, basename, join, isAbsolute, extname, relative, normalize, sep, delimiter };
        `;
        if (id === "\0node:util") return `
          export const promisify = (fn) => (...a) => new Promise((res, rej) => fn(...a, (e, v) => e ? rej(e) : res(v)));
          export const inspect = (v) => String(v); export const format = (...a) => a.join(" ");
          export const callbackify = (fn) => fn; export const inherits = ${noop};
          export default { promisify, inspect, format };
        `;
        if (id === "\0node:child_process") return `
          export const execFile = (_, __, cb) => cb && cb(null, "", "");
          export const exec = (_, cb) => cb && cb(null, "", "");
          export const spawn = () => ({ stdout: { on: ${noop} }, stderr: { on: ${noop} }, on: ${noop} });
          export default { execFile, exec, spawn };
        `;
        if (id === "\0node:stream") return `
          export class Readable { on() { return this; } pipe() { return this; } }
          export class Writable { on() { return this; } write() {} end() {} }
          export class Transform { on() { return this; } }
          export const pipeline = ${asyncNoop}; export const finished = ${asyncNoop};
          export default { Readable, Writable, Transform, pipeline };
        `;
        if (id === "\0node:stream/promises") return `
          export const pipeline = ${asyncNoop}; export const finished = ${asyncNoop};
          export default { pipeline, finished };
        `;
        if (id === "\0node:os") return `
          export const tmpdir = () => "/tmp"; export const homedir = () => "/";
          export const platform = () => "darwin"; export const arch = () => "arm64";
          export default { tmpdir, homedir, platform, arch };
        `;
        // catch-all
        return "export default {}; export const __esModule = true;";
      },
    },
  ],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
