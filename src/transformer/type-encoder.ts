import ts from "typescript";
import { T_STAND_IN } from "../common/format";
import { literalNode } from "./literal-node";
import { RttiContext } from "./rtti-context";
import { serialize } from "./serialize";
import { typeLiteral } from "./type-literal";
import { hasFlag } from './utils';

export class TypeEncoder {
    constructor(
        readonly ctx: RttiContext,
    ) {
    }

    get typeMap() { return this.ctx.typeMap; }
    get program() { return this.ctx.program; }
    get sourceFile() { return this.ctx.sourceFile; }
    get importMap() { return this.ctx.importMap; }
    get checker() { return this.ctx.checker; }

    extractTypeAliasDeclarationFromTypeNode(node: ts.TypeNode): ts.TypeAliasDeclaration | undefined {
        if (node == null){
            return undefined;
        }

        if (node.kind === ts.SyntaxKind.TypeAliasDeclaration) {
            return node as unknown as ts.TypeAliasDeclaration;
        }

        if (node.parent?.kind === ts.SyntaxKind.TypeAliasDeclaration) {
            return node.parent as unknown as ts.TypeAliasDeclaration;
        }

        if (node.kind !== ts.SyntaxKind.TypeReference) {
            return undefined;
        }
        const anode = node as ts.TypeReferenceNode;
        const symb = this.checker.getSymbolAtLocation(anode.typeName);

        return this.extractTypeAliasDeclarationFromSymbol(symb);
    }

    extractTypeAliasDeclarationFromType(type: ts.Type): ts.TypeAliasDeclaration | undefined {
        if (type == null){
            return undefined;
        }
        return this.extractTypeAliasDeclarationFromSymbol(type.symbol) || this.extractTypeAliasDeclarationFromSymbol(type.aliasSymbol);
    }

    extractTypeAliasDeclarationFromSymbol(symbol: ts.Symbol): ts.TypeAliasDeclaration | undefined {
        if (symbol == null){
            return undefined;
        }
        if ((symbol.flags & ts.SymbolFlags.Alias) === ts.SymbolFlags.Alias) {
            //console.log(`Symbol ${symbol.name} is an alias`);
            symbol = this.checker.getAliasedSymbol(symbol)
        }
        if ((symbol.flags & ts.SymbolFlags.TypeAlias) === ts.SymbolFlags.TypeAlias){
            //console.log(`Symbol ${symbol.name} is an typeAlias`);
        }
        //console.log(`Symbol ${symbol.name} is a ${symbol.flags}`);
        const sym = this.checker.getFullyQualifiedName(symbol);
        const decls = symbol.getDeclarations() as ts.Declaration[];
        if (decls == null){
            return undefined;
        }
        for (const d of decls){
                    // @TODO should we check the fully qualified name?
                    if (d.kind === ts.SyntaxKind.TypeAliasDeclaration) {
                        return d as ts.TypeAliasDeclaration;
                    }
        }
        return undefined;
    }

    referToTypeNode(typeNode: ts.TypeNode): ts.Expression {
        return this.referToType(this.checker.getTypeFromTypeNode(typeNode), typeNode);
    }

    referToType(type: ts.Type, typeNode?: ts.TypeNode,asAlias=true): ts.Expression {
        if (!type['id'])
            throw new Error(`Type does not have an ID!`);

        if (!this.typeMap.has(type['id'])) {

            // Allocate the typeMap slot so that we do not recurse if we encounter this type again
            this.typeMap.set(type['id'], null);

            let expr = typeLiteral(this, type, typeNode);
            let propName = ts.isObjectLiteralExpression(expr) ? 'RΦ' : 'LΦ';
            let isEnum = hasFlag(type.flags, ts.TypeFlags.Enum) || (hasFlag(type.flags, ts.TypeFlags.EnumLiteral) && (
                hasFlag(type.aliasSymbol?.flags, ts.SymbolFlags.Enum
            )));

            let useStandIn = false;
            let sourceFile = type.symbol?.declarations?.[0]?.getSourceFile();
            let isLocal = sourceFile === this.ctx.sourceFile;

            if (isEnum)
                useStandIn = isLocal && !hasFlag(type.symbol.flags, ts.SymbolFlags.ConstEnum);
            else if (type.isClassOrInterface())
                useStandIn = isLocal;

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

        let typeRef = type['id'];
        let typeRefAsString = false;
        if (asAlias) {
            let typeAlias:ts.TypeAliasDeclaration = this.extractTypeAliasDeclarationFromType(type) || this.extractTypeAliasDeclarationFromTypeNode(typeNode);
            if (typeAlias){
                    let typeAliasName = typeAlias.name.getText();
                    typeRef = typeAliasName+':'+type['id'];
                    typeRefAsString = true;
            }
        }

        return ts.factory.createCallExpression(
            ts.factory.createPropertyAccessExpression(
                ts.factory.createIdentifier(`__RΦ`),
                'a'
            ), [], [
                typeRefAsString?ts.factory.createStringLiteral(typeRef):ts.factory.createNumericLiteral(typeRef)
        ]
        );
    }
}
