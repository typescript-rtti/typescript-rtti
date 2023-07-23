import { ClassType } from './class-type';
import { InterfaceType } from './interface-type';
import { ObjectType } from './object-type';
import { Type } from './type';

/**
 * Implements type assignability comparisons for "structural" types, such as ClassType, InterfaceType and ObjectType.
 * @param type
 * @param otherType
 * @param allowExtraMembers
 * @returns
 */
export function structuralAssignableFrom(type: ClassType | InterfaceType | ObjectType, otherType: Type, allowExtraMembers: boolean) {
    if (otherType.isAny())
        return true;

    if (type.isClass()) {
        if (otherType.isClass()) {
            return type.equals(otherType);
        }

        if ([Number, String].includes(<any>type.class)) {
            if (otherType.is('enum')) {
                return otherType.values.map(x => Type.from(x)).every(elementType => type.assignableFrom(elementType))
            } else if (otherType.is('enum-literal')) {
                return type.assignableFrom(Type.from(otherType.value));
            } else if (otherType.isLiteral()) {
                return type.assignableFrom(Type.from(otherType.value));
            }

            return false;
        }

        return false;
    }

    if (type.isTypeLiteral()) {
        if (type.callSignatures.length > 0) {
            if (otherType.is('function')) {
                if (!type.callSignatures.some(sig => sig.assignableFrom(otherType.signature)))
                    return false;
            } else if (otherType.isTypeLiteral()) {
                let compatibleSignature = false;
                for (let mySig of type.callSignatures) {
                    for (let otherSig of type.callSignatures) {
                        if (mySig.assignableFrom(otherSig)) {
                            compatibleSignature = true;
                            break;
                        }
                    }
                }

                if (!compatibleSignature)
                    return false;
            }
        }
    }

    if (otherType.isStructural()) {
        let observedMembers: string[] = [];
        for (let member of type.members) {
            observedMembers.push(member.name);
            let otherMember = otherType.getMember(member.name);
            if (!otherMember && member.isOptional)
                continue;
            if (!member.type.assignableFrom(otherMember.type))
                return false;
        }

        if (!allowExtraMembers) {
            if (otherType.members.some(member => !observedMembers.includes(member.name))) {
                return false;
            }
        }
    }

    return false;
}