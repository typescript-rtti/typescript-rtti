import { expect } from "chai";
import { describe, it } from "@jest/globals";
import { runSimple } from "../../runner.test-harness";
import { MODULE_TYPES } from "./module-types.test-harness";
import { reify } from '../../lib';

describe('API transformations', () => {
    describe(': reify<T>()', () => {
        it.skip('will resolve to the interface symbol generated in the same file', async () => {
            // let exports = await runSimple({
            //     code: `
            //         import { reify } from 'typescript-rtti';
            //         export interface Foo { }
            //         export const ReifiedFoo = reify<Foo>();
            //     `,
            //     modules: {
            //         "typescript-rtti": { reify }
            //     }
            // });

            // let identity = exports.IΦFoo.identity;

            // expect(typeof identity).to.equal('symbol');
            // expect(exports.IΦFoo).to.eql({ name: 'Foo', prototype: {}, identity });
            // expect(exports.ReifiedFoo).to.equal(exports.IΦFoo);
        });
        for (let moduleType of MODULE_TYPES) {
            if (moduleType !== 'esm') continue;
            describe(` [${moduleType}]`, () => {
                it.skip('will resolve to the interface symbol generated in another file', async () => {
                    // let exports = await runSimple({
                    //     moduleType: moduleType,
                    //     code: `
                    //         import { reify } from 'typescript-rtti';
                    //         import { Foo } from "./another";
                    //         export const ReifiedFoo = reify<Foo>();
                    //     `,
                    //     modules: {
                    //         "typescript-rtti": { reify: callSite => callSite.tp[0] },
                    //         "./another.ts": `
                    //             export interface Foo {}
                    //         `
                    //     }
                    // });
                    // expect(exports.ReifiedFoo.name).to.equal('Foo');
                    // expect(exports.ReifiedFoo.prototype).to.exist;
                    // expect(exports.ReifiedFoo.identity).to.exist;
                });
                it('will error at runtime if the imported interface has no type metadata', async () => {
                    // let exports = await runSimple({
                    //     moduleType: moduleType,
                    //     code: `
                    //         import { reify } from 'typescript-rtti';
                    //         import { Foo } from "another2";

                    //         export function a() {
                    //             return reify<Foo>();
                    //         }
                    //     `,
                    //     modules: {
                    //         "typescript-rtti": {
                    //             reify
                    //         },
                    //         "another2": {}
                    //     }
                    // });

                    // let caughtError;
                    // try {
                    //     exports.a();
                    // } catch (e) {
                    //     caughtError = e;
                    // }
                    // expect(caughtError).to.exist;
                });
            });
        }
    });
});

