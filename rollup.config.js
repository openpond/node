import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import { readFileSync } from "fs";

const protoLoader = () => ({
  name: "proto-loader",
  resolveId(source) {
    if (source.endsWith(".proto")) {
      return source;
    }
    return null;
  },
  load(id) {
    if (id.endsWith(".proto")) {
      const content = readFileSync(id, "utf-8");
      return `export default ${JSON.stringify(content)};`;
    }
  },
});

export default {
  input: "src/bin/p2p-node.ts",
  output: {
    file: "dist/p2p-node.js",
    format: "es",
    sourcemap: true,
    inlineDynamicImports: true,
  },
  plugins: [
    protoLoader(),
    nodeResolve({
      preferBuiltins: true,
      exportConditions: ["node", "import", "default"],
      browser: false,
    }),
    commonjs({
      ignoreDynamicRequires: true,
      transformMixedEsModules: true,
      ignore: [/^node:.*/, /@grpc\/proto-loader/],
    }),
    json(),
    typescript({
      tsconfig: "./tsconfig.json",
      sourceMap: true,
    }),
  ],
  external: [
    /^node:/, // All new Node.js built-ins
    "@grpc/proto-loader",
    "@grpc/grpc-js",
    "events",
    "fs",
    "path",
    "os",
    "child_process",
    "readline",
    "crypto",
    "stream",
    "util",
    "buffer",
    "url",
    "net",
    "tls",
    "http",
    "https",
    "zlib",
    "dns",
    "assert",
    "constants",
    "process",
  ],
  onwarn(warning, warn) {
    if (warning.code === "CIRCULAR_DEPENDENCY") return;
    if (warning.code === "THIS_IS_UNDEFINED") return;
    warn(warning);
  },
};
