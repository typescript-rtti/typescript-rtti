import ts from "typescript";
import { TypeImport } from "./common/type-import";

export interface InterfaceSymbol {
    interfaceDecl : ts.InterfaceDeclaration;
    symbolDecl: ts.Statement[]
}

export interface RttiContext {
    program : ts.Program;
    sourceFile : ts.SourceFile;
    checker : ts.TypeChecker;
    trace : boolean;
    throwOnFailure : boolean;
    transformationContext : ts.TransformationContext;
    importMap : Map<string, TypeImport>;
    typeMap : Map<number, ts.Expression>;
    freeImportReference : number;
    currentNameScope : ts.ClassDeclaration | ts.InterfaceDeclaration;
    emitStandardMetadata : boolean;
    interfaceSymbols : InterfaceSymbol[];
}