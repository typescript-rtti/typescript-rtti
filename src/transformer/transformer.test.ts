
import { expect } from 'chai';
import { describe } from 'razmin';
import ts from 'typescript';
import transformer from './index';
import { F_OPTIONAL, F_PRIVATE, F_PROTECTED, F_PUBLIC, F_READONLY } from "./flags";

interface RunInvocation {
    code : string;
    compilerOptions? : Partial<ts.CompilerOptions>;
    modules? : Record<string,any>;
    trace? : boolean;
}

const hasOwnProperty = Object.prototype.hasOwnProperty;
function hasProperty(map: ts.MapLike<any>, key: string): boolean {
    return hasOwnProperty.call(map, key);
}

function transpilerHost(sourceFile : ts.SourceFile, write : (output : string) => void) {
    return <ts.CompilerHost>{
        getSourceFile: (fileName) => fileName === "module.ts" ? sourceFile : undefined,
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

function runSimple(invocation : RunInvocation) {
    let options : ts.CompilerOptions = Object.assign(
        ts.getDefaultCompilerOptions(),
        {
            target: ts.ScriptTarget.ES2016,
            module: ts.ModuleKind.CommonJS,
            moduleResolution: ts.ModuleResolutionKind.NodeJs,
            experimentalDecorators: true,
            emitDecoratorMetadata: false,
            suppressOutputPathCheck: true,
            // incremental: undefined,
            // lib: undefined,
            // declaration: undefined,
            // declarationMap: undefined,
            // emitDeclarationOnly: undefined,
            // outFile: undefined,
            // composite: undefined,
            // tsBuildInfoFile: undefined,
            // noEmit: undefined,
            // isolatedModules: true,
            // paths: undefined,
            // rootDirs: undefined,
            // types: undefined,
            // out: undefined,
            // noLib: true,
            // noResolve: true,
            // noEmitOnError: undefined,
            // declarationDir: undefined
        }, 
        invocation.compilerOptions || {}
    );
    
    const sourceFile = ts.createSourceFile("module.ts", invocation.code, options.target!);
    let outputText: string | undefined;
    const compilerHost = transpilerHost(sourceFile, output => outputText = output);
    const program = ts.createProgram(["module.ts"], options, compilerHost);

    program.getOptionsDiagnostics();
    program.getSyntacticDiagnostics();
    program.emit(undefined, undefined, undefined, undefined, {
        before: [ 
            transformer(program) 
        ]
    });

    if (outputText === undefined) {
        if (program.getOptionsDiagnostics().length > 0) {
            console.dir(program.getOptionsDiagnostics());
        } else {
            console.dir(program.getSyntacticDiagnostics(sourceFile));
        }

        throw new Error(`Failed to compile test code: '${invocation.code}'`);
    }

    if (invocation.trace) {
        console.log(`========================`);
        console.log(outputText);
        console.log(`========================`);
    }

    let exports : Record<string,any> = {};
    let require = (moduleName : string) => {
        if (!invocation.modules)
            throw new Error(`Cannot find module '${moduleName}'`);
            
        let symbols = invocation.modules[moduleName];

        if (!symbols)
            throw new Error(`Cannot find module '${moduleName}'`);

        return symbols;
    };

    let func = eval(`(
        function(exports, require){
            ${outputText}
        }
    )`);

    func(exports, require);

    return exports;
}

describe('RTTI: ', it => {
    describe('General', it => {
        it('doesn\'t explode on bare imports', () => {
            runSimple({
                code: `
                    import "fs";
                    
                    export class A { }
                    export class B {
                        constructor(hello : A) { }
                    }
                `,
                modules: {
                    fs: {}
                }
            });
        });
        it('doesn\'t explode on default imports', () => {
            runSimple({
                code: `
                    import fs from "fs";
                    
                    export class A { }
                    export class B {
                        constructor(hello : A) { }
                    }
                `,
                modules: {
                    fs: {}
                }
            });
        });
    })
    describe('emitDecoratorMetadata=true: ', it => {
        describe('design:type', it => {
            it('emits for method', () => {
                let exports = runSimple({
                    code: `
                        export class A { }
                        export class B { }
                        export class C {
                            method(parm : A, parm2 : B) { }
                        }
                    `, 
                    compilerOptions: { 
                        emitDecoratorMetadata: true 
                    }
                });
        
                let type = Reflect.getMetadata('design:type', exports.C.prototype, 'method');
                expect(type).to.equal(Function);
            });
            it('emits for property', () => {
                let exports = runSimple({
                    code: `
                        export class A { }
                        export class B { }
                        export class C {
                            property : B;
                        }
                    `, 
                    compilerOptions: { 
                        emitDecoratorMetadata: true 
                    }
                });
        
                let type = Reflect.getMetadata('design:type', exports.C.prototype, 'property');
                expect(type).to.equal(exports.B);
            });
        })
        describe('design:paramtypes', it => {
            it('emits for ctor params', () => {
                let exports = runSimple({
                    code: `
                        export class A { }
                        export class B { }
                        export class C {
                            constructor(hello : A, world : B) { }
                        }
                    `, 
                    compilerOptions: { 
                        emitDecoratorMetadata: true 
                    }
                });
        
                let params = Reflect.getMetadata('design:paramtypes', exports.C);
                expect(params).to.eql([exports.A, exports.B]);
            });
            it('emits for method params', () => {
                let exports = runSimple({
                    code: `
                        export class A { }
                        export class B { }
                        export class C {
                            method(parm : A, parm2 : B) { }
                        }
                    `, 
                    compilerOptions: { 
                        emitDecoratorMetadata: true 
                    }
                });
        
                let params = Reflect.getMetadata('design:paramtypes', exports.C.prototype, 'method');
                expect(params).to.eql([exports.A, exports.B]);
            });
            it('emits expected intrinsic types', () => {
                let exports = runSimple({
                    code: `
                        export class A { }
                        export class B { }
                        export class C {
                            method(a : string, b : number, c : boolean, d : Function, e : RegExp) { }
                        }
                    `, 
                    compilerOptions: { 
                        emitDecoratorMetadata: true 
                    }
                });
        
                let params = Reflect.getMetadata('design:paramtypes', exports.C.prototype, 'method');
                expect(params).to.eql([String, Number, Boolean, Function, RegExp]);
            });
        });
        describe('design:returntype', it => {
            it('emits the designed type on a method', () => {
                let exports = runSimple({
                    code: `
                        export class A { }
                        export class B { }
                        export class C {
                            method(parm : A, parm2 : B): B { return null; }
                        }
                    `, 
                    compilerOptions: { 
                        emitDecoratorMetadata: true 
                    }
                });
        
                let params = Reflect.getMetadata('design:returntype', exports.C.prototype, 'method');
                expect(params).to.equal(exports.B);
            });
            it('emits void 0 on a method returning nothing', () => {
                let exports = runSimple({
                    code: `
                        export class A { }
                        export class B { }
                        export class C {
                            method(parm : A, parm2 : B) { }
                        }
                    `, 
                    compilerOptions: { 
                        emitDecoratorMetadata: true 
                    }
                });
        
                let params = Reflect.getMetadata('design:returntype', exports.C.prototype, 'method');
                expect(params).to.equal(void 0);
            });
            it('emits void 0 on a method returning an inferred intrinsic', () => {
                let exports = runSimple({
                    code: `
                        export class A { }
                        export class B { }
                        export class C {
                            method(parm : A, parm2 : B) { return 123; }
                        }
                    `, 
                    compilerOptions: { 
                        emitDecoratorMetadata: true 
                    }
                });
        
                let params = Reflect.getMetadata('design:returntype', exports.C.prototype, 'method');
                expect(params).to.equal(void 0);
            });
            it('emits void 0 on a method returning an inferred class type', () => {
                let exports = runSimple({
                    code: `
                        export class A { }
                        export class B { }
                        export class C {
                            method(parm : A, parm2 : B) { return new B(); }
                        }
                    `, 
                    compilerOptions: { 
                        emitDecoratorMetadata: true 
                    }
                });
        
                let params = Reflect.getMetadata('design:returntype', exports.C.prototype, 'method');
                expect(params).to.equal(void 0);
            });
        });
    });
    describe('emitDecoratorMetadata=false: ', it => {
        it('does not emit design:paramtypes for ctor params', () => {
            let exports = runSimple({
                code: `
                    export class A { }
                    export class B {
                        constructor(hello : A) { }
                    }
                `, 
                compilerOptions: { 
                    emitDecoratorMetadata: false 
                }
            });
    
            let params = Reflect.getMetadata('design:paramtypes', exports.B);
            expect(params).not.to.exist;
        });
        it('does not emit design:paramtypes for method params', () => {
            let exports = runSimple({
                code: `
                    export class A { }
                    export class B { }
                    export class C {
                        method(hello : A, world : B) { }
                    }
                `, 
                compilerOptions: { 
                    emitDecoratorMetadata: false 
                }
            });
    
            let params = Reflect.getMetadata('design:paramtypes', exports.C.prototype, 'method');
            expect(params).not.to.exist;
        });
        it('does not emit design:type for method', () => {
            let exports = runSimple({
                code: `
                    export class A { }
                    export class B { }
                    export class C {
                        method(hello : A, world : B) { }
                    }
                `, 
                compilerOptions: { 
                    emitDecoratorMetadata: false 
                }
            });
    
            let type = Reflect.getMetadata('design:type', exports.C.prototype, 'method');
            expect(type).not.to.exist;
        });
        it('does emit rt:f on a method', () => {
            let exports = runSimple({
                code: `
                    export class A { }
                    export class B { }
                    export class C {
                        method(hello : A, world : B) { }
                    }
                `, 
                compilerOptions: { 
                    emitDecoratorMetadata: false 
                }
            });
    
            let type = Reflect.getMetadata('rt:f', exports.C.prototype, 'method');
            expect(type).to.equal('M$');
        });
    });

    describe('Class', it => {
        describe('rt:f', it => {
            it('emits', () => {
                let exports = runSimple({
                    code: `
                        export class A { }
                        export class B { }
                    `
                });
        
                let flags = Reflect.getMetadata('rt:f', exports.B);
                expect(flags).to.equal('C$');
            });
        });
        describe('rt:p', () => {
            it('emits for ctor params', () => {
                let exports = runSimple({
                    code: `
                        export class A { }
                        export class B {
                            constructor(hello : A) { }
                        }
                    `
                });
        
                let params = Reflect.getMetadata('rt:p', exports.B);
                expect(params[0].t()).to.equal(exports.A);
                expect(params[0].n).to.equal('hello');
            });
            it('emits F_PUBLIC for ctor param', () => {
                let exports = runSimple({
                    code: `
                        export class A { }
                        export class B { }
                        export class C {
                            constructor(public hello : A) { }
                        }
                    `
                });
        
                let params = Reflect.getMetadata('rt:p', exports.C);
                expect(params[0].f).to.contain(F_PUBLIC);
            });
            it('emits correctly for bound imports', () => {
                // TODO: requires type checker to test
                let lib = {
                    A: class {}
                };
                let exports = runSimple({
                    code: `
                        import { A } from "lib";
                        export class C {
                            method(hello : A) { return 123; }
                        }
                    `, 
                    compilerOptions: {
                        // target: ts.ScriptTarget.ES2020,
                        // module: ts.ModuleKind.ES2020
                    },
                    modules: {
                        lib
                    }
                });
        
                let params = Reflect.getMetadata('rt:p', exports.C.prototype, 'method');
                expect(params[0].t()).to.equal(lib.A);
            });
            it('emits correctly for star imports', () => {
                // TODO: requires type checker to test
                let lib = {
                    A: class {}
                };
                let exports = runSimple({
                    code: `
                        import * as lib from "lib";
                        export class C {
                            method(hello : lib.A) { return 123; }
                        }
                    `, 
                    modules: {
                        lib
                    }
                });
        
                let params = Reflect.getMetadata('rt:p', exports.C.prototype, 'method');
                expect(params[0].t()).to.equal(lib.A);
            });
            it('emits F_PROTECTED for ctor param', () => {
                let exports = runSimple({
                    code: `
                        export class A { }
                        export class B { }
                        export class C {
                            constructor(protected hello : A) { }
                        }
                    `
                });
        
                let params = Reflect.getMetadata('rt:p', exports.C);
                expect(params[0].f).to.contain(F_PROTECTED);
            });
            it('emits F_PRIVATE for ctor param', () => {
                let exports = runSimple({
                    code: `
                        export class A { }
                        export class B { }
                        export class C {
                            constructor(private hello : A) { }
                        }
                    `
                });
        
                let params = Reflect.getMetadata('rt:p', exports.C);
                expect(params[0].f).to.contain(F_PRIVATE);
            });
            it('emits F_READONLY for ctor param', () => {
                let exports = runSimple({
                    code: `
                        export class A { }
                        export class B { }
                        export class C {
                            constructor(readonly hello : A) { }
                        }
                    `
                });
        
                let params = Reflect.getMetadata('rt:p', exports.C);
                expect(params[0].f).to.contain(F_READONLY);
            });
            it('emits F_OPTIONAL for optional ctor param', () => {
                let exports = runSimple({
                    code: `
                        export class A { }
                        export class B { }
                        export class C {
                            constructor(hello? : A) { }
                        }
                    `
                });
        
                let params = Reflect.getMetadata('rt:p', exports.C);
                expect(params[0].f).to.contain(F_OPTIONAL);
            });
            it('emits multiple flags for ctor param', () => {
                let exports = runSimple({
                    code: `
                        export class A { }
                        export class B { 
                            constructor(public hello? : A) { }
                        }
                        export class C {
                            constructor(readonly hello? : A) { }
                        }
                    `
                });
        
                let bFlags = Reflect.getMetadata('rt:p', exports.B);
                expect(bFlags[0].f).to.contain(F_PUBLIC);
                expect(bFlags[0].f).to.contain(F_OPTIONAL);
                
                let cFlags = Reflect.getMetadata('rt:p', exports.C);
                expect(cFlags[0].f).to.contain(F_READONLY);
                expect(cFlags[0].f).to.contain(F_OPTIONAL);
            });
            it('emits for method params', () => {
                let exports = runSimple({
                    code: `
                        export class A { }
                        export class B { }
                        export class C {
                            method(hello : A, world : B) { }
                        }
                    `
                });
        
                let params = Reflect.getMetadata('rt:p', exports.C.prototype, 'method');
                expect(params[0].t()).to.equal(exports.A);
                expect(params[0].n).to.equal('hello');
                expect(params[1].t()).to.equal(exports.B);
                expect(params[1].n).to.equal('world');
            });
        });
        describe('rt:t', it => {
            it('emits for designed class return type', () => {
                let exports = runSimple({
                    code: `
                        export class A { }
                        export class B { }
                        export class C {
                            method(hello : A, world : B): B { return world; }
                        }
                    `
                });
        
                let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                expect(type()).to.equal(exports.B);
            })
            it('emits for inferred class return type (as Object)', () => {
                // TODO: requires type checker to test
                let exports = runSimple({
                    code: `
                        export class A { }
                        export class B { }
                        export class C {
                            method(hello : A, world : B) { return world; }
                        }
                    `
                });
        
                let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                expect(type()).to.equal(Object);
            })
            it('emits for inferred intrinsic return type', () => {
                let exports = runSimple({
                    code: `
                        export class A { }
                        export class B { }
                        export class C {
                            method(hello : A, world : B) { return 123; }
                        }
                    `
                });
        
                let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                expect(type()).to.equal(Number);
            })
        });
        it('can emit a class imported as default', () => {
            class A {}
            let exports = runSimple({
                code: `
                    import A from "fs";
                     
                    export class B {
                        constructor(hello : A) { }
                    }
                `,
                modules: {
                    fs: A
                }
            });

            let params = Reflect.getMetadata('rt:p', exports.B);

            expect(params.length).to.equal(1);
            expect(params[0].t()).to.equal(A);
        });
    });
});