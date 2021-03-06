import { describe } from "razmin";
import { expect } from "chai";
import { ReflectedClass } from "./reflect";

describe('ReflectedClass', it => {
    it('can reflect constructor parameters', () => {
        class A {
            constructor(a : number, b : string) { }
        }

        Reflect.defineMetadata('rt:p', [{n: 'a', t: () => Number}, {n: 'b', t: () => String}], A);
        let refClass = new ReflectedClass(A);

        expect(refClass.parameters.length).to.equal(2);

        let [a, b] = refClass.parameters;
        expect(a.type).to.equal(Number);
        expect(a.name).to.equal('a');
        expect(b.type).to.equal(String);
        expect(b.name).to.equal('b');
    });
});