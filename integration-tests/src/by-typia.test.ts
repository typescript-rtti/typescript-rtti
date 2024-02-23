import 'reflect-metadata'
import { expect } from "chai";
import { describe, it,test, beforeAll} from "@jest/globals";
import {reflect, ReflectedClass} from "typescript-rtti";
import {load} from "../typia-repo/test/build/template";
import {TestStructure} from "../typia-repo/test/build/internal/TestStructure";

/**
 * Cause describe can only run sync code, these must be loaded async beforehand
 */
let loadedTestStructures: TestStructure<any>[]
beforeAll( async () => {
    // Check that type info is available
    class A {}
    if(!isTypeInfoAvailable(A)) {
        throw new Error("Type info is not available. Please make sure this this test.ts file is transformed, before run.")
    }

    loadedTestStructures = await load();
});



describe("Test structures by typia", () => {
    loadedTestStructures.forEach(testStructure => {
        test(testStructure.name, async () => {});
    })
});




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

