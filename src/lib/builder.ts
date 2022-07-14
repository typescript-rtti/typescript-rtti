import {
    AliasToken, F_CLASS,
    F_FLAGS, F_INTERFACE, F_PROPERTY, InterfaceToken,
    RtAliasType,
    RtGenericType,
    RtObjectMember,
    RtObjectType,
    RtType, RtVariableType,
    T_ALIAS, T_VARIABLE
} from "../common";
import {
    ReflectedClass,
    ReflectedClassRef,
    ReflectedInterfaceRef,
    ReflectedObjectRef,
    ReflectedTypeRef
} from "../index";
import * as format from "../common/format";


/* cast a value to a RtType format */
export function asRtType(t: any): RtType {
    if (t instanceof ReflectedTypeRef) return t.ref as RtType;
    if (t instanceof TypeBuilder) return t.typeRef;
    if (t.TΦ != null) return t;
    return ReflectedTypeRef.createFromRtRef(t).ref as RtType;
}

export type BuilderType = RtType | ReflectedTypeRef | TypeBuilder<RtType>;
export type BuilderFlagType = { type: BuilderType, flags: F_FLAGS };
export type BuilderObjectType = { [key: string]: BuilderType | BuilderFlagType | BuilderObjectType };

export class TypeBuilder<T extends RtType> {
    typeRef: T | RtType = {TΦ: format.T_UNKNOWN};
    metadata: { [key: string]: any } = {};

    getType(): ReflectedTypeRef {
        return ReflectedTypeRef.createFromRtRef(this.typeRef);
    }

    getToken() {
        return undefined;
    }

    /* define metadata on token */
    defineMetadata(metadataKey: any, metadataValue: any, prop?: string) {
        if (this.getToken() != null) {
            const target = prop == null ? this.getToken() : this.getToken().prototype;
            Reflect.defineMetadata(metadataKey, metadataValue, target, prop);
        }
        this.metadata[metadataKey + prop ? "@" + prop : ""] = metadataValue;
    }

    /* get metadata from token */
    getMetadata(metadataKey: any, prop?: string) {
        if (this.getToken() != null) {
            const target = prop == null ? this.getToken() : this.getToken().prototype;
            return Reflect.getMetadata(metadataKey, target, prop);
        }
        return this.metadata[metadataKey + prop ? "@" + prop : ""];
    }
}

export class ObjectLikeTypeBuilder extends TypeBuilder<RtObjectType> {
    typeRef: RtObjectType = {TΦ: format.T_OBJECT, m: []};

    addProperty(name: string, type: BuilderType, flags?: F_FLAGS): this {
        this.typeRef.m.push({n: name, f: flags || '', t: asRtType(type)});
        return this;
    }

    extend(type: BuilderObjectType | TypeBuilder<RtType> | ReflectedTypeRef): this {
        if (type instanceof TypeBuilder) {
            if (type instanceof ObjectLikeTypeBuilder) {
                type.typeRef.m.forEach(m => {
                    this.addProperty(m.n, m.t, m.f);
                })
                return this;
            }
            throw new Error('Cannot extend from non-ObjectLikeType builders');
        }
        if (type instanceof ReflectedTypeRef) {
            if (type instanceof ReflectedObjectRef) {
                type.ref.m.forEach(m => {
                    this.addProperty(m.n, m.t, m.f);
                })
                return this;
            }
            if (type instanceof ReflectedInterfaceRef) {
                // @ TODO: implement
                // this.typeRef.m = this.typeRef.m.concat(type.ref.m);
                // return this;
                throw new Error('Cannot extend from interfaces ref');
            }
            if (type instanceof ReflectedClassRef) {
                // @ TODO: implement
                throw new Error('Cannot extend from classes ref');
            }
            if (type instanceof ReflectedClass) {
                // @ TODO: implement
                throw new Error('Cannot extend from classes');
            }
            throw new Error('Cannot extend from non-ObjectRef types');
        }

        for (const [name, value] of Object.entries(type)) {
            // @ts-ignore
            if (value && typeof value === 'object' && value.type != null && value.flags != null) {
                let v: BuilderFlagType = value as BuilderFlagType;
                this.addProperty(name, v.type, v.flags);
            } else {
                this.addProperty(name, value as BuilderType);
            }
        }
        return this;
    }
}

export class InterfaceTypeBuilder extends ObjectLikeTypeBuilder {
    typeRefToken: InterfaceToken = {
        name: "",
        prototype: {},
        identity: Symbol("interface"),
    }

    getToken() {
        return this.typeRefToken;
    }

    override getType(): ReflectedTypeRef {
        return ReflectedTypeRef.createFromRtRef(this.typeRefToken);
    }

    constructor() {
        super();
        /* define default metadata */
        this.defineMetadata("rt:P", []);
        this.defineMetadata('rt:m', []);
        this.addFlag(F_INTERFACE);
    }

    setName(name: string): this {
        this.typeRefToken.name = name;
        return this;
    }

    get name(): string {
        return this.typeRefToken.name;
    }

    set name(name: string) {
        this.typeRefToken.name = name;
    }

    addFlag(flag: F_FLAGS, prop?: string): this {
        if (flag == null) return this;
        this.defineMetadata('rt:f', (this.getMetadata('rt:f', prop) || "") + flag, prop);
        return this;
    }

    override addProperty(name: string, type: BuilderType, flags?: F_FLAGS): this {
        super.addProperty(name, type, flags);

        const last = this.typeRef.m[this.typeRef.m.length - 1];

        /* sync metadata */
        // prop
        this.getMetadata('rt:P').push(last.n);
        // set prop type
        this.defineMetadata('rt:t', () => last.t, name);
        // set prop flags
        this.addFlag(F_PROPERTY, name);
        this.addFlag(flags, name);

        return this;
    }
}

export class AliasTypeBuilder extends TypeBuilder<RtAliasType> {
    typeRef: RtAliasType = {
        TΦ: T_ALIAS,
        name: "",
        a: {
            name: "",
            identity: Symbol("Alias"),
        },
        t: () => {
            return {TΦ: format.T_UNKNOWN}
        },
        p: []
    };

    getToken() {
        return this.typeRef.a;
    }

    setName(name: string): this {
        this.typeRef.name = name;
        return this;
    }

    get name(): string {
        return this.typeRef.name;
    }

    set name(name: string) {
        this.typeRef.name = name;
        this.typeRef.a.name = name;
    }

    setAliasedType(type: BuilderType): this {
        this.typeRef.t = () => asRtType(type);
        return this;
    }

    /* parameters for generics */
    addParameters(...name: string[]): this {
        this.typeRef.p.push(...name);
        return this;
    }
}

// @TODO: implement
export class GenericTypeBuilder extends TypeBuilder<RtGenericType> {
}

/* just an alias */
export class ObjectTypeBuilder extends ObjectLikeTypeBuilder {

}

export class VariableTypeBuilder extends TypeBuilder<RtVariableType> {
    typeRef: RtVariableType = {
        TΦ: T_VARIABLE,
        name: "",
        t: () => {
            return {TΦ: format.T_UNKNOWN}
        }
    };

    setName(name: string): this {
        this.typeRef.name = name;
        return this;
    }

    get name(): string {
        return this.typeRef.name;
    }

    set name(name: string) {
        this.typeRef.name = name;
    }

    setTypeDeclaration(type: BuilderType): this {
        this.typeRef.t = () => asRtType(type);
        return this;
    }
}

/* @TODO class */
/* @TODO builder for all other kinds */
/* @TODO syntax sugar for type definition */
/**
 * type({a:Number,b:Number}) deep build as type -> ObjectLikeTypeBuilder
 * type([t1,t2]) deep build as type -> ArrayTypeBuilder
 * type(1) -> literal type
 * type(A,B) type(A).or(B)  -> union type
 * type(A).and(B) -> intersect type
 * literals ...
 * ect
 */


/* @TODO internally we could use the builders and just serialize the typeRef when emitting the code */
/* so we don't have to mess around with the typescript compiler everywhere */
/**
 *
 */
