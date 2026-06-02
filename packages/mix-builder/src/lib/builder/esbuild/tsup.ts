// import { build, defineConfig} from 'tsup';
// import { BuildOptions} from 'esbuild';
// import { existsSync, mkdirSync } from 'fs';
// import type {type FileEntry, init_build, formatResolver, mergeOptions} from './base.js'
// import fs from 'fs'
// import { copyPkgJson } from './copy-pkg.mjs';
// import { ArgParserConfig, parseProcessArgs } from './arg-parser';
// // Load build configuration
// export interface IBuildOption extends BuildOptions {
//     defineExternals?: (options: Partial<IBuildOption>) => string[]
//     resolveOutDir?: (entry: FileEntry, options: Partial<IBuildOption>) => string
//     nodeEnv?: 'development' | 'production'
//     skipExternal?: boolean
//     external?: string[]
//     pkgExternal?: boolean,
//     debug?: boolean
//     log?: boolean
//     dts?: boolean
//     [key: string]: any
// }

// /**
//  * Resolves configuration for esbuild
//  * @param {T} options - esbuild options
//  * @returns ```js
//  * {config: T, pkg: any}
//  * ```
//  */
// function resolveConfig<T extends IBuildOption = IBuildOption>(options: T) {
//     let {
//         env = "production",
//         entryPoints = [],
//         bundle = true,
//         splitting = true,
//         skipExternal = false,
//         minify = true,
//         minifySyntax = true,
//         minifyWhitespace = true,
//         minifyIdentifiers = true,
//         sourcemap = false,
//         format = "esm",
//         external = [],
//         pkgExternals = format === 'cjs' ? true : false,
//         treeShaking = true,
//         dts = true,
//         outExtension = { '.js': format === 'esm' ? '.mjs' : format === 'cjs' ? '.cjs' :  '.js' },
//         // chunkNames = 'chunks/[name]-[hash]',
//         entryNames = '[name]',
//         chunkNames = '[name]-[hash]',
//         assetNames = '[name]-[hash]',
//         platform = format === 'cjs' ? 'node' : 'browser',
//         target = 'es2021',
//         legalComments = 'none',
//         charset = 'utf8',
//         outdir = 'dist',
//         defineExternals
//     } = options;
//     const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
//     const pkg_externals = pkgExternals ? [
//         ...Object.keys(pkg.dependencies || {}),
//         ...Object.keys(pkg.peerDependencies || {}),
//         ].flatMap(dep => [dep, `${dep}/*`]): [];
//     // Base esbuild options
//     const esbuild_config: BuildOptions = {
//         // entryPoints,
//         // format,
//         // sourcemap,
//         // minify,
//         // splitting: format === 'esm' ? splitting : false,
//         bundle,
//         target,
//         platform,
//         minifySyntax,
//         minifyWhitespace,
//         minifyIdentifiers,
//         legalComments,
//         charset,
//         define: {
//             'process.env.NODE_ENV': '"' + env + '"',
//         },
//         external: (skipExternal && format !== 'cjs') ? [] : [
//             ...(pkgExternals ? pkg_externals : []),
//             ...external
//         ],
//         treeShaking,
//         outExtension,
//         entryNames,
//         chunkNames,
//         assetNames,
//         outdir,
//         jsx: 'automatic',
//         jsxImportSource: 'react',
//         loader: {
//             '.ts': 'ts',
//             '.tsx': 'tsx',
//             '.js': 'js',
//             '.jsx': 'jsx',
//             '.json': 'json',
//         },
//         // tsconfigRaw: {
//         //     compilerOptions: {
//         //         target: typeof target === 'string' ? target : target[0] ?? 'latest',
//         //         jsx: 'react-jsx',
//         //         jsxImportSource: 'react',
//         //         strict: true,
//         //         experimentalDecorators: true,
//         //     }
//         // },
//     };
//     if(defineExternals && (!skipExternal && format !== 'cjs')){
//         esbuild_config.external = [...(esbuild_config.external || []), ...defineExternals(esbuild_config)]
//         // console.log('defined externals', esbuild_config.external)
//     }
//     esbuild_config.external = [
//         ...(esbuild_config.external || []),
//         "esbuild"
//     ]

//     const config = defineConfig({
//         entry: entryPoints as string[],
//         minify,
//         format,
//         dts,
//         tsconfig: "tsconfig.build.json",
//         outDir: outdir,
//         splitting: format === 'esm' ? splitting : false,
//         sourcemap: sourcemap === true ? 'inline' : sourcemap !== 'inline' ? undefined : sourcemap,
//         treeshake: {
//             annotations: true,
//             correctVarValueBeforeDeclaration: true,
//             preset: "safest",
//         },
//         esbuildOptions(options, context) {
//             mergeOptions(options, esbuild_config);
//         }
//     });

//     return {config, pkg};
// }

// async function buildWithTsup(build: ReturnType<typeof init_build>) {
//     const {args, entries} = build;
//     const builds: Promise<void | null>[] = [];
//     console.log('Building with tsup...', entries.length);
//     for (const entry of entries) {
//         const b = await buildEntry(entry, args);
//         if(b){
//             builds.push(b);
//         }
//     }
//     return builds;
// }
// async function buildEntry<T extends IBuildOption>(entry: FileEntry, options: T) {
//     const inputFile = entry.filePath!;
//     const outputName = entry.name;
//     if(options.log){
//         console.log(`Building ${inputFile} -> ${outputName}`);
//     }
//     const entry_externals = entry.externals || [];
//     const external = [...(options.external || []), ...entry_externals];
//     if(external.length > 0){
//         console.log('external', external)
//     }
//     const outputDir = options.resolveOutDir ? options.resolveOutDir(entry, options) : 'dist';
//     if (!existsSync(outputDir)) {
//         mkdirSync(outputDir, { recursive: true });
//     }
//     const {config} = resolveConfig({...options, outdir: outputDir, entryPoints: [inputFile], external, format: formatResolver(entry.format)});
//     const buildOptions = {
//         ...config,
//     };

//     try {
//         const result = await build(buildOptions);
//         if(options.log){
//             console.log(`✅ Built ${inputFile}`);
//         }
//         copyPkgJson(process.cwd(), 'dist');
//         return result;
//     } catch (error) {
//         console.error(`❌ Failed to build ${inputFile}:`, error);
//     }
//     return null;

// }

// export {
//     buildWithTsup
// }
