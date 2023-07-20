import * as ts from 'typescript';
import * as format from '../common/format';

import { literalNode } from './literal-node';
import { serialize } from './serialize';
import { MappedType } from './ts-internal-types';
import { getModifiers, getTypeLocality, hasFlag, hasModifier, isFlagType, parentSymbol, skipAlias } from './utils';
import { RttiContext } from './rtti-context';
import { encodeParameter } from './encode-parameter';
import { ClassVisitor } from './common/class-visitor';
import { isAbstract, isExported } from './flags';
import { InterfaceVisitor } from './common/interface-visitor';

export interface TypeEncoderImpl {
    ctx: RttiContext;
    referToType(type: ts.Type, typeNode?: ts.TypeNode): ts.Expression;
    referToTypeNode(typeNode: ts.TypeNode): ts.Expression;
}

export interface TypeLiteralOptions {
    hoistImportsInCommonJS?: boolean;
}

function globalClassType(name: string, defaultLib = false): ts.Expression {
    return serialize({
        TΦ: format.T_CLASS,
        n: name,
        i: [],
        m: [],
        C: name ? <any>literalNode(ts.factory.createIdentifier(name)) : undefined,
        f: `${format.F_DEFAULT_LIB}`
    });
}

function intrinsicType(TΦ: string) {
    return serialize({ TΦ });
}

function isIntrinsicLiteral(type: ts.Type, name: string) {
    return isFlagType<ts.LiteralType>(type, ts.TypeFlags.Literal) && type['intrinsicName'] === name;
}

export function typeLiteral(encoder: TypeEncoderImpl, type: ts.Type, typeNode?: ts.TypeNode, options?: TypeLiteralOptions): ts.Expression {
    let ctx = encoder.ctx;
    let containingSourceFile = ctx.sourceFile;
    let checker = ctx.checker;
    let program = ctx.program;

    if (!type)
        return intrinsicType(format.T_ANY);

    const typeLocality = getTypeLocality(ctx, type, typeNode);

    switch (true) {
        case hasFlag(type.flags, ts.TypeFlags.String):      return globalClassType('String');
        case hasFlag(type.flags, ts.TypeFlags.Number):      return globalClassType('Number');
        case hasFlag(type.flags, ts.TypeFlags.Boolean):     return globalClassType('Boolean');
        case hasFlag(type.flags, ts.TypeFlags.Void):        return intrinsicType(format.T_VOID);
        case hasFlag(type.flags, ts.TypeFlags.BigInt):      return globalClassType('BigInt');
        case hasFlag(type.flags, ts.TypeFlags.Null):        return intrinsicType(format.T_NULL);
        case hasFlag(type.flags, ts.TypeFlags.Undefined):   return intrinsicType(format.T_UNDEFINED);
        case hasFlag(type.flags, ts.TypeFlags.Unknown):     return intrinsicType(format.T_UNKNOWN);
        case hasFlag(type.flags, ts.TypeFlags.Any):         return intrinsicType(format.T_ANY);
        case isIntrinsicLiteral(type, 'true'):              return intrinsicType(format.T_TRUE);
        case isIntrinsicLiteral(type, 'false'):             return intrinsicType(format.T_FALSE);
        case hasFlag(type.flags, ts.TypeFlags.Conditional): return globalClassType('Object'); // TODO

        case hasFlag(type.flags, ts.TypeFlags.EnumLiteral):

            if (hasFlag(type.flags, ts.TypeFlags.Union)) {
                // Technically when an enum itself is used as a type, it is a Union of EnumLiterals. Technically if we
                // did not handle this we would cause a T_UNION over the set of T_ENUM_LITERALs comprising the enum.
                // But it is more efficient to simply output a T_ENUM instead.
                return serialize({
                    TΦ: format.T_ENUM,
                    n: type.symbol.name ?? type.aliasSymbol.name,
                    v: (type as ts.UnionType).types.reduce((s, t: ts.LiteralType) => (s[t.symbol.name] = t.value, s), {})
                });
            } else if (type.isLiteral()) {
                // This would be hit in, for instance: `let a: MyEnum.Foo | MyEnum.Bar`. In that case we are creating
                // an _actual_ T_UNION (no EnumLiteral involved) comprised of a type for each enum constant
                // (EnumLiteral without Union).

                let unionType =  checker.getTypeAtLocation(parentSymbol(type.symbol).valueDeclaration);
                return serialize({
                    TΦ: format.T_ENUM_LITERAL,
                    n: type.symbol.name ?? type.aliasSymbol.name,
                    e: literalNode(encoder.referToType(unionType)),
                    v: type.value
                });
            } else {
                console.warn(`RTTI: EnumLiteral type was neither a primitive literal nor a union of literals! This is a bug, please send us a reproduction!`);
                return intrinsicType(format.T_ANY);
            }

        case hasFlag(type.flags, ts.TypeFlags.TypeVariable):
            return type['isThisType']
                ? intrinsicType(format.T_THIS)
                : globalClassType('Object')
            ;
    }

    if (type.isUnion()) {
        return serialize({
            TΦ: format.T_UNION,
            t: type.types.map(x => literalNode(encoder.referToType(x)))
        });
    } else if (type.isIntersection()) {
        return serialize({
            TΦ: format.T_INTERSECTION,
            t: type.types.map(x => literalNode(encoder.referToType(x)))
        });
    } else if (isFlagType<ts.LiteralType>(type, ts.TypeFlags.Literal)) {
        if (isFlagType<ts.BigIntLiteralType>(type, ts.TypeFlags.BigIntLiteral)) {
            let valueRep: ts.Expression = ts.factory.createCallExpression(
                ts.factory.createIdentifier("BigInt"),
                undefined,
                [ts.factory.createNumericLiteral(`${type.value.negative? '-' : ''}${type.value.base10Value}`)]
            );

            if (ctx.program.getCompilerOptions().target >= ts.ScriptTarget.ES2020) {
                valueRep = ts.factory.createBigIntLiteral(`${type.value.negative ? '-' : ''}${type.value.base10Value}n`);
            }

            return serialize({
                TΦ: format.T_LITERAL,
                v: literalNode(valueRep)
            });
        }

        return serialize({ TΦ: format.T_LITERAL, v: type.value });
    } else if (hasFlag(type.flags, ts.TypeFlags.Object)) {
        let objectType = <ts.ObjectType>type;
        let isMapped = hasFlag(objectType.objectFlags, ts.ObjectFlags.Mapped);
        let isInstantiated = hasFlag(objectType.objectFlags, ts.ObjectFlags.Instantiated);

        if (isMapped) {
            if (isInstantiated) {
                let typeRef = <MappedType>type;
                return serialize({
                    TΦ: format.T_MAPPED,
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
                        TΦ: format.T_TUPLE,
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
                        TΦ: format.T_ARRAY,
                        e: literalNode(encoder.referToType(typeRef.typeArguments[0]))
                    });
                }

                let tpNodes: ts.TypeNode[] = [];

                if (typeNode && ts.isTypeReferenceNode(typeNode) && typeNode.typeArguments) {
                    tpNodes = Array.from(typeNode.typeArguments);
                }

                try {
                    return serialize({
                        TΦ: format.T_GENERIC,
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
                TΦ: format.T_ARRAY,
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
        if (isDeclaredFunctionType || (type.symbol?.flags & ts.SymbolFlags.Function) !== 0 || type.getCallSignatures()?.length > 0) {
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

                let decl = signature.getDeclaration();

                if (decl) {
                    if (ts.isArrowFunction(decl))
                        flags += format.F_ARROW_FUNCTION;

                    let modifiers = ts.canHaveModifiers(decl) ? ts.getModifiers(decl) : [];

                    if (hasModifier(modifiers, ts.SyntaxKind.AsyncKeyword))
                        flags += format.F_ASYNC;
                }


                return serialize(<format.RtSerialized<format.RtFunctionType>>{
                    TΦ: format.T_FUNCTION,
                    n: type.symbol.name,
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

                            return <format.RtSerialized<format.RtParameter>>{
                                n: p.name,
                                t: literalNode(
                                    encoder.referToType(
                                        checker.getTypeOfSymbolAtLocation(
                                            p, typeNode ?? encoder.ctx.currentTopStatement
                                        )
                                    )
                                ),
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
            let constructorSymbolName: string = undefined;
            let omitMetadata = false;
            let flags: string[] = [];

            if (typeLocality === 'defaultLib') {
                omitMetadata = encoder.ctx.settings.omitLibTypeMetadata;
                flags.push(format.F_DEFAULT_LIB);

                if (checker.getRootSymbols(type.symbol).some(x => x.valueDeclaration)) {
                    constructorSymbolName = type.symbol.name;
                }
            }

            if (type.isClass()) {
                let extendType: ts.Expression
                let implementsTypes: ts.Expression[];
                let members: format.RtObjectMember[];

                let classDecl = findClassDeclaration(checker, type.symbol);
                let klassModifiers: readonly ts.Modifier[] = [];

                if (classDecl && (ts.isClassDeclaration(classDecl) || ts.isClassExpression(classDecl))) {
                    let implementsClause = classDecl.heritageClauses?.find(x => x.token === ts.SyntaxKind.ImplementsKeyword);
                    let extendsClause = classDecl.heritageClauses?.find(x => x.token === ts.SyntaxKind.ExtendsKeyword);

                    if (extendsClause?.types.length > 0) {
                        let typeNode = extendsClause.types[0];
                        let type = checker.getTypeFromTypeNode(typeNode)
                        extendType = encoder.referToType(type, typeNode);
                    }

                    let implementsTypeNodes = implementsClause?.types ?? [];

                    implementsTypes = implementsTypeNodes
                        .map(typeNode => encoder.referToType(checker.getTypeFromTypeNode(typeNode), typeNode));

                    members = ClassVisitor.visit(classDecl, encoder);
                    klassModifiers = ts.canHaveModifiers(classDecl) ? ts.getModifiers(classDecl) : [];
                } else {
                    extendType = encoder.referToType(type.getBaseTypes()[0]);
                    implementsTypes = [];
                    members = serializeObjectMembers(type, typeNode, encoder);
                }

                return serialize({
                    TΦ: format.T_CLASS,
                    f: [
                        ...flags,
                        isAbstract(klassModifiers),
                        isExported(klassModifiers)
                    ].join(''),
                    n: skipAlias(type.symbol, checker).name,
                    m: omitMetadata ? [] : members,
                    i: omitMetadata ? [] : implementsTypes.map(i => literalNode(i)),
                    e: omitMetadata ? undefined : extendType
                });
            } else {
                const interfaceType = <ts.InterfaceType>type;
                let interfaceModifiers: readonly ts.Modifier[] = [];

                let interfaceDecl = findInterfaceDeclaration(encoder.ctx.checker, interfaceType.symbol);
                if (interfaceDecl && ts.isInterfaceDeclaration(interfaceDecl)) {
                    interfaceModifiers = getModifiers(interfaceDecl);
                }

                let name: string = skipAlias(interfaceType.symbol, checker).name;

                if (interfaceDecl) {
                    name = interfaceDecl.name.getText();
                }

                if (constructorSymbolName) {
                    // This is a default-lib (global) type which has a constructor function available.
                    // Although this type is an interface, its effectively a class to the user (for instance String).

                    return serialize<format.RtClassType>({
                        TΦ: format.T_CLASS,
                        f: [
                            ...flags,
                            isExported(interfaceModifiers)
                        ].join(''),
                        n: constructorSymbolName,
                        C: literalNode(ts.factory.createIdentifier(constructorSymbolName)),
                        i: omitMetadata ? [] : getInterfaceExtends(encoder, interfaceType),
                        m: omitMetadata ? [] : getInterfaceMembers(encoder, interfaceType, typeNode)
                    });
                }

                return serialize<format.RtInterfaceType>({
                    TΦ: format.T_INTERFACE,
                    f: [
                        ...flags,
                        isExported(interfaceModifiers)
                    ].join(''),
                    n: name,
                    m: omitMetadata ? [] : getInterfaceMembers(encoder, interfaceType, typeNode),
                    e: omitMetadata ? [] : getInterfaceExtends(encoder, interfaceType)
                });
            }
        }

        if (hasFlag(type.flags, ts.TypeFlags.StructuredType)) {
            return structuredTypeLiteral(encoder, type, typeNode);
        }

        return globalClassType('Object');
    }

    // No idea
    return globalClassType('Object');
}

function findInterfaceDeclaration(checker: ts.TypeChecker, symbol: ts.Symbol) {
    return findDeclaration<ts.InterfaceDeclaration>(checker, symbol, n => ts.isInterfaceDeclaration(n));
}

function findClassDeclaration(checker: ts.TypeChecker, symbol: ts.Symbol) {
    return findDeclaration<ts.ClassDeclaration | ts.ClassExpression>(
        checker, symbol,
        n => ts.isClassDeclaration(n) || ts.isClassExpression(n));
}

function findDeclaration<T extends ts.Declaration>(checker: ts.TypeChecker, symbol: ts.Symbol, discriminant: (node: ts.Node) => boolean): T {
    let valueDecl = skipAlias(symbol, checker)?.valueDeclaration;
    if (!valueDecl) {
        for (const rootSymbol of checker.getRootSymbols(symbol)) {
            const decl = rootSymbol.declarations?.find(x => discriminant(x));
            if (decl)
                return <T>decl;
        }
    }

    return <T>valueDecl;
}

function getInterfaceExtends(encoder: TypeEncoderImpl, interfaceType: ts.InterfaceType) {
    return interfaceType.getBaseTypes().map(type => literalNode(encoder.referToType(interfaceType)))
}

function getInterfaceMembers(encoder: TypeEncoderImpl, interfaceType: ts.InterfaceType, typeNode: ts.TypeNode) {
    let interfaceDecl = findInterfaceDeclaration(encoder.ctx.checker, interfaceType.symbol);
    if (interfaceDecl && ts.isInterfaceDeclaration(interfaceDecl)) {
        return InterfaceVisitor.visit(interfaceDecl, encoder);
    } else {
        return serializeObjectMembers(interfaceType, typeNode, encoder);
    }

}

export function structuredTypeLiteral(encoder: TypeEncoderImpl, type: ts.Type, typeNode: ts.TypeNode, name?: string) {
    return serialize({
        TΦ: format.T_OBJECT,
        n: name,
        m: serializeObjectMembers(type, typeNode, encoder)
    });
}

function serializeObjectMembers(type: ts.Type, typeNode: ts.TypeNode, encoder: TypeEncoderImpl) {
    let members: format.RtObjectMember[] = [];

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
            f: `${hasFlag(prop.flags, ts.SymbolFlags.Optional) ? format.F_OPTIONAL : ''}`,
            t: <any>literalNode(encoder.referToType(memberType))
        })
    }

    return members;
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
export function getImportedPathForSymbol(ctx: RttiContext, symbol: ts.Symbol, typeNode: ts.TypeNode): [ string, ts.Symbol, boolean ] {
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
