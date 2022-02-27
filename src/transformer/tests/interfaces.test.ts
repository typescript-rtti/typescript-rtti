import { expect } from "chai";
import { describe } from "razmin";
import { runSimple } from "../../runner.test";
import { T_UNION } from "../flags";
import { reflect } from '../../lib';

describe('Interface tokens', it => {
    it('are emitted for exported interfaces', async () => {
        let exports = await runSimple({
            code: `
                export interface Foo { }
            `
        });

        expect(typeof exports.IΦFoo).to.equal('object');
        expect(typeof exports.IΦFoo.identity).to.equal('symbol');
    });
    it('should matchValue() correctly', async () => {
        let exports = await runSimple({
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
            }
        });

        if (!exports.trueResult) {
            console.log(`Expected matchValues() to return true, not false. Errors were: ${JSON.stringify(exports.trueErrors)}`);
        }
        expect(exports.trueResult).to.be.true;
        expect(exports.falseResult).to.be.false;
    });
    it('are emitted for non-exported interfaces', async () => {
        let exports = await runSimple({
            code: `
                interface Foo { }
            `
        });
        expect(exports.IΦFoo).not.to.exist;
    });
    it('collect type metadata', async () => {
        let exports = await runSimple({
            code: `
                export interface Foo { 
                    method(foo : number): boolean;
                    field : string;
                    blah : string | number;
                }
            `
        });

        expect(Reflect.getMetadata('rt:t', exports.IΦFoo.prototype, 'method')()).to.equal(Boolean);
        expect(Reflect.getMetadata('rt:t', exports.IΦFoo.prototype, 'field')()).to.equal(String);
        expect(Reflect.getMetadata('rt:t', exports.IΦFoo.prototype, 'blah')().TΦ).to.equal(T_UNION);
        expect(Reflect.getMetadata('rt:t', exports.IΦFoo.prototype, 'blah')().t).to.include.all.members([String, Number]);
        expect(Reflect.getMetadata('rt:p', exports.IΦFoo.prototype, 'method')[0].n).to.equal('foo');
        expect(Reflect.getMetadata('rt:p', exports.IΦFoo.prototype, 'method')[0].t()).to.equal(Number);
        expect(Reflect.getMetadata('rt:P', exports.IΦFoo)).to.eql(['field', 'blah']);
        expect(Reflect.getMetadata('rt:m', exports.IΦFoo)).to.eql(['method']);
    });
});