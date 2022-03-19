import * as ts from 'typescript';
import { RttiContext } from './rtti-context';
import { AnonymousType } from './ts-internal-types';
import { typeLiteral } from './type-literal';
import { hasAnyFlag, hasFlag, isFlagType, referenceSymbol } from './utils';

export class LegacyTypeEncoder {
    constructor(readonly ctx : RttiContext) {
    }

    get typeMap() { return this.ctx.typeMap; }
    get program() { return this.ctx.program; }
    get sourceFile() { return this.ctx.sourceFile; }
    get importMap() { return this.ctx.importMap; }
    get checker() { return this.ctx.checker; }
    
    referToTypeNode(typeNode : ts.TypeNode): ts.Expression {
        return this.referToType(this.checker.getTypeFromTypeNode(typeNode), typeNode);
    }

    referToType(type : ts.Type, typeNode? : ts.TypeNode): ts.Expression {
        if (!type)
            return ts.factory.createIdentifier('Object');
        
        if (hasFlag(type.flags, ts.TypeFlags.StringLike)) {
            return ts.factory.createIdentifier('String');
        } else if (hasFlag(type.flags, ts.TypeFlags.NumberLike)) {
            return ts.factory.createIdentifier('Number');
        } else if (hasFlag(type.flags, ts.TypeFlags.BooleanLike)) { 
            return ts.factory.createIdentifier('Boolean');
        } else if (hasAnyFlag(type.flags, [ts.TypeFlags.Void, ts.TypeFlags.Undefined, ts.TypeFlags.Null])) {
            return ts.factory.createVoidZero();
        } else if (hasFlag(type.flags, ts.TypeFlags.BigIntLike)) {
            return ts.factory.createIdentifier('BigInt');
        } else if (isFlagType<ts.ObjectType>(type, ts.TypeFlags.Object)) {
            if (hasFlag(type.objectFlags, ts.ObjectFlags.Reference)) {
                let typeRef = <ts.TypeReference>type;
                if (typeRef.target !== typeRef) {
                    if ((typeRef.target.objectFlags & ts.ObjectFlags.Tuple) !== 0)
                        return ts.factory.createIdentifier('Array');
                    
                    if (typeRef.target.symbol.name === 'Array' && typeRef.typeArguments.length === 1)
                        return ts.factory.createIdentifier('Array');

                    return this.referToType(typeRef.target, typeNode);
                }
            }

            if (hasFlag(type.objectFlags, ts.ObjectFlags.Anonymous)) {
                let anonymousType = <AnonymousType>type;
                if (anonymousType.getCallSignatures().length > 0)
                    return ts.factory.createIdentifier(`Function`);
                return ts.factory.createIdentifier('Object');

            } else if (type.isClassOrInterface()) { 
                let reifiedType = <boolean>type.isClass() || type.symbol?.name === 'Promise' || !!type.symbol.valueDeclaration;
                if (reifiedType) {
                    return typeLiteral(this, type, typeNode, { hoistImportsInCommonJS: true });
                }
            }

            return ts.factory.createIdentifier('Object');
        } else if (isFlagType(type, ts.TypeFlags.EnumLike)) {
            let types : ts.Type[] = type['types'];
            if (types && types.length > 0) {
                if (types.every(x => hasFlag(x.flags, ts.TypeFlags.StringLike)))
                    return ts.factory.createIdentifier('String');
                else if (types.every(x => hasFlag(x.flags, ts.TypeFlags.NumberLike)))
                    return ts.factory.createIdentifier('Number');
                else if (types.every(x => hasFlag(x.flags, ts.TypeFlags.BigIntLike)))
                    return ts.factory.createIdentifier('BigInt');
            }
        }

        // No idea
        return ts.factory.createIdentifier('Object');
    }
}