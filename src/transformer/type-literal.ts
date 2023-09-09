import * as ts from 'typescript';
import { F_OPTIONAL, RtFunctionType, RtObjectMember, RtParameter, RtSerialized, RtType, T_ANY, T_ARRAY, T_ENUM, T_FALSE, T_FUNCTION, T_GENERIC, T_INTERSECTION, T_MAPPED, T_NULL,
    T_OBJECT, T_STAND_IN, T_THIS, T_TRUE, T_TUPLE, T_UNDEFINED, T_UNION, T_UNKNOWN, T_VOID } from '../common';
import { findRelativePathToFile } from './find-relative-path';
import { getPreferredExportForImport } from './get-exports-for-symbol';
import { literalNode } from './literal-node';
import { serialize } from './serialize';
import { MappedType } from './ts-internal-types';
import { fileExists, getTypeLocality, hasFilesystemAccess, hasFlag, isFlagType, isInterfaceType, isNodeJS, optionalExportRef, propertyPrepend,
    serializeEntityNameAsExpression, typeHasValue } from './utils';
import type * as nodePathT from 'path';
import type * as nodeFsT from 'fs';
import { RttiContext } from './rtti-context';
import { forwardRef } from './forward-ref';
import { encodeParameter } from './encode-parameter';

export interface TypeEncoderImpl {
    ctx: RttiContext;
    referToType(type: ts.Type, typeNode?: ts.TypeNode): ts.Expression;
    referToTypeNode(typeNode: ts.TypeNode): ts.Expression;
}

export interface TypeLiteralOptions {
    hoistImportsInCommonJS?: boolean;
}

export function typeLiteral(encoder: TypeEncoderImpl, type: ts.Type, typeNode?: ts.TypeNode, options?: TypeLiteralOptions): ts.Expression {
    let ctx = encoder.ctx;
    let containingSourceFile = ctx.sourceFile;
    let checker = ctx.checker;
    let program = ctx.program;

    if (!type)
        return ts.factory.createIdentifier('Object');

    if ((type.flags & ts.TypeFlags.String) !== 0) {
        return ts.factory.createIdentifier('String');
    } else if ((type.flags & ts.TypeFlags.Number) !== 0) {
        return ts.factory.createIdentifier('Number');
    } else if ((type.flags & ts.TypeFlags.Boolean) !== 0) {
        return ts.factory.createIdentifier('Boolean');
    } else if ((type.flags & ts.TypeFlags.Void) !== 0) {
        return serialize({ TΦ: T_VOID });
    } else if ((type.flags & ts.TypeFlags.BigInt) !== 0) {
        return ts.factory.createIdentifier('BigInt');
    } else if (hasFlag(type.flags, ts.TypeFlags.EnumLiteral)) {

        if (type.symbol && hasFlag(type.symbol.flags, ts.SymbolFlags.ConstEnum)) {
            // This is a constant enum, so we won't refer to the runtime identity (there won't be one)
            let unionType = type as ts.UnionType;
            return serialize({
                TΦ: T_ENUM,
                n: type.symbol.name ?? type.aliasSymbol.name,
                v: unionType.types.reduce((s, t: ts.LiteralType) => (s[t.symbol.name] = t.value, s), {})
            });
        }

        return serialize({
            TΦ: T_ENUM,
            n: type.symbol?.name ?? type.aliasSymbol?.name,
            e: literalNode(referToTypeWithIdentifier(encoder, type, typeNode, options))
        });
    } else if (type.isUnion()) {
        return serialize({
            TΦ: T_UNION,
            t: type.types.map(x => literalNode(encoder.referToType(x)))
        });
    } else if (type.isIntersection()) {
        return serialize({
            TΦ: T_INTERSECTION,
            t: type.types.map(x => literalNode(encoder.referToType(x)))
        });
    } else if (hasFlag(type.flags, ts.TypeFlags.Null)) {
        return serialize({ TΦ: T_NULL });
    } else if (hasFlag(type.flags, ts.TypeFlags.Undefined)) {
        return serialize({ TΦ: T_UNDEFINED });
    } else if (hasFlag(type.flags, ts.TypeFlags.Unknown)) {
        return serialize({ TΦ: T_UNKNOWN });
    } else if (hasFlag(type.flags, ts.TypeFlags.Any)) {
        return serialize({ TΦ: T_ANY });
    } else if (isFlagType<ts.BigIntLiteralType>(type, ts.TypeFlags.BigIntLiteral)) {
        return serialize(BigInt(`${type.value.negative ? '-' : ''}${type.value.base10Value}`));
    } else if (isFlagType<ts.LiteralType>(type, ts.TypeFlags.Literal)) {
        if (type['intrinsicName'] === 'true')
            return serialize({ TΦ: T_TRUE });
        else if (type['intrinsicName'] === 'false')
            return serialize({ TΦ: T_FALSE });
        return serialize(type.value);
    } else if (hasFlag(type.flags, ts.TypeFlags.TypeVariable)) {
        if (type['isThisType'])
            return serialize({ TΦ: T_THIS });

        // TODO
        return ts.factory.createIdentifier('Object');
    } else if ((type.flags & ts.TypeFlags.Object) !== 0) {
        let objectType = <ts.ObjectType>type;
        let isMapped = hasFlag(objectType.objectFlags, ts.ObjectFlags.Mapped);
        let isInstantiated = hasFlag(objectType.objectFlags, ts.ObjectFlags.Instantiated);

        if (isMapped) {
            if (isInstantiated) {
                let typeRef = <MappedType>type;
                return serialize({
                    TΦ: T_MAPPED,
                    t: literalNode(encoder.referToType(typeRef.typeParameter)),
                    p: typeRef.aliasTypeArguments?.map(t => literalNode(encoder.referToType(t))) ?? [],
                    m: serializeObjectMembers(typeRef, typeNode, encoder)
                });
            }
        } else if ((objectType.objectFlags & ts.ObjectFlags.Reference) !== 0) {
            let typeRef = <ts.TypeReference>type;

            if (typeRef.target !== typeRef) {
                if ((typeRef.target.objectFlags & ts.ObjectFlags.Tuple) !== 0) {
                    let tupleTypeRef = <ts.TupleTypeReference>typeRef;
                    let tupleType = tupleTypeRef.target;

                    return serialize({
                        TΦ: T_TUPLE,
                        e: typeRef.typeArguments.map((e, i) => {
                            if (tupleType.labeledElementDeclarations) {
                                return {
                                    n: tupleType.labeledElementDeclarations[i].name.getText(),
                                    t: literalNode(encoder.referToType(e))
                                };
                            } else {
                                return {
                                    t: literalNode(encoder.referToType(e))
                                };
                            }
                        })
                    });
                }

                if (!typeRef.symbol)
                    debugger;

                if (!typeRef.target.symbol)
                    debugger;

                if (typeRef.target.symbol.name === 'Array' && typeRef.typeArguments.length === 1) {
                    return serialize({
                        TΦ: T_ARRAY,
                        e: literalNode(encoder.referToType(typeRef.typeArguments[0]))
                    });
                }

                let tpNodes: ts.TypeNode[] = [];

                if (typeNode && ts.isTypeReferenceNode(typeNode) && typeNode.typeArguments) {
                    tpNodes = Array.from(typeNode.typeArguments);
                }

                try {
                    return serialize({
                        TΦ: T_GENERIC,
                        t: literalNode(encoder.referToType(typeRef.target, typeNode)),
                        p: (typeRef.typeArguments ?? []).map((x, i) => literalNode(encoder.referToType(x, tpNodes[i])))
                    });
                } catch (e) {
                    console.error(`RTTI: Error while serializing type '${typeRef.symbol.name}': ${e.message}`);
                    console.error(e);
                    throw e;
                }
            }
        }

        // Special handling for case where the `Array` symbol is not available to the TS compiler
        // (such as when `noLib` is enabled). If we have a typeNode available, we can still detect
        // the array type and work around the lack of the Array symbol.

        if (!type.symbol && typeNode && ts.isArrayTypeNode(typeNode)) {
            let typeRef = checker.getTypeAtLocation(typeNode.elementType);
            return serialize({
                TΦ: T_ARRAY,
                e: literalNode(encoder.referToType(typeRef))
            });
        }

        // Without the underlying symbol we cannot reason about whether we are looking at a function, a class
        // or an interface.

        if (!type.symbol) {
            if (typeNode) {
                console.warn(`RTTI: Could not resolve symbol for type node '${typeNode.getText()}'.`);
            } else {
                if (program.getCompilerOptions().noLib) {
                    console.warn(
                        `RTTI: ${containingSourceFile.fileName}: ${ctx.locationHint ?? 'unknown location'}: `
                        + `Missing symbol for type with flags=${type.flags} without type node! `
                        + `'Object' will be emitted for the type instead.`
                    );

                    if (!ctx['__warnedNoLib']) {
                        console.warn(
                            `RTTI: ^-- You are compiling with noLib enabled, which may interfere with inferred array types. `
                            + `You may be able to work around this issue by explicitly declaring the array type instead `
                            + `of relying on inference. This notice is shown only once.`
                        );
                        ctx['__warnedNoLib'] = true;
                    }

                } else {
                    console.warn(
                        `RTTI: ${containingSourceFile.fileName}: ${ctx.locationHint ?? 'unknown location'}: `
                        + `Missing symbol for type with flags=${type.flags} without type node! `
                        + `'Object' will be emitted as the type instead. `
                        + `[please report]`
                    );
                }
            }
        }

        let isDeclaredFunctionType = typeNode && ts.isFunctionTypeNode(typeNode);
        if (isDeclaredFunctionType || (type.symbol?.flags & ts.SymbolFlags.Function) !== 0) {
            let signatures = type.getCallSignatures();


            if (signatures.length > 1) {
                console.warn(
                    `RTTI: ${containingSourceFile.fileName}: ${ctx.locationHint ?? 'unknown location'}: `
                    + `Function type had multiple call signatures, emitted type will only include the`
                    + `first one. We could use an isolated reproduction of this [please report]`
                );
            }

            if (signatures.length >= 1) {
                let signature = signatures[0];
                let returnType = signature.getReturnType()
                let parameters = signature.getParameters();
                let flags = ''; // No flags supported yet
                let missingParamDecls = false;

                return serialize(<RtSerialized<RtFunctionType>>{
                    TΦ: T_FUNCTION,
                    r: literalNode(encoder.referToType(returnType)),
                    p: parameters.map(p => {
                        let decl = p.valueDeclaration;
                        if (decl && ts.isParameter(decl)) {
                            return encodeParameter(encoder, decl);
                        } else {
                            // Shouldn't happen, but if it does, we should emit as much information as possible.

                            if (!missingParamDecls) {
                                missingParamDecls = true;
                                console.warn(
                                    `RTTI: ${containingSourceFile.fileName}: ${ctx.locationHint ?? 'unknown location'}: `
                                    + `Could not resolve declaration of parameter for function type. Initializer and `
                                    + `flags for these parameters will be unavailable. [please report]`
                                );
                            }

                            return <RtSerialized<RtParameter>>{
                                n: p.name,
                                t: literalNode(forwardRef(
                                    encoder.referToType(
                                        checker.getTypeOfSymbolAtLocation(
                                            p, typeNode ?? encoder.ctx.currentTopStatement
                                        )
                                    )
                                )),
                                v: undefined, // cannot get initializer without ParameterDeclaration
                                f: '' // cannot determine flags without a ParameterDeclaration
                            };
                        }

                    }),
                    f: flags
                });
            }

            return ts.factory.createIdentifier(`Function`);
        } else if (type.isClassOrInterface()) {
            return referToTypeWithIdentifier(encoder, type, typeNode, options);
        }

        if (hasFlag(type.flags, ts.TypeFlags.StructuredType)) {
            return structuredTypeLiteral(encoder, type, typeNode);
        }

        return ts.factory.createIdentifier('Object');
    }

    // No idea
    return ts.factory.createIdentifier('Object');
}

export function structuredTypeLiteral(encoder: TypeEncoderImpl, type: ts.Type, typeNode: ts.TypeNode, name?: string) {
    return serialize({
        TΦ: T_OBJECT,
        n: name,
        m: serializeObjectMembers(type, typeNode, encoder)
    });
}

function serializeObjectMembers(type: ts.Type, typeNode: ts.TypeNode, encoder: TypeEncoderImpl) {
    let members: RtObjectMember[] = [];

    let props = type.getProperties();
    for (let prop of props) {
        // TODO: currentTopStatement may be far up the AST- would be nice if we had
        // a currentStatement that was not constrained to be at the top of the SourceFile
        let memberType = encoder.ctx.checker.getTypeOfSymbolAtLocation(
            prop,
            typeNode ?? encoder.ctx.currentTopStatement
        );

        members.push({
            n: prop.name,
            f: `${hasFlag(prop.flags, ts.SymbolFlags.Optional) ? F_OPTIONAL : ''}`,
            t: <any>literalNode(encoder.referToType(memberType))
        })
    }

    return members;
}

/**
 * Responsible for outputting an expression for types which are referred to by identifier (classes, interfaces, enums)
 * and may be defined locally, imported, or defined globally.
 *
 * @param ctx
 * @param type
 * @param typeNode
 * @param options
 * @returns
 */
function referToTypeWithIdentifier(encoder: TypeEncoderImpl, type: ts.Type, typeNode: ts.TypeNode, options?: TypeLiteralOptions): ts.Expression {
    let ctx = encoder.ctx;
    let program = ctx.program;
    let sourceFile = type.symbol.declarations?.[0]?.getSourceFile();

    if (!sourceFile) {
        // TODO: this has happened for TlsOptions from @types/node, typeorm
        // [src/driver/cockroachdb/CockroachConnectionCredentialsOptions.ts]
        // ...but it shouldn't. Perhaps TS didn't have the type ready?
        return ts.factory.createIdentifier('Object');
    }

    if (!type.symbol)
        return ts.factory.createIdentifier('Object');

    // If this is a non-class from the standard library (ie lib.*.d.ts) then output Object
    if (program.isSourceFileDefaultLibrary(sourceFile) && !typeHasValue(type))
        return ts.factory.createIdentifier(`Object`);

    // If this symbol is imported, we need to handle it specially.

    if (getTypeLocality(ctx, type, typeNode) === 'imported')
        return referToImportedTypeWithIdentifier(encoder, type, typeNode, options?.hoistImportsInCommonJS ?? false);
    else
        return referToLocalTypeWithIdentifier(encoder, type);
}

/**
 * Handles creating a reference to a type which is declared within the current source file. This is the simpler
 * case.
 *
 * @param ctx
 * @param type
 * @returns
 */
function referToLocalTypeWithIdentifier(encoder: TypeEncoderImpl, type: ts.Type) {
    const ctx = encoder.ctx;
    const checker = ctx.checker;
    const containingSourceFile = ctx.sourceFile;

    let expr: ts.Identifier | ts.PropertyAccessExpression;

    if (typeHasValue(type)) {
        let entityName = checker.symbolToEntityName(type.symbol, ts.SymbolFlags.Class, undefined, undefined);
        if (!entityName) {
            /**
             * For instance, anonymous class expressions. When the class expression is defined at runtime its
             * type table slot will be replaced with the constructor reference, so we emit a T_STAND_IN.
             */
            return serialize({
                TΦ: T_STAND_IN,
                name: undefined,
                note: `(anonymous class)`
            });
        }
        expr = serializeEntityNameAsExpression(entityName, containingSourceFile);
    } else {
        let symbolName = `IΦ${type.symbol.name}`;
        expr = ts.factory.createIdentifier(symbolName); // TODO: qualified names
    }

    return expr;
}

/**
 * Determine what module specifier was used to import the given symbol, and resolve that symbol based on the import
 * method as necessary.
 *
 * @param ctx
 * @param symbol
 * @param typeNode
 * @returns
 */
function getImportedPathForSymbol(ctx: RttiContext, symbol: ts.Symbol, typeNode: ts.TypeNode): [ string, ts.Symbol, boolean ] {
    const checker = ctx.checker;

    if (!typeNode)
        return [ undefined, symbol, undefined ];

    let localSymbol: ts.Symbol;

    if (ts.isExpressionWithTypeArguments(typeNode)) {
        localSymbol = checker.getSymbolAtLocation(typeNode.expression);
    } else if (ts.isTypeReferenceNode(typeNode)) {
        let typeName = typeNode.typeName;
        while (ts.isQualifiedName(typeName))
            typeName = typeName.left;

        localSymbol = checker.getSymbolAtLocation(typeName);
    } else {
        return [ undefined, symbol, undefined ];
    }

    let localDecl = localSymbol?.declarations?.[0];

    if (!localDecl)
        return [ undefined, symbol, undefined ];

    let specifier: ts.StringLiteral;
    let typeOnly = false;

    if (ts.isImportClause(localDecl)) {
        specifier = <ts.StringLiteral>localDecl.parent?.moduleSpecifier;
        symbol = localSymbol;
        typeOnly = ts.isTypeOnlyImportOrExportDeclaration(localDecl);
    } else if (ts.isImportSpecifier(localDecl)) {
        specifier = <ts.StringLiteral>localDecl.parent?.parent?.parent?.moduleSpecifier;
        symbol = localSymbol;
        typeOnly = ts.isTypeOnlyImportOrExportDeclaration(localDecl);
    } else if (ts.isNamespaceImport(localDecl)) {
        specifier = <ts.StringLiteral>localDecl.parent.parent.moduleSpecifier;
        typeOnly = ts.isTypeOnlyImportOrExportDeclaration(localDecl);
    }

    if (specifier)
        return [ specifier.text, symbol, typeOnly ];

    return [ undefined, symbol, undefined ];
}

/**
 * Handles referring to a type which has been imported from somewhere else.
 *
 * @param ctx
 * @param type
 * @param typeNode
 * @param hoistImportsInCommonJS
 * @returns
 */
function referToImportedTypeWithIdentifier(encoder: TypeEncoderImpl, type: ts.Type, typeNode: ts.TypeNode, hoistImportsInCommonJS: boolean) {
    const ctx = encoder.ctx;
    const checker = ctx.checker;
    const program = ctx.program;
    const containingSourceFile = ctx.sourceFile;
    const importMap = ctx.importMap;
    const isCommonJS = program.getCompilerOptions().module === ts.ModuleKind.CommonJS;

    // This is imported. The symbol we've been examining is going
    // to be the one in the remote file.

    let [ importPath, symbol, typeOnly ] = findImportableSymbolForType(ctx, type, typeNode);

    // If the type was imported via a type-only import, refuse to generate an import since
    // that might have deleterious effects at compile/runtime (for instance when bundling
    // a frontend app or when using ESM over network)

    if (typeOnly)
        return structuredTypeLiteral(encoder, type, typeNode, symbol.name);

    if (!importPath)
        return ts.factory.createIdentifier(`Object`);

    if (!symbol || isExportedAsDefault(checker, symbol)) {
        let defaultName = isInterfaceType(type) ? `IΦdefault` : 'default';


        let impo = importMap.get(`*default:${importPath}`);
        if (!impo) {
            importMap.set(`*default:${importPath}`, impo = {
                importDeclaration: ctx.currentTopStatement,
                isDefault: defaultName === 'default',
                isNamespace: defaultName !== 'default',
                localName: `LΦ_${ctx.freeImportReference++}`,
                modulePath: importPath,
                name: `*${defaultName}:${importPath}`,
                refName: '',
                referenced: true
            });
        }

        if (defaultName === 'default') {
            return ts.factory.createIdentifier(impo.localName);
        } else {
            return ts.factory.createPropertyAccessExpression(
                ts.factory.createIdentifier(impo.localName),
                defaultName
            );
        }
    } else {
        // Named export

        let expr: ts.Identifier | ts.PropertyAccessExpression;
        let exportName: string;

        if (typeHasValue(type)) {
            let entityName = checker.symbolToEntityName(symbol, ts.SymbolFlags.Class, undefined, undefined);
            expr = serializeEntityNameAsExpression(entityName, containingSourceFile);
        } else {
            exportName = `IΦ${type.symbol.name}`;
            expr = ts.factory.createIdentifier(exportName); // TODO: qualified names
        }

        let impo = ctx.importMap.get(`*:${importPath}`);
        if (!impo) {
            ctx.importMap.set(`*:${importPath}`, impo = {
                importDeclaration: ctx.currentTopStatement,
                isDefault: false,
                isNamespace: true,
                localName: `LΦ_${ctx.freeImportReference++}`,
                modulePath: importPath,
                name: `*:${importPath}`,
                refName: '',
                referenced: true
            });
        }
        if (!isCommonJS) {
            // Since ES exports and imports are statically analyzable, some tools
            // regard it as an error to reference an export which does not exist.
            // When we encode references to interface tokens and the imported library
            // was not built with RTTI, we will invoke such errors. It is also possible
            // that this could happen with normal reified exports; if the code itself never
            // references the reified export but we do, and the version of the library
            // differs (and does not include that symbol) at bundle time.
            //
            // To avoid this, we opt out of such static analysis by making the access of the
            // export dynamic using the `oe()` helper in the emit.
            return optionalExportRef(ts.factory.createIdentifier(impo.localName), expr);
        } else {
            return propertyPrepend(ts.factory.createIdentifier(impo.localName), expr);
        }
    }
}

function findImportableSymbolForType(ctx: RttiContext, type: ts.Type, typeNode: ts.TypeNode): [ string, ts.Symbol, boolean ] {
    let symbol = type.symbol;
    let importPath: string;
    let typeOnly = false;

    [ importPath, symbol, typeOnly ] = getImportedPathForSymbol(ctx, symbol, typeNode);

    if (!importPath) {
        [ importPath, symbol ] = inferImportPath(ctx, type, symbol);
        typeOnly = false;
    }

    return [ importPath, symbol, typeOnly ];
}

/**
 * Attempt to infer the best import path for the given symbol, and dealias the symbol so that we
 * refer to it the right way when importing.
 *
 * @param ctx
 * @param type
 * @param symbol
 * @returns
 */
function inferImportPath(
    ctx: RttiContext, type: ts.Type, symbol: ts.Symbol
): [ string, ts.Symbol ] {
    const program = ctx.program;
    const containingSourceFile = ctx.sourceFile;
    const sourceFile = type.symbol.declarations?.[0]?.getSourceFile();
    const isCommonJS = program.getCompilerOptions().module === ts.ModuleKind.CommonJS;

    // The type is not directly imported in this file.

    let destFile = sourceFile.fileName;

    // Attempt to locate the "best" re-export for this symbol
    // This attempts to prevent reaching deep into a module
    // when a higher export is available, while also skipping
    // any potential re-exports which are already above this file.

    let preferredExport = getPreferredExportForImport(program, containingSourceFile, symbol);
    if (preferredExport) {
        destFile = preferredExport.sourceFile.fileName;
        symbol = preferredExport.symbol;
    }

    // Treat /index.js et al specially when compiling for Node.js in CommonJS mode.
    // This is equivalent to importing the containing folder by default due to the
    // node resolution algorithm.

    if (isCommonJS && isNodeJS()) {
        if (destFile.endsWith('/index.d.ts'))
            destFile = destFile.replace(/\/index\.d\.ts$/, '');
        else if (destFile.endsWith('/index.js'))
            destFile = destFile.replace(/\/index\.js$/, '');
        else if (destFile.endsWith('/index.ts'))
            destFile = destFile.replace(/\/index\.ts$/, '');
    }

    if (destFile.endsWith('.d.ts') && hasFilesystemAccess()) {
        // Make sure we have a .js file alongside the .d.ts.
        if (!fileExists(destFile.replace(/\.d\.ts$/, '.js'))) {
            console.warn(
                `RTTI: warning: Cannot import symbol '${symbol.name}' from declaration file '${destFile}' `
                + `because there is no corresponding Javascript file alongside the declaration `
                + `file! Refusing to emit type references for this symbol.`
            );

            return [ null, symbol ];
        }
    }

    if (destFile.endsWith('.d.ts'))
        destFile = destFile.replace(/\.d\.ts$/, '');
    else if (destFile.endsWith('.ts'))
        destFile = destFile.replace(/\.ts$/, '.js');

    let relativePath = findRelativePathToFile(ctx.sourceFile.fileName, destFile);

    // Find 'node_modules' in the resulting path and cut everything up to and including it out
    // to ensure we allow node resolution algorithm to work at runtime. In theory this case could
    // be hit when not using Node (or a Node-compatible bundler) but it seems exceedingly unlikely.
    // If this happens for you unexpectedly, please file a bug.

    let pathParts = relativePath.split('/');
    let nodeModulesIndex = pathParts.indexOf('node_modules');
    if (nodeModulesIndex >= 0) {
        let originalPath = relativePath;
        let pathToNodeModules = pathParts.slice(0, nodeModulesIndex + 1).join('/');
        let packagePath = pathParts.slice(nodeModulesIndex + 1);
        relativePath = packagePath.join('/');

        if (packagePath.length > 0) {
            let pathIntoPackageParts = packagePath.slice();
            let packageName = pathIntoPackageParts.shift();
            if (packageName.startsWith('@')) {
                // assume its a scoped package
                packageName += '/' + pathIntoPackageParts.shift();
            }

            // At this point, if we happen to be on Node.js, then it should be safe to introspect
            // the package.json.

            if (isNodeJS()) {
                let requireN = require;
                function requireX(path) {
                    return requireN(path);
                }

                const fs: typeof nodeFsT = requireX('fs');
                const path: typeof nodePathT = requireX('path');

                let pkgJsonPath = path.resolve(
                    path.dirname(ctx.sourceFile.fileName),
                    pathToNodeModules,
                    packageName,
                    'package.json'
                );

                if (!pkgJsonPath) {
                    throw new Error(`Failed to resolve path for package.json [file='${ctx.sourceFile.fileName}', node_modules='${pathToNodeModules}', packageName='${packageName}']`);
                    debugger;
                }

                let pkgJson: any;

                if (ctx.pkgJsonMap.has(pkgJsonPath)) {
                    pkgJson = ctx.pkgJsonMap.get(pkgJsonPath);
                } else {
                    try {
                        if (fs.existsSync(pkgJsonPath)) {
                            let buf = fs.readFileSync(pkgJsonPath);
                            let json = JSON.parse(buf.toString('utf-8'));
                            pkgJson = json;
                            ctx.pkgJsonMap.set(pkgJsonPath, pkgJson);
                        }
                    } catch (e) {
                        console.error(`RTTI: Caught error while reading ${pkgJsonPath}: ${e.message}`);
                        console.error(e);
                        console.error(`RTTI: Proceeding with potentially non-optimal import path '${relativePath}'`);
                    }
                }

                if (pkgJson) {
                    let absPathToNodeModules = path.resolve(
                        path.dirname(ctx.sourceFile.fileName),
                        pathToNodeModules
                    );
                    let entrypoints = [pkgJson.main, pkgJson.module, pkgJson.browser]
                        .filter(x => x);

                    for (let entrypoint of entrypoints) {
                        if (typeof entrypoint !== 'string') {
                            // see typescript package.json 'browser' field
                            continue;
                        }
                        let entrypointFile = path.resolve(path.dirname(pkgJsonPath), entrypoint);
                        let absolutePath = path.resolve(absPathToNodeModules, relativePath);

                        if (entrypointFile === absolutePath) {
                            relativePath = packageName;
                            break;
                        }
                    }
                }
            }
        }
    }

    let modulePath: string;

    if (relativePath) {
        modulePath = relativePath;
    } else {
        if (globalThis.RTTI_TRACE)
            console.warn(`RTTI: Cannot determine relative path from '${ctx.sourceFile.fileName}' to '${sourceFile.fileName}'! Using absolute path!`);
        modulePath = destFile;
    }

    // It's never appropriate to generate an import to @types/*. Additionally, the structure of @types packages
    // almost never has any relation to the structure of the package it is providing types for, so just assume
    // the root of the package.

    if (modulePath.startsWith('@types/')) {
        modulePath = modulePath.replace(/^@types\//, '').replace(/\/.*/, '');
    }

    return [ modulePath, symbol ];
}

function dealias(checker: ts.TypeChecker, symbol: ts.Symbol) {
    if (!symbol)
        return undefined;

    if (hasFlag(symbol.flags, ts.SymbolFlags.Alias))
        return checker.getImmediateAliasedSymbol(symbol);

    return symbol;
}

function isExportedAsDefault(checker: ts.TypeChecker, symbol: ts.Symbol) {
    return dealias(checker, symbol)?.name === 'default';
}