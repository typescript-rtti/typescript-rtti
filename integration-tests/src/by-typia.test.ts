import 'reflect-metadata'
import { expect } from "chai";
import {describe, it, test, beforeAll, beforeEach} from "@jest/globals";
import {reflect, ReflectedClass} from "typescript-rtti";
import {TestStructure} from "../typia-repo/test/build/internal/TestStructure";
import fs from "node:fs";

/**
 * Cause describe can only run sync code, these must be loaded async beforehand
 */
let loadedTestStructures: TestStructure<any>[] | undefined = undefined;
beforeAll( async () => {
    // Check that type info is available
    class A {}
    if(!isTypeInfoAvailable(A)) {
        throw new Error("Type info is not available. Please make sure this this test.ts file is transformed, before run.")
    }

    /**
     * from ../typia-repo/test/build/template.ts
     */
    async function loadTestStructures(): Promise<TestStructure<any>[]> {
        const path: string = `../typia-repo/test/src/structures`;
        const output: TestStructure<any>[] = [];

        for (const file of await fs.promises.readdir(path)) {
            const location: string = `${path}/${file}`;
            const modulo: Record<string, TestStructure<any>> = await import(location);
            output.push({
                ...Object.values(modulo)[0],
                name: file.substring(0, file.length - 3),
            });
        }
        return output;
    }

    loadedTestStructures = await loadTestStructures();
});



describe("Test structures by typia", () => {
    loadedTestStructures!.forEach(testStructure => {
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

