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
});