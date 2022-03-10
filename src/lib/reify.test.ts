import { expect } from "chai";
import { describe } from "razmin";
import { reify } from ".";
import { T_UNDEFINED, T_UNION, T_VOID } from "../common";

describe('reify<T>()', it => {
    it('extracts an InterfaceToken from a passed CallSite', () => {
        let IΦFoo = { name: 'Foo', prototype: {}, identity: Symbol('Foo (interface)') };
        expect(reify(<any>{ TΦ: 'c', tp: [ IΦFoo ]})).to.equal(IΦFoo);
    });

    it('is an error to call it with an invalid type', () => {
        function badCall(func: () => void) {
            let caughtError;
            try {
                func();
            } catch (e) {
                caughtError = e;
            }

            if (!caughtError)
                throw new Error(`Expected an exception when running: ${func.toString()}`);
        }

        badCall(() => reify(<any>{ TΦ: 'c', tp: [ { TΦ: T_UNION, e: [String,Number] } ]}));
        badCall(() => reify(<any>{ TΦ: 'c', tp: [ { TΦ: T_VOID } ]}));
        badCall(() => reify(<any>{ TΦ: 'c', tp: [ { TΦ: T_UNDEFINED } ]}));
    });
});