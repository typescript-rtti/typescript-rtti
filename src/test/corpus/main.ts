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
    }
};

async function main() {
    function section(message : string) {
        console.log(`(###)`);
        console.log(`(###) corpus: ${message}...`);
        console.log(`(###)`);
    }

    for (let pkgName of Object.keys(PACKAGES)) {
        let pkg = PACKAGES[pkgName];

        let local = `corpus.${pkgName}`;
        section(`Removing ${pkgName}...`);
        await promisify(rimraf)(local);

        section(`${pkgName}: Cloning ${pkg.url}...`);
        shell.exec(`git clone ${pkg.url} ${local}`);

        section(`${pkgName}: Checking out ref '${pkg.ref}'...`);
        shell.exec(`git checkout ${pkg.ref}`, { cwd: local });
        
        section(`${pkgName}: NPM Install...`);
        shell.exec(`npm install`, { cwd: local });
        shell.exec(`npm install typescript@latest`, { cwd: local });

        section(`${pkgName}: Modifying tsconfig.json...`);
        let tsconfigFileName = path.join(local, 'tsconfig.json');
        let tsconfig = JSON.parse((await fs.readFile(tsconfigFileName)).toString());
        tsconfig.compilerOptions.plugins = [{ transform: '../dist/transformer' }];
        await fs.writeFile(tsconfigFileName, JSON.stringify(tsconfig, undefined, 2));

        section(`${pkgName}: Building...`);
        console.log(`${pkgName}: ttsc -b...`);
        let result = shell.exec(`ttsc -b`, { cwd: local });

        if (result.code !== 0) {
            console.log();
            console.error(`--------------------------------------------------------`);
            console.error(`(!!) corpus: ${pkgName}: ERROR: Received error code ${result.code}`);
            console.log();
            process.exit(1);
        }

        section(`${pkgName}: Build successful.`);
    }
}

main();