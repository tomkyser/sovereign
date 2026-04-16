import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: { 'wire-server': 'src/wire/server.ts' },
  format: 'cjs',
  outDir: 'data/wire',
  clean: false,
  dts: false,
  fixedExtension: false,
  splitting: false,
  target: 'node20',
  external: [/^node:/],
  noExternal: [/@modelcontextprotocol/, /^ajv/, /^ajv-formats/],
});
