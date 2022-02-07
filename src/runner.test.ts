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

function transpilerHost(sourceFile : ts.SourceFile, write : (output : string) => void) {
    return <ts.CompilerHost>{
        getSourceFile: (fileName) => {
            if (fileName === "module.ts")
                return sourceFile;
        
            let libLoc = path.resolve(__dirname, '../node_modules/typescript/lib', fileName);
            let stat = fs.statSync(libLoc);

            if (!stat.isFile())
                return;
            
            let buf = fs.readFileSync(libLoc);

            return ts.createSourceFile("module.ts", buf.toString('utf-8'), ts.ScriptTarget.Latest);            
        },
        writeFile: (name, text) => {
            if (!name.endsWith(".map"))
                write(text);
        },
        getDefaultLibFileName: () => "lib.d.ts",
        useCaseSensitiveFileNames: () => false,
        getCanonicalFileName: fileName => fileName,
        getCurrentDirectory: () => "",
        getNewLine: () => "\n",
        fileExists: (fileName): boolean => fileName === "module.ts",
        readFile: () => "",
        directoryExists: () => true,
        getDirectories: () => []
    };
}

export function compile(invocation : RunInvocation): string {
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
            rtti: <any>{ trace: invocation.trace === true }
        }, 
        ...invocation.compilerOptions || {},
    };
    
    if (invocation.moduleType) {
        if (invocation.moduleType === 'esm') 
            options.module = ts.ModuleKind.ES2020;
    }

    const sourceFile = ts.createSourceFile("module.ts", invocation.code, options.target!);
    let outputText: string | undefined;
    const compilerHost = transpilerHost(sourceFile, output => outputText = output);
    const program = ts.createProgram(["module.ts"], options, compilerHost);

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

    program.emit(undefined, undefined, undefined, undefined, {
        before: invocation.transformerEnabled !== false ? [ 
            transformer(program) 
        ] : []
    });

    if (outputText === undefined) {
        if (program.getOptionsDiagnostics().length > 0) {
            console.dir(program.getOptionsDiagnostics());
        } else {
            console.dir(program.getSyntacticDiagnostics(sourceFile));
        }

        throw new Error(`Failed to compile test code: '${invocation.code}'`);
    }

    return outputText;
}

/**
 * Compile the given code using Typescript and typescript-rtti transformer plugin and return the 
 * resulting exports.
 * 
 * @param invocation 
 * @returns 
 */
export async function runSimple(invocation : RunInvocation) {
    let outputText = compile(invocation);

    if (invocation.trace) {
        console.log(`========================`);
        console.log(outputText);
        console.log(`========================`);
    }

    let exports : Record<string,any> = {};
    let rq = (moduleName : string) => {
        if (!invocation.modules)
            throw new Error(`(RTTI Test) Cannot find module '${moduleName}'`);
            
        let symbols = invocation.modules[moduleName];

        if (!symbols)
            throw new Error(`(RTTI Test) Cannot find module '${moduleName}'`);

        return symbols;
    };

    if (invocation.moduleType === 'esm') {

        global['moduleOverrides'] = invocation.modules;

        exports = await esRequire(
            `data:text/javascript;base64,${Buffer.from(`
                ${outputText}
            `).toString('base64')}`
        );
    } else {
        let func = eval(`(
            function(exports, require){
                ${outputText}
            }
        )`);
        func(exports, rq);
    }

    return exports;
}
