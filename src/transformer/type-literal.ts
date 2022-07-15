import * as ts from 'typescript';
import {
    F_OPTIONAL,
    RtFunctionType,
    RtObjectMember,
    RtParameter,
    RtSerialized,
    RtType,
    T_ANY,
    T_ARRAY,
    T_ENUM,
    T_FALSE,
    T_FUNCTION,
    T_GENERIC,
    T_INTERSECTION,
    T_MAPPED,
    T_NULL,
    T_OBJECT,
    T_THIS,
    T_TRUE,
    T_TUPLE,
    T_UNDEFINED,
    T_UNION,
    T_UNKNOWN,
    T_VARIABLE,
    T_VOID
} from '../common';
import {findRelativePathToFile} from './find-relative-path';
import {getPreferredExportForImport} from './get-exports-for-symbol';
import {literalNode} from './literal-node';
import {serialize, serializeExpression} from './serialize';
import {MappedType} from './ts-internal-types';
import {
    fileExists, getTypeLocality, hasFilesystemAccess, hasFlag, isFlagType, isNodeJS, propertyPrepend,
    serializeEntityNameAsExpression, typeHasValue
} from './utils';
import type * as nodePathT from 'path';
import type * as nodeFsT from 'fs';
import {RttiContext} from './rtti-context';
import {forwardRef} from './forward-ref';
import {encodeParameter} from './encode-parameter';

export interface TypeEncoderImpl {
    ctx: RttiContext;

    referToType(type: ts.Type, typeNode?: ts.TypeNode, asAlias?: boolean): ts.Expression;

    referToTypeNode(typeNode: ts.TypeNode): ts.Expression;

    extractTypeAliasDeclarationFromTypeNode?(node: ts.TypeNode): ts.TypeAliasDeclaration | undefined;

    extractTypeAliasDeclarationFromType?(type: ts.Type): ts.TypeAliasDeclaration | undefined

    extractTypeAliasDeclarationFromSymbol?(symbol: ts.Symbol): ts.TypeAliasDeclaration | undefined

    isTypeReferenceWithTypeArguments?(typeNode?: ts.TypeNode): boolean;

    retrieveTypeAliasDeclaration?(type: ts.Type, typeNode?: ts.TypeNode): ts.TypeAliasDeclaration | undefined;

    extractDeclarationFromSymbol?(syntaxKind:ts.SyntaxKind,...symbol: ts.Symbol[]): ts.Node | undefined;
}

export interface TypeLiteralOptions {
    hoistImportsInCommonJS?: boolean;
}

export function typeLiteral(encoder: TypeEncoderImpl, type: ts.Type, typeNode?: ts.TypeNode, options?: TypeLiteralOptions): ts.Expression {

    let ctx = encoder.ctx;
    let containingSourceFile = ctx.sourceFile;
    let checker = ctx.checker;
    let program = ctx.program;
    let importMap = ctx.importMap;

    if (!type)
        return ts.factory.createIdentifier('Object');

    if ((type.flags & ts.TypeFlags.String) !== 0) {
        return ts.factory.createIdentifier('String');
    } else if ((type.flags & ts.TypeFlags.Number) !== 0) {
        return ts.factory.createIdentifier('Number');
    } else if ((type.flags & ts.TypeFlags.Boolean) !== 0) {
        return ts.factory.createIdentifier('Boolean');
    } else if ((type.flags & ts.TypeFlags.Void) !== 0) {
        return serializeExpression({TΦ: T_VOID});
    } else if ((type.flags & ts.TypeFlags.BigInt) !== 0) {
        return ts.factory.createIdentifier('BigInt');
    } else if (hasFlag(type.flags, ts.TypeFlags.EnumLiteral)) {

        if (type.symbol && hasFlag(type.symbol.flags, ts.SymbolFlags.ConstEnum)) {
            // This is a constant enum, so we won't refer to the runtime identity (there won't be one)
            let unionType = type as ts.UnionType;
            return serializeExpression({
                TΦ: T_ENUM,
                n: type.symbol.name ?? type.aliasSymbol.name,
                v: unionType.types.reduce((s, t: ts.LiteralType) => (s[t.symbol.name] = t.value, s), {})
            });
        }

        return serializeExpression({
            TΦ: T_ENUM,
            n: type.symbol?.name ?? type.aliasSymbol?.name,
            e: literalNode(referToTypeWithIdentifier(ctx, type, typeNode, options))
        });
    } else if (type.isUnion()) {
        return serializeExpression({
            TΦ: T_UNION,
            t: type.types.map(x => literalNode(encoder.referToType(x)))
        });
    } else if (type.isIntersection()) {
        return serializeExpression({
            TΦ: T_INTERSECTION,
            t: type.types.map(x => literalNode(encoder.referToType(x)))
        });
    } else if (hasFlag(type.flags, ts.TypeFlags.Null)) {
        return serializeExpression({TΦ: T_NULL});
    } else if (hasFlag(type.flags, ts.TypeFlags.Undefined)) {
        return serializeExpression({TΦ: T_UNDEFINED});
    } else if (hasFlag(type.flags, ts.TypeFlags.Unknown)) {
        return serializeExpression({TΦ: T_UNKNOWN});
    } else if (hasFlag(type.flags, ts.TypeFlags.Any)) {
        return serializeExpression({TΦ: T_ANY});
    } else if (isFlagType<ts.LiteralType>(type, ts.TypeFlags.Literal)) {
        if (type['intrinsicName'] === 'true')
            return serializeExpression({TΦ: T_TRUE});
        else if (type['intrinsicName'] === 'false')
            return serializeExpression({TΦ: T_FALSE});
        return serializeExpression(type.value);
    } else if (hasFlag(type.flags, ts.TypeFlags.TypeVariable)) {
        if (type['isThisType'])
            return serializeExpression({TΦ: T_THIS});

        if (type.symbol || type.aliasSymbol) {
            /* handle type variable */
            const dec = encoder.extractDeclarationFromSymbol(ts.SyntaxKind.TypeParameter,type.symbol, type.aliasSymbol);
            const t = checker.getTypeAtLocation(dec);
            return serializeExpression({
                TΦ: T_VARIABLE,
                name: type.symbol?.name ?? type.aliasSymbol?.name,
                t: literalNode(encoder.referToType(t))
            });
        }

        // TODO
        return ts.factory.createIdentifier('Object');
    } else if ((type.flags & ts.TypeFlags.Object) !== 0) {
        let objectType = <ts.ObjectType>type;
        let isMapped = hasFlag(objectType.objectFlags, ts.ObjectFlags.Mapped);
        let isInstantiated = hasFlag(objectType.objectFlags, ts.ObjectFlags.Instantiated);

        if (isMapped) {
            if (isInstantiated) {
                let typeRef = <MappedType>type;
                return serializeExpression({
                    TΦ: T_MAPPED,
                    t: literalNode(encoder.referToType(typeRef.typeParameter)),
                    p: typeRef.aliasTypeArguments?.map(t => literalNode(encoder.referToType(t))) ?? []
                });
            }
        } else if ((objectType.objectFlags & ts.ObjectFlags.Reference) !== 0) {
            let typeRef = <ts.TypeReference>type;

            if (typeRef.target !== typeRef) {
                if ((typeRef.target.objectFlags & ts.ObjectFlags.Tuple) !== 0) {
                    let tupleTypeRef = <ts.TupleTypeReference>typeRef;
                    let tupleType = tupleTypeRef.target;

                    return serializeExpression({
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
                    return serializeExpression({
                        TΦ: T_ARRAY,
                        e: literalNode(encoder.referToType(typeRef.typeArguments[0]))
                    });
                }

                try {
                    return serializeExpression({
                        TΦ: T_GENERIC,
                        t: literalNode(encoder.referToType(typeRef.target)),
                        p: (typeRef.typeArguments ?? []).map(x => literalNode(encoder.referToType(x)))
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
            return serializeExpression({
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

                return serializeExpression(<RtSerialized<RtFunctionType>>{
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
            return referToTypeWithIdentifier(ctx, type, typeNode, options);
        }

        if (hasFlag(type.flags, ts.TypeFlags.StructuredType)) {
            let members: RtObjectMember[] = [];
            if (type.symbol && type.symbol.members) {
                type.symbol.members.forEach((value, key) => {
                    // TODO: currentTopStatement may be far up the AST- would be nice if we had
                    // a currentStatement that was not constrained to be at the top of the SourceFile
                    let memberType = encoder.ctx.checker.getTypeOfSymbolAtLocation(
                        value,
                        typeNode ?? encoder.ctx.currentTopStatement
                    );

                    members.push({
                        n: <string>key,
                        f: `${hasFlag(value.flags, ts.SymbolFlags.Optional) ? F_OPTIONAL : ''}`,
                        t: <any>literalNode(encoder.referToType(memberType))
                    })
                });
            }

            return serializeExpression({
                TΦ: T_OBJECT,
                m: members
            });
        }

        return ts.factory.createIdentifier('Object');
    }

    // No idea
    return ts.factory.createIdentifier('Object');
}

/**
 * Responsible for outputting an expression for types which are referred to by identifier and may be defined locally,
 * imported, or defined globally.
 *
 * @param ctx
 * @param type
 * @param typeNode
 * @param options
 * @returns
 */
export function referToTypeWithIdentifier(ctx: RttiContext, type: ts.Type, typeNode: ts.TypeNode, options?: TypeLiteralOptions): ts.Expression {
    let containingSourceFile = ctx.sourceFile;
    let checker = ctx.checker;
    let program = ctx.program;
    let importMap = ctx.importMap;
    let typeLocality = getTypeLocality(ctx, type, typeNode);
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

    if (typeLocality !== 'imported') {
        let expr: ts.Identifier | ts.PropertyAccessExpression;

        if (typeHasValue(type)) {
            let entityName = checker.symbolToEntityName(type.symbol, ts.SymbolFlags.Class, undefined, undefined);
            expr = serializeEntityNameAsExpression(entityName, containingSourceFile);
        } else {
            let symbolName = `IΦ${type.symbol.name}`;
            expr = ts.factory.createIdentifier(symbolName); // TODO: qualified names
        }

        return expr;
    } else {
        let symbol = type.symbol;

        // This is imported. The symbol we've been examining is going
        // to be the one in the remote file.

        let modulePath: string; //parents[0] ? JSON.parse(parents[0].name) : undefined;
        let isExportedAsDefault = symbol?.name === 'default';

        if (typeNode) {
            if (ts.isTypeReferenceNode(typeNode)) {
                let typeName = typeNode.typeName;
                while (ts.isQualifiedName(typeName))
                    typeName = typeName.left;

                let localSymbol = checker.getSymbolAtLocation(typeNode.typeName);
                if (localSymbol) {
                    let localDecl = localSymbol.declarations[0];
                    if (localDecl) {
                        let detectedImportPath: string;

                        if (ts.isImportClause(localDecl)) {
                            let specifier = <ts.StringLiteral>localDecl.parent?.moduleSpecifier;
                            detectedImportPath = specifier.text;
                        } else if (ts.isImportSpecifier(localDecl)) {
                            let specifier = <ts.StringLiteral>localDecl.parent?.parent?.parent?.moduleSpecifier;
                            detectedImportPath = specifier.text;
                        }

                        if (detectedImportPath) {
                            modulePath = detectedImportPath;
                            symbol = localSymbol;
                            isExportedAsDefault = checker.getImmediateAliasedSymbol(localSymbol)?.name === 'default';
                        }
                    }
                }
            } else {
                // TODO
                // In certain cases, Typescript will collapse a more complex type into a simpler one.
                // This can happen with enums in cases like `MyEnum | undefined` when `strictNullChecks` is not
                // enabled. I've been unable to pin down exactly when this occurs, but if we simply continue
                // instead of throwing, the modulePath will be undefined, allowing us to try to find the type
                // import another way that doesn't depend on the type node anyway.

                //throw new Error(`Unexpected type node type: '${ts.SyntaxKind[typeNode.kind]}'`);
                console.warn(`Unexpected type node type: '${ts.SyntaxKind[typeNode.kind]}'`);
            }
        }

        if (!modulePath) {
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
                isExportedAsDefault = symbol?.name === 'default' || !symbol;
            }

            // Treat /index.js et al specially: On Node.js this is equivalent to importing
            // the containing folder due to the node resolution algorithm. This can be important
            // if the .d.ts file does not have a corresponding .js file alongside it (for instance,
            // see the 'winston' package)

            if (isNodeJS()) {
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
                    return ts.factory.createIdentifier(`Object`);
                }
            }

            if (destFile.endsWith('.d.ts'))
                destFile = destFile.replace(/\.d\.ts$/, '');
            else if (destFile.endsWith('.ts'))
                destFile = destFile.replace(/\.ts$/, '');

            // TODO: The import now has no extension, but for Deno it is required.
            // I think only a configuration option could fix this, in which case we
            // would append .js here

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


            if (relativePath) {
                modulePath = relativePath;
            } else {
                if (globalThis.RTTI_TRACE)
                    console.warn(`RTTI: Cannot determine relative path from '${ctx.sourceFile.fileName}' to '${sourceFile.fileName}'! Using absolute path!`);
                modulePath = destFile;
            }
        }

        let exportedName = 'default';
        if (type.isClassOrInterface() && !type.isClass())
            exportedName = `IΦdefault`;

        let isCommonJS = program.getCompilerOptions().module === ts.ModuleKind.CommonJS;

        if (isExportedAsDefault) {
            if (isCommonJS && options?.hoistImportsInCommonJS !== true) {
                return ts.factory.createPropertyAccessExpression(
                    ts.factory.createCallExpression(
                        ts.factory.createIdentifier('require'),
                        [], [
                            ts.factory.createStringLiteral(modulePath)
                        ]
                    ), exportedName);
            } else {

                let impo = importMap.get(`*default:${modulePath}`);
                if (!impo) {
                    importMap.set(`*default:${modulePath}`, impo = {
                        importDeclaration: ctx.currentTopStatement,
                        isDefault: exportedName === 'default',
                        isNamespace: exportedName !== 'default',
                        localName: `LΦ_${ctx.freeImportReference++}`,
                        modulePath: modulePath,
                        name: `*${exportedName}:${modulePath}`,
                        refName: '',
                        referenced: true
                    });
                }

                if (exportedName === 'default') {
                    return ts.factory.createIdentifier(impo.localName);
                } else {
                    return ts.factory.createPropertyAccessExpression(
                        ts.factory.createIdentifier(impo.localName),
                        exportedName
                    );
                }
            }
        } else {
            // Named export

            let expr: ts.Identifier | ts.PropertyAccessExpression;

            if (typeHasValue(type)) {
                let entityName = checker.symbolToEntityName(symbol, ts.SymbolFlags.Class, undefined, undefined);
                expr = serializeEntityNameAsExpression(entityName, containingSourceFile);
            } else {
                let symbolName = `IΦ${type.symbol.name}`;
                expr = ts.factory.createIdentifier(symbolName); // TODO: qualified names
            }

            // This is used in the legacy type encoder to ensure matching semantics to Typescript's own
            // implementation. The import (ie require()) must be hoisted to the top of the file to ensure
            // that circular dependencies resolve the same way.

            if (isCommonJS && options?.hoistImportsInCommonJS !== true) {
                return propertyPrepend(
                    ts.factory.createCallExpression(
                        ts.factory.createIdentifier('require'),
                        [], [ts.factory.createStringLiteral(modulePath)]
                    ), expr
                );
            } else {
                let impo = ctx.importMap.get(`*:${modulePath}`);
                if (!impo) {
                    ctx.importMap.set(`*:${modulePath}`, impo = {
                        importDeclaration: ctx.currentTopStatement,
                        isDefault: false,
                        isNamespace: true,
                        localName: `LΦ_${ctx.freeImportReference++}`,
                        modulePath: modulePath,
                        name: `*:${modulePath}`,
                        refName: '',
                        referenced: true
                    });
                }

                return propertyPrepend(ts.factory.createIdentifier(impo.localName), expr);
            }
        }
    }
}
