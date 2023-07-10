import { expect } from "chai";
import { describe, it } from "@jest/globals";
import { InterfaceToken, RtCallSite } from '../../common';
import { runSimple } from "../../runner.test-harness";
import { MODULE_TYPES } from "./module-types.test-harness";

describe('Imports', () => {
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
    it('does not modify import order', async () => {
        globalThis['test__imports'] = [];
        await runSimple({
            code: `
                import "./polyfills.js";
                import { reflect } from "./FΦtypescript-rtti.js";
                import foo from "./foo.js";
                export const callsite = reflect<foo>();
                export const order = globalThis['test__imports']
            `,
            modules: {
                './FΦtypescript-rtti.ts': `
                    export function reflect<T = any>(_?, callsite?) { return callsite };
                `,
                './foo.ts': `
                    globalThis['test__imports'] = \`\${globalThis['test__imports'] || ''}(foo)\`;
                    export default interface Foo { }
                `,
                './polyfills.ts': `
                    globalThis['test__imports'] = \`\${globalThis['test__imports'] || ''}(polyfills)\`;
                `
            },
            checks: exports => {
                expect(exports.order).to.equal('(polyfills)(foo)');

                let callsite: RtCallSite = exports.callsite;
                let interfaceToken = <InterfaceToken>callsite.tp[0];

                expect(interfaceToken.name).to.equal('Foo');
            },
        });
    });
    it('emits correctly for bound imports', async () => {
        await runSimple({
            code: `
                import { A } from "./lib.js";
                export { A };

                export class C {
                    method(hello : A) { return 123; }
                }
            `,
            modules: {
                './lib.ts': `
                    export class A { }
                `
            },
            checks: exports => {
                let params = Reflect.getMetadata('rt:p', exports.C.prototype, 'method');
                expect(params[0].t()).to.equal(exports.A);
            }
        });
    });
    it('emits correctly for star imports', async () => {
        await runSimple({
            code: `
                import * as lib from "./libf.js";
                export class C {
                    method(hello : lib.A) { return 123; }
                }
            `,
            modules: {
                './libf.ts': `
                    export class A { }
                `
            },
            checks: exports => {
                let params = Reflect.getMetadata('rt:p', exports.C.prototype, 'method');
                expect(params[0].t()).to.exist;
            }
        });
    });
    it.skip('emits correctly for interfaces when using namespace imports', async () => {
        class Foo {
            blah: number
        }

        await runSimple({
            code: `
                import type * as express from "express";
                export interface Event {
                    request: express.Request;
                    response: express.Response;
                }
            `,
            modules: {
                'express': { },
                '@types/express': `
                    export interface Request {
                        headers: string;
                    }

                    export interface Response {
                        headers: string;
                    }
                `
            },
            checks: exports => {
                let requestType = Reflect.getMetadata('rt:t', exports.IΦEvent.prototype, 'request')();
                let headersType = Reflect.getMetadata('rt:t', requestType.prototype, 'headers')();
                expect(headersType).to.eql(String);
            }
        });
    });
    it('emits correctly for classes imported via type import', async () => {
        await runSimple({
            code: `
                import type * as foo from "foo";
                export class C {
                    foo: foo.Foo;
                }
            `,
            modules: {
                'foo': {
                    Foo: class {
                        bar: number
                    }
                },
                '@types/foo': `
                    export class Foo {
                        bar: number;
                    }
                `
            },
            checks: exports => {
                let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'foo')();
                expect(type).to.eql({ TΦ: 'O', n: 'Foo', m: [ { n: 'bar', f: '', t: Number } ] });
            }
        });
    });
    it('emits correctly for interfaces imported via type import', async () => {
        await runSimple({
            code: `
                import type * as foo from "foo";
                export class C {
                    foo: foo.Foo;
                }
            `,
            modules: {
                'foo': {
                    IΦFoo: <InterfaceToken>{
                        name: 'Foo',
                        identity: Symbol('Foo (interface)'),
                        prototype: {}
                    }
                },
                '@types/foo': `
                    export interface Foo {
                        bar: number;
                    }
                `
            },
            checks: exports => {
                let type = Reflect.getMetadata('rt:t', exports.C.prototype, 'foo')();
                expect(type).to.eql({ TΦ: 'O', n: 'Foo', m: [ { n: 'bar', f: '', t: Number } ] });
            }
        });
    });
    it('can emit a class imported as default', async () => {
        await runSimple({
            code: `
                import A from "./foo.js";
                export { A };
                export class B {
                    constructor(hello : A) { }
                }
            `,
            modules: {
                './foo.ts': `
                    export default class A { }
                `
            },
            checks: exports => {
                let params = Reflect.getMetadata('rt:p', exports.B);

                expect(params.length).to.equal(1);
                expect(params[0].t()).to.equal(exports.A);
            }
        });
    });
    it('emits correctly for non-default re-export of a default export', async () => {
        await runSimple({
            code: `
                import { A } from "./libf.js";
                export function f(a : A) { }
                export { A } from "./libf.js";
            `,
            modules: {
                './libf.ts': `
                    export { default as A } from './a.js'
                `,
                './a.ts': `
                    export default class A {
                        method(hello : A) { return 123; }
                    }
                `
            },
            checks: exports => {
                let params = Reflect.getMetadata('rt:p', exports.f);
                expect(params[0].t()).to.equal(exports.A);
            }
        });
    });
});