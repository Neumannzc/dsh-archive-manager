/**
 * Self-contained tsdown config for the dsh-ui-archive-manager client bundle,
 * mirroring the official DeepSeek Harness client-bundle protocol
 * (packages/client/tsdown.client.ts):
 *
 * - emits lib/client.js as a CJS closure that calls
 *   `window.__ModuleLoader__.load({ id, factory })` — the browser half is
 *   discovered through package.json `exports["./client"]` by dsh-client-modules;
 * - resolves platform modules (react, @deepseek-ai/cordis, ui-slots,
 *   ui-primitives, client-runtime/client, ...) through the injected require,
 *   i.e. they stay external and are never duplicated;
 * - compiles `*.module.css` with lightningcss into a hashed class map and
 *   injects one `<style data-plugin>` tag at factory execution (the loader
 *   removes plugin-owned tags on unload).
 *
 * The node half (lib/index.js + lib/types) is emitted by `tsc -p tsconfig.json`;
 * client type declarations by `tsc -p tsconfig.client.json`.
 */
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { basename, dirname, resolve as resolvePath, sep } from 'node:path'
import { transform } from 'lightningcss'

const PACKAGE_NAME = '@tangzai/dsh-ui-archive-manager'

/** The module specifiers the dsh shell shares into its frozen module table. */
const PLATFORM_MODULES = [
  'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-web-react',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-attachment',
  '@deepseek-ai/dsh-client-schema-form',
] as const

/**
 * Externals resolved from the loader module table: the platform seed entries
 * plus the documented runtime exemption (the snapshot-store engine
 * createSnapshotStore/defineStore lives in client-runtime until its
 * promotion-time rehoming; view-store.ts imports defineStore from it).
 */
const CLIENT_EXTERNALS: readonly string[] = [...PLATFORM_MODULES, '@deepseek-ai/dsh-client-runtime/client']

const CSS_VIRTUAL_PREFIX = '\0dsh-css:'
const CSS_VIRTUAL_SUFFIX = '.mjs'

/** Resolve an emitted JS asset import against its source-tree counterpart. */
function sourceAssetPath(source: string, importer: string): string {
  const emitted = resolvePath(dirname(importer), source)
  if (existsSync(emitted)) return emitted
  const marker = `${sep}lib${sep}types${sep}`
  const boundary = emitted.indexOf(marker)
  if (boundary < 0) return emitted
  return resolvePath(emitted.slice(0, boundary), 'src', emitted.slice(boundary + marker.length))
}

export default {
  name: `${PACKAGE_NAME}/client`,
  entry: { client: 'src/client/index.ts' },
  // Browser bundle lands next to the node half (single lib/ artifact dir;
  // the entryFileNames pin keeps it exactly lib/client.js). clean stays off —
  // a default clean would wipe the node-half output emitted by tsc.
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  dts: false,
  sourcemap: true,
  clean: false,
  external: CLIENT_EXTERNALS,
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    'import.meta.env.MODE': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    'import.meta.env': JSON.stringify({ MODE: process.env.NODE_ENV ?? 'production' }),
  },
  // Anything NOT in the loader module table must inline instead; a require()
  // the table cannot answer is a guaranteed runtime throw.
  noExternal: (id: string) => (CLIENT_EXTERNALS.includes(id) ? undefined : true),
  plugins: [{
    // Bundle purity gate: platform seed entries stay external, every other
    // @deepseek-ai value import is a build error — cross-plugin collaboration
    // goes through cordis services instead. Type-only imports are erased by
    // tsc and never reach this gate.
    name: 'dsh-client-bundle-purity',
    resolveId(source: string) {
      if (!source.startsWith('@deepseek-ai/')) return null
      if (CLIENT_EXTERNALS.includes(source)) return null
      throw new Error(
        `client bundle purity: "${source}" is not a platform module (CLIENT_EXTERNALS) — `
        + 'cross-plugin value imports are forbidden; collaborate through cordis services '
        + '(type-only imports are erased and never reach this gate)',
      )
    },
  }, {
    // CSS Modules: compile to a hashed class map + one injected <style> tag.
    name: 'dsh-css-modules-inline',
    resolveId(source: string, importer: string | undefined) {
      if (!source.endsWith('.module.css')) return null
      const abs = importer !== undefined ? sourceAssetPath(source, importer) : source
      return CSS_VIRTUAL_PREFIX + abs + CSS_VIRTUAL_SUFFIX
    },
    async load(virtualId: string) {
      if (!virtualId.startsWith(CSS_VIRTUAL_PREFIX)) return null
      const fileId = virtualId.slice(CSS_VIRTUAL_PREFIX.length, -CSS_VIRTUAL_SUFFIX.length)
      // The virtual id otherwise hides the physical stylesheet from Rolldown's watch graph.
      this.addWatchFile(fileId)
      const source = await readFile(fileId)
      const { code, exports: cssExports } = transform({
        filename: fileId,
        code: source,
        cssModules: { pattern: '[hash]_[local]' },
        minify: true,
      })
      const classMap: Record<string, string> = {}
      for (const [local, exp] of Object.entries(cssExports ?? {})) classMap[local] = exp.name
      // One <style data-plugin> per module file; idempotent under re-evaluation.
      return [
        `const css = ${JSON.stringify(code.toString())};`,
        `const tagId = ${JSON.stringify(`${PACKAGE_NAME}/${basename(fileId)}`)};`,
        'if (typeof document !== \'undefined\' && document.querySelector(\'style[data-plugin-css=\' + JSON.stringify(tagId) + \']\') === null) {',
        '  const tag = document.createElement(\'style\');',
        `  tag.dataset.plugin = ${JSON.stringify(PACKAGE_NAME)};`,
        '  tag.dataset.pluginCss = tagId;',
        '  tag.textContent = css;',
        '  document.head.appendChild(tag);',
        '}',
        `export default ${JSON.stringify(classMap)};`,
      ].join('\n')
    },
  }],
  outputOptions: {
    entryFileNames: 'client.js',
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PACKAGE_NAME)}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
}
