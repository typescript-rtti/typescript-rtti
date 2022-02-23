import { expect } from "chai";
import { describe } from "razmin";
import { runSimple } from "../../runner.test";
import { MODULE_TYPES } from "./module-types.test";

describe('API transformations', it => {
    describe(': reify<T>()', it => {
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
});

