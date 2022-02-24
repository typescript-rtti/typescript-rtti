import { Visit } from "./common/visitor-base";
import * as ts from 'typescript';
import { dottedNameToExpr, entityNameToString, hasFlag, propertyPrepend } from "./utils";
import { CompileError } from "./common/compile-error";
import { TypeReferenceSerializationKind } from "./ts-internal-types";
import { RttiVisitor } from "./rtti-visitor-base";
import { RttiContext } from "./rtti-context";

export class ApiCallTransformer extends RttiVisitor {

    static transform<T extends ts.Node>(node : T, ctx : RttiContext) {
        let transformer = new ApiCallTransformer(ctx);
        return transformer.visitEachChild(node);
    }

    usesApi = false;

    @Visit(ts.SyntaxKind.CallExpression)
    callExpr(expr : ts.CallExpression) {
        if (!ts.isIdentifier(expr.expression))
            return;
    
        let checker = this.checker;
        let symbol = checker.getSymbolAtLocation(expr.expression);
        if (!symbol)
            return;

        let identifier = expr.expression;
        
        if (!symbol || !['reify', 'reflect'].includes(symbol.name))
            return;
        
        let decls = symbol.getDeclarations();
        let importSpecifier = <ts.ImportSpecifier>decls.find(x => x.kind === ts.SyntaxKind.ImportSpecifier);
        let typeSpecifier : ts.TypeNode = expr.typeArguments && expr.typeArguments.length === 1 ? expr.typeArguments[0] : null;

        if (!importSpecifier)
            return;

        let modSpecifier = importSpecifier.parent.parent.parent.moduleSpecifier;
        if (!ts.isStringLiteral(modSpecifier))
            return;
        
        let isTypescriptRtti = 
            modSpecifier.text === 'typescript-rtti'
            || modSpecifier.text.match(/^http.*\/typescript-rtti\/index.js$/)
            || modSpecifier.text.match(/^http.*\/typescript-rtti\/index.ts$/)
            || modSpecifier.text.match(/^http.*\/typescript-rtti\/?$/)
        ;

        if (!isTypescriptRtti || !typeSpecifier)
            return;

        this.usesApi = true;
        let type = checker.getTypeAtLocation(typeSpecifier);
        let localName : string;

        if (type) {
            if (hasFlag(type.flags, ts.TypeFlags.TypeVariable)) {
                if (type.symbol.declarations) {
                    if (type.symbol.declarations.length === 1) {
                        let decl = type.symbol.declarations[0];

                        if (decl.kind === ts.SyntaxKind.TypeParameter) {
                            // This is an attempt at transient generic reflection. 
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
        
        return ts.factory.createCallExpression(identifier, undefined, [
            expression
        ]);
    }
}
