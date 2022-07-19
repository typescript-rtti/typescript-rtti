import ts from "typescript";
import {T_GENERIC, T_STAND_IN} from "../common/format";
import {literalNode} from "./literal-node";
import {RttiContext} from "./rtti-context";
import {serializeExpression} from "./serialize";
import {typeLiteral} from "./type-literal";
import {hasFlag} from './utils';
import {forwardRef} from "./forward-ref";

export class TypeEncoder {
    constructor(
        readonly ctx: RttiContext,
    ) {
    }

    cid: number = -1;

    get customTypeId(): number {
        return this.cid--;
    }

    get typeMap() {
        return this.ctx.typeMap;
    }

    get program() {
        return this.ctx.program;
    }

    get sourceFile() {
        return this.ctx.sourceFile;
    }

    get importMap() {
        return this.ctx.importMap;
    }

    get checker() {
        return this.ctx.checker;
    }

    extractTypeAliasDeclarationFromTypeNode(node: ts.TypeNode): ts.TypeAliasDeclaration | undefined {
        if (node == null) {
            return undefined;
        }

        if (node.kind === ts.SyntaxKind.TypeAliasDeclaration) {
            return node as unknown as ts.TypeAliasDeclaration;
        }

         if (node.parent?.kind === ts.SyntaxKind.TypeAliasDeclaration) {
             return node.parent as ts.TypeAliasDeclaration;
         }

        if (node.kind !== ts.SyntaxKind.TypeReference) {
            return undefined;
        }
        const anode = node as ts.TypeReferenceNode;
        const symb = this.checker.getSymbolAtLocation(anode.typeName);

        return this.extractTypeAliasDeclarationFromSymbol(symb);
    }

    extractTypeAliasDeclarationFromType(type: ts.Type): ts.TypeAliasDeclaration | undefined {
        if (type == null) {
            return undefined;
        }
        return this.extractTypeAliasDeclarationFromSymbol(type.symbol) || this.extractTypeAliasDeclarationFromSymbol(type.aliasSymbol);
    }

    extractTypeAliasDeclarationFromSymbol(symbol: ts.Symbol): ts.TypeAliasDeclaration | undefined {
        return this.extractDeclarationFromSymbol(ts.SyntaxKind.TypeAliasDeclaration, symbol) as ts.TypeAliasDeclaration | undefined;
    }

    extractDeclarationFromSymbol(syntaxKind: ts.SyntaxKind, ...symbol: ts.Symbol[]): ts.Node | undefined {
        for (const s of symbol) {
            const d = this._extractDeclarationFromSymbol(syntaxKind, s);
            if (d) {
                return d;
            }
        }
        return undefined;
    }

    protected _extractDeclarationFromSymbol(syntaxKind: ts.SyntaxKind, symbol: ts.Symbol): ts.Node | undefined {
        if (symbol == null) {
            return undefined;
        }
        if ((symbol.flags & ts.SymbolFlags.Alias) === ts.SymbolFlags.Alias) {
            //console.log(`Symbol ${symbol.name} is an alias`);
            symbol = this.checker.getAliasedSymbol(symbol)
        }
        if ((symbol.flags & ts.SymbolFlags.TypeAlias) === ts.SymbolFlags.TypeAlias) {
            //console.log(`Symbol ${symbol.name} is an typeAlias`);
        }
        //console.log(`Symbol ${symbol.name} is a ${symbol.flags}`);
        const sym = this.checker.getFullyQualifiedName(symbol);
        const decls = symbol.getDeclarations() as ts.Declaration[];
        if (decls == null) {
            return undefined;
        }
        for (const d of decls) {
            // @TODO should we check the fully qualified name?
            if (d.kind === syntaxKind) {
                return d;
            }
        }
        return undefined;
    }

    referToTypeNode(typeNode: ts.TypeNode, asAlias = true): ts.Expression {
        if (typeNode == null){
            throw new Error("referToTypeNode typeNode is null");
        }

        return this.referToType(this.checker.getTypeFromTypeNode(typeNode), typeNode, asAlias);
    }

    referToNode(node: ts.Node, asAlias = true): ts.Expression {
        if (node == null){
            throw new Error("referToNode node is null");
        }

        if (ts.isTypeNode(node)){
            return this.referToTypeNode(node as ts.TypeNode, asAlias);
        }
        if (ts.isTypeAliasDeclaration(node)){
            return this.referToTypeNode(node.type, asAlias);
        }

        // expression, computed/implicit types ect
        return this.referToType(this.checker.getTypeAtLocation(node), undefined, asAlias);
    }

    isTypeReferenceWithTypeArguments(typeNode?: ts.TypeNode): boolean {
        if (typeNode && typeNode.kind === ts.SyntaxKind.TypeReference && (typeNode as ts.TypeReferenceNode).typeArguments) {
            const ref = typeNode as ts.TypeReferenceNode;
            if (ref.typeArguments.length > 0)
                return true;
        }
        return false;
    }

    retrieveTypeAliasDeclaration(type: ts.Type, typeNode?: ts.TypeNode): ts.TypeAliasDeclaration | undefined {
        return this.extractTypeAliasDeclarationFromType(type) || this.extractTypeAliasDeclarationFromTypeNode(typeNode);
    }

    getTypeHash(node: ts.TypeAliasDeclaration | ts.TypeReferenceNode): string {
        if (node == null) {
            throw new Error("node is null");
        }


        if (node.kind === ts.SyntaxKind.TypeAliasDeclaration) {
            let n = 'A' + node.name.text;
            n += '<' + (node.typeParameters?.map(t => t.name.text) || []).join(',') + '>';
            return n;
        }

        if (node.kind === ts.SyntaxKind.TypeReference) {
            let n = ''
            if ("text" in node.typeName) {
                n = 'R' + node.typeName.text;
            }
            n += '<' + (node.typeArguments?.map(t => this.checker.getTypeAtLocation(t)['id']) || []).join(',') + '>';
            return n;
        }

        // @ts-ignore
        throw new Error(`unsupported node kind ${node.kind}`);
    }

    /* get type id number or the alias identifier */
    getTypeId(type: ts.Type, typeNode?: ts.TypeNode, asAlias = true): number | string | ts.Expression {
        let typeRef = type['id'];
        if (asAlias) {
            let typeAlias: ts.TypeAliasDeclaration = this.retrieveTypeAliasDeclaration(type, typeNode);

            if (typeAlias) {
                if (this.isTypeReferenceWithTypeArguments(typeNode)) {
                    const ref = typeNode as ts.TypeReferenceNode;
                    // get node id
                    const Tid = this.getTypeHash(ref);
                    if (this.declaredTypeExists(Tid)) {
                        return Tid;
                    }

                    // create new type
                    this.declareType(null, Tid);

                    /* emit as generic */
                    // @TODO handle builtin types aliases like Partial<T>

                    // const tp = this.referToType(this.checker.getTypeAtLocation(typeAlias), typeAlias.type, false);
                    //
                    // const aliasOrType = ts.factory.createBinaryExpression(
                    //     this.referToType(this.checker.getTypeAtLocation(typeAlias), typeAlias.type),
                    //     ts.factory.createToken(ts.SyntaxKind.BarBarToken),
                    //     tp
                    // )

                    const tp = this.referToNode(typeAlias,false);

                    const aliasOrType = ts.factory.createBinaryExpression(
                        this.referToNode(typeAlias),
                        ts.factory.createToken(ts.SyntaxKind.BarBarToken),
                        tp
                    )

                    this.declareType({
                        TΦ: T_GENERIC,
                        t: forwardRef(aliasOrType), // reference to the original type alias
                        p: ref.typeArguments.map(x => this.referToNode(x)),
                    }, Tid);

                    return Tid;

                }else{
                    return this.getTypeHash(typeAlias);
                }
            }
        }
        return typeRef;
    }

    declareType(expr: any, id: number | string, name?: string, useStandIn = false): ts.Expression {
        expr = serializeExpression(expr);
        let propName = ts.isObjectLiteralExpression(expr) ? 'RΦ' : 'LΦ';
        if (useStandIn) {
            // The class or interface may not be defined at the top level of the module.
            // If it is defined in a function for instance then outputting a reference to
            // it is not valid. We'll put the real reference into the map at runtime when the
            // class/interface declaration is executed.
            this.typeMap.set(id, serializeExpression({
                TΦ: T_STAND_IN,
                name: `${name}`
            }));
        } else {
            this.typeMap.set(id, serializeExpression({
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
        return expr;
    }

    declaredTypeExists(typeRef: string | number) {
        return this.typeMap.has(typeRef)
    }

    accessDeclaredType(typeRef: string | number): ts.Expression {
        return ts.factory.createCallExpression(
            ts.factory.createPropertyAccessExpression(
                ts.factory.createIdentifier(`__RΦ`),
                'a'
            ), [], [
                typeof typeRef === 'string' ? ts.factory.createStringLiteral(typeRef) : ts.factory.createNumericLiteral(typeRef)
            ]
        );
    }

    referToType(type: ts.Type, typeNode?: ts.TypeNode, asAlias = true): ts.Expression {
        if (!type['id'])
            throw new Error(`Type does not have an ID!`);

        if (!this.typeMap.has(type['id'])) {

            // Allocate the typeMap slot so that we do not recurse if we encounter this type again
            this.typeMap.set(type['id'], null);

            const expr = typeLiteral(this, type, typeNode);
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

            this.declareType(expr, type['id'], type.symbol?.name, useStandIn);
        }

        let typeRef = this.getTypeId(type, typeNode, asAlias);

        if (typeof typeRef === 'object') {
            return typeRef;
        }

        return this.accessDeclaredType(typeRef);
    }
}
