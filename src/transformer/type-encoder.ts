import * as ts from "typescript";

import { RttiContext } from "./rtti-context";
import { typeLiteral } from "./type-literal";

export class TypeEncoder {
    constructor(
        readonly ctx: RttiContext,
    ) {
    }

    get typeMap() { return this.ctx.typeMap; }
    get program() { return this.ctx.program; }
    get sourceFile() { return this.ctx.sourceFile; }
    get checker() { return this.ctx.checker; }

    referToTypeNode(typeNode: ts.TypeNode): ts.Expression {
        return this.referToType(this.checker.getTypeFromTypeNode(typeNode), typeNode);
    }

    referToType(type: ts.Type, typeNode?: ts.TypeNode): ts.Expression {
        if (!type['id'])
            throw new Error(`Type does not have an ID!`);

        if (!this.typeMap.has(type['id'])) {
            // Allocate the typeMap slot first so we don't recurse if we encounter it again
            this.typeMap.set(type['id'], null);
            this.typeMap.set(type['id'],
                ts.factory.createArrowFunction(
                    undefined,
                    undefined,
                    [],
                    undefined,
                    ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
                    typeLiteral(this, type, typeNode))
            )
                ;
        }

        return ts.factory.createCallExpression(
            ts.factory.createPropertyAccessExpression(
                ts.factory.createIdentifier("__RΦ"),
                ts.factory.createIdentifier("a")
            ),
            undefined,
            [ts.factory.createNumericLiteral(type['id'])]
        );
    }
}