import * as fs from 'fs/promises';
import * as path from 'path';

import * as shell from 'shelljs';
import rimraf from 'rimraf';
import { promisify } from 'util';

interface Package {
    url : string;
    ref : string;
}

const PACKAGES : Record<string, Package> = {
    razmin: {
        url: 'https://github.com/rezonant/razmin.git',
        ref: 'v1.2.0'
    },
    "@astronautlabs/bitstream": {
        url: 'https://github.com/astronautlabs/bitstream.git',
        ref: 'main'
    }
};

const TYPESCRIPTS = ['4.5.5', '4.5', '4', 'latest'];

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
            for (let tsVersion of TYPESCRIPTS) {
                try {
                    let pkg = PACKAGES[pkgName];

                    let local = `corpus.${pkgName.replace(/\//g, '__')}`;

                    await promisify(rimraf)(local);

                    run(`git clone ${pkg.url} ${local}`);
                    run(`git checkout ${pkg.ref}`, local);
                    
                    run(`npm install`, local);
                    run(`npm install typescript@${tsVersion}`, local);

                    let tsconfigFileName = path.join(local, 'tsconfig.json');
                    let tsconfig = JSON.parse((await fs.readFile(tsconfigFileName)).toString());
                    tsconfig.compilerOptions.plugins = [{ transform: '../dist/transformer' }];
                    await fs.writeFile(tsconfigFileName, JSON.stringify(tsconfig, undefined, 2));

                    let result = shell.exec(`ttsc -b`, { cwd: local });
                    if (result.code !== 0) {
                        throw new Error(`ERROR: build failed [${result.code}]`);
                    }

                    console.log(`✅ ${pkgName} [typescript@${tsVersion}]: success`);
                } catch (e) {
                    throw new Error(`${pkgName} [typescript@${tsVersion}]: ${e.mesasge}`);
                }
            }
        }
    } catch (e) {
        console.error(`❌ ${e.message}`);
        process.exit(1);
    }
}

main();