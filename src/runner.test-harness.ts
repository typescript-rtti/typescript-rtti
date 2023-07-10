import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as childProcess from 'child_process';
import * as tsrtti from './index';
import transformer from './transformer';
import { rimraf } from 'rimraf';

export interface RunInvocation {
    code: string;
    transformerEnabled?: boolean;
    moduleType?: 'commonjs' | 'esm';
    target?: ts.ScriptTarget;
    compilerOptions?: Partial<ts.CompilerOptions>;
    outputTransformer?: (filename: string, code: string) => string;
    modules?: Record<string, any>;
    trace?: boolean;
    checks?: (exports: any) => void;
}

function normalizeFilename(filename: string, extension?: string) {
    if (extension && !filename.endsWith(`.${extension}`))
        filename = `${filename}.${extension}`;

    if (!filename.includes('/'))
        filename = `./${filename}`;

    return filename;
}

export function compile(invocation: RunInvocation): Record<string, string> {
    let options: ts.CompilerOptions = {
        ...ts.getDefaultCompilerOptions(),
        ...<ts.CompilerOptions>{
            target: ts.ScriptTarget.ES2016,
            module: ts.ModuleKind.CommonJS,
            moduleResolution: ts.ModuleResolutionKind.NodeJs,
            experimentalDecorators: true,
            lib: ['lib.es2016.d.ts'],
            noLib: false,
            emitDecoratorMetadata: false,
            suppressOutputPathCheck: true,
            rtti: <any>{ trace: invocation.trace === true, throwOnFailure: true }
        },
        ...invocation.compilerOptions || {},
    };

    if (options.noLib)
        delete options.lib;

    let inputs: Record<string, ts.SourceFile> = {
        './main.ts': ts.createSourceFile('./main.ts', invocation.code, options.target!)
    };

    let otherFiles = Object.keys(invocation?.modules ?? {}).filter(x => x.endsWith('.ts') || x.startsWith('@types/'));
    for (let filename of otherFiles) {
        let source = invocation.modules[filename];
        if (filename.startsWith('@types/')) {
            let packageName = filename.replace(/^@types\//, '');
            source = `declare module "${packageName}" {\n${source}\n}`;
            filename = `./${packageName}.d.ts`;
        }

        inputs[filename] = ts.createSourceFile(filename, source, options.target!);
    }

    let outputs: Record<string, string> = {};

    if (invocation.moduleType) {
        if (invocation.moduleType === 'esm')
            options.module = ts.ModuleKind.ES2020;
    }

    if (invocation.target) {
        options.target = invocation.target;
    }

    if (invocation.trace) {
        console.log(`Test: Feeding ${Object.keys(inputs).length} files to Typescript: ${Object.keys(inputs).join(', ')}`);
    }

    const program = ts.createProgram(Object.keys(inputs), options, {
        getSourceFile: (fileName: string) => {
            fileName = normalizeFilename(fileName, 'ts');

            if (inputs[fileName]) {
                if (invocation.trace)
                    console.log(`Test: Typescript opened input '${fileName}'`);
                return inputs[fileName];
            }

            // libs

            let libLoc = path.resolve(__dirname, '../node_modules/typescript/lib', fileName);
            try {
                let stat = fs.statSync(libLoc);

                if (!stat.isFile()) {
                    if (invocation.trace)
                        console.log(`Test: Typescript tried to open library '${fileName}': not found`);
                    return;
                }
            } catch (e) {
                if (invocation.trace)
                    console.log(`Test: Typescript tried to open library '${fileName}', error: ${e.message}`);
                return;
            }

            let buf = fs.readFileSync(libLoc);

            if (invocation.trace)
                console.log(`Test: Typescript opened library ${fileName}`);
            return ts.createSourceFile(libLoc, buf.toString('utf-8'), ts.ScriptTarget.Latest);
        },
        writeFile: (filename: string, text: string) => {
            if (invocation.trace) {
                console.log(`Test: Emitting '${filename}'...`);
            }

            filename = normalizeFilename(filename, 'js');
            outputs[filename] = text;
        },
        getDefaultLibFileName: () => "lib.d.ts",
        useCaseSensitiveFileNames: () => false,
        getCanonicalFileName: fileName => fileName,
        getCurrentDirectory: () => "",
        getNewLine: () => "\n",
        fileExists: (fileName: string): boolean => {
            let exists = false;
            fileName = normalizeFilename(fileName, 'ts');

            if (!!inputs[fileName] || !!invocation?.modules?.[fileName]) {
                exists = true;
            } else {
                let libLoc = path.resolve(__dirname, '../node_modules/typescript/lib', fileName);
                try {
                    let stat = fs.statSync(libLoc);

                    if (stat.isFile())
                        exists = true;
                } catch (e) {
                    exists = false;
                }
            }

            return exists;
        },
        readFile: () => "",
        directoryExists: () => true,
        getDirectories: () => []
    });

    if (invocation.trace) {
        // TODO: All tests should have this enabled

        let optionsDiags = program.getOptionsDiagnostics();
        let syntacticDiags = program.getSyntacticDiagnostics();
        let semanticDiags = program.getSemanticDiagnostics();
        let diags = ([] as ts.Diagnostic[]).concat(optionsDiags, syntacticDiags, semanticDiags);

        diags = diags.filter(x => ![2307].includes(x.code)); // filter 'Cannot find module...'

        if (diags.length > 0) {
            throw new Error(`Typescript did not compile this test correctly. Errors: ${JSON.stringify(diags.map(x => ts.formatDiagnostic(x, {
                getCanonicalFileName: fileName => fileName,
                getCurrentDirectory: () => './test',
                getNewLine: () => `\n`
            })))}`);
        }
    }

    if (invocation.transformerEnabled !== false) {
        program.emit(undefined, undefined, undefined, undefined, {
            before: [transformer(program)]
        });
    } else {
        program.emit();
    }
    if (outputs['./main.js'] === undefined) {
        if (program.getOptionsDiagnostics().length > 0) {
            console.dir(program.getOptionsDiagnostics());
        } else {
            console.error(`Diagnostics for './main.ts':`);
            console.dir(program.getSyntacticDiagnostics(inputs['./main.ts']));
        }

        throw new Error(`Failed to compile test code: '${invocation.code}'. Code was emitted for: ${JSON.stringify(Object.keys(outputs))}`);
    }

    if (invocation.outputTransformer) {
        for (let key of Object.keys(outputs)) {
            outputs[key] = invocation.outputTransformer(key, outputs[key]);
        }
    }

    return outputs;
}

interface Module {
    exports: any;
    filename: string;
    code?: string;
}

function runCommonJS(module: Module, $require) {
    try {
        eval(`(
            function(module, exports, require){
                ${module.code}
            }
        )`)(module, module.exports, $require);
    } catch (e) {
        throw new Error(`Failed to run '${module.filename}': ${e.message}`);
    }
    return module;
}

const { Script } = require('vm');
let pinnedScripts: any[] = [];
let originalRun = Script.prototype.runInThisContext;
Script.prototype.runInThisContext = function (options) {
    console.log(`HAPPENING`);
	pinnedScripts.push(this);
	return originalRun.call(this, options);
};

/**
 * Compile the given code using Typescript and typescript-rtti transformer plugin and return the
 * resulting exports.
 *
 * @param invocation
 * @returns
 */
export async function runSimple(invocation: RunInvocation) {
    await runSimpleCJS({ ...invocation, moduleType: 'commonjs' });
    await runSimpleESM({ ...invocation, moduleType: 'esm' });
}

async function runSimpleCJS(invocation: RunInvocation) {
    let outputs = compile(invocation);
    if (invocation.trace) {
        let outputs = compile(invocation);
        for (let filename of Object.keys(outputs)) {
            console.log(`    // [CJS] ${filename}\n\n    ${outputs[filename].replace(/\r?\n/g, `\n    `)}`);
        }
    }

    let modules: Record<string, Module> = {};

    let $require = (moduleName: string) => {
        let fileName = moduleName;

        fileName = normalizeFilename(fileName, 'js');

        let code = outputs[fileName];

        if (!code && typeof invocation.modules?.[moduleName] === 'string') {
            code = invocation.modules?.[moduleName];
        }

        if (code) {
            if (modules[fileName])
                return modules[fileName].exports;

            return modules[fileName] ?? runCommonJS(modules[fileName] = {
                exports: {}, code,
                filename: fileName
            }, $require).exports;
        }

        let symbols = invocation.modules?.[moduleName];

        if (!symbols && moduleName === 'typescript-rtti') {
            symbols = tsrtti;
        }

        if (!symbols) {
            throw new Error(
                `(RTTI Test) Cannot find module '${moduleName}' [aka '${fileName}']. `
                + `Compilation outputs are: ${JSON.stringify(Object.keys(outputs))}, `
                + `JSON modules are: ${JSON.stringify(Object.keys(invocation?.modules ?? [])
                    .filter(x => !x.endsWith('.ts')))}`
            );
        }

        return symbols;
    };

    let exports = $require('./main.js');

    if (invocation.checks) {
        try {
            invocation.checks(exports);
        } catch (e) {
            if (invocation.trace)
                console.error(`The check error occurred in CommonJS mode.`);
            throw e;
        }
    }
}

async function runSimpleESM(invocation: RunInvocation) {
    if (invocation.trace) {
        let outputs = compile(invocation);
        for (let filename of Object.keys(outputs)) {
            console.log(`    // [ESM] ${filename}\n\n    ${outputs[filename].replace(/\r?\n/g, `\n    `)}`);
        }
    }

    let tsrttiLocation = path.resolve(__dirname, "..", "dist.esm", "index.js").replace(/\\/g, '/');
    invocation.modules ??= {}

    if (!invocation.modules['typescript-rtti']) {
        invocation.modules['typescript-rtti'] = `
            export * from "file://${tsrttiLocation}";
        `
    }

    let outputs = compile(invocation);
    let exports: Record<string, any> = {};
    let files = { ...outputs, ...invocation.modules };

    let folder = path.resolve(os.tmpdir(), `tsrtti_esm_test_${Math.random() * 1_000_000 | 0}`);

    await rimraf(folder);
    fs.mkdirSync(folder);
    fs.mkdirSync(path.resolve(folder, "node_modules"));

    fs.writeFileSync(path.resolve(folder, "package.json"), JSON.stringify({
        type: 'module',
        main: './__test.js'
    }));

    let pkgJson = JSON.stringify({
        type: 'module',
        main: './index.js'
    });

    for (let file of Object.keys(files)) {
        if (file.startsWith('@types/'))
            continue;

        let filePath = path.resolve(folder, file);
        let fileContent = files[file];

        if (typeof fileContent !== 'string') {
            let object = fileContent;
            fileContent = ``;

            for (let key of Object.keys(object)) {
                fileContent += `export const ${key} = ${serializeJavascriptObject(object[key])};`;
                fileContent += `\n`;
            }
        }

        if (!file.startsWith("./")) {
            filePath = path.resolve(folder, "node_modules", file, "index.js");
            fs.mkdirSync(path.resolve(folder, "node_modules", file));
            fs.writeFileSync(path.resolve(folder, "node_modules", file, "package.json"), pkgJson);
        }

        fs.writeFileSync(filePath, fileContent);
    }

    let reflectMetadataLocation = path.resolve(__dirname, "..", "node_modules", "reflect-metadata").replace(/\\/g, '/');
    let chaiLocation = path.resolve(__dirname, "..", "node_modules", "chai").replace(/\\/g, '/')

    fs.writeFileSync(path.resolve(folder, "__test.js"), `
        import "file://${reflectMetadataLocation}/Reflect.js";
        import * as exports from './main.js';
        import * as chai_1 from "file://${chaiLocation}/index.mjs";

        (${(invocation.checks ?? (() => {})).toString()})(exports)
    `);

    if (invocation.trace) {
        console.log(`RTTI Test: executing code under test...`);
    }

    let proc = childProcess.spawn('node', [`${path.resolve(folder, '__test.js')}`], {
        stdio: 'pipe'
    });

    if (invocation.trace) {
        console.log(`RTTI Test: test folder is ${folder}`);
    }

    let stdout = Buffer.alloc(0);

    proc.stdout.on('data', buf => stdout = Buffer.concat([stdout, Buffer.from(buf)]));
    proc.stderr.on('data', buf => stdout = Buffer.concat([stdout, Buffer.from(buf)]));

    await new Promise<void>((resolve, reject) => proc.on('exit', code => {
        if (code === 0) {
            resolve();
            return;
        }

        reject(new Error(`Failed in ESM mode. Test folder: ${folder}\nOutput:\n${stdout.toString('utf-8')}`));
    }));

    await rimraf(folder);
}

function serializeJavascriptObject(object: object, depth = 1) {
    if (object === undefined)
        return `undefined`;
    else if (typeof object === 'function')
        return object.toString();
    else if (object === null || typeof object !== 'object')
        return JSON.stringify(object);

    let obj = `{\n`;

    for (let key of Object.keys(object)) {
        obj += `${Array(depth + 1).join('    ')}${JSON.stringify(key)}: ${serializeJavascriptObject(object[key], depth + 1)},\n`;
    }

    obj += `${Array(depth).join('    ')}}`

    return obj;
}
