import ts from "typescript";

export interface InterfaceSymbol {
    interfaceDecl: ts.InterfaceDeclaration;
    symbolDecl: ts.Statement[];
}

export interface RttiSettings {
    trace?: boolean;
    throwOnFailure?: boolean;

    /**
     * Whether to omit the members of library types (ie String, Number).
     * This defaults to true, because emitting detailed type information for the standard library significantly
     * increases the compilation time and output size.
     */
    omitLibTypeMetadata?: boolean;
}

export interface RttiContext {
    settings: RttiSettings;
    program: ts.Program;
    sourceFile: ts.SourceFile;
    checker: ts.TypeChecker;
    transformationContext: ts.TransformationContext;
    typeMap: Map<number, ts.Expression>;
    currentNameScope: ts.ClassDeclaration | ts.ClassExpression | ts.EnumDeclaration;
    interfaceSymbols: InterfaceSymbol[];
    pkgJsonMap: Map<string, any>;
    currentTopStatement?: ts.Statement;
    locationHint?: string;
}