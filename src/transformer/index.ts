/// <reference types="reflect-metadata" />
/**
 * RTTI Transformer
 *
 * This Typescript transformer does two things:
 * 1. When emitDecoratorMetadata is enabled, this emits Typescript's "design:*" metadata on all syntactic
 *    elements processed during a compilation, regardless of whether a decorator is originally present on the element.
 *    NOTE: You may not want this, because design:* has a number of flaws. If you disable emitDecoratorMetadata this
 *    transformer will still output the rt:* metadata items instead.
 * 2. Emits "rt:*" metadata on each syntactic element which describes compile-time semantics of an element,
 *    which encodes element type, public, private, protected, abstract, readonly, async, optional, lists of
 *    method names and property names for classes, and lists of parameter names, types, and modifiers for methods
 *    and classes (ie constructors).
 *
 * - The "rt:f" metadata item holds a string of flags, where each character indicates the positive presence of a flag.
 *   For the list of available flags, see src/common/flags.ts
 * - The "rt:i" metadata item contains an array of type references which point to interface objects representing the
 *   interfaces found in the "implements" clause of a class
 * - The "rt:t" metadata item represents the "type" of an item. This is the type of a property, the return type of a method,
 *   or Function in the case of a class (similar to "design:type" for a class).
 * - The "rt:p" metadata item represents parameters of a method or a class (ie constructor). It is an array of objects which
 *   each have n (name : string), t (type : Function), and optionally f (flags : string) options. The meaning of flags is
 *   as above.
 * - The "rt:P" metadata item represents an array of property names
 * - The "rt:m" metadata item represents an array of method names
 * - The "rt:SP" metadata item represents an array of static property names
 * - The "rt:Sm" metadata item represents an array of static method names
 * - The "rt:h" metadata item represents the "host" of the element. For methods, this is the class constructor
 *   or interface token of the enclosing class/interface.
 *
 */

import { rtStore } from './rt-helper';
import * as ts from 'typescript';
import { ImportAnalyzer } from './common/import-analyzer';
import { CompileError } from './common/compile-error';
import { RttiContext } from './rtti-context';
import { ApiCallTransformer } from './api-call-transformer';
import { MetadataEmitter } from './metadata-emitter';
import { DeclarationsEmitter } from './declarations-emitter';

export interface RttiSettings {
    trace?: boolean;
    throwOnFailure?: boolean;
}

const transformer: (program: ts.Program) => ts.TransformerFactory<ts.SourceFile> = (program: ts.Program) => {
    let compilerOptions = program.getCompilerOptions();

    if (typeof compilerOptions['rtti$emitStandardMetadata'] === 'undefined') {
        let emitDecoratorMetadata = compilerOptions.emitDecoratorMetadata;
        compilerOptions['rtti$emitStandardMetadata'] = emitDecoratorMetadata;
        compilerOptions.emitDecoratorMetadata = false;
    }

    let emitStandardMetadata = <boolean>compilerOptions['rtti$emitStandardMetadata'];

    if (globalThis.RTTI_TRACE)
        console.log(`RTTI: Entering program [emitDecoratorMetadata=${emitStandardMetadata}]`);

    // Share a package.json cache across the whole program
    let pkgJsonMap = new Map<string, any>();

    const rttiTransformer: ts.TransformerFactory<ts.SourceFile> = (context: ts.TransformationContext) => {
        let settings = <RttiSettings>context.getCompilerOptions().rtti;

        if (globalThis.RTTI_TRACE)
            console.log(`RTTI: Transformer setup`);

        return sourceFile => {

            if (globalThis.RTTI_TRACE)
                console.log(`RTTI: Transforming '${sourceFile.fileName}'`);

            let ctx: RttiContext = {
                program,
                checker: program.getTypeChecker(),
                currentNameScope: undefined,
                freeImportReference: 0,
                importMap: new Map(),
                sourceFile,
                trace: settings?.trace ?? false,
                throwOnFailure: settings?.throwOnFailure ?? false,
                transformationContext: context,
                typeMap: new Map<number, ts.Expression>(),
                pkgJsonMap,
                emitStandardMetadata,
                currentTopStatement: undefined,
                interfaceSymbols: []
            };

            ImportAnalyzer.analyze(sourceFile, ctx);

            if (sourceFile.isDeclarationFile || sourceFile.fileName.endsWith('.d.ts')) {
                if (ctx.trace)
                    console.log(`#### Processing declaration ${sourceFile.fileName}`);
                return DeclarationsEmitter.emit(sourceFile, ctx);
            }

            if (ctx.trace)
                console.log(`#### Processing ${sourceFile.fileName}`);

            globalThis.RTTI_TRACE = ctx.trace;
            globalThis.RTTI_THROW_ON_FAILURE = ctx.throwOnFailure;

            //////////////////////////////////////////////////////////
            // Transform reflect<T>() and reify<T>()

            sourceFile = ApiCallTransformer.transform(sourceFile, ctx);

            function generateInterfaceSymbols(statements: ts.Statement[]): ts.Statement[] {
                for (let iface of ctx.interfaceSymbols) {
                    let impoIndex = statements.indexOf(iface.interfaceDecl);
                    if (impoIndex >= 0) {
                        statements.splice(impoIndex, 0, ...iface.symbolDecl);
                    } else {
                        statements.push(...iface.symbolDecl);
                    }

                }

                return statements;
            }

            function generateImports(statements: ts.Statement[]): ts.Statement[] {
                let imports: ts.ImportDeclaration[] = [];
                let isCommonJS = context.getCompilerOptions().module === ts.ModuleKind.CommonJS;

                let statementTransforms = new Map<ts.Statement, ts.Statement>();
                for (let statement of statements)
                    statementTransforms.set(<ts.Statement>ts.getOriginalNode(statement), statement);

                for (let impo of ctx.importMap.values()) {
                    if (!impo.referenced)
                        continue;

                    if (ctx.trace)
                        console.log(`RTTI: Generating owned import for '${impo.modulePath}'`);

                    let ownedImpo: ts.Statement;

                    if (impo.isDefault) {
                        if (isCommonJS) {
                            // Typescript's conversion of default imports to CommonJS causes default imports get
                            // renamed without changing the corresponding references, so we need to output a
                            // literal `require()` statement here
                            ownedImpo = ts.factory.createVariableStatement(
                                undefined,
                                ts.factory.createVariableDeclarationList(
                                    [ts.factory.createVariableDeclaration(
                                        ts.factory.createIdentifier(impo.localName),
                                        undefined,
                                        undefined,
                                        ts.factory.createPropertyAccessExpression(
                                            ts.factory.createCallExpression(
                                                ts.factory.createIdentifier("require"),
                                                undefined,
                                                [ts.factory.createStringLiteral(impo.modulePath)]
                                            ),
                                            ts.factory.createIdentifier("default")
                                        )
                                    )],
                                    ts.NodeFlags.None
                                )
                            )
                        } else {
                            ownedImpo = ts.factory.createImportDeclaration(
                                undefined,
                                undefined,
                                ts.factory.createImportClause(
                                    false, ts.factory.createIdentifier(impo.localName),
                                    undefined
                                ),
                                ts.factory.createStringLiteral(impo.modulePath),
                                undefined
                            );
                        }
                    } else {
                        ownedImpo = ts.factory.createImportDeclaration(
                            undefined,
                            undefined,
                            ts.factory.createImportClause(
                                false, undefined,

                                impo.isNamespace
                                    ? ts.factory.createNamespaceImport(ts.factory.createIdentifier(impo.localName))
                                    : ts.factory.createNamedImports(
                                        [
                                            ts.factory.createImportSpecifier(
                                                false,
                                                ts.factory.createIdentifier(impo.refName),
                                                ts.factory.createIdentifier(impo.localName)
                                            )
                                        ]
                                    )
                            ),
                            ts.factory.createStringLiteral(impo.modulePath)
                        );
                    }

                    let impoIndex = -1;
                    if (impo.importDeclaration) {
                        let original = statementTransforms.get(impo.importDeclaration) ?? impo.importDeclaration;
                        impoIndex = statements.indexOf(original);
                        if (impoIndex < 0)
                            impoIndex = statements.indexOf(impo.importDeclaration);
                    }

                    if (impoIndex >= 0) {
                        statements.splice(impoIndex, 0, ownedImpo);
                    } else {
                        statements.splice(0, 0, ownedImpo);
                    }
                }

                return statements;
            }

            try {
                sourceFile = MetadataEmitter.emit(sourceFile, ctx);
                sourceFile = ts.factory.updateSourceFile(
                    sourceFile,
                    [
                        ...generateInterfaceSymbols(generateImports(Array.from(sourceFile.statements))),
                    ],
                    sourceFile.isDeclarationFile,
                    sourceFile.referencedFiles,
                    sourceFile.typeReferenceDirectives,
                    sourceFile.hasNoDefaultLib,
                    sourceFile.libReferenceDirectives
                );
            } catch (e) {
                if (e instanceof CompileError)
                    throw e;

                console.error(`RTTI: Failed to build source file ${sourceFile.fileName}: ${e.message} [please report]`);
                console.error(e);

                if (globalThis.RTTI_THROW_ON_FAILURE)
                    throw e;
            }

            sourceFile = ts.factory.updateSourceFile(
                sourceFile,
                [rtStore(ctx.typeMap), ...sourceFile.statements],
                sourceFile.isDeclarationFile,
                sourceFile.referencedFiles,
                sourceFile.typeReferenceDirectives,
                sourceFile.hasNoDefaultLib,
                sourceFile.libReferenceDirectives
            );

            if (globalThis.RTTI_TRACE)
                console.log(`RTTI: Finished transforming '${sourceFile.fileName}'`);
            return sourceFile;
        };
    };

    return rttiTransformer;
};

export default transformer;