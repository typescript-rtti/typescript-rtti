import { expect } from "chai";
import { describe } from "razmin";
import { reflect, ReflectedClass } from ".";

describe('ReflectedClass#matchesValue()', it => {
    it.only('works with simple interfaces', async () => {
        let IΦA = { name: 'A', prototype: {}, identity: Symbol('A (interface)') };

        Reflect.defineMetadata('rt:P', ['foo', 'bar', 'baz'], IΦA);
        Reflect.defineMetadata('rt:t', () => String, IΦA.prototype, 'foo');
        Reflect.defineMetadata('rt:t', () => Number, IΦA.prototype, 'bar');
        Reflect.defineMetadata('rt:t', () => Boolean, IΦA.prototype, 'baz');

        expect(reflect(IΦA).matchesValue({
            foo: 'hello',
            bar: 123,
            baz: true
        })).to.be.true;
        
        expect(reflect(IΦA).matchesValue({
            foo: 1111,
            bar: 123,
            baz: true
        })).to.be.false;
    });
    it.only('supports literal types', async () => {
        const IΦA = { name: 'A', prototype: {}, identity: Symbol('A (interface)')};
        
        Reflect.defineMetadata('rt:P', ['foo'], IΦA);
        Reflect.defineMetadata('rt:t', () => 'hello', IΦA.prototype, 'foo');
        expect(reflect(IΦA).matchesValue({ foo: 'hello' })).to.be.true;
        expect(reflect(IΦA).matchesValue({ foo: 'hello world' })).to.be.false;
    });
});