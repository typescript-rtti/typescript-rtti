import { expect } from "chai";
import { describe, it } from "@jest/globals";
import { runSimple } from "../../runner.test-harness";
import * as format from "../../common/format";
import { reflect } from '../../lib';

describe('Interface token', () => {
    it('is emitted for exported interfaces', async () => {
        await runSimple({
            code: `
                export interface Foo { }
            `,
            checks: exports => {
                expect(typeof exports.IΦFoo).to.equal('object');
                expect(typeof exports.IΦFoo.identity).to.equal('symbol');
            }
        });
    });
    it('is emitted for imported interfaces', async () => {
        await runSimple({
            code: `
                import { Foo } from './foo';
                export interface Bar {
                    foo : Foo;
                }
            `,
            modules: {
                './foo.ts': `
                    export interface Foo { }
                `
            },
            checks: exports => {
                let typeResolver = Reflect.getMetadata('rt:t', exports.IΦBar.prototype, 'foo');
                let type = typeResolver();
                expect(type.name).to.equal('Foo');
            }
        });
    });
    it('is re-exported along with interface re-export', async () => {
        await runSimple({
            code: `
                import { Foo } from './foo';
                export { Foo };
            `,
            modules: {
                './foo.ts': `
                    export interface Foo { }
                `
            },
            checks: exports => {
                expect(exports.IΦFoo).to.exist;
                expect(exports.IΦFoo.name).to.equal('Foo');
                expect(exports.IΦFoo.prototype).to.exist;
                expect(typeof exports.IΦFoo.identity).to.equal('symbol');
            }
        });
    });
    it('is emitted for interfaces across multiple re-exports', async () => {
        await runSimple({
            code: `
                import { Foo } from './foo2';
                export interface Bar {
                    foo : Foo;
                }
            `,
            modules: {
                './foo2.ts': `
                    export interface Foo { }
                `,
                './foo1.ts': `
                    export interface Foo { }
                `
            },
            checks: exports => {
                let typeResolver = Reflect.getMetadata('rt:t', exports.IΦBar.prototype, 'foo');
                let type = typeResolver();
                expect(type.name).to.equal('Foo');
            }
        });

    });
    it('should emit using ExpressionStatement to avoid ASI issues', async () => {
        // If the __RΦ.m() metadata definer calls are not statements, then automatic semicolon insertion
        // can cause the last line of this example to be treated as a continuation of the previous expression,
        // which in this case will be the last __RΦ.m() call, yielding "__RΦ.m(...)(...) is not a function"
        await runSimple({
            code: `
                import { reflect } from 'typescript-rtti';

                function doStuff() { exports.ok = true; }

                interface Request {
                    operation : 'foo' | 'bar';
                    items? : string[];
                }

                (0, doStuff)();
            `,
            modules: {
                'typescript-rtti': { reflect }
            },
            checks: exports => {
                expect(exports.ok).to.be.true;
            }
        });
    });
    it('should matchValue() correctly', async () => {
        await runSimple({
            code: `
                import { reflect } from 'typescript-rtti';

                interface Request {
                    operation : 'foo' | 'bar';
                    items? : string[];
                }

                export const trueErrors = [];
                export const trueResult = reflect<Request>().matchesValue({ operation : 'bar' }, trueErrors);
                export const falseResult = reflect<Request>().matchesValue({ operation : 'baz' });
            `,
            modules: {
                'typescript-rtti': { reflect }
            },
            checks: exports => {
                if (!exports.trueResult) {
                    console.log(`Expected matchValues() to return true, not false. Errors were: ${JSON.stringify(exports.trueErrors)}`);
                }
                expect(exports.trueResult).to.be.true;
                expect(exports.falseResult).to.be.false;
            }
        });
    });
    it('is emitted for non-exported interface', async () => {
        await runSimple({
            code: `
                interface Foo { }
            `,
            checks: exports => {
                expect(exports.IΦFoo).not.to.exist;
            }
        });
    });
    it('collects type metadata', async () => {
        await runSimple({
            code: `
                export interface Foo {
                    method(foo : number): boolean;
                    field : string;
                    blah : string | number;
                }
            `,
            checks: exports => {
                expect(Reflect.getMetadata('rt:t', exports.IΦFoo.prototype, 'method')()).to.equal(Boolean);
                expect(Reflect.getMetadata('rt:t', exports.IΦFoo.prototype, 'field')()).to.equal(String);
                expect(Reflect.getMetadata('rt:t', exports.IΦFoo.prototype, 'blah')().TΦ).to.equal(format.T_UNION);
                expect(Reflect.getMetadata('rt:t', exports.IΦFoo.prototype, 'blah')().t).to.include.all.members([String, Number]);
                expect(Reflect.getMetadata('rt:p', exports.IΦFoo.prototype, 'method')[0].n).to.equal('foo');
                expect(Reflect.getMetadata('rt:p', exports.IΦFoo.prototype, 'method')[0].t()).to.equal(Number);
                expect(Reflect.getMetadata('rt:P', exports.IΦFoo)).to.eql(['field', 'blah']);
                expect(Reflect.getMetadata('rt:m', exports.IΦFoo)).to.eql(['method']);
            }
        });
    });
    it('exposes interfaces which are extended', async () => {
        await runSimple({
            code: `
                export interface Foo1 { }
                export interface Foo2 { }
                export interface Bar extends Foo1, Foo2 { }
            `,
            checks: exports => {
                let ext = Reflect.getMetadata('rt:i', exports.IΦBar);
                let ifaces = ext.map(f => f());

                expect(ifaces.length).to.equal(2);
                expect(ifaces[0]).to.equal(exports.IΦFoo1);
                expect(ifaces[1]).to.equal(exports.IΦFoo2);
            }
        });
    });
    it('exposes classes from declared modules', async () => {
        await runSimple({
            code: `
                declare module foobar {
                    export class Foo1 {
                        member1: number;
                        member2: string;
                    }
                    export class Foo2 { }
                }

                export class A {
                    foo1: foobar.Foo1;
                    foo2: foobar.Foo2;
                }
            `,
            checks: exports => {
                const typeRef: format.RtObjectType = Reflect.getMetadata('rt:t', exports.A.prototype, 'foo1')();
                expect(typeRef.TΦ).to.equal(format.T_OBJECT);
                expect(typeRef.n).to.equal('Foo1');
                expect(typeRef.m.length).to.equal(2);
                expect(typeRef.m[0].n === 'foo1');
                expect(typeRef.m[0].t === Number);
                expect(typeRef.m[0].n === 'foo2');
                expect(typeRef.m[1].t === String);
            }
        });
    });
    it.only('emits interface decorators only once', async () => {
        await runSimple({
            code: `
                export interface A {
                    a:string;
                    b:string;
                    c:string;
                    d:string;
                    e:string,
                    f:string;
                    g:string;
                }
            `,
            outputTransformer(filename, code) {
                code = code.replace(/__RΦ\.m\(/g, `((key, value) => ((globalThis.__metadataDecorators = globalThis.__metadataDecorators ?? []).push([key, value]), __RΦ.m(key, value)))(`)
                return code;
            },
            checks: exports => {
                let decorators: ([key: string, value: any ])[] = (globalThis as any).__metadataDecorators;
                let count = decorators.filter(([key, value]) => key === 'rt:t').length;

                expect(count).to.equal(7);
            }
        });
    })
});