import 'reflect-metadata'
import { expect } from "chai";
import {describe, it, test, beforeAll} from "@jest/globals";
import {reflect, ReflectedClass} from "typescript-rtti";
import {TestStructure} from "../typia-repo/test/build/internal/TestStructure";
import * as fs from "node:fs";
import {fail} from "assert";

beforeAll( async () => {
    // Check that type info is available
    class A {}
    if(!isTypeInfoAvailable(A)) {
        throw new Error("Type info is not available. Please make sure this this test.ts file is transformed, before run.")
    }
});



describe("Test structures by typia", () => {
    const path: string = `${__dirname}/../typia-repo/test/src/structures`;
    for (const structureModuleFile of fs.readdirSync(path)) { // iterate all structure files
        if(!structureModuleFile.endsWith(".js")) {
            continue;
        }
        const name = structureModuleFile.substring(0, structureModuleFile.length - 3);
        test(name, async () => {
            const module = await import(`${path}/${structureModuleFile}`);
            const testStructure = module[name] as TestStructure<any>;
            let generate: (() => any) = testStructure.generate!

            // Bug workaround:
            //@ts-ignore
            generate = testStructure.workaround_redefined_generate
            if(generate === undefined) {
                throw new Error("workaround_redefined_generate not found. Make sure the files were patched with applyNamespaceBugPatches.js (run the script prepare:namespace_bug_workaround)");
            }

            const typeToTest = reflect(generate).returnType;
            let validValue = generate();
            expect(typeToTest.matchesValue(validValue)).to.be.true

            for(const spoil of testStructure.SPOILERS || []) {
                const value = generate();
                const diag_path = spoil(value); // Spoil it
                if(typeToTest.matchesValue(value)) {
                    fail(`The (spoiled) value ${JSON.stringify(value)} was not detected as invalid for type '${typeToTest.toString()}'. Hint: Spoiled by the following function:\n ${spoil.toString()}` )
                }
            }

            const i = 0;
        });
    }
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

