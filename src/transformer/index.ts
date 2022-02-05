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
 * - The "rt:t" metadata item represents the "type" of an item. This is the type of a property, the return type of a method,
 *   or Function in the case of a class (similar to "design:type" for a class).
 * - The "rt:p" metadata item represents parameters of a method or a class (ie constructor). It is an array of objects which 
 *   each have n (name : string), t (type : Function), and optionally f (flags : string) options. The meaning of flags is 
 *   as above.
 * - The "rt:P" metadata item represents an array of property names
 * - The "rt:m" metadata item represents an array of method names
 * 
 */

import { F_ABSTRACT, F_CLASS, F_METHOD, F_OPTIONAL, F_PRIVATE, F_PROPERTY, F_PROTECTED, F_PUBLIC, F_READONLY, getVisibility, isAbstract, isExported, isReadOnly } from './flags';
import { forwardRef } from './forward-ref';
import { metadataDecorator } from './metadata-decorator';
import { rtHelper } from './rt-helper';
import { serialize } from './serialize';
import * as ts from 'typescript';
import { cloneEntityNameAsExpr, getRootNameOfEntityName } from './utils';
import { T_ANY, T_ARRAY, T_GENERIC, T_INTERSECTION, T_THIS, T_TUPLE, T_UNION, T_UNKNOWN } from '../common';

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

        let trace = false;

        return sourceFile => {
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
            let currentNameScope : ts.ClassDeclaration;
            let currentLexicalScope : ts.SourceFile | ts.Block | ts.ModuleBlock | ts.CaseBlock = sourceFile;

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

                /// ??

                if (extended)
                    console.warn(`RTTI: ${sourceFile.fileName}: Warning: ${ts.SyntaxKind[typeNode.kind]} is unsupported, emitting Object`);

                return ts.factory.createIdentifier('Object');
            }

            //////////////////////////////////////////////////////////
            
            function extractClassMetadata(klass : ts.ClassDeclaration, details : ClassDetails) {
                let decs : ts.Decorator[] = [
                ];

                if (details.propertyNames.length > 0)
                    decs.push(metadataDecorator('rt:P', details.propertyNames));
                if (details.methodNames.length > 0)
                    decs.push(metadataDecorator('rt:m', details.methodNames));

                let constructor = klass.members.find(x => ts.isConstructorDeclaration(x)) as ts.ConstructorDeclaration;
                if (constructor) {
                    decs.push(...extractParamsMetadata(constructor));
                }

                decs.push(metadataDecorator('rt:f', `${F_CLASS}${getVisibility(klass.modifiers)}${isAbstract(klass.modifiers)}${isExported(klass.modifiers)}`));

                return decs;
            }

            function extractPropertyMetadata(property : ts.PropertyDeclaration) {
                return [
                    ...extractTypeMetadata(property.type, 'type'),
                    metadataDecorator('rt:f', `${F_PROPERTY}${getVisibility(property.modifiers)}${isReadOnly(property.modifiers)}`)
                ];
            }

            function classAnalyzer(classDecl : ts.ClassDeclaration): ClassDetails {
                let details : ClassDetails = {
                    methodNames: [],
                    propertyNames: []
                };

                const visitor = function(node : ts.Node) {
                    if (ts.isPropertyDeclaration(node)) {
                        details.methodNames.push(node.name.getText())
                    } else if (ts.isMethodDeclaration(node)) {
                        details.methodNames.push(node.name.getText())
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
                } else if ((type.flags & ts.TypeFlags.Object) !== 0) {
                    return ts.factory.createIdentifier('Object');
                }

                // No idea
                return ts.factory.createIdentifier('Object');
            }
        
            function extractMethodMetadata(method : ts.MethodDeclaration) {
                let decs : ts.Decorator[] = [];

                if (emitStandardMetadata)
                    decs.push(metadataDecorator('design:type', literalNode(ts.factory.createIdentifier('Function'))));
                                
                decs.push(...extractParamsMetadata(method));
                decs.push(metadataDecorator('rt:f', `${F_METHOD}${getVisibility(method.modifiers)}${isAbstract(method.modifiers)}`));

                let returnType : ts.Expression;
                if (method.type) {
                    returnType = serializeTypeRef(method.type, true);
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

            function extractParamsMetadata(method : ts.FunctionLikeDeclaration) {
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

            const visitor = (node : ts.Node) => {
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
                        console.log(`Decorating property ${node.parent.name.text}#${node.name.getText()}`);

                    if (ts.isClassDeclaration(node.parent)) {
                        node = ts.factory.updatePropertyDeclaration(
                            node, 
                            [ ...(node.decorators || []), ...extractPropertyMetadata(node) ], 
                            node.modifiers, 
                            node.name, 
                            node.questionToken || node.exclamationToken, 
                            node.type,
                            node.initializer
                        )
                    }
                } else if (ts.isClassDeclaration(node)) {
                    if (trace)
                        console.log(`Decorating class ${node.name.text}`);
                    
                    let details = classAnalyzer(node);
                    
                    let savedCurrentNameScope = currentNameScope;
                    currentNameScope = node;
                    try {
                        node = ts.factory.updateClassDeclaration(
                            node, 
                            [ ...(node.decorators || []), ...extractClassMetadata(node, details) ],
                            node.modifiers,
                            node.name,
                            node.typeParameters,
                            node.heritageClauses,
                            node.members
                        );

                        return ts.visitEachChild(node, visitor, context);
                    } finally {
                        currentNameScope = savedCurrentNameScope;
                    }
                } else if (ts.isMethodDeclaration(node)) {
                    if (ts.isClassDeclaration(node.parent)) {
                        if (trace)
                            console.log(`Decorating method ${ts.isClassDeclaration(node.parent) ? node.parent.name.text : '<anon>'}#${node.name.getText()}`);
                        
                        node = ts.factory.updateMethodDeclaration(
                            node,
                            [ ...(node.decorators || []), ...extractMethodMetadata(node) ],
                            node.modifiers,
                            node.asteriskToken,
                            node.name,
                            node.questionToken,
                            node.typeParameters,
                            node.parameters,
                            node.type,
                            node.body
                        );
                    }
                }

                return ts.visitEachChild(node, visitor, context);
            };

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
                    generateImports(Array.from(sourceFile.statements)), 
                    sourceFile.isDeclarationFile, 
                    sourceFile.referencedFiles,
                    sourceFile.typeReferenceDirectives,
                    sourceFile.hasNoDefaultLib,
                    sourceFile.libReferenceDirectives
                );
            } catch (e) {
                console.error(e);
                console.error(`RTTI: Failed to build source file ${sourceFile.fileName}: ${e.message}`);
            }

            return sourceFile;
        };
    }

    return rttiTransformer;
};

export default transformer;