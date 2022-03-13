import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import { esRequire } from '../test-esrequire.js';
import transformer from './transformer';

export interface RunInvocation {
    code : string;
    transformerEnabled? : boolean;
    moduleType? : 'commonjs' | 'esm';
    compilerOptions? : Partial<ts.CompilerOptions>;
    modules? : Record<string,any>;
    trace? : boolean;
}

function normalizeFilename(filename : string, extension? : string) {
    if (extension && !filename.endsWith(`.${extension}`))
        filename = `${filename}.${extension}`;

    if (!filename.includes('/'))
        filename = `./${filename}`;

    return filename;
}

export function compile(invocation : RunInvocation): Record<string,string> {
    let options : ts.CompilerOptions = {
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
    
    let inputs : Record<string,ts.SourceFile> = {
        './main.ts': ts.createSourceFile('./main.ts', invocation.code, options.target!)
    };

    let otherFiles = Object.keys(invocation?.modules ?? {}).filter(x => x.endsWith('.ts'));
    for (let otherFile of otherFiles) {
        inputs[otherFile] = ts.createSourceFile(otherFile, invocation.modules[otherFile], options.target!);
    }

    let outputs : Record<string,string> = {};

    if (invocation.moduleType) {
        if (invocation.moduleType === 'esm') 
            options.module = ts.ModuleKind.ES2020;
    }
    
    const program = ts.createProgram(Object.keys(inputs), options, {
        getSourceFile: (fileName : string) => {
            fileName = normalizeFilename(fileName, 'ts');
            
            if (invocation.trace) {
                console.log(`Test: Typescript requests to open '${fileName}'...`);
            }

            if (inputs[fileName])
                return inputs[fileName];
    
            // libs

            let libLoc = path.resolve(__dirname, '../node_modules/typescript/lib', fileName);
            try {
                let stat = fs.statSync(libLoc);

                if (!stat.isFile())
                    return;
            } catch (e) {
                return;
            }

            let buf = fs.readFileSync(libLoc);

            return ts.createSourceFile(libLoc, buf.toString('utf-8'), ts.ScriptTarget.Latest);
        },
        writeFile: (filename : string, text : string) => {
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
        fileExists: (fileName : string): boolean => {
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

    let optionsDiags = program.getOptionsDiagnostics();
    let syntacticDiags = program.getSyntacticDiagnostics();

    if (invocation.trace) {
        for (let diag of optionsDiags) {
            console.log(diag);
        }
        for (let diag of syntacticDiags) {
            console.log(diag);
        }
    }

    if (invocation.transformerEnabled !== false) {
        program.emit(undefined, undefined, undefined, undefined, {
            before: [ transformer(program) ]
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

    return outputs;
}

interface Module {
    exports : any;
    filename : string;
    code? : string;
}

function runCommonJS(module : Module, $require) {
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

// function esRequire(moduleSpecifier : string) {
//     return eval(`import(${JSON.stringify(moduleSpecifier)})`);
// }

/**
 * Compile the given code using Typescript and typescript-rtti transformer plugin and return the 
 * resulting exports.
 * 
 * @param invocation 
 * @returns 
 */
export async function runSimple(invocation : RunInvocation) {
    let outputs = compile(invocation);

    if (invocation.trace) {
        console.log(`========================`);
        for (let filename of Object.keys(outputs)) {
            console.log(`  ${filename}:`);
            console.log(`    ${outputs[filename].replace(/\r?\n/g, `\n    `)}`);
        }
        console.log(`========================`);
    }

    let outputText = outputs['./main.js'];

    let exports : Record<string,any> = {};
    let modules : Record<string, Module> = {};

    if (invocation.moduleType === 'esm') {

        global['moduleOverrides'] = { ...outputs, ...invocation.modules };

        if (invocation.trace) {
            console.log(`RTTI Test: executing code under test...`);
        }
        exports = await esRequire(`./main.js`);
    } else {
        let $require = (moduleName : string) => {
            let fileName = moduleName;
            
            fileName = normalizeFilename(fileName, 'js');

            if (outputs[fileName]) {
                if (modules[fileName])
                    return modules[fileName].exports;
                
                return modules[fileName] ?? runCommonJS(modules[fileName] = { 
                    exports: {}, code: outputs[fileName],
                    filename: fileName
                }, $require).exports;
            }
    
            let symbols = invocation.modules?.[moduleName];
    
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
    
        return $require('./main.js');
    }

    return exports;
}
