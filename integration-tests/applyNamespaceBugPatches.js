//*****
// Bug workaround for: https://github.com/typescript-rtti/typescript-rtti/issues/118


const fs = require("node:fs");

let patchStartMarker = "/*START_PATCH*/";
let patchEndMarker = "/*END_PATCH*/\n  ";
const patchLines=patchStartMarker + "\n" +
    "  // Patch, applied by typescript-rtti/integration-tests/applyNamespaceBugPatches.js\n" +
    "  // To remove these patches, run the `clean` script from typescript-rtti/integration-tests/package.json \n" +
    "  // Workaround: The transformer does not include the generate function in the exports. Therefore we must list it again:\n" +
    "  export const workaround_redefined_generate = generate;\n" +
    "  " + patchEndMarker;


const path = `${__dirname}/typia-repo/test/src/structures`;
let counter = 0;
for (const structureModuleFile of fs.readdirSync(path)) { // iterate all structure files
    if (!structureModuleFile.endsWith(".ts")) {
        continue;
    }
    let absoluteFile = `${path}/${structureModuleFile}`;
    let fileContents = fs.readFileSync(absoluteFile, {encoding: "utf8"});

    // Remove old patch first
    /\/\*START_PATCH\*\/.*\/\*END_PATCH\*\/\n  /g
    const patchedRegExp = new RegExp(escapeRegExp(patchStartMarker) + ".*" + escapeRegExp(patchEndMarker),"gs");
    fileContents = fileContents.replaceAll(patchedRegExp, "");

    if(process.argv.some((s) => s =="--clean")) { // --clean arg ?
    }
    else {
        // Install new patch:
        const insertionPlace = "export const SPOILERS";
        if (! (fileContents.indexOf(insertionPlace) > -1)) {
            console.warn(`warning Marker string for insertion '${insertionPlace}' not found in file ${absoluteFile}`);
        }
        fileContents = fileContents.replaceAll(insertionPlace, patchLines + insertionPlace);
    }

    fs.writeFileSync(absoluteFile, fileContents, {encoding: "utf8"});
    counter++;
}

console.log(`${counter} files patched`)


function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}
