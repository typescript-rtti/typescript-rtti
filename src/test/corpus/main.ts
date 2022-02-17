import * as fs from 'fs/promises';
import * as fst from 'fs';
import * as path from 'path';
import stripJsonComments from 'strip-json-comments';
import * as shell from 'shelljs';
import rimraf from 'rimraf';
import { promisify } from 'util';
import { Stats } from 'fs';
import ts from 'typescript';

interface Package {
    enabled : boolean;
    only? : boolean;
    yarn? : boolean;
    acceptFailure? : boolean;
    url : string;
    ref : string;
    commands : string[];
}

/**
 * What open source packages should be compiled by corpus using the local build of 
 * the typescript-rtti transformer. Failure to build is a failure for the corpus test.
 */
const PACKAGES : Record<string, Package> = {
    "rezonant/razmin": {
        enabled: true,
        url: 'https://github.com/rezonant/razmin.git',
        ref: '2b643273035cdf2efcab41315562e6e1a49bb16a',
        commands: [ 'npm run build', 'npm test' ]
    },
    "@astronautlabs/bitstream": {
        enabled: true,
        url: 'https://github.com/astronautlabs/bitstream.git',
        ref: 'main',
        commands: [ 'npm run build', 'npm test' ]
    },
    "@astronautlabs/jwt": {
        enabled: false,
        url: 'https://github.com/astronautlabs/jwt.git',
        ref: 'v1.0.1',
        commands: [ 'npm run build', 'npm test' ]
    },
    "alterior-mvc/alterior": {
        enabled: false,
        url: 'https://github.com/alterior-mvc/alterior.git',
        ref: '1e6e462dc50bdbe045281cae50b7c3fd21c16b82',
        commands: [ 'npm install tslib@latest', 'lerna bootstrap', 'lerna link', 'npm test' ]
    },
    "rezonant/typescript-rtti": {
        enabled: true, // 🎉
        url: 'https://github.com/rezonant/typescript-rtti.git',
        ref: 'eec152929c840a13fdbbfd2f13bf524067c8d379',
        commands: [ 'npm run build', 'npm test' ]
    },
    "capaj/decapi": {
        enabled: true,
        yarn: true,
        url: 'https://github.com/capaj/decapi.git',
        ref: '1.0.0',
        commands: [ 'npm run -- test --runInBand --no-cache --ci ' ]
    }
};

/**
 * What Typescript versions should be tested (git tags)
 */
const TYPESCRIPTS = [
    '4.5.5', 
    //'4', 'latest', 'next', 'beta', 'rc', 'insiders'
];

function run(str : string, cwd? : string, context? : string) {
    if (globalThis.CORPUS_VERBOSE) {
        console.log(`corpus${context ? `: ${context}` : ``}: RUN: ${str}`);
    }
    let result = shell.exec(str, { cwd: cwd ?? process.cwd(), silent: true });
    if (result.code !== 0) {
        console.error(`corpus: Failed to run: '${str}': exit code ${result.code}`);
        console.error(`stdout:`);
        console.error(result.stderr);
        console.error();
        console.error(`stderr:`);
        console.error(result.stderr);
        console.error();
        throw new Error(`Failed to run '${str}': exit code ${result.code}`);
    }
}

function trace(message : string, context? : string) {
    if (globalThis.CORPUS_VERBOSE)
        console.log(`corpus${context ? `: ${context}` : ``}: ${message}`);
}

async function modify<T = any>(filename : string, modifier : (t : T) => void) {
    try {
        let jsonString = (await fs.readFile(filename)).toString();
        let obj = JSON.parse(stripJsonComments(jsonString));
        modifier(obj);
        await fs.writeFile(filename, JSON.stringify(obj, undefined, 2));
    } catch (e) {
        throw new Error(`Could not transform '${filename}': ${e.message}`);
    }
}

async function fileExists(file : string) {
    let stat : fst.Stats;
    try {
        stat = await fs.stat(file);
    } catch (e) {
        stat = null;
    }

    if (!stat)
        return false;
    
    return stat.isFile();
}

async function dirExists(file : string) {
    let stat : fst.Stats;
    try {
        stat = await fs.stat(file);
    } catch (e) {
        stat = null;
    }

    if (!stat)
        return false;
    
    return stat.isDirectory();
}

async function main(args : string[]) {
    let hasTrace = args.some(x => x === '--trace');
    globalThis.CORPUS_VERBOSE = hasTrace;

    try {
        let hasOnly = Object.values(PACKAGES).some(x => x.only === true);

        for (let pkgName of Object.keys(PACKAGES)) {
            let pkg = PACKAGES[pkgName];

            if (!pkg.enabled)
                continue;
            
            if (hasOnly && !pkg.only)
                continue;

            for (let tsVersion of TYPESCRIPTS) {
                try {
                    let context = `${pkgName} [typescript@${tsVersion}]`;
                    let local = `corpus.${pkgName.replace(/\//g, '__')}`;

                    trace(`RUN: rm -Rf ${local}`, context);
                    await promisify(rimraf)(local);

                    run(`git clone ${pkg.url} ${local}`, undefined, context);
                    run(`git checkout ${pkg.ref}`, local, context);
                    
                    // forced to allow for codebases that have not yet updated to
                    // npm@7 peer deps

                    if (pkg.yarn) {
                        run(`yarn`, local, context);
                    } else {
                        run(`npm install --force`, local, context);
                        run(`npm install typescript@${tsVersion} --force`, local, context);
                    }

                    trace(`Transforming project-level tsconfig.json...`, context);
                    await modify<{ compilerOptions : ts.CompilerOptions }>(path.join(local, 'tsconfig.json'), config => {
                        (config.compilerOptions as any).plugins = [{ transform: path.join(__dirname, '..', '..', 'transformer') }];
                    });

                    trace(`Transforming project-level package.json...`, context);
                    await modify(path.join(local, 'package.json'), pkg => {
                        for (let key of Object.keys(pkg.scripts))
                            pkg.scripts[key] = (pkg.scripts[key] ?? '').replace(/\btsc\b/g, 'ttsc');

                    });

                    trace(`Transforming project-level package.json...`, context);
                    await modify(path.join(local, 'package.json'), pkg => {
                        for (let key of Object.keys(pkg.scripts))
                            pkg.scripts[key] = (pkg.scripts[key] ?? '').replace(/\btsc\b/g, 'ttsc');

                    });
                    
                    if (await fileExists(path.join(local, 'jest.config.js'))) {
                        trace(`Transforming jest config...`, context)
                        await modify(path.join(local, 'jest.config.js'), jestConfig => {
                            jestConfig.globals ??= {};
                            jestConfig.globals['ts-jest'] ??= {};
                            jestConfig.globals['ts-jest'].compiler = 'ttypescript';
                        });
                    }

                    // Patch all subpackage package.jsons

                    let pkgDir = path.join(local, 'packages');
                    let stat : Stats;
                    
                    if (await dirExists(pkgDir)) {
                        let packages = await fs.readdir(pkgDir);
                        for (let pkg of packages) {
                            trace(`Transforming package.json for subpackage '${pkg}'...`, context);
                            try {
                                let stat = await fs.stat(path.join(pkgDir, pkg));
                                if (stat.isDirectory()) {
                                    // Patch package.json to call ttsc instead of tsc
                                    modify(path.join(pkgDir, pkg, 'package.json'), pkg => {
                                        for (let key of Object.keys(pkg.scripts))
                                            pkg.scripts[key] = (pkg.scripts[key] ?? '').replace(/\btsc\b/g, 'ttsc');
                                    });
                                }
                            } catch (e) {
                                throw new Error(`Could not patch package.json in subpackage '${pkg}': ${e.message}`);
                            }
                        }
                    }

                    for (let command of pkg.commands) {
                        run(command, local, context);
                    }

                    console.log(`✅ ${pkgName} [typescript@${tsVersion}]: success`);
                } catch (e) {
                    throw new Error(`${pkgName} [typescript@${tsVersion}]: ${e.message}`);
                }
            }
        }
    } catch (e) {
        console.error(`❌ ${e.message}`);
        process.exit(1);
    }
}

main(process.argv.slice(2));