import * as fs from 'fs/promises';
import * as path from 'path';

import * as shell from 'shelljs';
import rimraf from 'rimraf';
import { promisify } from 'util';
import { Stats } from 'fs';

interface Package {
    enabled : boolean;
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
        enabled: true,
        url: 'https://github.com/astronautlabs/jwt.git',
        ref: 'v1.0.1',
        commands: [ 'npm run build', 'npm test' ]
    },
    "alterior": {
        enabled: false,
        url: 'https://github.com/alterior-mvc/alterior.git',
        ref: '1e6e462dc50bdbe045281cae50b7c3fd21c16b82',
        commands: [ 'npm install tslib@latest', 'lerna bootstrap', 'lerna link', 'npm test' ]
    },
    "rezonant/typescript-rtti": {
        enabled: false, // this is aspirational
        url: 'https://github.com/rezonant/typescript-rtti.git',
        ref: 'main',
        commands: [ 'npm run build', 'npm test' ]
    }
};

/**
 * What Typescript versions should be tested (git tags)
 */
const TYPESCRIPTS = [
    '4.5.5', 
    //'4', 'latest', 'next', 'beta', 'rc', 'insiders'
];

function run(str : string, cwd? : string) {
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

async function main() {
    try {
        for (let pkgName of Object.keys(PACKAGES)) {
            let pkg = PACKAGES[pkgName];

            if (!pkg.enabled)
                continue;

            for (let tsVersion of TYPESCRIPTS) {
                try {

                    let local = `corpus.${pkgName.replace(/\//g, '__')}`;

                    await promisify(rimraf)(local);

                    run(`git clone ${pkg.url} ${local}`);
                    run(`git checkout ${pkg.ref}`, local);
                    
                    run(`npm install`, local);
                    run(`npm install typescript@${tsVersion}`, local);

                    let tsconfigFileName = path.join(local, 'tsconfig.json');
                    let tsconfig = JSON.parse((await fs.readFile(tsconfigFileName)).toString());
                    tsconfig.compilerOptions.plugins = [{ transform: path.join(__dirname, '..', '..', 'transformer') }];
                    await fs.writeFile(tsconfigFileName, JSON.stringify(tsconfig, undefined, 2));

                    // Patch package.json to call ttsc instead of tsc
                    let packageFileName = path.join(local, 'package.json');
                    let packageJson = JSON.parse((await fs.readFile(packageFileName)).toString());
                    for (let key of Object.keys(packageJson.scripts))
                        packageJson.scripts[key] = (packageJson.scripts[key] ?? '').replace(/\btsc\b/g, 'ttsc');
                    await fs.writeFile(packageFileName, JSON.stringify(packageJson, undefined, 2));

                    // Patch all package package.jsons

                    let pkgDir = path.join(local, 'packages');
                    let stat : Stats;
                    
                    try {
                        stat = await fs.stat(pkgDir);
                    } catch (e) {
                        stat = null;
                    }

                    if (stat && stat.isDirectory()) {
                        let packages = await fs.readdir(pkgDir);
                        for (let pkg of packages) {
                            let stat = await fs.stat(path.join(pkgDir, pkg));
                            if (stat.isDirectory()) {
                                // Patch package.json to call ttsc instead of tsc
                                let packageFileName = path.join(pkgDir, pkg, 'package.json');
                                let packageJson = JSON.parse((await fs.readFile(packageFileName)).toString());
                                for (let key of Object.keys(packageJson.scripts))
                                    packageJson.scripts[key] = (packageJson.scripts[key] ?? '').replace(/\btsc\b/g, 'ttsc');
                                await fs.writeFile(packageFileName, JSON.stringify(packageJson, undefined, 2));
                            }
                        }
                    }

                    for (let command of pkg.commands) {
                        run(command, local);
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

main();