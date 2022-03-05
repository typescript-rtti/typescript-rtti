import ts from "typescript";
import { T_ANY, T_ARRAY, T_FALSE, T_GENERIC, T_INTERSECTION, T_MAPPED, T_NULL, T_STAND_IN, T_THIS, T_TRUE, T_TUPLE, T_UNDEFINED, T_UNION, T_UNKNOWN, T_VOID } from "../common";
import { literalNode } from "./literal-node";
import { RttiContext } from "./rtti-context";
import { serialize } from "./serialize";
import { MappedType } from "./ts-internal-types";
import { hasFlag, isFlagType, propertyPrepend, serializeEntityNameAsExpression } from "./utils";

export class TypeEncoder {
    constructor(
        readonly ctx : RttiContext,
    ) {
    }

    get typeMap() { return this.ctx.typeMap; }
    get program() { return this.ctx.program; }
    get sourceFile() { return this.ctx.sourceFile; }
    get importMap() { return this.ctx.importMap; }
    get checker() { return this.ctx.checker; }

    referToTypeOfInitializer(initializer : ts.Expression, typeNode? : ts.TypeNode) {
        if (typeNode)
            return this.referToTypeNode(typeNode);

        return this.referToType(this.checker.getTypeAtLocation(initializer), typeNode);
    }

    referToTypeNode(typeNode : ts.TypeNode): ts.Expression {
        return this.referToType(this.checker.getTypeFromTypeNode(typeNode), typeNode);
    }

    referToType(type : ts.Type, typeNode? : ts.TypeNode): ts.Expression {
        if (!type['id'])
            throw new Error(`Type does not have an ID!`);

        if (!this.typeMap.has(type['id'])) {

            // Allocate the typeMap slot so that we do not recurse if we encounter this type again
            this.typeMap.set(type['id'], null);

            let expr = this.typeLiteral(type, typeNode);
            let propName = ts.isObjectLiteralExpression(expr) ? 'RΦ' : 'LΦ';
            let useStandIn = false;
            if (type.isClassOrInterface()) {
                let sourceFile = type.symbol?.declarations?.[0]?.getSourceFile();
                let isLocal = sourceFile === this.ctx.sourceFile;
                useStandIn = isLocal;
            }

            if (useStandIn) {
                // The class or interface may not be defined at the top level of the module.
                // If it is defined in a function for instance then outputting a reference to 
                // it is not valid. We'll put the real reference into the map at runtime when the 
                // class/interface declaration is executed.
                this.typeMap.set(type['id'], serialize({
                    TΦ: T_STAND_IN,
                    name: `${type.symbol.name}`
                }));
            } else {
                this.typeMap.set(type['id'], serialize({
                    [propName]: literalNode(ts.factory.createArrowFunction(
                        [], [], [
                            ts.factory.createParameterDeclaration(
                                [], [], undefined, 't', undefined, undefined, 
                                undefined
                            )
                        ], undefined, ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken), expr
                    ))
                }));
            }
        }

        return ts.factory.createCallExpression(
            ts.factory.createPropertyAccessExpression(
                ts.factory.createIdentifier(`__RΦ`),
                'a'
            ), [], [
                ts.factory.createNumericLiteral(type['id'])
            ]
        )
    }

    private findRelativePathToFile(fromFile : string, toFile : string) {
        fromFile = fromFile.replace(/\\/g, '/');
        toFile = toFile.replace(/\\/g, '/');
    
        if (fromFile.startsWith('./'))
            fromFile = fromFile.slice(2);
        if (toFile.startsWith('./'))
            toFile = toFile.slice(2);
        
        let fromAbsolute = /^[A-Za-z]:/.test(fromFile) || /^\//.test(fromFile);
        let toAbsolute = /^[A-Za-z]:/.test(toFile) || /^\//.test(toFile);

        if (fromAbsolute !== toAbsolute)
            throw new Error(`Cannot determine relationship between an absolute and a relative path!`);
        
        if (!fromAbsolute && !toAbsolute) {
            fromFile = `/${fromFile}`;
            toFile = `/${toFile}`;
        }

        let from = fromFile.split('/');
        let to = toFile.split('/');
        let parents = 0;
        let forwardPaths : string[] = [];
    
        // pop off the filenames
        let fromFileName = from.pop();
        let toFileName = to.pop();
        
        while (from.length > 0 && !to.join('/').startsWith(from.join('/'))) {
            parents += 1;
            from.pop();
        }
    
        if (from.length === 0) {
            // Could be different drive letters, ie C:/ vs D:/ -- in that case, we just have to 
            // use the absolute path
            return undefined;
        } else {
            if (parents > 0) {
                return [ ...[Array(1 + parents).join('..')], ...to.slice(from.length), toFileName].join('/');
            } else {
                return ['.', ...to.slice(from.length), toFileName].join('/');
            }
        }
    

    }

    /**
     * Create a literal expression for the given type. 
     * @param type 
     * @returns 
     */
    private typeLiteral(type : ts.Type, typeNode? : ts.TypeNode): ts.Expression {
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
        } else if (type.isUnion()) {
            return serialize({
                TΦ: T_UNION,
                t: type.types.map(x => literalNode(this.referToType(x)))
            });
        } else if (type.isIntersection()) {
            return serialize({
                TΦ: T_INTERSECTION,
                t: type.types.map(x => literalNode(this.referToType(x)))
            });
        } else if (hasFlag(type.flags, ts.TypeFlags.Null)) {
            return serialize({ TΦ: T_NULL });
        } else if (hasFlag(type.flags, ts.TypeFlags.Undefined)) {
            return serialize({ TΦ: T_UNDEFINED });
        } else if (hasFlag(type.flags, ts.TypeFlags.Unknown)) {
            return serialize({ TΦ: T_UNKNOWN });
        } else if (hasFlag(type.flags, ts.TypeFlags.Any)) {
            return serialize({ TΦ: T_ANY });
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
                        t: literalNode(this.referToType(typeRef.typeParameter)),
                        p: typeRef.aliasTypeArguments.map(t => literalNode(this.referToType(t)))
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
                                        t: literalNode(this.referToType(e))
                                    }
                                } else {
                                    return {
                                        t: literalNode(this.referToType(e))
                                    }
                                }
                            })
                        })
                    }

                    if (!typeRef.symbol)
                        debugger;
                        
                    if (!typeRef.target.symbol)
                        debugger;
                    
                    if (typeRef.target.symbol.name === 'Array' && typeRef.typeArguments.length === 1) {
                        return serialize({
                            TΦ: T_ARRAY, 
                            e: literalNode(this.referToType(typeRef.typeArguments[0]))
                        })
                    }

                    try {
                        return serialize({
                            TΦ: T_GENERIC, 
                            t: literalNode(this.referToType(typeRef.target)),
                            p: (typeRef.typeArguments ?? []).map(x => literalNode(this.referToType(x)))
                        })
                    } catch (e) {
                        console.error(`RTTI: Error while serializing type '${typeRef.symbol.name}': ${e.message}`);
                        throw e;
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
                let isCommonJS = this.program.getCompilerOptions().module === ts.ModuleKind.CommonJS;
                let reifiedType = <boolean>type.isClass() || type.symbol.name === 'Promise' || !!type.symbol.valueDeclaration;
                
                // Acquire the list of parent symbols. This will be used for detecting imports.

                let parents : ts.Symbol[] = [];
                let parent : ts.Symbol = type.symbol['parent'];
                
                while (parent) {
                    parents.push(parent);
                    parent = parent['parent'];
                }

                let expr : ts.Identifier | ts.PropertyAccessExpression;

                if (reifiedType) {
                    let entityName = this.checker.symbolToEntityName(type.symbol, ts.SymbolFlags.Class, undefined, undefined);
                    expr = serializeEntityNameAsExpression(entityName, this.sourceFile);
                } else {
                    let symbolName = `IΦ${type.symbol.name}`;
                    expr = ts.factory.createIdentifier(symbolName); // TODO: qualified names
                }

                // If this symbol is imported, we need to handle it specially.

                let sourceFile = type.symbol.declarations?.[0]?.getSourceFile();
                let isLocal = sourceFile === this.ctx.sourceFile;

                if (sourceFile.hasNoDefaultLib && /lib\.[^\.]+\.d\.ts/.test(sourceFile.fileName)) {
                    // Appears to be the standard lib. Assume no import is needed.
                    isLocal = true;
                }

                if (!isLocal) {
                    // This is imported
                    
                    let importName : string;
                    if (parents.length > 1) {
                        importName = parents[1].name
                    } else {
                        importName = type.symbol.name;
                    }

                    let modulePath : string; //parents[0] ? JSON.parse(parents[0].name) : undefined;

                    if (typeNode) {
                        if (ts.isTypeReferenceNode(typeNode)) {
                            let importIdentifier : ts.Identifier;
                            let typeName = typeNode.typeName;
                            while (ts.isQualifiedName(typeName))
                                typeName = typeName.left;
                            
                            let localSymbol = this.checker.getSymbolAtLocation(typeNode.typeName);
                            if (localSymbol) {
                                let localDecl = localSymbol.declarations[0];
                                if (localDecl) {
                                    if (ts.isImportClause(localDecl)) {
                                        let specifier = <ts.StringLiteral>localDecl.parent?.moduleSpecifier;
                                        let detectedImportPath = specifier.text;
                                        if (detectedImportPath)
                                            modulePath = detectedImportPath;
                                    } else if (ts.isImportSpecifier(localDecl)) {
                                        let specifier = <ts.StringLiteral>localDecl.parent?.parent?.parent?.moduleSpecifier;
                                        let detectedImportPath = specifier.text;
                                        if (detectedImportPath)
                                            modulePath = detectedImportPath;
                                    }
                                }
                            }
                        } else {
                            throw new Error(`Unexpected type node type: '${ts.SyntaxKind[typeNode.kind]}'`);
                        }
                    }

                    if (!modulePath) {
                        // The type is not directly imported in this file. 
                        let destFile = sourceFile.fileName;
                        
                        if (destFile.endsWith('.d.ts'))
                            destFile = destFile.replace(/\.d\.ts$/, '');
                        else if (destFile.endsWith('.ts'))
                            destFile = destFile.replace(/\.ts$/, '');

                        // TODO: The import now has no extension, but for Deno it is required.
                        // I think only a configuration option could fix this, in which case we 
                        // would append .js here

                        let relativePath = this.findRelativePathToFile(this.ctx.sourceFile.fileName, destFile);
                        if (relativePath) {
                            modulePath = relativePath;
                        } else { 
                            if (globalThis.RTTI_TRACE)
                            console.log(`RTTI: Cannot determine relative path from '${this.ctx.sourceFile.fileName}' to '${sourceFile.fileName}'! Using absolute path!`);
                            modulePath = destFile;
                        }
                    }

                    if (parents.length === 1 && type.symbol.name === 'default') {
                        // Default export 

                        if (isCommonJS) {
                            return ts.factory.createPropertyAccessExpression(
                                ts.factory.createCallExpression(
                                    ts.factory.createIdentifier('require'),
                                    [], [
                                        ts.factory.createStringLiteral(modulePath)
                                    ]
                                ), 'default')
                        } else {
                            
                            let impo = this.importMap.get(`*default:${modulePath}`);
                            if (!impo) {
                                this.importMap.set(`*default:${modulePath}`, impo = {
                                    importDeclaration: undefined,
                                    isDefault: true,
                                    isNamespace: false,
                                    localName: `LΦ_${this.ctx.freeImportReference++}`,
                                    modulePath: modulePath,
                                    name: `*default:${modulePath}`,
                                    refName: '',
                                    referenced: true
                                })
                            }
                            
                            return ts.factory.createIdentifier(impo.localName);
                        }
                    } else {
                        if (isCommonJS) {
                            return propertyPrepend(
                                ts.factory.createCallExpression(
                                    ts.factory.createIdentifier('require'),
                                    [], [ ts.factory.createStringLiteral(modulePath) ]
                                ), expr
                            );
                        } else {
                            let impo = this.ctx.importMap.get(`*:${modulePath}`);
                            if (!impo) {
                                this.ctx.importMap.set(`*:${modulePath}`, impo = {
                                    importDeclaration: undefined,
                                    isDefault: false,
                                    isNamespace: true,
                                    localName: `LΦ_${this.ctx.freeImportReference++}`,
                                    modulePath: modulePath,
                                    name: `*:${modulePath}`,
                                    refName: '',
                                    referenced: true
                                })
                            }
                            
                            return propertyPrepend(ts.factory.createIdentifier(impo.localName), expr);
                        }
                    }
                }

                return expr;
            }

            return ts.factory.createIdentifier('Object');
        }

        // No idea
        return ts.factory.createIdentifier('Object');
    }
}