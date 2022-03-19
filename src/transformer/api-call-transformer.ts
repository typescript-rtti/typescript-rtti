import { Visit } from "./common/visitor-base";
import * as ts from 'typescript';
import { hasFlag } from "./utils";
import { RttiVisitor } from "./rtti-visitor-base";
import { RttiContext } from "./rtti-context";
import { serialize } from "./serialize";
import { TypeEncoder } from "./type-encoder";
import { literalNode } from "./literal-node";
import * as format from "../common/format";

export class ApiCallTransformer extends RttiVisitor {

    typeEncoder = new TypeEncoder(this.ctx);

    static transform<T extends ts.Node>(node: T, ctx: RttiContext) {
        let transformer = new ApiCallTransformer(ctx);
        return transformer.visitNode(node);
    }

    private isRttiCall(expr: ts.CallExpression, name?: string) {
        return ts.isIdentifier(expr.expression)
            && this.isAnyImportedSymbol(
                this.checker.getSymbolAtLocation(expr.expression),
                'typescript-rtti', name ? [name] : ['reify', 'reflect']
            )
            ;
    }

    isAnyImportedSymbol(symbol: ts.Symbol, packageName: string, names: string[]) {
        if (!symbol || !names.includes(symbol.name))
            return false;

        return this.isSymbolFromPackage(symbol, packageName);
    }

    isImportedSymbol(symbol: ts.Symbol, packageName: string, name: string) {
        return this.isAnyImportedSymbol(symbol, packageName, [name]);
    }

    isSymbolFromPackage(symbol: ts.Symbol, packageName: string) {
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

    isCallSiteTypeRef(typeNode: ts.TypeNode) {
        if (!typeNode)
            return false;

        if (typeNode.kind === ts.SyntaxKind.TypeReference) {
            let typeRef = <ts.TypeReferenceNode>typeNode;
            if (!typeRef.typeName)
                return false;
            if (typeRef.typeName.kind === ts.SyntaxKind.Identifier && typeRef.typeName.text === 'CallSite') {
                let symbol = this.checker.getSymbolAtLocation(typeRef.typeName);
                return this.isImportedSymbol(symbol, 'typescript-rtti', 'CallSite');
            }
        }

        return false;
    }

    isCallSiteParameter(param: ts.ParameterDeclaration) {
        return !!param?.questionToken && this.isCallSiteTypeRef(param?.type);
    }

    typeOfParamSymbol(symbol: ts.Symbol): ts.Type {
        return this.checker.getTypeOfSymbolAtLocation(symbol, symbol.getDeclarations()[0]);
    }

    @Visit(ts.SyntaxKind.CallExpression)
    callExpr(expr: ts.CallExpression) {
        let signature = this.checker.getResolvedSignature(expr);
        if (!signature) {
            debugger;
            if (globalThis.RTTI_TRACE)
                console.warn(`RTTI: Could not find signature for call expression '${expr.getText()}'`);
            return expr;
        }

        let params = signature.parameters;
        let callSiteArgIndex = params.findIndex(
            x => this.isCallSiteParameter((x.valueDeclaration as ts.ParameterDeclaration))
        );

        if (callSiteArgIndex < 0) {
            let jsDocTags = signature.getJsDocTags();
            if (jsDocTags) {
                let tag = jsDocTags.find(x => x.name === 'rtti' && x.text[0]?.text.startsWith(':callsite '));
                if (tag) {
                    let comment = <string>tag.text[0].text;
                    callSiteArgIndex = Number(comment.replace(/:callsite /, ''));
                }
            }
        }

        if (this.isRttiCall(expr, 'reflect') && callSiteArgIndex < 0) {
            callSiteArgIndex = 1;
        } else if (this.isRttiCall(expr, 'reify') && callSiteArgIndex < 0) {
            callSiteArgIndex = 0;
        }

        if (callSiteArgIndex >= 0 && callSiteArgIndex >= expr.arguments.length) {

            let args = Array.from(expr.arguments);
            while (callSiteArgIndex > args.length) {
                args.push(ts.factory.createVoidZero());
            }

            args.push(serialize(<format.RtSerialized<format.RtCallSite>>{
                TΦ: 'c',
                t: undefined, // TODO: this type
                p: expr.arguments.map(x => literalNode(this.referToType(this.checker.getTypeAtLocation(x)))),
                r: undefined, // TODO return type
                tp: (expr.typeArguments ?? []).map(x => literalNode(this.referToType(this.checker.getTypeAtLocation(x))))
            }));

            return ts.factory.updateCallExpression(this.visitEachChild(expr), expr.expression, expr.typeArguments, args);
        } else {
            return this.visitEachChild(expr);
        }
    }

    private referToType(type: ts.Type) {
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
                                );
                            }
                        }
                    }
                }
            }
        }

        return this.typeEncoder.referToType(type);
    }
}
