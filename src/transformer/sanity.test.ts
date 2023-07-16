import { expect } from "chai";
import { describe, it } from "@jest/globals";
import ts from 'typescript';
import { runSimple } from "../runner.test-harness";

describe('Sanity', () => {
    it('when function declarations appear in if statements', async () => {
        await runSimple({
            code: `
                export let foo = false;
                if (false)
                    function a() { return 321; }
                else
                    foo = true;
            `,
            checks: exports => {
                expect(exports.foo).to.equal(true);
            }
        });

    });
    it('when function declarations are named', async () => {
        await runSimple({
            code: `
                export let foo = false;
                function a() { return 321; }
                foo = a() === 321;
            `,
            checks: exports => {
                expect(exports.foo).to.equal(true);
            }
        });
    });
    it('when function declarations appear in if statements (2)', async () => {
        await runSimple({
            code: `
                export let foo = false;
                if (true)
                    function a() { return 321; }
                else
                    foo = true;

                export let bar = a();
                export let func = a;
            `,
            checks: exports => {
                expect(exports.bar).to.equal(321);
            }
        });
    });
    it('when unnamed function expressions appear in property assignments', async () => {
        await runSimple({
            code: `
                export let foo = { bar: () => 123 };
            `,
            checks: exports => {
                expect(exports.foo.bar.name).to.equal('bar');
            }
        });
    });
    it('when arrow functions appear in property assignments', async () => {
        await runSimple({
            code: `
                export let foo = { bar: () => 123 };
            `,
            checks: exports => {
                expect(exports.foo.bar.name).to.equal('bar');
            }
        });
    });
    it('prevails, do not collapse exports', async () => {
        await runSimple({
            code: `
                export interface A { }
                export function B() { }
                export class C { foo() { } }
            `,
            checks: exports => {
                expect(typeof exports.B).to.equal('function');
                expect(typeof exports.C).to.equal('function');
                expect(typeof exports.C.prototype.foo).to.equal('function');
            }
        });
    });
    it('prevails, do not crash on symbol methods', async () => {
        await runSimple({
            code: `
                let sym = Symbol();
                export class A {
                    constructor(readonly bar = 'abc') {
                    };

                    [sym]() {
                        return 123;
                    }

                    foo(faz : number) {
                        return 'works';
                    }
                }
            `,
            checks: exports => {
                expect(new exports.A().foo()).to.equal('works');
            }
        });
    });
    it('prevails, do not crash on symbol methods from property access', async () => {
        await runSimple({
            code: `
                let foo = {
                    sym: Symbol()
                };

                export class A {
                    constructor(readonly bar = 'abc') {
                    };

                    [foo.sym]() {
                        return 123;
                    }

                    foo(faz : number) {
                        return 'works';
                    }
                }
            `,
            checks: exports => {
                expect(new exports.A().foo()).to.equal('works');
            }
        });
    });
    it('prevails, do not crash on exported symbol methods in CommonJS', async () => {
        await runSimple({
            code: `
                export let sym = Symbol();
                export class A {
                    constructor(readonly bar = 'abc') {
                    };

                    [sym]() {
                        return 123;
                    }

                    foo(faz : number) {
                        return 'works';
                    }
                }
            `,
            checks: exports => {
                expect(new exports.A().foo()).to.equal('works');
            }
        });

    });
    it('prevails, emits properly with a file containing only a type', async () => {
        await runSimple({
            code: `
                /**
                 * All types that relation can be.
                 */
                export type RelationType = "one-to-one"|"one-to-many"|"many-to-one"|"many-to-many";
            `
        });
    });
    it('prevails, emits properly for mapped types with no type params', async () => {
        await runSimple({
            code: `
                /**
                 * Condition.
                 */
                export type Condition<T, P extends keyof T> = {
                    $eq?: T[P];
                    $gt?: T[P];
                    $gte?: T[P];
                    $in?: T[P][];
                    $lt?: T[P];
                    $lte?: T[P];
                    $ne?: T[P];
                    $nin?: T[P][];
                    $and?: (FilterQuery<T[P]> | T[P])[];
                    $or?: (FilterQuery<T[P]> | T[P])[];
                    $not?: (FilterQuery<T[P]> | T[P])[] | T[P];
                    $expr?: any;
                    $jsonSchema?: any;
                    $mod?: [number, number];
                    $regex?: RegExp;
                    $options?: string;
                    $text?: {
                        $search: string;
                        $language?: string;
                        $caseSensitive?: boolean;
                        $diacraticSensitive?: boolean;
                    };
                    $where?: Object;
                    $geoIntersects?: Object;
                    $geoWithin?: Object;
                    $near?: Object;
                    $nearSphere?: Object;
                    $elemMatch?: Object;
                    $size?: number;
                    $bitsAllClear?: Object;
                    $bitsAllSet?: Object;
                    $bitsAnyClear?: Object;
                    $bitsAnySet?: Object;
                    [key: string]: any;
                };

                export type FilterQuery<T> = {
                    [P in keyof T]?: T[P] | Condition<T, P>;
                } | { [key: string]: any };

                export interface Collection<T> {
                    count(query: FilterQuery<T>, callback: MongoCallback<number>): void;
                }
            `
        });
    });
    it('prevails, emits properly for class expressions', async () => {
        await runSimple({
            code: `
                /**
                 * All types that relation can be.
                 */
                export const A = class {
                    private foo : number;
                }
            `
        });
    });
    it('prevails, emits properly for private properties', async () => {
        await runSimple({
            code: `
                export class A {
                    #foo : number;
                }
            `
        });
    });
    it('prevails, emits properly for grouped exports', async () => {
        await runSimple({
            code: `
                export {
                    foo,
                    Bar,
                    Foobar
                } from './registry.js';
            `,
            modules: {
                './registry.ts': `
                    export const foo = 123;
                    export class Bar {};
                    export type Foobar<T = any> = (data: any) => T | Promise<T>;
                `
            }
        });
    });
    it('prevails, emits properly for type alias', async () => {
        await runSimple({
            code: `
                export { HookExecutor } from './registry.js';
            `,
            modules: {
                './registry.ts': `
                    export type HookExecutor<Result> = string;
                `,
                './error.ts': `
                    export class HookError {}
                `
            }
        });
    });
    it('prevails, emits properly for exported variable', async () => {
        await runSimple({
            code: `
                export { foo } from './registry.js';
            `,
            modules: {
                './registry.ts': `
                    export const foo = 123;
                `
            }
        });
    });
    it('prevails, does not interfere with the name of a class expression', async () => {
        await runSimple({
            code: `
                export let A = class B { };
            `,
            checks: exports => {
                expect(exports.A.name).to.equal('B');
            }
        });
    });
    it('prevails, supports implicit naming of a class expression', async () => {
        await runSimple({
            code: `
                export let A = class { };
            `,
            checks: exports => {
                expect(exports.A.name).to.equal('A');
            }
        });
    });
    it('prevails, does not crush under the weight of a declared class', async () => {
        await runSimple({
            code: `
                declare class A {
                    foo() {

                    }

                    bar : number;
                }
            `
        });
    });
    it('prevails, does not crash for default class', async () => {
        await runSimple({
            code: `
                export default class IoC {
                    static resolve(a: string[]): number {
                        return 0
                    }
                }

                IoC.resolve(['text'])
            `
        });
    });
    it('prevails, does not crash for static property with initializer in ES5/CommonJS', async () => {
        // Filed as https://github.com/microsoft/TypeScript/issues/49794
        // Prevents us from using the builtin decorators array on nodes until fixed.
        // Targetted for fix in Typescript 4.8.
        await runSimple({
            moduleType: 'commonjs',
            target: ts.ScriptTarget.ES5,
            code: `
                class A {
                    static stuff = "things";
                }
            `
        });
    });
    it('doesn\'t explode on bare imports', async () => {
        await runSimple({
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
});