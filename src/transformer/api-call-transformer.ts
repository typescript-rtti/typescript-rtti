import { Visit } from "./common/visitor-base";
import * as ts from 'typescript';
import { dottedNameToExpr, entityNameToString, hasFlag, propertyPrepend } from "./utils";
import { CompileError } from "./common/compile-error";
import { TypeReferenceSerializationKind } from "./ts-internal-types";
import { RttiVisitor } from "./rtti-visitor-base";
import { RttiContext } from "./rtti-context";
import { serialize } from "./serialize";
import { TypeEncoder } from "./type-encoder";
import { literalNode } from "./literal-node";

export class ApiCallTransformer extends RttiVisitor {

    typeEncoder = new TypeEncoder(this.ctx);

    static transform<T extends ts.Node>(node : T, ctx : RttiContext) {
        let transformer = new ApiCallTransformer(ctx);
        return transformer.visitNode(node);
    }

    private isRttiCall(expr : ts.CallExpression, name? : string) {
        return ts.isIdentifier(expr.expression) 
            && this.isAnyImportedSymbol(
                this.checker.getSymbolAtLocation(expr.expression), 
                'typescript-rtti', name ? [name] : ['reify', 'reflect']
            )
        ;
    }

    isAnyImportedSymbol(symbol : ts.Symbol, packageName : string, names : string[]) {
        if (!symbol || !names.includes(symbol.name))
            return false;
        
        return this.isSymbolFromPackage(symbol, packageName);
    }

    isImportedSymbol(symbol : ts.Symbol, packageName : string, name : string) {
        return this.isAnyImportedSymbol(symbol, packageName, [ name ])
    }

    isSymbolFromPackage(symbol : ts.Symbol, packageName : string) {
        let decls = Array.from(symbol.getDeclarations());
        let importSpecifier = <ts.ImportSpecifier>decls.find(x => x.kind === ts.SyntaxKind.ImportSpecifier);
        
        if (!importSpecifier)
            return false;

        let modSpecifier = importSpecifier.parent.parent.parent.moduleSpecifier;

        if (!ts.isStringLiteral(modSpecifier))
            return false;

        return modSpecifier.text === packageName 
            || modSpecifier.text.match(new RegExp(`^https?:.*/${packageName}/index.js$`)) 
            || modSpecifier.text.match(new RegExp(`^https?:.*/${packageName}/index.ts$`)) 
            || modSpecifier.text.match(new RegExp(`^https?:.*/${packageName}/?$`))
        ;
    }

    isCallSiteTypeRef(typeNode : ts.TypeNode) {
        if (!typeNode)
            return false;
        
        if (typeNode.kind === ts.SyntaxKind.TypeReference) {
            let typeRef = <ts.TypeReferenceNode>typeNode;
            if (!typeRef.typeName)
                return false;
            if (typeRef.typeName.kind === ts.SyntaxKind.Identifier && typeRef.typeName.text === 'CallSite') {
                let symbol = this.checker.getSymbolAtLocation(typeRef.typeName)
                return this.isImportedSymbol(symbol, 'typescript-rtti', 'CallSite');
            }
        }

        return false;
    }

    isCallSiteParameter(param : ts.ParameterDeclaration) {
        return !!param?.questionToken && this.isCallSiteTypeRef(param?.type);
    }

    typeOfParamSymbol(symbol : ts.Symbol): ts.Type {
        return this.checker.getTypeOfSymbolAtLocation(symbol, symbol.getDeclarations()[0]);
    }

    @Visit(ts.SyntaxKind.CallExpression)
    callExpr(expr : ts.CallExpression) {
        let signature = this.checker.getResolvedSignature(expr);
        let params = signature.parameters;

        let callSiteArgIndex = params.findIndex(
            x => this.isCallSiteParameter((x.valueDeclaration as ts.ParameterDeclaration))
        );

        if (this.isRttiCall(expr, 'reflect') && callSiteArgIndex < 0) {
            callSiteArgIndex = 1;
        } else if (this.isRttiCall(expr, 'reify') && callSiteArgIndex < 0) {
            callSiteArgIndex = 0;
        }

        if (callSiteArgIndex < 0)
            return;
            
        if (callSiteArgIndex >= expr.arguments.length) {
            
            let args = Array.from(expr.arguments);
            while (callSiteArgIndex > args.length) {
                args.push(ts.factory.createVoidZero());
            }

            args.push(serialize({
                TΦ: 'c',
                t: undefined, // TODO: this type
                p: expr.arguments.map(x => literalNode(this.referToType(this.checker.getTypeAtLocation(x)))),
                r: undefined, // TODO return type
                tp: (expr.typeArguments ?? []).map(x => literalNode(this.referToType(this.checker.getTypeAtLocation(x))))
            }));
            return ts.factory.updateCallExpression(expr, expr.expression, expr.typeArguments, args);
        }

    }

    private referToType(type : ts.Type) {
        if (hasFlag(type.flags, ts.TypeFlags.TypeVariable)) {
            let symbol = type.symbol;
            let decl = symbol.declarations[0];
            if (ts.isTypeParameterDeclaration(decl)) {
                let parentDecl = decl.parent;
                if (ts.isFunctionDeclaration(parentDecl) || ts.isArrowFunction(parentDecl) || ts.isMethodDeclaration(parentDecl) || ts.isFunctionExpression(parentDecl)) {
                    let typeIndex = parentDecl.typeParameters.findIndex(tp => this.checker.getTypeAtLocation(tp) === type);
                    if (typeIndex >= 0) {
                        let callSiteArgIndex = parentDecl.parameters.findIndex(p => this.isCallSiteParameter(p));
                        if (callSiteArgIndex >= 0) {
                            let callSiteArg = parentDecl.parameters[callSiteArgIndex];
        
                            if (ts.isIdentifier(callSiteArg.name)) {
                                let callSiteName = callSiteArg.name.text;
                                return ts.factory.createElementAccessExpression(
                                    ts.factory.createPropertyAccessExpression(
                                        ts.factory.createIdentifier(callSiteName),
                                        'tp'
                                    ),
                                    typeIndex
                                )
                            }
                        }
                    }
                }
            }
        }

        return this.typeEncoder.referToType(type);
    }

    private rewriteApiCall(expr : ts.CallExpression) {
        let typeSpecifier : ts.TypeNode = expr.typeArguments && expr.typeArguments.length === 1 ? expr.typeArguments[0] : null;

        if (!typeSpecifier)
            return;
        
        let type = this.checker.getTypeAtLocation(typeSpecifier);
        let localName : string;

        if (type) {
            if (hasFlag(type.flags, ts.TypeFlags.TypeVariable)) {
                if (type.symbol.declarations) {
                    if (type.symbol.declarations.length === 1) {
                        let decl = type.symbol.declarations[0];

                        if (decl.kind === ts.SyntaxKind.TypeParameter) {
                            // This is an attempt at transient generic reflection.
                            // Check that we have a call site opt-in

                            //throw new CompileError(`reflect<${type.symbol.name}>(): Cannot be called on type parameter`);
                        } else {
                            throw new CompileError(`reflect<${type.symbol.name}>(): Generic parameter of type '${ts.SyntaxKind[decl.kind]}' is not supported`);
                        }
                    } else {
                        throw new CompileError(`reflect<${type.symbol.name}>(): Multiple declaration symbols found`)
                    }
                } else {
                    throw new CompileError(`reflect<${type.symbol.name}>(): No declaration symbol found`)
                }
            } else if (type.isClassOrInterface() && !type.isClass()) {
                if (ts.isTypeReferenceNode(typeSpecifier)) {
                    localName = entityNameToString(typeSpecifier.typeName);
                }
            } else {
                if (ts.isTypeReferenceNode(typeSpecifier)) {
                    const resolver = this.context['getEmitResolver']();
                    const kind : TypeReferenceSerializationKind = resolver.getTypeReferenceSerializationKind(
                        typeSpecifier.typeName, this.ctx.currentNameScope || this.sourceFile
                    );
    
                    if (kind === TypeReferenceSerializationKind.Unknown) {
                        if (this.trace)
                            console.warn(`RTTI: warning: ${this.sourceFile.fileName}: reify<${typeSpecifier.getText()}>: unknown symbol: Assuming imported interface [This may be a bug]`);
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
                `RTTI: ${this.sourceFile.fileName}: reify(): ` 
                + `cannot resolve interface: ${text || '<unresolvable>'}: Not supported.`
            );
        }

        let typeImport = this.importMap.get(localName);
        let expression : ts.Expression;

        if (typeImport) {
            // Special behavior for commonjs (inline require())
            // For ESM this is handled by hoisting an import
            
            if (this.program.getCompilerOptions().module === ts.ModuleKind.CommonJS) {
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
                
                let impo = this.importMap.get(`*:${typeImport.modulePath}`);
                if (!impo) {
                    this.importMap.set(`*:${typeImport.modulePath}`, impo = {
                        importDeclaration: typeImport?.importDeclaration,
                        isDefault: false,
                        isNamespace: true,
                        localName: `LΦ_${this.ctx.freeImportReference++}`,
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
        
        return ts.factory.createCallExpression(expr.expression, undefined, [
            expression
        ]);
    }
}
