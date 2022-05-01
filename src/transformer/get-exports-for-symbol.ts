import * as ts from 'typescript';

import { externalModules, fileExists, getDefaultLikeExportInfo, getDirectoryPath, hasFilesystemAccess, ImportKind,
    isTypeOnlySymbol, skipAlias } from './utils';

interface SymbolExportInfo {
    readonly moduleSymbol: ts.Symbol;
    readonly importKind: ImportKind;
    /** If true, can't use an es6 import from a js file. */
    readonly exportedSymbolIsTypeOnly: boolean;
    /**
     * The symbol as exported from this module. When undefined, it means
     * it is the default export
     */
    readonly symbol: ts.Symbol;
    readonly sourceFile: ts.SourceFile;
}

export function getExportsForSymbol(
    program: ts.Program,
    importingFile: ts.SourceFile,
    symbol: ts.Symbol
): readonly SymbolExportInfo[] {
    const checker = program.getTypeChecker();
    const compilerOptions = program.getCompilerOptions();
    const result: SymbolExportInfo[] = [];
    let exportingModuleSymbol: ts.Symbol = symbol['parent'];

    for (let [moduleSymbol, moduleFile] of externalModules(program)) {
        let isRootDeclaration = moduleSymbol === exportingModuleSymbol;

        if (moduleFile === importingFile)
            continue;

        // Don't import from a re-export when looking "up" like to `./index` or `../index`.
        if (moduleFile && !isRootDeclaration && importingFile.fileName.startsWith(getDirectoryPath(moduleFile.fileName)))
            continue;

        const defaultInfo = getDefaultLikeExportInfo(importingFile, moduleSymbol, checker, compilerOptions);

        if (defaultInfo && skipAlias(defaultInfo.symbol, checker) === symbol) {
            result.push({
                moduleSymbol,
                importKind: defaultInfo.kind,
                exportedSymbolIsTypeOnly: isTypeOnlySymbol(defaultInfo.symbol, checker),
                symbol: undefined,
                sourceFile: moduleFile
            });
        }
        for (const exported of getExportsAndPropertiesOfModule(checker, moduleSymbol)) {
            if (skipAlias(exported, checker) === symbol) {
                result.push({
                    moduleSymbol,
                    importKind: ImportKind.Named,
                    exportedSymbolIsTypeOnly: isTypeOnlySymbol(exported, checker),
                    symbol: exported,
                    sourceFile: moduleFile
                });
            }
        }
    }

    return result;
}

/**
 * Locate the file that exports the given symbol which is a preferable place to import it.
 * @param program
 * @param importingFile
 * @param symbol
 */
export function getPreferredExportForImport(
    program: ts.Program,
    importingFile: ts.SourceFile,
    symbol: ts.Symbol
) {
    let exports = getExportsForSymbol(program, importingFile, symbol).slice();
    exports = exports.filter(x => x.sourceFile);
    exports.sort((a, b) => {
        return a.sourceFile.fileName.length - b.sourceFile.fileName.length;
    });

    // If it is possible, try to determine if this import has a corresponding JS file.
    // A good example of where this is important is for a package like:
    // package/
    //   lib/
    //     index.js <-- "main"/"module" entrypoint
    //   index.d.ts <-- "types" entrypoint
    //
    // Here, if we end up importing "package/import", it will fail at runtime since there is no "package/import.js".

    if (hasFilesystemAccess()) {
        exports = exports.filter(exp => {
            if (exp.sourceFile.fileName.endsWith('.d.ts')) {
                let jsFile = exp.sourceFile.fileName.replace(/\.d\.ts$/, '.js');
                if (!fileExists(jsFile))
                    return false;
            }

            return true;
        });
    }

    // console.log(`Found ${exports.length} viable exports for symbol ${symbol.name}:`);
    // for (let exp of exports) {
    //     console.log(` - ${exp.sourceFile.fileName}`);
    // }

    return exports[0];
}

function getExportsAndPropertiesOfModule(checker: ts.TypeChecker, moduleSymbol: ts.Symbol): ts.Symbol[] {
    return checker['getExportsAndPropertiesOfModule'](moduleSymbol);
}