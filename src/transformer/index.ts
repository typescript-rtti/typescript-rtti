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
 * 
 */

import { F_ABSTRACT, F_CLASS, F_METHOD, F_OPTIONAL, F_PRIVATE, F_PROPERTY, F_PROTECTED, F_PUBLIC, F_READONLY, getVisibility, isAbstract, isAsync, isExported, isReadOnly } from './flags';
import { forwardRef } from './forward-ref';
import { metadataDecorator } from './metadata-decorator';
import { rtHelper } from './rt-helper';
import { serialize } from './serialize';
import * as ts from 'typescript';
import { T_ANY, T_ARRAY, T_INTERSECTION, T_THIS, T_TUPLE, T_UNION, T_UNKNOWN, T_GENERIC, T_VOID, F_FUNCTION, F_INTERFACE } from '../common';
import { cloneEntityNameAsExpr, dottedNameToExpr, entityNameToString, getRootNameOfEntityName } from './utils';

export class CompileError extends Error {}

export interface RttiSettings {
    trace? : boolean;
}

export enum TypeReferenceSerializationKind {
    // The TypeReferenceNode could not be resolved.
    // The type name should be emitted using a safe fallback.
    Unknown,

    // The TypeReferenceNode resolves to a type with a constructor
    // function that can be reached at runtime (e.g. a `class`
    // declaration or a `var` declaration for the static side
    // of a type, such as the global `Promise` type in lib.d.ts).
    TypeWithConstructSignatureAndValue,

    // The TypeReferenceNode resolves to a Void-like, Nullable, or Never type.
    VoidNullableOrNeverType,

    // The TypeReferenceNode resolves to a Number-like type.
    NumberLikeType,

    // The TypeReferenceNode resolves to a BigInt-like type.
    BigIntLikeType,

    // The TypeReferenceNode resolves to a String-like type.
    StringLikeType,

    // The TypeReferenceNode resolves to a Boolean-like type.
    BooleanType,

    // The TypeReferenceNode resolves to an Array-like type.
    ArrayLikeType,

    // The TypeReferenceNode resolves to the ESSymbol type.
    ESSymbolType,

    // The TypeReferenceNode resolved to the global Promise constructor symbol.
    Promise,

    // The TypeReferenceNode resolves to a Function type or a type with call signatures.
    TypeWithCallSignature,

    // The TypeReferenceNode resolves to any other type.
    ObjectType,
}

interface TypeImport {
    importDeclaration : ts.ImportDeclaration;
    refName : string;
    modulePath : string;
    isNamespace : boolean;
    isDefault : boolean;
    referenced? : boolean;
    name : string;
    localName : string;
}

interface ClassDetails {
    methodNames : string[];
    propertyNames : string[];
    staticPropertyNames : string[];
    staticMethodNames : string[];
}

const transformer: (program : ts.Program) => ts.TransformerFactory<ts.SourceFile> = (program : ts.Program) => {

    if (typeof program['rtti$emitStandardMetadata'] === 'undefined') {
        let emitDecoratorMetadata = program.getCompilerOptions().emitDecoratorMetadata;
        program['rtti$emitStandardMetadata'] = emitDecoratorMetadata;
        program.getCompilerOptions().emitDecoratorMetadata = false;
    }


    let emitStandardMetadata = program['rtti$emitStandardMetadata'];

    const rttiTransformer: ts.TransformerFactory<ts.SourceFile> = (context : ts.TransformationContext) => {
        function literalNode(node : ts.Node) {
            return { $__isTSNode: true, node };
        }

        let settings = <RttiSettings> context.getCompilerOptions().rtti;
        let trace = settings?.trace ?? false;

        return sourceFile => {
            if (sourceFile.isDeclarationFile || sourceFile.fileName.endsWith('.d.ts'))
                return sourceFile;

            sourceFile = ts.factory.updateSourceFile(
                sourceFile, 
                [ rtHelper(), ...sourceFile.statements ], 
                sourceFile.isDeclarationFile, 
                sourceFile.referencedFiles,
                sourceFile.typeReferenceDirectives,
                sourceFile.hasNoDefaultLib,
                sourceFile.libReferenceDirectives
            );
    
            let importMap = new Map<string,TypeImport>();
            let classMap = new Map<ts.ClassDeclaration,ClassDetails>();
            let currentNameScope : ts.ClassDeclaration | ts.InterfaceDeclaration;
            let currentLexicalScope : ts.SourceFile | ts.Block | ts.ModuleBlock | ts.CaseBlock = sourceFile;
            let metadataCollector = inlineMetadataCollector;
            let outboardMetadataCollector = metadataCollector;

            function scope<T = any>(nameScope : ts.ClassDeclaration | ts.InterfaceDeclaration, callback: () => T) {
                let originalScope = currentNameScope;
                currentNameScope = nameScope;

                try {
                    return callback();
                } finally {
                    currentNameScope = originalScope;
                }
            }

            function inlineMetadataCollector<T extends ts.Node>(node : T, decorators : ts.Decorator[]): T {
                if (ts.isPropertyDeclaration(node)) {
                    return <any>ts.factory.updatePropertyDeclaration(
                        node, 
                        [ ...(node.decorators || []), ...decorators ], 
                        node.modifiers, 
                        node.name, 
                        node.questionToken || node.exclamationToken, 
                        node.type,
                        node.initializer
                    );
                } else if (ts.isMethodDeclaration(node)) {
                    return <any>ts.factory.updateMethodDeclaration(
                        node,
                        [ ...(node.decorators || []), ...decorators ],
                        node.modifiers,
                        node.asteriskToken,
                        node.name,
                        node.questionToken,
                        node.typeParameters,
                        node.parameters,
                        node.type,
                        node.body
                    );
                } else if (ts.isClassDeclaration(node)) {
                    return <any>ts.factory.updateClassDeclaration(
                        node, 
                        [ ...(node.decorators || []), ...decorators ],
                        node.modifiers,
                        node.name,
                        node.typeParameters,
                        node.heritageClauses,
                        node.members
                    );
                } else {
                    throw new TypeError(`Not sure how to collect metadata onto ${node}`);
                }
            }

            function collectMetadata<T = any>(callback : () => T): { node: T, decorators: { property? : string, node : ts.Node, decorator: ts.Decorator }[] } {
                let originalCollector = metadataCollector;
                let originalOutboardCollector = outboardMetadataCollector;

                let decorators : { node : ts.Node, decorator : ts.Decorator }[] = [];

                function externalMetadataCollector<T extends ts.Node>(node : T, addedDecorators : ts.Decorator[]): T {
                    let property : string;

                    if (ts.isMethodDeclaration(node)) {
                        property = node.name.getText();
                    } else if (ts.isPropertyDeclaration(node)) {
                        property = node.name.getText();
                    } else if (ts.isMethodSignature(node)) {
                        property = node.name.getText();
                    } else if (ts.isPropertySignature(node)) {
                        property = node.name.getText();
                    }

                    decorators.push(...addedDecorators.map(decorator => ({ property, node, decorator })));
                    return node;
                };

                metadataCollector = externalMetadataCollector;

                // The outboard metadata collector is used for class elements which are compiled away in the 
                // resulting Javascript, for instance abstract methods. In that case the decorators on the 
                // item are discarded. So instead we collect the metadata for placement outside the class 
                // definition, which is the nearest place where it is valid to insert a call expression.

                outboardMetadataCollector = externalMetadataCollector;

                try {
                    return {
                        node: callback(),
                        decorators
                    }
                } finally {
                    metadataCollector = originalCollector;
                    outboardMetadataCollector = originalOutboardCollector;
                }
            }

            function collectOutboardMetadata<T = any>(callback : () => T): { node: T, decorators: { property? : string, node : ts.Node, decorator: ts.Decorator }[] } {
                let originalCollector = outboardMetadataCollector;

                let decorators : { node : ts.Node, decorator : ts.Decorator }[] = [];

                function externalMetadataCollector<T extends ts.Node>(node : T, addedDecorators : ts.Decorator[]): T {
                    let property : string;

                    if (ts.isMethodDeclaration(node)) {
                        property = node.name.getText();
                    } else if (ts.isPropertyDeclaration(node)) {
                        property = node.name.getText();
                    } else if (ts.isMethodSignature(node)) {
                        property = node.name.getText();
                    } else if (ts.isPropertySignature(node)) {
                        property = node.name.getText();
                    }

                    decorators.push(...addedDecorators.map(decorator => ({ property, node, decorator })));
                    return node;
                };

                outboardMetadataCollector = externalMetadataCollector;
                try {
                    return {
                        node: callback(),
                        decorators
                    }
                } finally {
                    outboardMetadataCollector = originalCollector;
                }
            }

            function assureTypeAvailable(entityName : ts.EntityName) {
                let rootName = getRootNameOfEntityName(entityName);
                let impo = importMap.get(rootName);
                if (impo) {
                    impo.referenced = true;
                    return impo.localName;
                }

                return rootName;
            }

            function propertyPrepend(expr : ts.Expression, propAccess : ts.PropertyAccessExpression | ts.Identifier) {
                if (ts.isIdentifier(propAccess)) {
                    return ts.factory.createPropertyAccessExpression(expr, propAccess);
                } else if (ts.isPropertyAccessExpression(propAccess.expression)) {
                    return ts.factory.createPropertyAccessExpression(propertyPrepend(expr, propAccess.expression), propAccess.name);
                } else if (ts.isIdentifier(propAccess.expression)) {
                    // expr, (identifier, identifier)
                    // ((expr, identifier), identifier)

                    return ts.factory.createPropertyAccessExpression( 
                        ts.factory.createPropertyAccessExpression(
                            expr,
                            propAccess.expression
                        ),
                        propAccess.name
                    );
                } else {
                    console.dir(propAccess);
                    throw new Error(`Unsupported expression type '${ts.SyntaxKind[propAccess.kind]}'`);
                }
            }

            function serializeTypeRef(typeNode : ts.Node, extended): ts.Expression {
                if (!typeNode)
                    return ts.factory.createVoidZero();
                
                let expr = serializeBaseTypeRef(typeNode, extended);

                if (extended) {
                    if (ts.isTypeReferenceNode(typeNode)) {
                        if (typeNode.typeArguments && typeNode.typeArguments.length > 0) {
                            // Handle generic types like Promise<string> etc
                            expr = serialize({ 
                                TΦ: T_GENERIC, 
                                t: literalNode(expr),
                                p: typeNode.typeArguments.map(x => literalNode(serializeTypeRef(x, extended)))
                            });
                        }
                    }
                }

                return expr;
            }

            function serializeBaseTypeRef(typeNode : ts.Node, extended): ts.Expression {
                if (!typeNode)
                    return ts.factory.createVoidZero();
                

                if (ts.isTypeReferenceNode(typeNode)) {
                    const resolver = context['getEmitResolver']();
                    const kind : TypeReferenceSerializationKind = resolver.getTypeReferenceSerializationKind(typeNode.typeName, currentNameScope || currentLexicalScope);
    
                    let expr : ts.PropertyAccessExpression | ts.Identifier ;

                    if (ts.isIdentifier(typeNode.typeName)) {
                        let primitiveTypes = ['Number', 'String', 'Boolean', 'Function', 'Object', 'Promise', 'Symbol'];
                        if (primitiveTypes.includes(typeNode.typeName.text)) {
                            return ts.factory.createIdentifier(typeNode.typeName.text);
                        }
                    }

                    if (kind !== TypeReferenceSerializationKind.Unknown && kind !== TypeReferenceSerializationKind.TypeWithConstructSignatureAndValue)
                        return ts.factory.createIdentifier('Object');

                    let type = program.getTypeChecker().getTypeFromTypeNode(typeNode); 

                    if (type.isIntersection() || type.isUnion())
                        return ts.factory.createIdentifier('Object');

                    if (type.isTypeParameter())
                        return ts.factory.createIdentifier('Object');

                    if (context.getCompilerOptions().module === ts.ModuleKind.CommonJS) {
                        let origName = getRootNameOfEntityName(typeNode.typeName);
                        let impo = importMap.get(origName);
                        
                        if (ts.isIdentifier(typeNode.typeName)) {
                            expr = ts.factory.createIdentifier(origName);
                        } else {
                            expr = cloneEntityNameAsExpr(typeNode.typeName, origName);
                        }

                        if (impo) {
                            impo.referenced = true;
                            if (impo.isDefault) {
                                return ts.factory.createCallExpression(
                                    ts.factory.createIdentifier('require'),
                                    [], [ ts.factory.createStringLiteral(impo.modulePath) ]
                                );
                            } else if (!impo.isNamespace) {
                                expr = propertyPrepend(
                                    ts.factory.createCallExpression(
                                        ts.factory.createIdentifier('require'),
                                        [], [ ts.factory.createStringLiteral(impo.modulePath) ]
                                    ), expr
                                );
                            } else {
                                let rootName = assureTypeAvailable(typeNode.typeName);
                                if (ts.isIdentifier(typeNode.typeName)) {
                                    expr = ts.factory.createIdentifier(rootName);
                                } else {
                                    expr = cloneEntityNameAsExpr(typeNode.typeName, rootName);
                                }
                            }
                        }
                        
                    } else {
                        let rootName = assureTypeAvailable(typeNode.typeName);
                        if (ts.isIdentifier(typeNode.typeName)) {
                            expr = ts.factory.createIdentifier(rootName);
                        } else {
                            expr = cloneEntityNameAsExpr(typeNode.typeName, rootName);
                        }
                    }

                    return expr;
                }

                if (typeNode.kind === ts.SyntaxKind.StringKeyword)
                    return ts.factory.createIdentifier('String');
                else if (typeNode.kind === ts.SyntaxKind.NumberKeyword)
                    return ts.factory.createIdentifier('Number');
                else if (typeNode.kind === ts.SyntaxKind.BooleanKeyword)
                    return ts.factory.createIdentifier('Boolean');
                else if (typeNode.kind === ts.SyntaxKind.BigIntKeyword)
                    return ts.factory.createIdentifier('BigInt');
                else if (typeNode.kind === ts.SyntaxKind.AnyKeyword)
                    return serialize({ TΦ: T_ANY });
                else if (typeNode.kind === ts.SyntaxKind.FunctionType)
                    return ts.factory.createIdentifier('Function');
                else if (typeNode.kind === ts.SyntaxKind.UnknownKeyword)
                    return serialize({ TΦ: T_UNKNOWN });
                else if (ts.isArrayTypeNode(typeNode)) {
                    if (extended)
                        return serialize({ TΦ: T_ARRAY, e: literalNode(serializeTypeRef(typeNode.elementType, true)) });
                    else
                        return ts.factory.createIdentifier('Array');
                }
                
                if (ts.isLiteralTypeNode(typeNode)) {
                    let literal = typeNode.literal;

                    if (ts.isLiteralExpression(literal))
                        return literal;
                    if (ts.isPrefixUnaryExpression(literal))
                        return literal;
                    
                    switch (literal.kind) {
                        case ts.SyntaxKind.NullKeyword:
                            return ts.factory.createIdentifier('null');
                        case ts.SyntaxKind.FalseKeyword:
                            return ts.factory.createIdentifier('false');
                        case ts.SyntaxKind.TrueKeyword:
                            return ts.factory.createIdentifier('true');
                    }
                }
                
                if (ts.isTupleTypeNode(typeNode)) {
                    if (!extended)
                        return ts.factory.createIdentifier('Object');
                    
                    return serialize({
                        TΦ: T_TUPLE,
                        e: typeNode.elements.map(e => {
                            if (ts.isNamedTupleMember(e)) {
                                return { n: e.name.text, t: literalNode(serializeTypeRef(e.type, extended)) };
                            } else {
                                return { t: literalNode(serializeTypeRef(e, extended)) };
                            }
                        })
                    })
                    
                }

                if (ts.isUnionTypeNode(typeNode)) {
                    if (!extended)
                        return ts.factory.createIdentifier('Object');

                    return serialize({
                        TΦ: T_UNION,
                        t: typeNode.types.map(x => literalNode(serializeTypeRef(x, extended)))
                    });
                } else if (ts.isIntersectionTypeNode(typeNode)) {
                    if (!extended)
                        return ts.factory.createIdentifier('Object');
                    
                    return serialize({
                        TΦ: T_INTERSECTION,
                        t: typeNode.types.map(x => literalNode(serializeTypeRef(x, extended)))
                    });
                }

                if (ts.isThisTypeNode(typeNode))
                    return serialize({ TΦ: T_THIS });

                if (ts.isConditionalTypeNode(typeNode))
                    return ts.factory.createIdentifier('Object');

                if (ts.isTypePredicateNode(typeNode))
                    return ts.factory.createIdentifier('Boolean');

                if (typeNode.kind === ts.SyntaxKind.UndefinedKeyword)
                    return ts.factory.createVoidZero();

                if (typeNode.kind === ts.SyntaxKind.VoidKeyword)
                    return serialize({ TΦ: T_VOID })

                /// ??

                if (extended && trace)
                    console.warn(`RTTI: ${sourceFile.fileName}: Warning: ${ts.SyntaxKind[typeNode.kind]} is unsupported, emitting Object`);

                return ts.factory.createIdentifier('Object');
            }

            //////////////////////////////////////////////////////////
            
            function extractClassMetadata(klass : ts.ClassDeclaration | ts.InterfaceDeclaration, details : ClassDetails) {
                let decs : ts.Decorator[] = [
                ];

                if (details.propertyNames.length > 0) {
                    if (ts.isClassDeclaration(klass))
                        decs.push(metadataDecorator('rt:SP', details.staticPropertyNames));
                    decs.push(metadataDecorator('rt:P', details.propertyNames));
                }

                if (details.methodNames.length > 0) {
                    if (ts.isClassDeclaration(klass))
                        decs.push(metadataDecorator('rt:Sm', details.staticMethodNames));
                    decs.push(metadataDecorator('rt:m', details.methodNames));
                }

                if (ts.isClassDeclaration(klass)) {
                    let constructor = klass.members.find(x => ts.isConstructorDeclaration(x)) as ts.ConstructorDeclaration;
                    if (constructor) {
                        decs.push(...extractParamsMetadata(constructor));
                    }
                }

                if (klass.heritageClauses) {
                    for (let clause of klass.heritageClauses) {
                        if (clause.token === ts.SyntaxKind.ImplementsKeyword) {

                            let typeRefs : ts.Expression[] = [];

                            for (let type of clause.types) {
                                let checker = program.getTypeChecker();
                                let symbol = checker.getSymbolAtLocation(type.expression);

                                if (symbol) {
                                    let symbolType = checker.getTypeOfSymbolAtLocation(symbol, type.expression);
                                    let decls = symbol.getDeclarations();
                                    let importSpecifier = <ts.ImportSpecifier>decls.find(x => x.kind === ts.SyntaxKind.ImportSpecifier);
                                    let typeSpecifier : ts.TypeNode = type.typeArguments && type.typeArguments.length === 1 ? type.typeArguments[0] : null;
                                    let localName = type.expression.getText();
                                    let typeImport = importMap.get(localName);

                                    
                                    if (importSpecifier) {
                                        let modSpecifier = importSpecifier.parent.parent.parent.moduleSpecifier;
                                        if (ts.isStringLiteral(modSpecifier)) {
                                            let modulePath = modSpecifier.text;
                                            
                                            let impo = importMap.get(`*:${typeImport.modulePath}`);
                                            if (!impo) {
                                                importMap.set(`*:${modulePath}`, impo = {
                                                    importDeclaration: importSpecifier?.parent?.parent?.parent,
                                                    isDefault: false,
                                                    isNamespace: true,
                                                    localName: `LΦ_${freeImportReference++}`,
                                                    modulePath: modulePath,
                                                    name: `*:${modulePath}`,
                                                    refName: '',
                                                    referenced: true
                                                })
                                            }

                                            impo.referenced = true;
                                            
                                            symbol = checker.getExportSymbolOfSymbol(symbol);
                                            if (symbolType.isClassOrInterface() && !symbolType.isClass()) {
                                                localName = `IΦ${localName}`;
                                            }

                                            typeRefs.push(
                                                ts.factory.createBinaryExpression(
                                                    ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier(impo.localName), localName),
                                                    ts.factory.createToken(ts.SyntaxKind.QuestionQuestionToken),
                                                    ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier(impo.localName), `IΦ${localName}`)
                                                )
                                            );

                                            continue;
                                        } else {
                                            console.error(`RTTI: Unexpected type for module specifier while processing class ${klass.name.text}: ${modSpecifier.getText()} [please report]`);
                                        }
                                    } else {
                                        let interfaceDecl = decls.find(x => ts.isInterfaceDeclaration(x));
                                        let classDecl = decls.find(x => ts.isClassDeclaration(x));

                                        if (interfaceDecl && !classDecl)
                                            localName = `IΦ${localName}`;
                                        
                                        // we're a local declaration
                                        typeRefs.push(ts.factory.createIdentifier(localName));
                                        continue;
                                    }
                                } else {
                                    console.error(`RTTI: Cannot identify type ${type.getText()} on implements clause for class ${klass.name.text} [please report]`);
                                }

                                
                                typeRefs.push(undefined);
                            }

                            decs.push(metadataDecorator('rt:i', typeRefs.map(tr => tr ? literalNode(forwardRef(tr)) : undefined)));

                        } else if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
                            // always at most one class
                        }
                    }
                }

                let fType = ts.isInterfaceDeclaration(klass) ? F_INTERFACE : F_CLASS;
                decs.push(metadataDecorator('rt:f', `${fType}${getVisibility(klass.modifiers)}${isAbstract(klass.modifiers)}${isExported(klass.modifiers)}`));

                return decs;
            }
            
            function extractPropertyMetadata(property : ts.PropertyDeclaration | ts.PropertySignature) {
                return [
                    ...extractTypeMetadata(property.type, 'type'),
                    metadataDecorator('rt:f', `${F_PROPERTY}${getVisibility(property.modifiers)}${isReadOnly(property.modifiers)}`)
                ];
            }

            function classAnalyzer(classDecl : ts.ClassDeclaration): ClassDetails {
                let details : ClassDetails = {
                    methodNames: [],
                    propertyNames: [],
                    staticMethodNames: [],
                    staticPropertyNames: []
                };

                const visitor = function(node : ts.Node) {
                    if (ts.isPropertyDeclaration(node)) {
                        if ((node.modifiers ?? <ts.Modifier[]>[]).some(x => x.kind === ts.SyntaxKind.StaticKeyword)) {
                            details.staticMethodNames.push(node.name.getText());
                        } else {
                            details.staticPropertyNames.push(node.name.getText());
                        }
                    } else if (ts.isMethodDeclaration(node)) {
                        if ((node.modifiers ?? <ts.Modifier[]>[]).some(x => x.kind === ts.SyntaxKind.StaticKeyword)) {
                            details.staticMethodNames.push(node.name.getText());
                        } else {
                            details.methodNames.push(node.name.getText())
                        }
                    } else if (ts.isConstructorDeclaration(node)) {
                        for (let param of node.parameters) {
                            let isProperty = 
                                param.modifiers 
                                && (
                                    param.modifiers.some(x => x.kind === ts.SyntaxKind.PublicKeyword)
                                    || param.modifiers.some(x => x.kind === ts.SyntaxKind.ProtectedKeyword)
                                    || param.modifiers.some(x => x.kind === ts.SyntaxKind.PrivateKeyword)
                                    || param.modifiers.some(x => x.kind === ts.SyntaxKind.ReadonlyKeyword)
                                )
                            ;

                            if (isProperty)
                                details.propertyNames.push(param.name.getText());
                        }
                    } else {
                        ts.visitEachChild(node, visitor, context);
                    }

                    return node;
                }

                ts.visitEachChild(classDecl, visitor, context);

                return details;
            }

            function interfaceAnalyzer(ifaceDecl : ts.InterfaceDeclaration): ClassDetails {
                let details : ClassDetails = {
                    methodNames: [],
                    propertyNames: [],
                    staticPropertyNames: [],
                    staticMethodNames: []
                };

                const visitor = function(node : ts.Node) {
                    if (ts.isPropertySignature(node)) {
                        details.propertyNames.push(node.name.getText());
                    } else if (ts.isMethodSignature(node)) {
                        details.methodNames.push(node.name.getText())
                    } else {
                        ts.visitEachChild(node, visitor, context);
                    }

                    return node;
                }

                ts.visitEachChild(ifaceDecl, visitor, context);

                return details;
            }

            function typeToTypeRef(type : ts.Type): ts.Expression {
                if ((type.flags & ts.TypeFlags.String) !== 0) {
                    return ts.factory.createIdentifier('String');
                } else if ((type.flags & ts.TypeFlags.Number) !== 0) {
                    return ts.factory.createIdentifier('Number');
                } else if ((type.flags & ts.TypeFlags.Boolean) !== 0) { 
                    return ts.factory.createIdentifier('Boolean');
                } else if ((type.flags & ts.TypeFlags.Void) !== 0) {
                    return ts.factory.createVoidZero();
                } else if ((type.flags & ts.TypeFlags.BigInt) !== 0) {
                    return ts.factory.createIdentifier('BigInt');
                } else if (type.isUnion()) {
                    return serialize({
                        TΦ: T_UNION,
                        t: type.types.map(x => literalNode(typeToTypeRef(x)))
                    });
                } else if (type.isIntersection()) {
                    return serialize({
                        TΦ: T_INTERSECTION,
                        t: type.types.map(x => literalNode(typeToTypeRef(x)))
                    });
                } else if (type.isLiteral()) {
                    return serialize(type.value);
                } else if ((type.flags & ts.TypeFlags.Object) !== 0) {
                    if (type.isClass()) {
                        return ts.factory.createIdentifier(type.symbol.name);
                    } else if (type.isClassOrInterface()) {
                        return ts.factory.createIdentifier(`IΦ${type.symbol.name}`);
                    }

                    return ts.factory.createIdentifier('Object');
                } else if ((type.flags & ts.TypeFlags.Any) !== 0) {
                    return serialize({ TΦ: T_ANY });
                }

                // No idea
                return ts.factory.createIdentifier('Object');
            }
        
            function extractMethodMetadata(method : ts.MethodDeclaration | ts.MethodSignature | ts.FunctionDeclaration) {
                let decs : ts.Decorator[] = [];

                if (emitStandardMetadata)
                    decs.push(metadataDecorator('design:type', literalNode(ts.factory.createIdentifier('Function'))));
                                
                decs.push(...extractParamsMetadata(method));

                if (ts.isFunctionDeclaration(method)) {
                    let type = F_FUNCTION;
                    decs.push(metadataDecorator('rt:f', `${type}${isAsync(method.modifiers)}`));
                } else {
                    let type = F_METHOD;
                    let flags = `${type}${getVisibility(method.modifiers)}${isAbstract(method.modifiers)}${isAsync(method.modifiers)}`;
                    decs.push(metadataDecorator('rt:f', flags));
                }

                if (method.type) {
                    decs.push(...extractTypeMetadata(method.type, 'returntype'));
                } else {
                    let signature = program.getTypeChecker().getSignatureFromDeclaration(method);
                    let returnT = typeToTypeRef(signature.getReturnType());
                    decs.push(metadataDecorator('rt:t', literalNode(forwardRef(returnT))));

                    if (emitStandardMetadata)
                        decs.push(metadataDecorator('design:returntype', literalNode(ts.factory.createVoidZero())));
                }

                return decs;
            }
            
            //////////////////////////////////////////////////////////

            function extractTypeMetadata(type : ts.TypeNode, standardName : string) {
                let decs : ts.Decorator[] = [];
                decs.push(metadataDecorator('rt:t', literalNode(forwardRef(serializeTypeRef(type, true)))));
                if (emitStandardMetadata)
                    decs.push(metadataDecorator(`design:${standardName}`, literalNode(serializeTypeRef(type, false))));
                return decs;
            }

            function extractParamsMetadata(method : ts.FunctionLikeDeclaration | ts.MethodSignature) {
                let decs : ts.Decorator[] = [];
                let standardParamTypes : ts.Expression[] = [];
                let serializedParamMeta : any[] = [];

                for (let param of method.parameters) {
                    let expr = serializeTypeRef(param.type, false);
                    standardParamTypes.push(expr);

                    let f : string[] = [];

                    if (param.modifiers) {
                        for (let modifier of Array.from(param.modifiers)) {
                            if (modifier.kind === ts.SyntaxKind.ReadonlyKeyword)
                                f.push(F_READONLY);
                            if (modifier.kind === ts.SyntaxKind.PrivateKeyword)
                                f.push(F_PRIVATE);
                            if (modifier.kind === ts.SyntaxKind.PublicKeyword)
                                f.push(F_PUBLIC);
                            if (modifier.kind === ts.SyntaxKind.ProtectedKeyword)
                                f.push(F_PROTECTED);
                        }
                    }

                    if (param.questionToken)
                        f.push(F_OPTIONAL)

                    let meta : Record<string,any> = {
                        n: param.name.getText(),
                        t: literalNode(forwardRef(serializeTypeRef(param.type, true)))
                    };

                    if (f.length > 0)
                        meta.f = f.join('');
                    
                    serializedParamMeta.push(literalNode(serialize(meta)));
                }

                decs.push(metadataDecorator('rt:p', serializedParamMeta));
                if (emitStandardMetadata) {
                    decs.push(metadataDecorator('design:paramtypes', standardParamTypes.map(t => {
                        
                        return literalNode(t);
                    })));
                }
                
                return decs;
            }
        
            ////////////////////////////////////////////////////////////////////////////

            let interfaceSymbols : { interfaceDecl : ts.InterfaceDeclaration, symbolDecl: ts.Statement[] }[] = [];
            let freeImportReference = 0;

            const visitor = (node : ts.Node): ts.VisitResult<ts.Node> => {
                if (!node)
                    return;

                if (ts.isImportDeclaration(node)) {
                    if (node.importClause) {
                        let bindings = node.importClause.namedBindings;

                        if (!bindings) {
                            let name = node.importClause.name.text;

                            importMap.set(name, {
                                name,
                                localName: name,
                                refName: name,
                                modulePath: (<ts.StringLiteral>node.moduleSpecifier).text,
                                isNamespace: false,
                                isDefault: true,
                                importDeclaration: node
                            })
                        } else if (bindings) {
                            if (ts.isNamedImports(bindings)) {
                                for (let binding of bindings.elements) {
                                    importMap.set(binding.name.text, {
                                        name: binding.name.text,
                                        localName: `${binding.propertyName?.text ?? binding.name.text}Φ`,
                                        refName: binding.name.text,
                                        modulePath: (<ts.StringLiteral>node.moduleSpecifier).text,
                                        isNamespace: false,
                                        isDefault: false,
                                        importDeclaration: node
                                    });

                                    let nameAsInterface = `IΦ${binding.name.text}`;

                                    importMap.set(nameAsInterface, {
                                        name: nameAsInterface,
                                        localName: nameAsInterface,
                                        refName: nameAsInterface,
                                        modulePath: (<ts.StringLiteral>node.moduleSpecifier).text,
                                        isNamespace: false,
                                        isDefault: false,
                                        importDeclaration: node
                                    });
                                }
                            } else if (ts.isNamespaceImport(bindings)) {
                                importMap.set(bindings.name.text, {
                                    name: bindings.name.text,
                                    localName: `${bindings.name.text}Φ`,
                                    modulePath: (<ts.StringLiteral>node.moduleSpecifier).text,
                                    refName: bindings.name.text,
                                    isNamespace: true,
                                    isDefault: false,
                                    importDeclaration: node
                                })
                                bindings.name
                            }
                        }
                    }
                }
                 
                if (ts.isPropertyDeclaration(node)) {
                    if (trace)
                        console.log(`Decorating class property ${node.parent.name.text}#${node.name.getText()}`);

                    if (ts.isClassDeclaration(node.parent))
                        node = metadataCollector(node, extractPropertyMetadata(node));
                    
                } else if (ts.isPropertySignature(node)) {
                    if (trace)
                        console.log(`Decorating interface property ${(node.parent as ts.InterfaceDeclaration).name.text}#${node.name.getText()}`);
                    
                    if (ts.isInterfaceDeclaration(node.parent))
                        node = metadataCollector(node, extractPropertyMetadata(node));
                    
                } else if (ts.isCallExpression(node)) {
                    if (ts.isIdentifier(node.expression)) {
                        let checker = program.getTypeChecker();
                        let symbol = checker.getSymbolAtLocation(node.expression);
                        let type = checker.getTypeOfSymbolAtLocation(symbol, node.expression);
                        let symbolName = symbol?.name;
                        let identifier = node.expression;
                        
                        if (symbol && ['reify', 'reflect'].includes(symbol.name)) {
                            let decls = symbol.getDeclarations();
                            let importSpecifier = <ts.ImportSpecifier>decls.find(x => x.kind === ts.SyntaxKind.ImportSpecifier);
                            let typeSpecifier : ts.TypeNode = node.typeArguments && node.typeArguments.length === 1 ? node.typeArguments[0] : null;

                            if (importSpecifier) {
                                let modSpecifier = importSpecifier.parent.parent.parent.moduleSpecifier;
                                if (ts.isStringLiteral(modSpecifier)) {
                                    let isTypescriptRtti = 
                                        modSpecifier.text === 'typescript-rtti'
                                        || modSpecifier.text.match(/^http.*\/typescript-rtti\/index.js$/)
                                        || modSpecifier.text.match(/^http.*\/typescript-rtti\/index.ts$/)
                                        || modSpecifier.text.match(/^http.*\/typescript-rtti\/?$/)
                                    ;

                                    if (isTypescriptRtti) {
                                        if (typeSpecifier) {
                                            let type = checker.getTypeAtLocation(typeSpecifier);
                                            let localName : string;

                                            if (type) {
                                                if (type.isClassOrInterface() && !type.isClass()) {
                                                    if (ts.isTypeReferenceNode(typeSpecifier)) {
                                                        localName = entityNameToString(typeSpecifier.typeName);
                                                    }
                                                } else {
                                                    if (ts.isTypeReferenceNode(typeSpecifier)) {
                                                        const resolver = context['getEmitResolver']();
                                                        const kind : TypeReferenceSerializationKind = resolver.getTypeReferenceSerializationKind(typeSpecifier.typeName, currentNameScope || currentLexicalScope);
                                        
                                                        if (kind === TypeReferenceSerializationKind.Unknown) {
                                                            if (trace)
                                                                console.warn(`RTTI: warning: ${sourceFile.fileName}: reify<${typeSpecifier.getText()}>: unknown symbol: Assuming imported interface [This may be a bug]`);
                                                            localName = entityNameToString(typeSpecifier.typeName);
                                                        }
                                                    }
                                                }
                                            }

                                            if (!localName) {
                                                let text : string;
                                                try {
                                                    text = typeSpecifier.getText();
                                                } catch (e) {
                                                    if (globalThis.RTTI_TRACE)
                                                        console.warn(`RTTI: Failed to resolve type specifier (see <unresolvable> below):`);
                                                    console.dir(typeSpecifier);
                                                }

                                                throw new CompileError(
                                                    `RTTI: ${sourceFile.fileName}: reify(): ` 
                                                    + `cannot resolve interface: ${text || '<unresolvable>'}: Not supported.`
                                                );
                                            }

                                            let typeImport = importMap.get(localName);
                                            let expression : ts.Expression;

                                            if (typeImport) {
                                                // Special behavior for commonjs (inline require())
                                                // For ESM this is handled by hoisting an import
                                                
                                                if (program.getCompilerOptions().module === ts.ModuleKind.CommonJS) {
                                                    let origName = localName;
                                                    let expr = dottedNameToExpr(`IΦ${localName}`);

                                                    if (typeImport.isDefault) {
                                                        return ts.factory.createCallExpression(
                                                            ts.factory.createIdentifier('require'),
                                                            [], [ ts.factory.createStringLiteral(typeImport.modulePath) ]
                                                        );
                                                    } else if (!typeImport.isNamespace) {
                                                        expr = propertyPrepend(
                                                            ts.factory.createCallExpression(
                                                                ts.factory.createIdentifier('require'),
                                                                [], [ ts.factory.createStringLiteral(typeImport.modulePath) ]
                                                            ), expr
                                                        );
                                                    }

                                                    expression = expr;
                                                } else {

                                                    // ESM

                                                    if (localName) {
                                                        localName = `IΦ${localName}`;
                                                    }
                                                    
                                                    let impo = importMap.get(`*:${typeImport.modulePath}`);
                                                    if (!impo) {
                                                        importMap.set(`*:${typeImport.modulePath}`, impo = {
                                                            importDeclaration: typeImport?.importDeclaration,
                                                            isDefault: false,
                                                            isNamespace: true,
                                                            localName: `LΦ_${freeImportReference++}`,
                                                            modulePath: typeImport.modulePath,
                                                            name: `*:${typeImport.modulePath}`,
                                                            refName: '',
                                                            referenced: true
                                                        })
                                                    }
                                                    
                                                    expression = ts.factory.createPropertyAccessExpression(
                                                        ts.factory.createIdentifier(impo.localName), 
                                                        ts.factory.createIdentifier(localName)
                                                    )
                                                }
                                            } else {
                                                expression = ts.factory.createIdentifier(`IΦ${localName}`);
                                            }
                                            

                                            return ts.factory.createCallExpression(identifier, undefined, [
                                                expression
                                            ]);
                                        }

                                    }
                                }
                            }
                        }
                    }
                
                } else if (ts.isClassDeclaration(node)) {
                    if (trace)
                        console.log(`Decorating class ${node.name.text}`);
                    
                    let details = classAnalyzer(node);
                    
                    return scope(node, () => {
                        let outboardMetadata = collectOutboardMetadata(() => {
                            node = ts.visitEachChild(
                                metadataCollector(node, extractClassMetadata(<ts.ClassDeclaration>node, details)), 
                                visitor, context
                            );
                        });

                        return [
                            node,
                            ...(outboardMetadata.decorators.map(dec => ts.factory.createCallExpression(dec.decorator.expression, undefined, [
                                ts.factory.createPropertyAccessExpression(
                                    ts.factory.createIdentifier((node as ts.ClassDeclaration).name.text), 
                                    'prototype'
                                ),
                                ts.factory.createStringLiteral(dec.property)
                            ])))
                        ]
                    });

                } else if (ts.isInterfaceDeclaration(node)) {
                    interfaceSymbols.push(
                        {
                            interfaceDecl: node,
                            symbolDecl: [
                                ts.factory.createVariableStatement(
                                    [],
                                    ts.factory.createVariableDeclarationList(
                                        [ts.factory.createVariableDeclaration(
                                            ts.factory.createIdentifier(`IΦ${node.name.text}`),
                                            undefined,
                                            undefined,
                                            ts.factory.createObjectLiteralExpression([
                                                ts.factory.createPropertyAssignment(
                                                    'name',
                                                    ts.factory.createStringLiteral(node.name.text)
                                                ),
                                                ts.factory.createPropertyAssignment(
                                                    'prototype',
                                                    ts.factory.createObjectLiteralExpression()
                                                ),
                                                ts.factory.createPropertyAssignment(
                                                    'identity',
                                                    ts.factory.createCallExpression(
                                                        ts.factory.createIdentifier("Symbol"),
                                                        undefined,
                                                        [ts.factory.createStringLiteral(`${node.name.text} (interface)`)]
                                                    )
                                                )
                                            ])
                                            
                                        )],
                                        ts.NodeFlags.Const
                                    )
                                ),
                                ...(
                                    (node.modifiers && node.modifiers.some(x => x.kind === ts.SyntaxKind.ExportKeyword))
                                    ? [ts.factory.createExportDeclaration(
                                        undefined,
                                        undefined,
                                        false,
                                        ts.factory.createNamedExports(
                                            [
                                                ts.factory.createExportSpecifier(
                                                    undefined,
                                                    ts.factory.createIdentifier(`IΦ${node.name.text}`)
                                                )
                                            ]
                                        ),
                                        undefined
                                    )] : []
                                )
                            ]
                        }
                    );
                    
                    if (trace)
                        console.log(`Decorating interface ${node.name.text}`);
                    
                    let details = interfaceAnalyzer(node);
                    
                    return scope(node, () => {
                        let result = collectMetadata(() => {
                            return ts.visitEachChild(node, visitor, context)
                        });

                        return [
                            result.node,
                            ...extractClassMetadata(<ts.InterfaceDeclaration>node, details)
                                .map(decorator => ts.factory.createCallExpression(decorator.expression, undefined, [
                                    ts.factory.createIdentifier(`IΦ${(node as ts.InterfaceDeclaration).name.text}`)
                                ])),
                            ...(result.decorators.map(dec => ts.factory.createCallExpression(dec.decorator.expression, undefined, [
                                ts.factory.createPropertyAccessExpression(
                                    ts.factory.createIdentifier(`IΦ${(node as ts.InterfaceDeclaration).name.text}`), 
                                    'prototype'
                                ),
                                ts.factory.createStringLiteral(dec.property)
                            ])))
                        ]
                    });
                } else if (ts.isFunctionDeclaration(node)) {
                    let metadata = extractMethodMetadata(node);
                    node = ts.visitEachChild(node, visitor, context);
                    return [
                        node,
                        ...(metadata.map(dec => ts.factory.createCallExpression(dec.expression, undefined, [
                            ts.factory.createIdentifier(`${(node as ts.FunctionDeclaration).name.text}`)
                        ])))
                    ]
                } else if (ts.isMethodDeclaration(node)) {
                    if (ts.isClassDeclaration(node.parent)) {
                        if (trace)
                            console.log(`Decorating class method ${node.parent.name.text}#${node.name.getText()}`);
                        
                        let metadata = extractMethodMetadata(node);
                        let name = node.name.getText();
                        let isAbstract = (node.modifiers ?? []).some(x => x.kind === ts.SyntaxKind.AbstractKeyword);

                        if (isAbstract) {
                            outboardMetadataCollector(node, metadata);
                        } else {
                            node = metadataCollector(node, metadata);
                        }
                    }
                } else if (ts.isMethodSignature(node)) {
                    if (ts.isInterfaceDeclaration(node.parent)) {
                        if (trace)
                            console.log(`Decorating interface method ${node.parent.name.text}#${node.name.getText()}`);
                        
                        node = metadataCollector(node, extractMethodMetadata(node));
                    }
                }

                return ts.visitEachChild(node, visitor, context);
            };

            function generateInterfaceSymbols(statements : ts.Statement[]): ts.Statement[] {
                for (let iface of interfaceSymbols) {
                    let impoIndex = statements.indexOf(iface.interfaceDecl);
                    if (impoIndex >= 0) {
                        statements.splice(impoIndex, 0, ...iface.symbolDecl);
                    } else {
                        statements.push(...iface.symbolDecl);
                    }
                    
                }

                return statements;
            }

            function generateImports(statements : ts.Statement[]): ts.Statement[] {
                let imports : ts.ImportDeclaration[] = [];
                let isCommonJS = context.getCompilerOptions().module === ts.ModuleKind.CommonJS;

                for (let impo of importMap.values()) {
                    if (!impo.referenced)
                        continue;

                    // for commonjs we only add extra imports for namespace imports 
                    // (ie import * as x from 'y') and default imports. regular bound imports are handled
                    // with a direct require anyway.

                    if (isCommonJS && !impo.isNamespace && !impo.isDefault)
                        continue;
                       
                    let ownedImpo : ts.ImportDeclaration;

                    if (impo.isDefault) {
                        ownedImpo = ts.factory.createImportDeclaration(
                            undefined,
                            undefined,
                            ts.factory.createImportClause(
                                false, ts.factory.createIdentifier(impo.localName),
                                undefined
                            ),
                            ts.factory.createStringLiteral(
                                (<ts.StringLiteral>impo.importDeclaration.moduleSpecifier).text
                            )
                        );
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
                                                ts.factory.createIdentifier(impo.refName),
                                                ts.factory.createIdentifier(impo.localName)
                                            )
                                        ]
                                    )
                            ),
                            ts.factory.createStringLiteral(
                                (<ts.StringLiteral>impo.importDeclaration.moduleSpecifier).text
                            )
                        );
                    }

                    let impoIndex = statements.indexOf(impo.importDeclaration);
                    if (impoIndex >= 0) {
                        statements.splice(impoIndex, 0, ownedImpo);
                    } else {
                        statements.splice(0, 0, ownedImpo);
                    }
                }

                return statements;
            }

            try {
                sourceFile = ts.visitNode(sourceFile, visitor);
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
            }

            return sourceFile;
        };
    }

    return rttiTransformer;
};

export default transformer;