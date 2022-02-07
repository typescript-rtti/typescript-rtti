import { expect } from "chai";
import { describe } from "razmin";
import { reflect, ReflectedClass } from ".";
import { runSimple } from "../runner.test";

describe('ReflectedClass#matchesValue()', it => {
    it('works with simple interfaces', async () => {
        let exports = await runSimple({
            code: `
                export interface A {
                    foo : string;
                    bar : number;
                    baz : boolean;
                }
            `
        });

        expect(reflect(exports.IΦA).matchesValue({
            foo: 'hello',
            bar: 123,
            baz: true
        })).to.be.true;
        
        expect(reflect(exports.IΦA).matchesValue({
            foo: 1111,
            bar: 123,
            baz: true
        })).to.be.false;
    });
    it('supports literal types', async () => {
        let exports = await runSimple({
            code: `
                export interface A {
                    foo : 'hello';
                }
            `
        });

        expect(reflect(exports.IΦA).matchesValue({ foo: 'hello' })).to.be.true;
        expect(reflect(exports.IΦA).matchesValue({ foo: 'hello world' })).to.be.false;
    });
});