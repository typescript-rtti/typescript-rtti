import { expect } from "chai";
import { describe } from "razmin";
import { runSimple } from "../../runner.test";
import { MODULE_TYPES } from "./module-types.test";

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
                let exports = await runSimple({
                    moduleType,
                    code: `
                        import { A } from "./lib";
                        export { A };

                        export class C {
                            method(hello : A) { return 123; }
                        }
                    `,
                    modules: {
                        './lib.ts': `
                            export class A { }
                        `
                    }
                });
        
                let params = Reflect.getMetadata('rt:p', exports.C.prototype, 'method');
                expect(params[0].t()).to.equal(exports.A);
            });
            it('emits correctly for star imports', async () => {
                let exports = await runSimple({
                    moduleType,
                    code: `
                        import * as lib from "./libf";
                        export class C {
                            method(hello : lib.A) { return 123; }
                        }
                    `, 
                    modules: {
                        './libf.ts': `
                            export class A { }
                        `
                    }
                });
        
                let params = Reflect.getMetadata('rt:p', exports.C.prototype, 'method');
                expect(params[0].t()).to.exist;
            });
            it('can emit a class imported as default', async () => {
                let exports = await runSimple({
                    moduleType,
                    code: `
                        import A from "./foo";
                        export { A };
                        export class B {
                            constructor(hello : A) { }
                        }
                    `,
                    modules: {
                        './foo.ts': `
                            export default class A { } 
                        `
                    }
                });

                let params = Reflect.getMetadata('rt:p', exports.B);

                expect(params.length).to.equal(1);
                expect(params[0].t()).to.equal(exports.A);
            });
            it.only('emits correctly for non-default re-export of a default export', async () => {
                let exports = await runSimple({
                    trace: true,
                    moduleType,
                    code: `
                        import { A } from "./libf";
                        export function f(a : A) { }
                        export { A } from "./libf";
                    `, 
                    modules: {
                        './libf.ts': `
                            export { default as A } from './a'
                        `,
                        './a.ts': `
                            export default class A {
                                method(hello : lib.A) { return 123; }
                            }
                        `
                    }
                });
        
                let params = Reflect.getMetadata('rt:p', exports.f);
                expect(params[0].t()).to.equal(exports.A);
            });
        });
    }
});