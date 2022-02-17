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

import { F_CLASS, F_METHOD, F_OPTIONAL, F_PRIVATE, F_PROPERTY, F_PROTECTED, F_PUBLIC, F_READONLY, getVisibility, isAbstract, isAsync, isExported, isReadOnly } from './flags';
import { forwardRef, functionForwardRef } from './forward-ref';
import { decorateFunctionExpression, directMetadataDecorator, legacyMetadataDecorator, metadataDecorator } from './metadata-decorator';
import { rtfHelper, rtHelper } from './rt-helper';
import { serialize } from './serialize';
import * as ts from 'typescript';
import { T_ANY, T_ARRAY, T_INTERSECTION, T_THIS, T_TUPLE, T_UNION, T_UNKNOWN, T_GENERIC, T_VOID, F_FUNCTION, F_INTERFACE, RtSerialized, RtParameter, LiteralSerializedNode, F_STATIC, F_ARROW_FUNCTION } from '../common';
import { cloneEntityNameAsExpr, dottedNameToExpr, entityNameToString, getRootNameOfEntityName } from './utils';
import { literalNode } from './literal-node';
import { legacyDecorator } from './legacy-decorator';

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

    let compilerOptions = program.getCompilerOptions();

    if (typeof compilerOptions['rtti$emitStandardMetadata'] === 'undefined') {
        let emitDecoratorMetadata = compilerOptions.emitDecoratorMetadata;
        compilerOptions['rtti$emitStandardMetadata'] = emitDecoratorMetadata;
        compilerOptions.emitDecoratorMetadata = false;
    }


    let emitStandardMetadata = compilerOptions['rtti$emitStandardMetadata'];

    if (globalThis.RTTI_TRACE)
        console.log(`RTTI: Entering program [emitDecoratorMetadata=${emitStandardMetadata}]`);
    
    const rttiTransformer: ts.TransformerFactory<ts.SourceFile> = (context : ts.TransformationContext) => {
        let settings = <RttiSettings> context.getCompilerOptions().rtti;
        let trace = settings?.trace ?? false;

        globalThis.RTTI_TRACE = trace;

        return sourceFile => {

            if (trace)
                console.log(`#### Processing ${sourceFile.fileName}`);
            if (sourceFile.isDeclarationFile || sourceFile.fileName.endsWith('.d.ts'))
                return sourceFile;

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
                if (decorators.length === 0)
                    return node;
                
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
                } else if (ts.isGetAccessor(node)) {
                    return <any>ts.factory.updateGetAccessorDeclaration(
                        node,
                        [ ...(node.decorators || []), ...decorators ],
                        node.modifiers,
                        node.name,
                        node.parameters,
                        node.type, 
                        node.body
                    );
                } else if (ts.isSetAccessor(node)) {
                    return <any>ts.factory.updateSetAccessorDeclaration(
                        node,
                        [ ...(node.decorators || []), ...decorators ],
                        node.modifiers,
                        node.name,
                        node.parameters,
                        node.body
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

            function collectMetadata<T = any>(callback : () => T): { node: T, decorators: { property? : string, node : ts.Node, decorator: ts.Decorator, direct: boolean }[] } {
                let originalCollector = metadataCollector;
                let originalOutboardCollector = outboardMetadataCollector;

                let decorators : { node : ts.Node, decorator : ts.Decorator, direct : boolean }[] = [];

                function externalMetadataCollector<T extends ts.Node>(node : T, addedDecorators : ts.Decorator[]): T {
                    let property : string;

                    if (ts.isMethodDeclaration(node)) {
                        property = node.name.getText();
                    } else if (ts.isPropertyDeclaration(node) || ts.isGetAccessor(node) || ts.isSetAccessor(node)) {
                        property = node.name.getText();
                    } else if (ts.isMethodSignature(node)) {
                        property = node.name.getText();
                    } else if (ts.isPropertySignature(node)) {
                        property = node.name.getText();
                    }

                    let legacyDecorators = addedDecorators.filter(decorator => decorator['__Φlegacy']);
                    let nonLegacyDecorators = addedDecorators.filter(decorator => !decorator['__Φlegacy']);

                    decorators.push(...nonLegacyDecorators.map(decorator => ({ property, node, decorator, direct: decorator['__Φdirect'] ?? false })));

                    // Only apply legacy decorators (inline) when there are other 
                    // decorators to match TS' own semantics

                    if (node.decorators?.length > 0 && legacyDecorator.length > 0) {
                        node = inlineMetadataCollector(node, legacyDecorators);
                    }
                    
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

            function collectOutboardMetadata<T = any>(callback : () => T): { 
                node: T, decorators: { property? : string, node : ts.Node, decorator: ts.Decorator, direct: boolean }[] 
            } {
                let originalCollector = outboardMetadataCollector;

                let decorators : { node : ts.Node, decorator : ts.Decorator, direct : boolean }[] = [];

                function externalMetadataCollector<T extends ts.Node>(node : T, addedDecorators : ts.Decorator[]): T {
                    let property : string;

                    if (ts.isMethodDeclaration(node)) {
                        property = node.name.getText();
                    } else if (ts.isPropertyDeclaration(node) || ts.isSetAccessor(node) || ts.isGetAccessor(node)) {
                        property = node.name.getText();
                    } else if (ts.isMethodSignature(node)) {
                        property = node.name.getText();
                    } else if (ts.isPropertySignature(node)) {
                        property = node.name.getText();
                    }

                    decorators.push(...addedDecorators.map(decorator => ({ property, node, decorator, direct: decorator['__Φdirect'] ?? false })));
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
                    return ts.factory.createIdentifier('Object');
                
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

                    if (kind === TypeReferenceSerializationKind.StringLikeType)
                        return ts.factory.createIdentifier('String');
                    if (kind === TypeReferenceSerializationKind.NumberLikeType)
                        return ts.factory.createIdentifier('Number');
                    
                    if (kind !== TypeReferenceSerializationKind.Unknown && kind !== TypeReferenceSerializationKind.TypeWithConstructSignatureAndValue)
                        return ts.factory.createIdentifier('Object');

                    let type = program.getTypeChecker().getTypeFromTypeNode(typeNode); 
                    let isInterface = type.isClassOrInterface() && !type.isClass();
                    let typeSymbol = type.getSymbol();

                    // Interfaces can shadow classes. Sometimes we think it's an interface, but really it should 
                    // be a class

                    if (isInterface && typeSymbol && typeSymbol.valueDeclaration) {
                        isInterface = false;
                    }

                    if (type.isIntersection() || type.isUnion())
                        return ts.factory.createIdentifier('Object');

                    if (type.isTypeParameter())
                        return ts.factory.createIdentifier('Object');


                    if (context.getCompilerOptions().module === ts.ModuleKind.CommonJS) {
                        let origName = getRootNameOfEntityName(typeNode.typeName);

                        if (isInterface)
                            origName = `IΦ${origName}`;
                        
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
            
            function extractPropertyMetadata(property : ts.PropertyDeclaration | ts.PropertySignature | ts.GetAccessorDeclaration | ts.SetAccessorDeclaration) {
                let type : ts.TypeNode = property.type;
                if (!type && ts.isSetAccessor(property) && property.parameters.length > 0) {
                    type = property.parameters[0].type;
                }

                return [
                    ...extractTypeMetadata(
                        type, 'type', 
                        (ts.isPropertyDeclaration(property) || ts.isGetAccessor(property) || ts.isSetAccessor(property)) 
                            && property.decorators?.length > 0
                    ),
                    metadataDecorator('rt:f', `${F_PROPERTY}${getVisibility(property.modifiers)}${isReadOnly(property.modifiers)}`)
                ];
            }

            function classAnalyzer(classDecl : ts.ClassDeclaration): ClassDetails {
                let className = classDecl.name.getText();
                let details : ClassDetails = {
                    methodNames: [],
                    propertyNames: [],
                    staticMethodNames: [],
                    staticPropertyNames: []
                };

                function addItem(list : string[], prop : string) {
                    if (!list.includes(prop))
                        list.push(prop);
                }

                const visitor = function(node : ts.Node) {
                    if (ts.isPropertyDeclaration(node)) {
                        if ((node.modifiers ?? <ts.Modifier[]>[]).some(x => x.kind === ts.SyntaxKind.StaticKeyword)) {
                            addItem(details.staticPropertyNames, node.name.getText());
                        } else {
                            addItem(details.propertyNames, node.name.getText());
                        }
                    } else if (ts.isGetAccessor(node)) {
                        if ((node.modifiers ?? <ts.Modifier[]>[]).some(x => x.kind === ts.SyntaxKind.StaticKeyword)) {
                            addItem(details.staticPropertyNames, node.name.getText());
                        } else {
                            addItem(details.propertyNames, node.name.getText());
                        }
                    } else if (ts.isSetAccessor(node)) {
                        if ((node.modifiers ?? <ts.Modifier[]>[]).some(x => x.kind === ts.SyntaxKind.StaticKeyword)) {
                            addItem(details.staticPropertyNames, node.name.getText());
                        } else {
                            addItem(details.propertyNames, node.name.getText());
                        }
                    } else if (ts.isMethodDeclaration(node)) {
                        if ((node.modifiers ?? <ts.Modifier[]>[]).some(x => x.kind === ts.SyntaxKind.StaticKeyword)) {
                            addItem(details.staticMethodNames, node.name.getText());
                        } else {
                            addItem(details.methodNames, node.name.getText())
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
                                addItem(details.propertyNames, param.name.getText());
                        }
                    } else {
                        try {
                            ts.visitEachChild(node, visitor, context);
                        } catch (e) {
                            console.error(`RTTI: During class analyzer visit for node '${node.getText()}': ${e.message}`);
                            throw e;
                        }
                    }

                    return node;
                }

                try {
                    ts.visitEachChild(classDecl, visitor, context);
                } catch (e) {
                    console.error(`RTTI: During analyzer for class ${className}: ${e.message}`);
                    throw e;
                }

                return details;
            }

            function interfaceAnalyzer(ifaceDecl : ts.InterfaceDeclaration): ClassDetails {
                let interfaceName = ifaceDecl.name.getText();
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
                        try {
                            ts.visitEachChild(node, visitor, context);
                        } catch (e) {
                            console.error(`RTTI: During interface analyzer visitor for ${node.getText()}: ${e.message}`);
                            throw e;
                        }
                    }

                    return node;
                }

                try {
                    ts.visitEachChild(ifaceDecl, visitor, context);
                } catch (e) {
                    console.error(`RTTI: During analyzer for interface ${interfaceName}: ${e.message}`);
                    throw e;
                }

                return details;
            }

            function typeToTypeRef(type : ts.Type, extended : boolean = true): ts.Expression {                
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
                    let objectType = <ts.ObjectType>type;

                    if ((objectType.objectFlags & ts.ObjectFlags.Reference) !== 0) {
                        let typeRef = <ts.TypeReference>type;

                        if (typeRef.target !== typeRef) {
                            if (extended) {
                                // generic
                                return serialize({
                                    TΦ: T_GENERIC, 
                                    t: literalNode(typeToTypeRef(typeRef.target)),
                                    p: (typeRef.typeArguments ?? []).map(x => literalNode(typeToTypeRef(x)))
                                })
                            } else {
                                return typeToTypeRef(typeRef.target);
                            }
                        }
                    }

                    if (type.symbol.name === '__object') {
                        // TODO: anonymous object type, not yet supported
                        return ts.factory.createIdentifier('Object');
                    }

                    if ((type.symbol.flags & ts.SymbolFlags.Function) !== 0) {
                        return ts.factory.createIdentifier(`Function`);
                    } else if (type.isClassOrInterface()) { 
                        let reifiedType = <boolean>type.isClass() || type.symbol.name === 'Promise' || !!type.symbol.valueDeclaration;
                        let symbolName = reifiedType ? type.symbol.name : `IΦ${type.symbol.name}`;
                        return ts.factory.createIdentifier(symbolName);
                    }

                    return ts.factory.createIdentifier('Object');
                } else if ((type.flags & ts.TypeFlags.Any) !== 0) {
                    return serialize({ TΦ: T_ANY });
                }

                // No idea
                return ts.factory.createIdentifier('Object');
            }
        
            function extractMethodFlags(method : ts.MethodDeclaration | ts.MethodSignature | ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction) {
                if (ts.isFunctionDeclaration(method) || ts.isArrowFunction(method)) {
                    let type = F_FUNCTION;
                    return `${type}${isAsync(method.modifiers)}${ts.isArrowFunction(method) ? F_ARROW_FUNCTION : ''}`;
                }
                
                let type = F_METHOD;
                let flags = `${type}${getVisibility(method.modifiers)}${isAbstract(method.modifiers)}${isAsync(method.modifiers)}`;
                
                if (ts.isMethodDeclaration(method) && (method.modifiers ?? <ts.Modifier[]>[]).some(x => x.kind === ts.SyntaxKind.StaticKeyword))
                    flags += F_STATIC;
                
                return flags;
            }

            function extractMethodMetadata(method : ts.MethodDeclaration | ts.MethodSignature | ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction) {
                let decs : ts.Decorator[] = [];

                if (emitStandardMetadata && ts.isMethodDeclaration(method) && method.decorators?.length > 0)
                    decs.push(legacyMetadataDecorator('design:type', literalNode(ts.factory.createIdentifier('Function'))));
                                
                decs.push(...extractParamsMetadata(method));
                decs.push(metadataDecorator('rt:f', extractMethodFlags(method)));

                if (method.type) {
                    decs.push(...extractTypeMetadata(method.type, 'returntype', ts.isMethodDeclaration(method) && method.decorators?.length > 0));
                } else {
                    let signature = program.getTypeChecker().getSignatureFromDeclaration(method);
                    if (signature) {
                        decs.push(metadataDecorator('rt:t', literalNode(
                            forwardRef(typeToTypeRef(signature.getReturnType()))
                        )));

                        if (emitStandardMetadata && ts.isMethodDeclaration(method) && method.decorators?.length > 0) {
                            decs.push(legacyMetadataDecorator('design:returntype', literalNode(
                                typeToTypeRef(signature.getReturnType(), false)))
                            );
                        }
                    }
                }

                return decs;
            }
            
            //////////////////////////////////////////////////////////

            function extractTypeMetadata(type : ts.TypeNode, standardName : string, allowStandardMetadata = true) {
                let decs : ts.Decorator[] = [];
                decs.push(metadataDecorator('rt:t', literalNode(forwardRef(serializeTypeRef(type, true)))));
                if (emitStandardMetadata && allowStandardMetadata)
                    decs.push(legacyMetadataDecorator(`design:${standardName}`, literalNode(serializeTypeRef(type, false))));
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

                    let meta : RtSerialized<RtParameter> = {
                        n: param.name?.getText(),
                        t: literalNode(forwardRef(serializeTypeRef(param.type, true))),
                        v: param.initializer ? literalNode(functionForwardRef(param.initializer)) : null
                    };

                    if (f.length > 0)
                        meta.f = f.join('');
                    
                    serializedParamMeta.push(literalNode(serialize(meta)));
                }

                decs.push(metadataDecorator('rt:p', serializedParamMeta));

                let eligibleForLegacyDecorators = (ts.isMethodDeclaration(method) || ts.isConstructorDeclaration(method));
                let isDecorated = method.decorators?.length > 0;
                if (ts.isConstructorDeclaration(method)) {
                    isDecorated = method.parent.decorators?.length > 0;
                }

                if (emitStandardMetadata && eligibleForLegacyDecorators && isDecorated)
                    decs.push(metadataDecorator('design:paramtypes', standardParamTypes.map(t => literalNode(t))));
                
                return decs;
            }

            function emitOutboardMetadata<NodeT extends ts.ClassDeclaration | ts.InterfaceDeclaration>(
                node : NodeT, 
                outboardMetadata : { node: NodeT, decorators: { property? : string, node : ts.Node, decorator: ts.Decorator, direct: boolean }[] }
            ) {
                let nodes : ts.Node[] = [];
                let elementName = node.name.text;
                for (let dec of outboardMetadata.decorators) {
                    
                    let host : ts.Expression = ts.factory.createIdentifier(elementName);
    
                    if (ts.isInterfaceDeclaration(node)) {
                        let interfaceName = `IΦ${node.name.text}`;
                        host = ts.factory.createIdentifier(interfaceName);
                    }
    
                    let isStatic = false;

                    if (ts.isPropertyDeclaration(dec.node) || ts.isMethodDeclaration(dec.node) || ts.isGetAccessor(dec.node) || ts.isSetAccessor(dec.node))
                        isStatic = (dec.node.modifiers ?? <ts.Modifier[]>[]).some(x => x.kind === ts.SyntaxKind.StaticKeyword);
                    if (ts.isClassDeclaration(dec.node))
                        isStatic = true;
                    
                    if (!isStatic)
                        host = ts.factory.createPropertyAccessExpression(host, 'prototype');
                    
                    if (dec.property) {
                        if (dec.direct) {
                            host = ts.factory.createPropertyAccessExpression(host, dec.property);
                            nodes.push(ts.factory.createExpressionStatement(ts.factory.createCallExpression(dec.decorator.expression, undefined, [ host ])));
                        } else {
                            nodes.push(ts.factory.createExpressionStatement(ts.factory.createCallExpression(dec.decorator.expression, undefined, [ 
                                host,
                                ts.factory.createStringLiteral(dec.property)
                            ])));
                        }
                    } else {
                        nodes.push(ts.factory.createExpressionStatement(ts.factory.createCallExpression(dec.decorator.expression, undefined, [ 
                            host
                        ])));
                    }
                }

                return nodes;
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
                    if (ts.isClassDeclaration(node.parent)) {
                        if (trace)
                            console.log(`Decorating class property ${node.parent.name.text}#${node.name.getText()}`);
                        node = metadataCollector(node, extractPropertyMetadata(node));
                    }
                } else if (ts.isGetAccessor(node)) {
                    if (ts.isClassDeclaration(node.parent)) {
                        if (trace)
                            console.log(`Decorating class property getter ${node.parent.name.text}#${node.name.getText()}`);
                        node = metadataCollector(node, extractPropertyMetadata(node));
                    }
                } else if (ts.isSetAccessor(node)) {
                    if (ts.isClassDeclaration(node.parent)) {
                        if (trace)
                            console.log(`Decorating class property getter ${node.parent.name.text}#${node.name.getText()}`);
                        node = metadataCollector(node, extractPropertyMetadata(node));
                    }
                } else if (ts.isPropertySignature(node)) {
                    if (trace)
                        console.log(`Decorating interface property ${(node.parent as ts.InterfaceDeclaration).name.text}#${node.name.getText()}`);
                    
                    if (ts.isInterfaceDeclaration(node.parent))
                        node = metadataCollector(node, extractPropertyMetadata(node));
                    
                } else if (ts.isCallExpression(node)) {
                    if (ts.isIdentifier(node.expression)) {
                        let checker = program.getTypeChecker();
                        let symbol = checker.getSymbolAtLocation(node.expression);
                        if (symbol) {
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
                    }
                
                } else if (ts.isClassDeclaration(node)) {
                    if (trace)
                        console.log(`Decorating class ${node.name.text}`);
                    
                    let details = classAnalyzer(node);
                    let className = node.name.getText();

                    return scope(node, () => {
                        let outboardMetadata = collectMetadata(() => {
                            try {
                                node = ts.visitEachChild(
                                    metadataCollector(node, extractClassMetadata(<ts.ClassDeclaration>node, details)), 
                                    visitor, context
                                );
                                return <ts.ClassDeclaration>node;
                            } catch (e) {
                                console.error(`RTTI: During outboard metadata collection for class ${className}: ${e.message}`);
                                throw e;
                            }
                        });

                        if (trace) console.log(` - ${outboardMetadata.decorators.length} outboard decorators`);

                        return [
                            node,
                            ...(emitOutboardMetadata(node as ts.ClassDeclaration, outboardMetadata))
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
                                                    false,
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
                    let interfaceName = node.name.getText();
                    let interfaceDecl = node;
                    
                    return scope(node, () => {
                        let result = collectMetadata(() => {
                            try {
                                return <ts.InterfaceDeclaration>ts.visitEachChild(node, visitor, context)
                            } catch (e) {
                                console.error(`RTTI: During metadata collection for interface ${interfaceName}: ${e.message}`);
                                throw e;
                            }
                        });

                        return [
                            result.node,
                            ...extractClassMetadata(<ts.InterfaceDeclaration>node, details)
                                .map(decorator => ts.factory.createCallExpression(decorator.expression, undefined, [
                                    ts.factory.createIdentifier(`IΦ${(node as ts.InterfaceDeclaration).name.text}`)
                                ])),
                            ...emitOutboardMetadata(interfaceDecl, result),
                            ...(result.decorators.map(dec => ts.factory.createCallExpression(dec.decorator.expression, undefined, [
                                ts.factory.createPropertyAccessExpression(
                                    ts.factory.createIdentifier(`IΦ${(node as ts.InterfaceDeclaration).name.text}`), 
                                    'prototype'
                                ),
                                ts.factory.createStringLiteral(dec.property)
                            ])))
                        ]
                    });
                } else if (ts.isFunctionDeclaration(node) && node.body) {
                    // Note that we check for node.body here ^^ in case of
                    // "function a();" which will trigger an error later anyway.

                    let metadata = extractMethodMetadata(node);
                    let functionName = node.name.getText();

                    if (!ts.isBlock(node.parent) && !ts.isSourceFile(node.parent)) {
                        // Care must be taken here. Take this example:
                        //   if (true) function foo() { return 123 }
                        //   expect(foo()).to.equal(123)
                        //
                        // In that case, foo() is *declared*, not an expression,
                        // and it should be available outside the if() statement.
                        // A corner case, but one that we shouldn't break on.
                        // Since a function declaration in an expression becomes a 
                        // function expression, and named function expressions have 
                        // their own scope, we can't just emit ie: 
                        //
                        //   if (true) __RfΦ(function a() { }, [ ... ])
                        //
                        // ...because a() will no longer be in scope. 
                        // Thankfully, since function declaration semantics match those of 
                        // the var keyword, we can accomplish this with:
                        //
                        //    if (true) var a = __RfΦ(function a() { }, [ ... ])

                        let expr = ts.factory.createFunctionExpression(
                            node.modifiers, node.asteriskToken, node.name, node.typeParameters, node.parameters, 
                            node.type, node.body
                        );

                        try {
                            expr = ts.visitEachChild(expr, visitor, context);
                        } catch (e) {
                            console.error(`RTTI: During non-block function declaration ${functionName}: ${e.message}`);
                            throw e;
                        }

                        return ts.factory.createVariableStatement([], [
                            ts.factory.createVariableDeclaration(
                                node.name.getText(), undefined, undefined, 
                                decorateFunctionExpression(expr, metadata)
                            )
                        ]);
                    }

                    try {
                        node = ts.visitEachChild(node, visitor, context);
                    } catch (e) {
                        console.error(`RTTI: During function declaration ${functionName}: ${e.message}`);
                        throw e;
                    }

                    return [
                        node,
                        ...(metadata.map(dec => ts.factory.createExpressionStatement(ts.factory.createCallExpression(dec.expression, undefined, [
                            ts.factory.createIdentifier(`${(node as ts.FunctionDeclaration).name.text}`)
                        ]))))
                    ]
                } else if (ts.isArrowFunction(node)) {
                    return decorateFunctionExpression(ts.visitEachChild(node, visitor, context), extractMethodMetadata(node));
                } else if (ts.isFunctionExpression(node)) {
                    return decorateFunctionExpression(ts.visitEachChild(node, visitor, context), extractMethodMetadata(node));
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
                            // Also collect the flags and host reference on the concrete method itself for resolving
                            // ReflectedMethod from a bare method function.

                            outboardMetadataCollector(node, [ 
                                directMetadataDecorator('rt:f', extractMethodFlags(node)),
                                directMetadataDecorator('rt:h', literalNode(forwardRef(node.parent.name)))
                            ]);

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

                if (node === undefined || node === null)
                    throw new Error(`RTTI: Bugcheck: Node should not be undefined/null here`);
                
                try {
                    return ts.visitEachChild(node, visitor, context);
                } catch (e) {
                    console.error(`RTTI: Failed while processing node '${node.getText()}' in ${node.getSourceFile().fileName}:`);
                    console.error(e);

                    throw e;
                }
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
                                                false,
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

            sourceFile = ts.factory.updateSourceFile(
                sourceFile, 
                [ rtHelper(), rtfHelper(), ...sourceFile.statements ], 
                sourceFile.isDeclarationFile, 
                sourceFile.referencedFiles,
                sourceFile.typeReferenceDirectives,
                sourceFile.hasNoDefaultLib,
                sourceFile.libReferenceDirectives
            );
    
            return sourceFile;
        };
    }

    return rttiTransformer;
};

export default transformer;