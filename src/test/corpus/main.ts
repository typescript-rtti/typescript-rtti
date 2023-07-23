import * as fs from 'fs/promises';
import * as fst from 'fs';
import * as path from 'path';
import stripJsonComments from 'strip-json-comments';
import shell from 'shelljs';
import { rimraf } from 'rimraf';
import { Stats } from 'fs';
import ts from 'typescript';
import { hasGlobalFlag, setGlobalFlag } from '../../transformer/utils.js';

interface Package {
    enabled: boolean;
    failable?: boolean;
    only?: boolean;
    yarn?: boolean;
    transformSubPackages?: boolean;
    url: string;
    ref: string;
    target?: 'esm' | 'commonjs',
    precommands?: string[];
    jestESM?: boolean;
    commands: string[];
}

/**
 * What open source packages should be compiled by corpus using the local build of
 * the typescript-rtti transformer. Failure to build is a failure for the corpus test.
 */
const PACKAGES: Record<string, Package> = {
    "rezonant/razmin": {
        enabled: true,
        url: 'https://github.com/rezonant/razmin.git',
        ref: '2b643273035cdf2efcab41315562e6e1a49bb16a',
        commands: ['npm run build', 'npm test']
    },
    "@astronautlabs/bitstream": {
        enabled: true,
        url: 'https://github.com/astronautlabs/bitstream.git',
        ref: 'main',
        commands: ['npm run build', 'npm test']
    },
    "@astronautlabs/jwt": {
        enabled: false,
        url: 'https://github.com/astronautlabs/jwt.git',
        ref: 'v1.0.1',
        commands: ['npm run build', 'npm test']
    },
    "alterior-mvc/alterior": {
        enabled: false,
        url: 'https://github.com/alterior-mvc/alterior.git',
        ref: '1e6e462dc50bdbe045281cae50b7c3fd21c16b82',
        commands: ['npm install tslib@latest', 'lerna bootstrap', 'lerna link', 'npm test']
    },
    "typescript-rtti": {
        enabled: true, // 🎉
        url: 'https://github.com/typescript-rtti/typescript-rtti.git',
        ref: 'ce43d452e193d180d0829e108b52be48831b0408',
        commands: ['npm run build', 'npm test']
    },
    "@typescript-rtti/issue-61": {
        enabled: true,
        failable: true,
        url: 'https://github.com/typescript-rtti/rtti-testcase-61.git',
        ref: 'main',
        commands: ['npm test']
    },
    "@typescript-rtti/issue-98": {
        enabled: true,
        failable: true,
        transformSubPackages: false,
        url: 'https://github.com/typescript-rtti/rtti-testcase-98.git',
        ref: 'main',
        commands: ['tsc -b', 'node .typescript/packages/import/Importing.js']
    },
    "capaj/decapi@2.0.1": {
        enabled: true,
        yarn: true,
        url: 'https://github.com/capaj/decapi.git',
        ref: 'v2.0.1',
        target: 'esm',
        precommands: ['rimraf yarn.lock', 'yarn config set ignore-engines true'],
        commands: ['npm run -- test --runInBand --no-cache --ci ']
    },
    "typeorm/typeorm": {
        enabled: true,
        url: 'https://github.com/typeorm/typeorm.git',
        ref: '0.3.11',
        commands: ['tsc']
    }
};

/**
 * What Typescript versions should be tested (git tags)
 */
const TYPESCRIPTS = [
    { tsVersion: '4.8', compiler: 'ttsc', jestCompiler: 'ttypescript', precommands: [ 'npm install ttypescript --force' ] },
    { tsVersion: '4.9', compiler: 'ttsc', jestCompiler: 'ttypescript', precommands: [ 'npm install ttypescript --force' ] },
    { tsVersion: '5.0', compiler: 'tspc', jestCompiler: 'ts-patch/compiler', precommands: [ 'npm install ts-patch --force' ] },
    { tsVersion: '5.1', compiler: 'tspc', jestCompiler: 'ts-patch/compiler', precommands: [ 'npm install ts-patch --force' ] }
];

function run(str: string, cwd?: string, context?: string) {
    let startedAt = Date.now();

    if (hasGlobalFlag('CORPUS_VERBOSE')) {
        console.log(`corpus${context ? `: ${context}` : ``}: RUN: ${str}`);
    }

    let result = shell.exec(str, { cwd: cwd ?? process.cwd(), silent: true });
    let runtime = (Date.now() - startedAt) / 1000.0;

    if (result.code !== 0) {
        console.error(`⚠️  ${str} (exit code ${result.code})`);
        console.error(`stdout:`);
        console.error(result.stdout);
        console.error();
        console.error(`stderr:`);
        console.error(result.stderr);
        console.error();
        throw new Error(`Failed to run '${str}': exit code ${result.code} after ${runtime} seconds`);
    }

    if (hasGlobalFlag('CORPUS_VERBOSE')) {
        console.log(`corpus${context ? `: ${context}` : ``}: FINISHED: ${str} after ${runtime} seconds`);
    }
}

function trace(message: string, context?: string) {
    if (hasGlobalFlag('CORPUS_VERBOSE'))
        console.log(`corpus${context ? `: ${context}` : ``}: ${message}`);
}

async function modify<T = any>(filename: string, modifier: (t: T) => void, target?: 'esm' | 'commonjs') {

    if (filename.endsWith('.js')) {
        let config;
        let isModule = target === 'esm';
        config = await import('file://' + path.resolve(process.cwd(), filename).replace(/\\/g, '/'));
        if (config.default)
            config = config.default;

        modifier(config);

        if (isModule)
            await fs.writeFile(filename, `export default ${JSON.stringify(config, undefined, 2)};`);
        else
            await fs.writeFile(filename, `module.exports = ${JSON.stringify(config, undefined, 2)};`);

    } else if (filename.endsWith('.json')) {

        try {
            let jsonString = (await fs.readFile(filename)).toString();
            jsonString = stripJsonComments(jsonString);
            let obj = JSON.parse(jsonString);
            modifier(obj);
            jsonString = JSON.stringify(obj, undefined, 2);
            await fs.writeFile(filename, jsonString);
        } catch (e : any) {
            throw new Error(`Could not transform '${filename}': ${e.message}`);
        }
    } else {
        throw new Error(`Unsupported format for '${filename}'`);
    }
}

async function fileExists(file: string) {
    let stat: fst.Stats | null;
    try {
        stat = await fs.stat(file);
    } catch (e) {
        stat = null;
    }

    if (!stat)
        return false;

    return stat.isFile();
}

async function dirExists(file: string) {
    let stat: fst.Stats | null;
    try {
        stat = await fs.stat(file);
    } catch (e) {
        stat = null;
    }

    return stat?.isDirectory() ?? false;
}

async function main(args: string[]) {
    let hasTrace = args.some(x => x === '--trace');
    setGlobalFlag('CORPUS_VERBOSE', hasTrace);

    let tsrttiDir = process.cwd(); // path.join(__dirname, '..', '..', '..');
    let corpusDir = path.join(process.cwd(), '.corpus');

    if (!await dirExists(corpusDir))
        await fs.mkdir(corpusDir);
    process.chdir(corpusDir);

    try {
        let hasOnly = Object.values(PACKAGES).some(x => x.only === true);

        let unacceptableFailures = 0;

        for (let pkgName of Object.keys(PACKAGES)) {
            let pkg = PACKAGES[pkgName];

            if (!pkg.enabled)
                continue;

            if (hasOnly && !pkg.only)
                continue;

            for (let { tsVersion, compiler, jestCompiler, precommands } of TYPESCRIPTS) {
                try {
                    let context = `${pkgName} [typescript@${tsVersion}]`;
                    let local = `${pkgName.replace(/\//g, '__')}`;

                    trace(`RUN: rm -Rf ${local}`, context);
                    await rimraf(local);

                    run(`git clone ${pkg.url} ${local}`, undefined, context);
                    run(`git checkout ${pkg.ref}`, local, context);
                    run(`cpy ${path.join(tsrttiDir, 'dist')} .tsrtti`, local, context);
                    run(`cpy ${path.join(tsrttiDir, 'dist.esm')} .tsrtti`, local, context);
                    run(`cpy "${path.join(tsrttiDir, 'package.json')}" "${path.join(local, '.tsrtti', 'package.json')}"`, undefined, context);

                    for (let command of (pkg.precommands ?? [])) {
                        run(command, local, context);
                    }

                    // forced to allow for codebases that have not yet updated to
                    // npm@7 peer deps

                    if (pkg.yarn) {
                        run(`yarn --ignore-engines`, local, context);
                    } else {
                        run(`npm install --force`, local, context);
                    }

                    run(`npm install typescript@${tsVersion} --force`, local, context);

                    trace(`Transforming project-level tsconfig.json...`, context);
                    await modify<{ compilerOptions: ts.CompilerOptions; }>(path.join(local, 'tsconfig.json'), config => {
                        if (!config.compilerOptions)
                            config.compilerOptions = {};

                        (config.compilerOptions as any).plugins = [{ transform: path.resolve(local, '.tsrtti', 'dist', 'transformer') }];
                    });

                    trace(`Transforming project-level package.json...`, context);
                    await modify(path.join(local, 'package.json'), pkg => {
                        for (let key of Object.keys(pkg.scripts)) {
                            let command = (pkg.scripts[key] ?? '');

                            command = command.replace(/\btsc\b/g, compiler);
                            command = command.replace(/\brm -rf\b/ig, 'rimraf');

                            pkg.scripts[key] = command;
                        }

                    });

                    if (await fileExists(path.join(local, 'jest.config.js'))) {
                        trace(`Transforming jest config...`, context);
                        await modify(path.join(local, 'jest.config.js'), jestConfig => {
                            jestConfig.globals ??= {};
                            jestConfig.globals['ts-jest'] ??= {};
                            jestConfig.globals['ts-jest'].compiler = jestCompiler;
                        }, pkg.target);
                    }

                    // Patch all subpackage package.jsons

                    if (pkg.transformSubPackages !== false) {
                        let pkgDir = path.join(local, 'packages');
                        let stat: Stats;

                        if (await dirExists(pkgDir)) {
                            let packages = await fs.readdir(pkgDir);
                            for (let pkg of packages) {
                                trace(`Transforming package.json for subpackage '${pkg}'...`, context);
                                try {
                                    let stat = await fs.stat(path.join(pkgDir, pkg));
                                    if (stat.isDirectory()) {
                                        // Patch package.json to call transforming compiler instead of tsc
                                        modify(path.join(pkgDir, pkg, 'package.json'), pkg => {
                                            for (let key of Object.keys(pkg.scripts))
                                                pkg.scripts[key] = (pkg.scripts[key] ?? '').replace(/\btsc\b/g, compiler);
                                        });
                                    }
                                } catch (e: any) {
                                    throw new Error(`Could not patch package.json in subpackage '${pkg}': ${e.message}`);
                                }
                            }
                        }
                    }

                    for (let command of (precommands ?? []))
                        run(command, local, context);

                    for (let command of pkg.commands) {
                        if (command === 'tsc' || command.startsWith('tsc '))
                            command = command.replace(/^tsc/, path.resolve(local, `./node_modules/.bin/${compiler}`));
                        run(command, local, context);
                    }

                    console.log(`✅  ${pkgName} [typescript@${tsVersion}]: success`);
                } catch (e: any) {
                    if (pkg.failable) {
                        console.log(`⚠️  ${pkgName} [typescript@${tsVersion}]: acceptable failure (see above)`);
                    } else {
                        console.log(`❌  ${pkgName} [typescript@${tsVersion}]: unacceptable failure (see above)`);
                        unacceptableFailures += 1;
                    }
                }
            }
        }

        if (unacceptableFailures > 0) {
            throw new Error(`${unacceptableFailures} unacceptable failures occurred. Build failed.`)
        }
    } catch (e: any) {
        console.error(`❌ ${e.message}`);
        process.exit(1);
    }
}

main(process.argv.slice(2));