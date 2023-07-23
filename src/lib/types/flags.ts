import * as format from '../../common/format';

function Flag(value: string) {
    return (target, propertyKey) => {
        if (!target.flagToProperty)
            target.flagToProperty = {};
        if (!target.propertyToFlag)
            target.propertyToFlag = {};
        target.flagToProperty[value] = propertyKey;
        target.propertyToFlag[propertyKey] = value;
    };
}

export class Flags {
    constructor(flags: string) {
        if (!flags)
            flags = '';
        Object.keys(this.flagToProperty)
            .forEach(flag => this[this.flagToProperty[flag]] = flags.includes(flag));
    }

    private flagToProperty: Record<string, string>;
    private propertyToFlag: Record<string, string>;

    @Flag(format.F_READONLY) isReadOnly: boolean;
    @Flag(format.F_ACCESSOR) isAccessor: boolean;
    @Flag(format.F_GET_ACCESSOR) hasGetAccessor: boolean;
    @Flag(format.F_SET_ACCESSOR) hasSetAccessor: boolean;
    @Flag(format.F_DEFAULT_LIB) isFromDefaultLib: boolean;
    @Flag(format.F_ABSTRACT) isAbstract: boolean;
    @Flag(format.F_PUBLIC) isPublic: boolean;
    @Flag(format.F_PRIVATE) isPrivate: boolean;
    @Flag(format.F_PROTECTED) isProtected: boolean;
    @Flag(format.F_PROPERTY) isProperty: boolean;
    @Flag(format.F_CONSTRUCTOR) isConstructor: boolean;
    @Flag(format.F_METHOD) isMethod: boolean;
    @Flag(format.F_STATIC) isStatic: boolean;
    @Flag(format.F_OPTIONAL) isOptional: boolean;
    @Flag(format.F_REST) isRest: boolean;
    @Flag(format.F_ASYNC) isAsync: boolean;
    @Flag(format.F_EXPORTED) isExported: boolean;
    @Flag(format.F_INFERRED) isInferred: boolean;
    @Flag(format.F_OMITTED) isOmitted: boolean;
    @Flag(format.F_ARRAY_BINDING) isArrayBinding: boolean;
    @Flag(format.F_OBJECT_BINDING) isObjectBinding: boolean;

    get memberBrand(): format.RtMemberBrand {
        if (this.isProperty)
            return format.F_PROPERTY;
        else if (this.isMethod)
            return format.F_METHOD;
        else if (this.isConstructor)
            return format.F_CONSTRUCTOR;
    }

    toString() {
        return Object.keys(this.propertyToFlag)
            .map(property => this[property] ? this.propertyToFlag[property] : '')
            .join('');
    }

}
