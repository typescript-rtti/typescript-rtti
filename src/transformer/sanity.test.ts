import { expect } from "chai";
import { describe } from "razmin";
import { runSimple } from "../runner.test";

describe('Sanity', it => {
    it('when function declarations appear in if statements', async () => {
        let exports = await runSimple({
            code: `
                export let foo = false;
                if (false) 
                    function a() { return 321; }
                else
                    foo = true;
            `
        });

        expect(exports.foo).to.equal(true);
    });
    it('when function declarations are named', async () => {
        let exports = await runSimple({
            code: `
                export let foo = false;
                function a() { return 321; }
                foo = a() === 321;
            `
        });

        expect(exports.foo).to.equal(true);
    });
    it('when function declarations appear in if statements (2)', async () => {
        let exports = await runSimple({
            code: `
                export let foo = false;
                if (true) 
                    function a() { return 321; }
                else
                    foo = true;

                export let bar = a();
                export let func = a;
            `
        });

        expect(exports.bar).to.equal(321);
    });
    it('when unnamed function expressions appear in property assignments', async () => {
        let exports = await runSimple({
            code: `
                export let foo = { bar: () => 123 };
            `
        });

        expect(exports.foo.bar.name).to.equal('bar');
    });
    it('when arrow functions appear in property assignments', async () => {
        let exports = await runSimple({
            code: `
                export let foo = { bar: () => 123 };
            `
        });

        expect(exports.foo.bar.name).to.equal('bar');
    });
    it('prevails, do not collapse exports', async () => {
        let exports = await runSimple({
            code: `
                export interface A { }
                export function B() { }
                export class C { foo() { } }
            `
        })

        expect(typeof exports.IΦA.identity).to.equal('symbol');
        expect(typeof exports.B).to.equal('function');
        expect(typeof exports.C).to.equal('function');
        expect(typeof exports.C.prototype.foo).to.equal('function');
    });
    it('prevails, do not crash on symbol methods', async () => {
        let exports = await runSimple({
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
            `
        })

        expect(new exports.A().foo()).to.equal('works');
    });
    it('prevails, do not crash on symbol methods from property access', async () => {
        let exports = await runSimple({
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
            `
        })

        expect(new exports.A().foo()).to.equal('works');
    });
    it('prevails, do not crash on exported symbol methods in CommonJS', async () => {
        let exports = await runSimple({
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
            `
        })

        expect(new exports.A().foo()).to.equal('works');
    });
    it('prevails, emits properly with a file containing only a type', async() => {
        await runSimple({
            code: `
                /**
                 * All types that relation can be.
                 */
                export type RelationType = "one-to-one"|"one-to-many"|"many-to-one"|"many-to-many";
            `
        });
    });
    it('prevails, emits properly for mapped types with no type params', async() => {
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
    it('prevails, emits properly for class expressions', async() => {
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
    it('prevails, emits properly for private properties', async() => {
        await runSimple({
            code: `
                export class A { 
                    #foo : number;
                }
            `
        });
    });
    it('prevails, emits properly for grouped exports', async() => {
        await runSimple({
            code: `
                export {
                    foo,
                    Bar,
                    Foobar
                } from './registry';
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
    it('prevails, emits properly for type alias', async() => {
        await runSimple({
            code: `
                export { HookExecutor } from './registry';
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
    it('prevails, emits properly for exported variable', async() => {
        await runSimple({
            code: `
                export { foo } from './registry';
            `,
            modules: {
                './registry.ts': `
                    export const foo = 123;
                `
            }
        });
    });
    it('prevails, does not interfere with the name of a class expression', async() => {
        let exports = await runSimple({
            code: `
                export let A = class B { };
            `
        });

        expect(exports.A.name).to.equal('B');
    });
    it('prevails, supports implicit naming of a class expression', async() => {
        let exports = await runSimple({
            code: `
                export let A = class { };
            `
        });

        expect(exports.A.name).to.equal('A');
    });
    it('prevails, does not crush under the weight of a declared class', async() => {
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
});