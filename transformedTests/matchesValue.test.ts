import 'reflect-metadata'
import { expect } from "chai";
import { describe, it,test } from "@jest/globals";
import {reflect} from "typescript-rtti";

describe("general", () => {
   test("Type info is available", () => {
       class A {}

       expect(isTypeInfoAvailable(A)).to.be.true
   })
});

describe("matches value", () => {
    it("should match a simple object", () => {
        expect(reflect({}).matchesValue({})).to.be.true
    })
})


function isTypeInfoAvailable(value: object) {
    const r = reflect(value);

    // *** Some heuristic checks: (the rtti api currently has no really good way to check it)
    // TODO: improve checks for security reasons !

    /*
    if(r.methods.length === 0) {
        return false;
    }
    // Still this check was not enough because we received  the methods of the prototype
    */

    if (r.getProperty("xxyyyyzzzzzdoesntExist") !== undefined) { // non existing property reported as existing ?
        return false;
    }

    return true
}
