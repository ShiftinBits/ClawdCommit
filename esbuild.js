const esbuild = require('esbuild');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/** @type {import('esbuild').Plugin} */
const esbuildProblemMatcherPlugin = {
    name: 'esbuild-problem-matcher',
    setup(build) {
        build.onStart(() => {
            console.log('[watch] build started');
        });
        build.onEnd((result) => {
            result.errors.forEach(({ text, location }) => {
                console.error(`\u2717 [ERROR] ${text}`);
                if (location) {
                    console.error(`    ${location.file}:${location.line}:${location.column}:`);
                }
            });
            console.log('[watch] build finished');
        });
    },
};

/** @type {import('esbuild').BuildOptions} */
const sharedOptions = {
    bundle: true,
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    external: ['vscode'],
    logLevel: 'silent',
    plugins: [esbuildProblemMatcherPlugin],
};

async function main() {
    // Desktop (Node) build
    const nodeCtx = await esbuild.context({
        ...sharedOptions,
        entryPoints: ['src/extension.ts'],
        format: 'cjs',
        platform: 'node',
        outfile: 'dist/extension.js',
    });

    // Web (browser) build
    const webCtx = await esbuild.context({
        ...sharedOptions,
        entryPoints: ['src/extension.web.ts'],
        format: 'esm',
        platform: 'browser',
        outfile: 'dist/web/extension.js',
    });

    if (watch) {
        await Promise.all([nodeCtx.watch(), webCtx.watch()]);
    } else {
        await Promise.all([nodeCtx.rebuild(), webCtx.rebuild()]);
        await Promise.all([nodeCtx.dispose(), webCtx.dispose()]);
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
