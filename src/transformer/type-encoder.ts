import ts from "typescript";
import { T_OBJECT, T_STAND_IN } from "../common/format";
import { literalNode } from "./literal-node";
import { RttiContext } from "./rtti-context";
import { serialize } from "./serialize";
import { structuredTypeLiteral, typeLiteral } from "./type-literal";
import { hasFlag } from './utils';
import { InternalNodeFlags } from './ts-internal-types';

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

    referToTypeNode(typeNode: ts.TypeNode): ts.Expression {
        return this.referToType(this.checker.getTypeFromTypeNode(typeNode), typeNode);
    }

    referToType(type: ts.Type, typeNode?: ts.TypeNode): ts.Expression {
        if (!type['id'])
            throw new Error(`Type does not have an ID!`);

        if (!this.typeMap.has(type['id'])) {

            // Allocate the typeMap slot so that we do not recurse if we encounter this type again
            this.typeMap.set(type['id'], null);

            let isEnum = hasFlag(type.flags, ts.TypeFlags.Enum) || (hasFlag(type.flags, ts.TypeFlags.EnumLiteral) && (
                hasFlag(type.aliasSymbol?.flags, ts.SymbolFlags.Enum
            )));

            let declarations = type.symbol?.getDeclarations();
            let declaration = declarations?.[0];
            let sourceFile = declaration?.getSourceFile();
            let isLocal = sourceFile === this.ctx.sourceFile;
            let isAmbient = hasFlag(declaration?.flags, InternalNodeFlags.Ambient);
            let useStandIn = false;

            if (isEnum) {
                useStandIn = isLocal && !hasFlag(type.symbol.flags, ts.SymbolFlags.ConstEnum);
            } else if (type.isClassOrInterface()) {
                useStandIn = isLocal && !isAmbient;
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
                // Ambient classes/interfaces cannot use stand-ins and will never have class references or interface
                // tokens available. Instead, we should encode this as a structured type.
                let expr = (isLocal && isAmbient)
                    ? structuredTypeLiteral(this, type, typeNode, type.symbol?.name)
                    : typeLiteral(this, type, typeNode)
                ;

                let propName = ts.isObjectLiteralExpression(expr) ? 'RΦ' : 'LΦ';
                this.typeMap.set(type['id'], serialize({
                    [propName]: literalNode(ts.factory.createArrowFunction(
                        [], [], [
                        ts.factory.createParameterDeclaration(
                            [], undefined, 't', undefined, undefined,
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
        );
    }
}