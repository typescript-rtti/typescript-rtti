import { expect } from "chai";
import { describe, it } from "@jest/globals";
import { runSimple } from "../../runner.test-harness";
import { reflect } from '../../lib';

describe('Transformer: Generic transience', () => {
    it('stuffs undefined on call args when needed', async () => {
        await runSimple({
            compilerOptions: {
                declaration: true
            },
            code: `
                import { reflect, CallSite } from 'typescript-rtti';
                export function a<T>(foo? : number, call? : CallSite) {
                    return call;
                }

                export function b() {
                    return a<String>();
                }
            `,
            modules: {
                'typescript-rtti': {
                    reflect: () => { }
                }
            },
            checks: exports => {
                expect(exports.b()).to.eql({
                    TΦ: 'c',
                    t: undefined,
                    p: [],
                    r: undefined,
                    tp: [String],
                });
            }
        });
    });
    it('is supported at the top level', async () => {
        await runSimple({
            compilerOptions: {
                declaration: true
            },
            code: `
                import { CallSite } from 'typescript-rtti';
                export function a<T>(foo? : number, call? : CallSite) {
                    return call;
                }

                export const t = a<String>();
            `,
            modules: {
                'typescript-rtti': {}
            },
            checks: exports => {
                expect(exports.t).to.eql({
                    TΦ: 'c',
                    t: undefined,
                    p: [],
                    r: undefined,
                    tp: [String],
                });
            }
        });
    });
    it('is supported in function calls', async () => {
        await runSimple({
            compilerOptions: {
                declaration: true
            },
            code: `
                import { CallSite } from 'typescript-rtti';
                export function a<T>(foo? : number, call? : CallSite) {
                    return call;
                }

                function wrap(t) { return t; }
                export const t = wrap(a<String>());
            `,
            modules: {
                'typescript-rtti': {}
            },
            checks: exports => {
                expect(exports.t).to.eql({
                    TΦ: 'c',
                    t: undefined,
                    p: [],
                    r: undefined,
                    tp: [String],
                });
            }
        });
    });
    it('reflects generic transience via JSDoc', async () => {
        await runSimple({
            compilerOptions: {
                declaration: true
            },
            code: `
                import { reflect, CallSite } from 'typescript-rtti';

                /**
                 * @rtti:callsite 1
                 */
                export function a<T>(foo : number, call?) {
                    return call;
                }

                export function b() {
                    return a<String>(123);
                }
            `,
            modules: {
                'typescript-rtti': {
                    reflect: () => { }
                }
            },
            checks: exports => {
                expect(exports.b()).to.eql({
                    TΦ: 'c',
                    t: undefined,
                    p: [123],
                    r: undefined,
                    tp: [String],
                });
            }
        });
    });
    it('reflects generic transience via JSDoc with other JSDoc', async () => {
        await runSimple({
            compilerOptions: {
                declaration: true
            },
            code: `
                import { reflect, CallSite } from 'typescript-rtti';

                /**
                 * This is the thing
                 *
                 * @param foo {string}
                 * @foo 123
                 * @rtti:callsite 1
                 */
                export function a<T>(foo : number, call?) {
                    return call;
                }

                export function b() {
                    return a<String>(123);
                }
            `,
            modules: {
                'typescript-rtti': {
                    reflect: () => { }
                }
            },
            checks: exports => {
                expect(exports.b()).to.eql({
                    TΦ: 'c',
                    t: undefined,
                    p: [123],
                    r: undefined,
                    tp: [String],
                });
            }
        });
    });
    it('reflects generic transience via call-site reflection on function declarations', async () => {
        await runSimple({
            compilerOptions: {
                declaration: true
            },
            code: `
                import { reflect, CallSite } from 'typescript-rtti';
                export function a<T>(foo : number, call? : CallSite) {
                    return call;
                }

                export function b() {
                    return a<String>(123);
                }
            `,
            modules: {
                'typescript-rtti': {
                    reflect: () => { }
                }
            },
            checks: exports => {
                expect(exports.b()).to.eql({
                    TΦ: 'c',
                    t: undefined,
                    p: [123],
                    r: undefined,
                    tp: [String],
                });
            }
        });
    });
    it('reflects nsted generic transience via call-site reflection on function expressions', async () => {
        await runSimple({
            compilerOptions: {
                declaration: true
            },
            code: `
                import { reflect, CallSite } from 'typescript-rtti';
                let a = (function<T>(foo : number, call? : CallSite) {
                    return call;
                });

                let b = (function<T>(foo : number, call? : CallSite) {
                    return a<T>(123);
                });

                export function c() {
                    return b<String>(123);
                }
            `,
            modules: {
                'typescript-rtti': {
                    reflect: () => { }
                }
            },
            checks: exports => {
                expect(exports.c()).to.eql({
                    TΦ: 'c',
                    t: undefined,
                    p: [123],
                    r: undefined,
                    tp: [String],
                });
            }
        });
    });
    it('reflects nested generic transience via call-site reflection on arrow functions', async () => {
        await runSimple({
            compilerOptions: {
                declaration: true
            },
            code: `
                import { reflect, CallSite } from 'typescript-rtti';
                let a = (<T>(foo : number, call? : CallSite) => {
                    return call;
                });

                let b = (<T>(foo : number, call? : CallSite) => {
                    return a<T>(foo);
                });

                export function c() {
                    return b<String>(123);
                }
            `,
            modules: {
                'typescript-rtti': {
                    reflect: () => { }
                }
            },
            checks: exports => {
                expect(exports.c()).to.eql({
                    TΦ: 'c',
                    t: undefined,
                    p: [Number],
                    r: undefined,
                    tp: [String],
                });
            }
        });
    });
    it('reflects generic transience to reflect<T>()', async () => {
        await runSimple({
            compilerOptions: {
                declaration: true
            },
            code: `
                import { reflect, CallSite } from 'typescript-rtti';
                export function a<T>(call? : CallSite) {
                    return reflect<T>();
                }

                export function b() {
                    return a<String>();
                }
            `,
            modules: {
                'typescript-rtti': {
                    reflect: (_, callsite) => callsite
                }
            },
            checks: exports => {
                expect(exports.b().tp[0]).to.equal(String);
            }
        });
    });
    it('reflects nested generic transience via call-site reflection on methods', async () => {
        await runSimple({
            compilerOptions: {
                declaration: true
            },
            code: `
                import { reflect, CallSite } from 'typescript-rtti';

                class A {
                    foo<T>(foo : number, call? : CallSite) {
                        return call;
                    }
                }

                class B {
                    bar<T>(foo : number, call? : CallSite) {
                        let a = new A();
                        return a.foo<T>(foo);
                    }
                }

                export function c() {
                    return new B().bar<String>(123);
                }
            `,
            modules: {
                'typescript-rtti': {
                    reflect: () => { }
                }
            },
            checks: exports => {
                expect(exports.c()).to.eql({
                    TΦ: 'c',
                    t: undefined,
                    p: [Number],
                    r: undefined,
                    tp: [String],
                });
            }
        });
    });
    it('does not output call-site metadata unless opted in', async () => {
        await runSimple({
            compilerOptions: {
                declaration: true
            },
            code: `
                import { reflect, CallSite } from 'typescript-rtti';
                export function a<T>(foo : number) {
                    return arguments.length;
                }

                export function b() {
                    return a<String>(123);
                }
            `,
            modules: {
                'typescript-rtti': {
                    reflect: () => { }
                }
            },
            checks: exports => {
                expect(exports.b()).to.equal(1);
            }
        });
    });
    it('passes nested call site information', async () => {
        await runSimple({
            compilerOptions: {
                declaration: true
            },
            code: `
                import { reflect, CallSite } from 'typescript-rtti';

                export function a<T>(foo : number, call? : CallSite) {
                    return call;
                }

                export function b<T>(foo : number, call? : CallSite) {
                    return a<T>(foo);
                }

                export function c() {
                    return b<String>(123);
                }
            `,
            modules: {
                'typescript-rtti': {
                    reflect: () => { }
                }
            },
            checks: exports => {
                expect(exports.c()).to.eql({
                    TΦ: 'c',
                    t: undefined,
                    p: [Number],
                    r: undefined,
                    tp: [String],
                });
            }
        });
    });
    it('does not pass nested call site information without opting in', async () => {
        await runSimple({
            compilerOptions: {
                declaration: true
            },
            code: `
                import { reflect, CallSite } from 'typescript-rtti';

                export function a<T>(foo : number, call? : CallSite) {
                    return call;
                }

                export function b<T>(foo : number) {
                    return a<T>(foo);
                }

                export function c() {
                    return b<String>(123);
                }
            `,
            modules: {
                'typescript-rtti': {
                    reflect: () => { }
                }
            },
            checks: exports => {
                expect(exports.c()).to.eql({
                    TΦ: 'c',
                    t: undefined,
                    p: [Number],
                    r: undefined,
                    tp: [Object],
                });
            }
        });
    });
});