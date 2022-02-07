
import { expect } from 'chai';
import { describe } from 'razmin';
import ts from 'typescript';
import { F_OPTIONAL, F_PRIVATE, F_PROTECTED, F_PUBLIC, F_READONLY } from "./flags";
import { F_ABSTRACT, F_CLASS, F_EXPORTED, T_ANY, T_ARRAY, T_GENERIC, T_INTERSECTION, T_THIS, T_TUPLE, T_UNION, T_UNKNOWN, T_VOID } from '../common';
import { Interface } from '../common';
import { runSimple } from '../runner.test';
import { reify, reflect } from '../lib';

const hasOwnProperty = Object.prototype.hasOwnProperty;
function hasProperty(map: ts.MapLike<any>, key: string): boolean {
    return hasOwnProperty.call(map, key);
}

const MODULE_TYPES : ('commonjs' | 'esm')[] = ['commonjs', 'esm'];

describe('RTTI: ', () => {
    describe('interface', it => {
        it('emits a symbol for every exported interface', async () => {
            let exports = await runSimple({
                code: `
                    export interface Foo { }
                `
            });

            expect(typeof exports.IΦFoo).to.equal('object');
            expect(typeof exports.IΦFoo.identity).to.equal('symbol');
        });
        it('emits no symbol for non-exported interface', async () => {
            let exports = await runSimple({
                code: `
                    interface Foo { }
                `
            });
            expect(exports.IΦFoo).not.to.exist;
        });
        it('\'s symbol has type metadata', async () => {
            let exports = await runSimple({
                code: `
                    export interface Foo { 
                        method(foo : number): boolean;
                        field : string;
                        blah : string | number;
                    }
                `
            });

            expect(Reflect.getMetadata('rt:t', exports.IΦFoo.prototype, 'method')()).to.equal(Boolean);
            expect(Reflect.getMetadata('rt:t', exports.IΦFoo.prototype, 'field')()).to.equal(String);
            expect(Reflect.getMetadata('rt:t', exports.IΦFoo.prototype, 'blah')()).to.eql({ TΦ: "|", t: [String, Number] });
            expect(Reflect.getMetadata('rt:p', exports.IΦFoo.prototype, 'method')[0].n).to.equal('foo');
            expect(Reflect.getMetadata('rt:p', exports.IΦFoo.prototype, 'method')[0].t()).to.equal(Number);
            expect(Reflect.getMetadata('rt:P', exports.IΦFoo)).to.eql(['field', 'blah']);
            expect(Reflect.getMetadata('rt:m', exports.IΦFoo)).to.eql(['method']);
        });
    });
    describe('reify<T>()', it => {
        it('will resolve to the interface symbol generated in the same file', async () => {
            let exports = await runSimple({
                code: `
                    import { reify } from 'typescript-rtti';
                    export interface Foo { }
                    export const ReifiedFoo = reify<Foo>();
                `,
                modules: {
                    "typescript-rtti": { reify: a => a }
                }
            });

            let identity = exports.IΦFoo.identity;

            expect(typeof identity).to.equal('symbol');
            expect(exports.IΦFoo).to.eql({ name: 'Foo', prototype: {}, identity });
            expect(exports.ReifiedFoo).to.equal(exports.IΦFoo);
        })
        for (let moduleType of MODULE_TYPES) {
            if (moduleType !== 'esm') continue;
            describe(` [${moduleType}]`, it => {
                it('will resolve to the interface symbol generated in another file', async () => {
                    let FooSym = "$$FOO";
                    let IΦFoo = { name: 'Foo', prototype: {}, identity: FooSym };

                    let exports = await runSimple({
                        moduleType: moduleType,
                        code: `
                            import { reify } from 'typescript-rtti';
                            import { Foo } from "another";
                            export const ReifiedFoo = reify<Foo>();
                        `,
                        modules: {
                            "typescript-rtti": { reify: a => a, reflect: a => a },
                            "another": {
                                IΦFoo
                            }
                        }
                    });
                    expect(exports.ReifiedFoo).to.eql(IΦFoo);
                })
                it('will not choke if the imported interface has no type metadata', async () => {
                    let exports = await runSimple({
                        moduleType: moduleType,
                        code: `
                            import { reify } from 'typescript-rtti';
                            import { Foo } from "another2";
                            export const ReifiedFoo = reify<Foo>();
                        `,
                        modules: {
                            "typescript-rtti": { 
                                reify: () => {}
                            },
                            "another2": {}
                        }
                    });

                    expect(exports.ReifiedFoo).to.equal(undefined);
                });
            });
        }
    });
    describe('Imports', it => {
        for (let moduleType of MODULE_TYPES) {
            describe(`(${moduleType})`, it => {
                it('doesn\'t explode on bare imports', async () => {
                    await runSimple({
                        moduleType,
                        code: `
                            import "foo";
                            
                            export class A { }
                            export class B {
                                constructor(hello : A) { }
                            }
                        `,
                        modules: {
                            foo: {}
                        }
                    });
                });
                it('doesn\'t explode on default imports', async () => {
                    await runSimple({
                        moduleType,
                        code: `
                            import foo from "foo";
                            
                            export class A { }
                            export class B {
                                constructor(hello : A) { }
                            }
                        `,
                        modules: {
                            foo: {}
                        }
                    });
                });
                it('emits correctly for bound imports', async () => {
                    // TODO: requires type checker to test
                    let lib = {
                        A: "$$A"
                    };
                    let exports = await runSimple({
                        moduleType,
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
                it('emits correctly for star imports', async () => {
                    // TODO: requires type checker to test
                    let lib = {
                        A: "$$A"
                    };
                    let exports = await runSimple({
                        moduleType,
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
                it('can emit a class imported as default', async () => {
                    const A = "$$A";
                    let exports = await runSimple({
                        moduleType,
                        code: `
                            import A from "foo";
                            
                            export class B {
                                constructor(hello : A) { }
                            }
                        `,
                        modules: {
                            foo: A
                        }
                    });
    
                    let params = Reflect.getMetadata('rt:p', exports.B);
    
                    expect(params.length).to.equal(1);
                    expect(params[0].t()).to.equal(A);
                });
            });
        }
    });

    describe('emitDecoratorMetadata=true: ', () => {
        describe('design:type', it => {
            it('emits for method', async () => {
                let exports = await runSimple({
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
            it('emits for property', async () => {
                let exports = await runSimple({
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
            it('emits for property of type Promise', async () => {
                let exports = await runSimple({
                    code: `
                        export class A { }
                        export class B { }
                        export class C {
                            property : Promise<B>;
                        }
                    `, 
                    compilerOptions: { 
                        emitDecoratorMetadata: true 
                    }
                });
        
                let type = Reflect.getMetadata('design:type', exports.C.prototype, 'property');
                expect(type).to.equal(Promise);
            });
        })
        describe('design:paramtypes', it => {
            it('emits for ctor params', async () => {
                let exports = await runSimple({
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
            it('emits for method params', async () => {
                let exports = await runSimple({
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
            it('emits expected intrinsic types', async () => {
                let exports = await runSimple({
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
                
                expect(params[0]).to.equal(String);
                expect(params[1]).to.equal(Number);
                expect(params[2]).to.equal(Boolean);
                expect(params[3]).to.equal(Function);
                expect(params[4]).to.equal(RegExp);

            });
        });
        describe('design:returntype', it => {
            it('emits the designed type on a method', async () => {
                let exports = await runSimple({
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
            it('emits void 0 on a method returning nothing', async () => {
                let exports = await runSimple({
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
            it('emits void 0 on a method returning an inferred intrinsic', async () => {
                let exports = await runSimple({
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
            it('emits void 0 on a method returning an inferred class type', async () => {
                let exports = await runSimple({
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
        it('does not emit design:paramtypes for ctor params', async () => {
            let exports = await runSimple({
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
        it('does not emit design:paramtypes for method params', async () => {
            let exports = await runSimple({
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
        it('does not emit design:type for method', async () => {
            let exports = await runSimple({
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
        it('does emit rt:f on a method', async () => {
            let exports = await runSimple({
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
            it('identify classes', async () => {
                let exports = await runSimple({
                    code: `
                        export class A { }
                    `
                });
        
                let aFlags = Reflect.getMetadata('rt:f', exports.A);
                expect(aFlags).to.contain(F_CLASS);
            });
            it('identifies exported classes', async () => {
                let exports = await runSimple({
                    code: `
                        class A { }
                        export class B { }
                        export const A2 = A;
                    `
                });
        
                let aFlags = Reflect.getMetadata('rt:f', exports.A2);
                let bFlags = Reflect.getMetadata('rt:f', exports.B);
                expect(aFlags).not.to.contain(F_EXPORTED);
                expect(bFlags).to.contain(F_EXPORTED);
            });
            it('identifies abstract classes', async () => {
                let exports = await runSimple({
                    code: `
                        export class A { }
                        export abstract class B { }
                    `
                });
        
                let aFlags = Reflect.getMetadata('rt:f', exports.A);
                let bFlags = Reflect.getMetadata('rt:f', exports.B);
                expect(aFlags).not.to.contain(F_ABSTRACT);
                expect(bFlags).to.contain(F_ABSTRACT);
            });
        });
        describe('rt:p', () => {
            it('emits for ctor params', async () => {
                let exports = await runSimple({
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
            it('emits F_PUBLIC for ctor param', async () => {
                let exports = await runSimple({
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
            
            it('emits F_PROTECTED for ctor param', async () => {
                let exports = await runSimple({
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
            it('emits F_PRIVATE for ctor param', async () => {
                let exports = await runSimple({
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
            it('emits F_READONLY for ctor param', async () => {
                let exports = await runSimple({
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
            it('emits F_OPTIONAL for optional ctor param', async () => {
                let exports = await runSimple({
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
            it('emits multiple flags for ctor param', async () => {
                let exports = await runSimple({
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
            it('emits for method params', async () => {
                let exports = await runSimple({
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
            it('emits for designed class return type', async () => {
                let exports = await runSimple({
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
            it('emits for static method return type', async () => {
                let exports = await runSimple({
                    code: `
                        export class A { }
                        export class B { }
                        export class C {
                            static method(hello : A, world : B): B { return world; }
                        }
                    `
                });
        
                let type = Reflect.getMetadata('rt:t', exports.C, 'method');
                expect(type()).to.equal(exports.B);
            })
            it('emits for designed interface return type', async () => {
                let exports = await runSimple({
                    code: `
                        interface I {
                            foo : number;
                        }

                        export class C {
                            method(): I { return { foo: 123 }; }
                        }
                    `
                });
        
                let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                expect(type()).to.equal(Object);
            })
            it('emits for unknown return type', async () => {
                let exports = await runSimple({
                    code: `
                        export class C {
                            method(): unknown { return null; }
                        }
                    `
                });
        
                let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                expect(type()).to.eql({ TΦ: T_UNKNOWN });
            })
            it('emits for void return type', async () => {
                let exports = await runSimple({
                    code: `
                        export class C {
                            method(): void { }
                        }
                    `
                });
        
                let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                expect(type()).to.eql({ TΦ: T_VOID });
            })
            it('emits for any return type', async () => {
                let exports = await runSimple({
                    code: `
                        interface I {
                            foo : number;
                        }

                        export class C {
                            method(): any { return null; }
                        }
                    `
                });
        
                let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                expect(type()).to.eql({ TΦ: T_ANY });
            })
            it('emits for array types', async () => {
                let exports = await runSimple({
                    code: `
                        interface I {
                            foo : number;
                        }

                        export class C {
                            method(): string[] { return null; }
                        }
                    `
                });
        
                let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                expect(type()).to.eql({ TΦ: T_ARRAY, e: String });
            })
            it('emits for double array types', async () => {
                let exports = await runSimple({
                    code: `
                        interface I {
                            foo : number;
                        }

                        export class C {
                            method(): string[][] { return null; }
                        }
                    `
                });
        
                let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                expect(type()).to.eql({ TΦ: T_ARRAY, e: { TΦ: T_ARRAY, e: String } });
            })
            it('emits for tuple types', async () => {
                let exports = await runSimple({
                    code: `
                        interface I {
                            foo : number;
                        }

                        export class C {
                            method(): [string, number] { return ['foo', 123]; }
                        }
                    `
                });
        
                let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                expect(type()).to.eql({ TΦ: T_TUPLE, e: [ { t: String }, { t: Number } ] });
            })
            it('emits for tuple types with named elements', async () => {
                let exports = await runSimple({
                    code: `
                        interface I {
                            foo : number;
                        }

                        export class C {
                            method(): [str : string, num : number] { return ['foo', 123]; }
                        }
                    `
                });
        
                let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                expect(type()).to.eql({ TΦ: T_TUPLE, e: [ { n: 'str', t: String }, { n: 'num', t: Number } ] });
            })
            it('emits for returned Boolean', async () => {
                let exports = await runSimple({
                    code: `
                        export class C {
                            method<T>(t : T): Boolean { return false; }
                        }
                    `
                });
        
                let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                expect(type()).to.equal(Boolean);
            })
            it('emits for conditional types', async () => {
                let exports = await runSimple({
                    code: `
                        export class C {
                            method<T>(t : T): T extends Boolean ? boolean : string { return false; }
                        }
                    `
                });
        
                let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                expect(type()).to.equal(Object);
            })
            it('emits for type predicate types', async () => {
                let exports = await runSimple({
                    code: `
                        export class C {
                            isBlue(): this is D { return false; }
                        }

                        export class D extends C { }
                    `
                });
        
                let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'isBlue');
                expect(type()).to.equal(Boolean);
            })
            it('emits for this type', async () => {
                let exports = await runSimple({
                    code: `
                        export class C {
                            isBlue(): this { return this; }
                        }
                    `
                });
        
                let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'isBlue');
                expect(type()).to.eql({ TΦ: T_THIS });
            })
            it('emits for returned String', async () => {
                let exports = await runSimple({
                    code: `
                        export class C {
                            method<T>(t : T): String { return 'hello'; }
                        }
                    `
                });
        
                let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                expect(type()).to.equal(String);
            })
            it('emits for returned Number', async () => {
                let exports = await runSimple({
                    code: `
                        export class C {
                            method<T>(t : T): Number { return 123; }
                        }
                    `
                });
        
                let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                expect(type()).to.equal(Number);
            })
            it('emits for literal null', async () => {
                let exports = await runSimple({
                    code: `
                        export class A { }
                        export class B { }
                        export class C {
                            method(hello : A, world : B) : null { 
                                return 123; 
                            }
                        }
                    `
                });
        
                let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                expect(type()).to.equal(null);
            })
            it('emits for literal undefined', async () => {
                let exports = await runSimple({
                    code: `
                        export class A { }
                        export class B { }
                        export class C {
                            method(hello : A, world : B) : undefined { 
                                return 123; 
                            }
                        }
                    `
                });
        
                let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                expect(type()).to.equal(undefined);
            })
            it('emits for literal false', async () => {
                let exports = await runSimple({
                    code: `
                        export class A { }
                        export class B { }
                        export class C {
                            method(hello : A, world : B) : false { 
                                return false;
                            }
                        }
                    `
                });
        
                let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                expect(type()).to.equal(false);
            })
            it('emits for literal true', async () => {
                let exports = await runSimple({
                    code: `
                        export class A { }
                        export class B { }
                        export class C {
                            method(hello : A, world : B) : true { 
                                return true;
                            }
                        }
                    `
                });
        
                let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                expect(type()).to.equal(true);
            })
            it('emits for literal expression', async () => {
                let exports = await runSimple({
                    code: `
                        export class A { }
                        export class B { }
                        export class C {
                            method(hello : A, world : B) : 3 { 
                                return 3;
                            }
                        }
                    `
                });
        
                let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                expect(type()).to.equal(3);
            })
            it('emits for unary literal expression', async () => {
                let exports = await runSimple({
                    code: `
                        export class A { }
                        export class B { }
                        export class C {
                            method(hello : A, world : B) : -3 { 
                                return -3;
                            }
                        }
                    `
                });
        
                let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                expect(type()).to.equal(-3);
            })
            it('emits for returned Function', async () => {
                let exports = await runSimple({
                    code: `
                        export class C {
                            method<T>(t : T): Function { return () => {}; }
                        }
                    `
                });
        
                let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                expect(type()).to.equal(Function);
            })
            it('emits for returned type parameter', async () => {
                let exports = await runSimple({
                    code: `
                        export class C {
                            method<T>(t : T): T { return t; }
                        }
                    `
                });
        
                let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                expect(type()).to.equal(Object);
            })
            it('emits for type transformations', async () => {
                let exports = await runSimple({
                    code: `
                        export class A {}
                        type Px<T> = {
                            [P in keyof T]?: T[P];
                        };
                        export class C {
                            method<T>(): Px<A> { return null; }
                        }
                    `
                });
        
                let typeResolver = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                let type = typeResolver();

                expect(type.TΦ).to.equal(T_GENERIC);
                expect(type.t).to.equal(Object);
                expect(type.p).to.eql([exports.A]);
            })
            it('emits for type transforms from TS lib', async () => {
                let exports = await runSimple({
                    code: `
                        export class A {}
                        export class C {
                            method<T>(): Partial<A> { return null; }
                        }
                    `
                });
        
                let typeResolver = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                let type = typeResolver();

                expect(type.TΦ).to.equal(T_GENERIC);
                expect(type.t).to.equal(Object);
                expect(type.p).to.eql([exports.A]);
            })
            it('emits for inferred class return type (as Object)', async () => {
                // TODO: requires type checker to test
                let exports = await runSimple({
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
            it('emits for inferred intrinsic return type', async () => {
                let exports = await runSimple({
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
            it('does not assume a property will have a TypeRef', async () => {
                await runSimple({
                    code: `
                        export class TestClass {
                            name = 'foobar'
                        }
                    `
                });
            });
            it('emits for union return type', async () => {
                let exports = await runSimple({
                    code: `
                        export class A { }
                        export class B { }
                        export class C {
                            method(hello : A, world : B) : string | number { 
                                return 123; 
                            }
                        }
                    `
                });
        
                let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                expect(type()).to.eql({ TΦ: T_UNION, t: [ String, Number ] });
            })
            it('emits for intersection return type', async () => {
                let exports = await runSimple({
                    code: `
                        export class A { }
                        export class B { }
                        export class C {
                            method(hello : A, world : B) : string & number { 
                                return 123; 
                            }
                        }
                    `
                });
        
                let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                expect(type()).to.eql({ TΦ: T_INTERSECTION, t: [ String, Number ] });
            })
            it('emits for Promise return type', async () => {
                let exports = await runSimple({
                    code: `
                        export class A { }
                        export class B { }
                        export class C {
                            method(hello : A, world : B) : Promise<string> { 
                                return 123; 
                            }
                        }
                    `
                });
        
                let typeResolver = Reflect.getMetadata('rt:t', exports.C.prototype, 'method');
                let type = typeResolver();

                expect(type.TΦ).to.equal(T_GENERIC);
                expect(type.t).to.equal(Promise);
                expect(type.p).to.eql([ String ]);
            })
        });
        describe('rt:i', it => {
            it('emits for local interfaces implemented by a class', async () => {
                let exports = await runSimple({
                    code: `
                        export interface Something {}
                        export interface SomethingElse {}
                        export class C implements Something, SomethingElse {}
                    `
                });
        
                let typeRefs : any[] = Reflect.getMetadata('rt:i', exports.C);
                
                expect(typeRefs).to.exist;
                expect(typeRefs.length).to.equal(2);
                expect(typeRefs[0]()).to.equal(exports.IΦSomething);
                expect(typeRefs[1]()).to.equal(exports.IΦSomethingElse);
            })
            it('emits for external interfaces implemented by a class', async () => {
                let IΦSomething : Interface = { 
                    name: 'Something',
                    prototype: {},
                    identity: Symbol('Something (interface)')
                };

                let IΦSomethingElse : Interface = { 
                    name: 'SomethingElse',
                    prototype: {},
                    identity: Symbol('SomethingElse (interface)')
                };

                let exports = await runSimple({
                    modules: {
                        other: {
                            IΦSomething, IΦSomethingElse
                        }
                    },
                    code: `
                        import { Something, SomethingElse } from 'other';
                        export class C implements Something, SomethingElse {}
                    `
                });
        
                let typeRefs : any[] = Reflect.getMetadata('rt:i', exports.C);
                
                expect(typeRefs).to.exist;
                expect(typeRefs.length).to.equal(2);
                expect(typeRefs[0]()).to.equal(IΦSomething);
                expect(typeRefs[1]()).to.equal(IΦSomethingElse);
            })
            it('prefers exported class over exported interface', async () => {
                let IΦSomething : Interface = { 
                    name: 'Something',
                    prototype: {},
                    identity: Symbol('Something (interface)')
                };

                let IΦSomethingElse : Interface = { 
                    name: 'SomethingElse',
                    prototype: {},
                    identity: Symbol('SomethingElse (interface)')
                };

                class Something {}

                let exports = await runSimple({
                    modules: {
                        other: {
                            Something, IΦSomething, IΦSomethingElse
                        }
                    },
                    code: `
                        import { Something, SomethingElse } from 'other';
                        export class C implements Something, SomethingElse {}
                    `
                });
        
                let typeRefs : any[] = Reflect.getMetadata('rt:i', exports.C);
                
                expect(typeRefs).to.exist;
                expect(typeRefs.length).to.equal(2);
                expect(typeRefs[0]()).to.equal(Something);
                expect(typeRefs[1]()).to.equal(IΦSomethingElse);
            })
        });
    });
});