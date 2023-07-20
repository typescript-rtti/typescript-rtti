import * as format from '../common/format';
import { getParameterNames } from './get-parameter-names';
const NotProvided = Symbol();

export function isCallSite(callSite: CallSite) {
    return callSite?.TΦ === 'c';
}

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

export type TypeKind = 'union' | 'intersection' | 'any'
    | 'unknown' | 'tuple' | 'array' | 'class' | 'any' | 'unknown' | 'generic' | 'mapped' | 'literal'
    | 'void' | 'interface' | 'null' | 'undefined' | 'true' | 'false' | 'object' | 'enum' | 'enum-literal'
    | 'function' | 'class' | 'interface';

export const TYPE_REF_KIND_EXPANSION: Record<string, TypeKind> = {
    [format.T_UNKNOWN]: 'unknown',
    [format.T_ANY]: 'any',
    [format.T_UNION]: 'union',
    [format.T_INTERSECTION]: 'intersection',
    [format.T_TUPLE]: 'tuple',
    [format.T_ARRAY]: 'array',
    [format.T_GENERIC]: 'generic',
    [format.T_VOID]: 'void',
    [format.T_NULL]: 'null',
    [format.T_UNDEFINED]: 'undefined',
    [format.T_MAPPED]: 'mapped',
    [format.T_ENUM]: 'enum',
    [format.T_ENUM_LITERAL]: 'enum-literal',
    [format.T_FALSE]: 'false',
    [format.T_TRUE]: 'true',
    [format.T_OBJECT]: 'object',
    [format.T_CLASS]: 'class',
    [format.T_INTERFACE]: 'interface',
    [format.T_FUNCTION]: 'function',
    [format.T_LITERAL]: 'literal'
};

export interface MatchesValueOptions {
    /**
     * An array where errors encountered while validating an object are saved.
     * If you don't supply this, you won't be able to get the list of errors.
     */
    errors?: Error[];

    context?: string;

    /**
     * Whether to allow extra properties that do not conform to the type.
     * Though Typescript normally allows extra properties, it is a potential
     * security vulnerability if the user chooses to use this to validate
     * user-controlled objects, so you have to opt in if you expect extra
     * properties to be present.
     *
     * @default false
     */
    allowExtraProperties?: boolean;
}
export class Type<T extends format.RtType = format.RtType> {
    /** @internal */
    constructor(
        private _ref: T
    ) {
    }

    /**
     * @internal
     */
    static getTypeRef(obj) {
        if (obj === null || !['object', 'function'].includes(typeof obj))
            return undefined;

        return Reflect.getMetadata('rtti:type', obj)?.();
    }

    toString() {
        return `[${this.kind} type]`;
    }

    /** @internal */
    static Kind(kind: TypeKind) {
        return (target) => {
            Type.kinds[kind] = target;
        };
    }

    /**
     * Check if the given value matches this type reference. Collects any errors into the `errors` list.
     * @param value
     * @param errors
     * @param context
     * @returns
     */
    matchesValue(value, options?: MatchesValueOptions) {
        options ??= {};
        options.errors ??= [];
        options.errors.push(new Error(`No validation available for type with kind '${this.kind}'`));
        return false;
    }

    /**
     * Check if the given type reference is equivalent to this type reference.
     * @param ref
     * @returns
     */
    equals(ref : this) {
        if (this === ref)
            return true;

        if (ref.constructor !== this.constructor)
            return false;

        return this.matches(ref);
    }

    protected matches(ref : this) {
        if (!(ref instanceof this.constructor))
            return false;

        return true;
    }

    private static kinds: Record<TypeKind, Constructor<Type>> = <any>{};

    get kind(): TypeKind {
        let ref = this._ref;
        if (ref === null || ['string', 'number', 'bigint'].includes(typeof ref))
            return 'literal';

        if (typeof ref === 'object' && 'TΦ' in ref)
            return TYPE_REF_KIND_EXPANSION[(<format.RtBrandedType>ref).TΦ];

        if (typeof ref === 'object')
            return 'interface';

        return 'class';
    }

    /** @internal */
    get ref(): Readonly<T> {
        return this._ref;
    }

    /**
     * Checks if this type reference is a Promise, optionally a Promise of a specific type.
     * If the type reference does not specify a type of Promise but you have provided a type
     * to check for, this will return false.
     * @param klass The type of promise to check for. Would be String when looking for Promise<string>
     */
    isPromise(): this is GenericType {
        if (this.isGeneric() && this.baseType.isBuiltinClass(Promise))
            return true;
        return false;
    }

    /**
     * True if the type is considered to be an instance of the given constructor.
     * This does not mean this type is a ClassType, since literals and other more
     * specialized types are not represented by ClassType.
     * @param klass
     */
    isBuiltinClass<T>(klass?: Constructor<T> | BigIntConstructor): this is ClassType {
        if (this.isClass()) {
            return isBuiltIn(klass) && this.class === klass;
        }

        return false;
    }

    /**
     * Checks if this type reference is a class. Note: If the class reference has type parameters,
     * (ie it is generic) this check will fail, and instead isGeneric() will succeed.
     * @param klass
     */
    isClass(): this is ClassType {
        return this.kind === 'class';
    }

    isInterface(interfaceType?: format.InterfaceToken): this is InterfaceType {
        if (interfaceType)
            return this.isInterface() && (this.ref as unknown as format.InterfaceToken).identity === interfaceType.identity;
        else
            return this.kind === 'interface';
    }

    /**
     * Checks if this type is a literal type (null/true/false or a string/number literal).
     * Caution: You cannot use this to check for `undefined`. Use `isUndefined()` instead.
     * @param value
     * @returns
     */
    isLiteral(value: null): this is NullType;
    isLiteral(value: undefined): this is UndefinedType;
    isLiteral(value: true): this is TrueType;
    isLiteral(value: false): this is FalseType;
    isLiteral<T extends format.Literal>(value: T): this is LiteralType<T>;
    isLiteral(): this is LiteralType<any>;
    isLiteral(value: number | bigint | string): boolean;
    isLiteral(value: true | false | null | number | bigint | string | symbol = NotProvided): boolean {
        if (value === null) return this.isNull();
        if (value === true) return this.isTrue();
        if (value === false) return this.isFalse();
        return this.kind === 'literal' && (value === NotProvided || (<any>this.ref).v === value);
    }


    /** Check if this type reference is a function type      */ is(kind: 'function'): this is FunctionType;
    /** Check if this type reference is an interface type    */ is(kind: 'interface'): this is InterfaceType;
    /** Check if this type reference is a class type         */ is(kind: 'class'): this is ClassType;
    /** Check if this type reference is a generic type       */ is(kind: 'generic'): this is GenericType;
    /** Check if this type reference is an array type        */ is(kind: 'array'): this is ArrayType;
    /** Check if this type reference is an intersection type */ is(kind: 'intersection'): this is IntersectionType;
    /** Check if this type reference is a union type         */ is(kind: 'union'): this is UnionType;
    /** Check if this type reference is an enum type         */ is(kind: 'enum'): this is EnumType;
    /** Check if this type reference is an enum literal type */ is(kind: 'enum-literal'): this is EnumLiteralType;
    /** Check if this type reference is a tuple type         */ is(kind: 'tuple'): this is TupleType;
    /** Check if this type reference is a void type          */ is(kind: 'void'): this is VoidType;
    /** Check if this type reference is an any type          */ is(kind: 'any'): this is AnyType;
    /** Check if this type reference is a false type         */ is(kind: 'false'): this is FalseType;
    /** Check if this type reference is a true type          */ is(kind: 'true'): this is TrueType;
    /** Check if this type reference is an undefined type    */ is(kind: 'undefined'): this is UndefinedType;
    /** Check if this type reference is a null type          */ is(kind: 'null'): this is NullType;
    /** Check if this type reference is an unknown type      */ is(kind: 'unknown'): this is UnknownType;
    /** Check if this type reference is an mapped type       */ is(kind: 'mapped'): this is MappedType;
    /** Check if this type reference is a structural type    */ is(kind: 'object'): this is ObjectType;
    /** Check if this type reference is a literal type       */ is(kind: 'literal'): this is LiteralType<any>;
    /**
     * Check if this type reference is an instance of the given Type subclass.
     * @param type The subclass of Type to check
     */
    is<T, U extends T>(this: T, type: Constructor<U>): this is U;
    is(this, kind: TypeKind | Constructor<any>): boolean {
        if (typeof kind === 'function')
            return this instanceof kind;
        else if (typeof kind === 'string')
            return this.kind === kind;
    }

    /**
     * Assert that this type reference is an interface type and cast it to InterfaceType.
     * If the reference is not the correct type an error is thrown.
     */
     as(kind: 'interface'): InterfaceType;
     /**
      * Assert that this type reference is a Function type and cast it to FunctionType.
      * If the reference is not the correct type an error is thrown.
      */
     as(kind: 'function'): FunctionType;
    /**
     * Assert that this type reference is a class type and cast it to ClassType.
     * If the reference is not the correct type an error is thrown.
     */
    as<T = any>(kind: 'class'): ClassType;
    /**
     * Assert that this type reference is a generic type and cast it to GenericType.
     * If the reference is not the correct type an error is thrown.
     */
    as<T = any>(kind: 'generic'): GenericType;
    /**
     * Assert that this type reference is an enum type and cast it to EnumType.
     * If the reference is not the correct type an error is thrown. Given `enum Foo { Bar = 1 }`,
     * an enum type would be `Foo` (as opposed to `Foo.Bar`, which is an enum literal type)
     */
    as<T = any>(kind: 'enum'): EnumType;
    /**
     * Assert that this type reference is an enum literal type and cast it to EnumLiteralType.
     * If the reference is not the correct type an error is thrown. Given `enum Foo { Bar = 1 }`,
     * an enum literal type would be `Foo.Bar` (as opposed to `Foo`, which is an enum type)
     */
    as<T = any>(kind: 'enum-literal'): EnumLiteralType;
    /**
     * Assert that this type reference is an array type and cast it to ArrayType.
     * If the reference is not the correct type an error is thrown.
     */
    as(kind: 'array'): ArrayType;
    /**
     * Assert that this type reference is an intersection type and cast it to IntersectionType.
     * If the reference is not the correct type an error is thrown.
     */
    as(kind: 'intersection'): IntersectionType;
    /**
     * Assert that this type reference is a union type and cast it to UnionType.
     * If the reference is not the correct type an error is thrown.
     */
    as(kind: 'union'): UnionType;
    /**
     * Assert that this type reference is a tuple type and cast it to TupleType.
     * If the reference is not the correct type an error is thrown.
     */
    as(kind: 'tuple'): TupleType;
    /**
     * Assert that this type reference is a void type and cast it to VoidType.
     * If the reference is not the correct type an error is thrown.
     */
    as(kind: 'void'): VoidType;
    /**
     * Assert that this type reference is a void type and cast it to UnknownType.
     * If the reference is not the correct type an error is thrown.
     */
    as(kind: 'unknown'): UnknownType;
    /**
     * Assert that this type reference is a void type and cast it to AnyType.
     * If the reference is not the correct type an error is thrown.
     */
    as(kind: 'any'): AnyType;
    /**
     * Assert that this type reference is a void type and cast it to LiteralType.
     * If the reference is not the correct type an error is thrown.
     */
    as(kind: 'literal'): LiteralType;
    /**
     * Assert that this type reference is the given Type subclass.
     * If the reference is not the correct type an error is thrown.
     */
    as<T, U extends T>(this: T, subclass: Constructor<U>): U;
    as(this, subclass: TypeKind | Constructor<any>) {
        if (typeof subclass === 'function' && !(this instanceof subclass))
            throw new TypeError(`Value of type ${this.constructor.name} cannot be converted to ${subclass.name}`);
        else if (typeof subclass === 'string' && this.kind !== subclass)
            throw new TypeError(`Type has kind ${this.kind}, expected ${subclass}`);
        return this;
    }

    isVoid(): this is VoidType { return this.kind === 'void'; }
    isNull(): this is NullType { return this.kind === 'null'; }
    isUndefined(): this is UndefinedType { return this.kind === 'undefined'; }
    isTrue(): this is TrueType { return this.kind === 'true'; }
    isFalse(): this is FalseType { return this.kind === 'false'; }
    isStringLiteral(): this is LiteralType<string> { return this.kind === 'literal' && typeof this.ref === 'string'; }
    isNumberLiteral(): this is LiteralType<number> { return this.kind === 'literal' && typeof this.ref === 'number'; }
    isBigIntLiteral(): this is LiteralType<bigint> { return this.kind === 'literal' && typeof this.ref === 'bigint'; }
    isBooleanLiteral(): this is LiteralType<number> { return this.isTrue() || this.isFalse(); }

    /**
     * Check if this type reference is a generic type, optionally checking if the generic's
     * base type is the given class. For instance isGeneric(Promise) is true for Promise<string>.
     * @param klass
     */
    isGeneric(): this is GenericType {
        return this.kind === 'generic';
    }

    isUnion(elementDiscriminator?: (elementType: Type) => boolean): this is UnionType {
        return elementDiscriminator
            ? this.isUnion() && this.types.every(e => elementDiscriminator(e))
            : this.kind === 'union';
    }

    isIntersection(elementDiscriminator?: (elementType: Type) => boolean): this is IntersectionType {
        return elementDiscriminator
            ? this.isIntersection() && this.types.every(e => elementDiscriminator(e))
            : this.kind === 'intersection';
    }

    isArray(elementDiscriminator?: (elementType: Type) => boolean): this is ArrayType {
        return elementDiscriminator
            ? this.isArray() && elementDiscriminator(this.elementType)
            : this.kind === 'array'
            ;
    }

    isTuple(elementDiscriminators?: ((elementType: TupleElement) => boolean)[]): this is TupleType {
        return elementDiscriminators
            ? this.isTuple() && this.elements.every((e, i) => elementDiscriminators[i](e))
            : this.kind === 'tuple';
    }

    isUnknown() {
        return this.kind === 'unknown';
    }

    isAny() {
        return this.kind === 'any';
    }

    /**
     * Creates an "unknown"
     * @internal
     */
    static createUnknown() {
        return this.createFromRtRef({ TΦ: format.T_UNKNOWN });
    }

    /** @internal */
    static createFromRtRef<T>(this: Constructor<T>, ref: format.RtType): T {
        if (ref === undefined)
            return undefined;
        if (ref === null)
            return null;

        let kind: TypeKind;

        if (ref === null || !['object', 'function'].includes(typeof ref))
            kind = 'literal';
        else if (typeof ref === 'object' && 'TΦ' in <object>ref)
            kind = TYPE_REF_KIND_EXPANSION[(ref as format.RtBrandedType).TΦ];
        else if (typeof ref === 'object')
            kind = 'interface';
        else
            kind = 'class';

        return <T> new (Type.kinds[kind] || Type)(ref);
    }
}

@Type.Kind('class')
export class ClassType extends Type<format.RtClassType> {
    private _interfaces: Type[];
    private _super: ClassType;
    private _ownMembers: Member[];
    private _ownMethods: Method[];
    private _ownProperties: Property[];
    private _constructors: ConstructorMember[];

    get kind() { return 'class' as const; }

    /**
     * Retrieve the class constructor if this type represents a built-in (default library) class such as String or
     * Number.
     */
    get class() { return <Constructor<any>> this.ref.C; }
    get name() { return this.ref.n; }

    static from(constructor: Function) {
        if (typeof constructor !== 'function')
            throw new TypeError(`Parameter constructor must be a function`);
        if (!constructor.prototype)
            throw new TypeError(`Passed function is not a valid constructor`);

        const ref = Type.getTypeRef(constructor);
        if (ref)
            return this.createFromRtRef(ref);

        return this.createFromRtRef(this.synthesizeRef(constructor));
    }

    /**
     * @internal
     */
    static synthesizeRef(constructor: Function): format.RtType {
        if (!constructor)
            return undefined;

        let ctorParamTypeHints = Reflect.getMetadata('design:paramtypes', constructor) ?? [];
        let paramNames = getParameterNames(constructor);

        return {
            TΦ: format.T_CLASS,
            C: constructor,
            n: constructor.name,
            i: [],
            m: [
                {
                    f: format.F_CONSTRUCTOR,
                    n: 'constructor',
                    t: {
                        TΦ: format.T_FUNCTION,
                        n: 'constructor',
                        r: { TΦ: format.T_VOID },
                        f: '',
                        p: paramNames.map((name, i) => (<format.RtParameter>{
                            n: name,
                            t: this.synthesizeRef(ctorParamTypeHints[i]) ?? { TΦ: format.T_ANY }
                        }))
                    }
                },
                ...Object.getOwnPropertyNames(constructor.prototype)
                    .filter(x => !['constructor'].includes(x))
                    .map(name => synthesizeMember(constructor.prototype, name)),
                ...Object.getOwnPropertyNames(constructor)
                    .filter(x => !['length', 'prototype', 'name'].includes(x))
                    .map(name => synthesizeMember(constructor, name, format.F_STATIC)),
            ],
            f: `${format.F_DEFAULT_LIB}`
        }
    }

    toString() { return `class ${this.name}`; }

    protected override matches(ref : this) {
        if (!super.matches(ref))
            return false;

        if (ref.name !== this.name)
            return false;

        if (ref.flags.toString() !== this.flags.toString())
            return false;

        if (this.allMembers.length !== ref.allMembers.length)
            return false;

        if (!this.allMembers.every(x => ref.allMembers.some(y => x.equals(y))))
            return false;

        return true;
    }

    private _flags: Flags;
    get flags() { return this._flags ??= new Flags(this.ref.f) };

    /**
     * True if this class is abstract.
     */
    get isAbstract() { return this.flags.isAbstract; }

    /**
     * Get the reflected superclass for this class. If this is an interface,
     * this will always be undefined. If you are looking to access the classes/interfaces that
     * an interface extends, use the "interfaces" property.
     */
    get super(): ClassType {
        return this._super ??= ClassType.createFromRtRef(this.ref.e);
    }

    //#region Own Instance Members

    get ownMembers(): Member[] {
        return this._ownMembers ??= this.ref.m.filter(m => !m.f?.includes(format.F_STATIC)).map(m => Member.createFromRef(m));
    }

    get ownMethods() {
        return this._ownMethods ??= this.ownMembers.filter(x => x instanceof Method) as Method[];
    }

    get ownProperties() {
        return this._ownProperties ??= this.ownMembers.filter(x => x instanceof Property) as Property[];
    }

    private _dynamicMembers: Member[] = [];
    getOwnProperty(name: string) {
        let prop = this.ownProperties.find(x => x.name === name);

        prop ??= this._dynamicMembers.filter(x => x instanceof Property).find(x => x.name === name) as Property;
        if (!prop && this.class) {
            let typeHint = Reflect.getMetadata('design:type', this.class.prototype, name);
            if (typeHint) {
                this._dynamicMembers.push(prop = Member.createFromRef(synthesizeMember(this.class.prototype, name)) as Property);
            }
        }

        return prop;
    }

    getOwnMethod(name: string) {
        let method = this.ownMethods.find(x => x.name === name);

        method ??= this._dynamicMembers.filter(x => x instanceof Method).find(x => x.name === name) as Method;
        if (!method && this.class) {
            let typeHint = Reflect.getMetadata('design:returntype', this.class.prototype, name);
            if (typeHint) {
                this._dynamicMembers.push(method = Member.createFromRef(synthesizeMember(this.class, name)) as Method);
            }
        }

        return method;
    }

    //#endregion
    //#region All Instance Members

    private _allMembers: Member[];

    /**
     * Retrieve a set of all members (both instance and static) for this class.
     */
    get allMembers(): Member[] {
        return this._allMembers ??= [].concat(this.members, this.staticMembers);
    }

    private _members: Member[];

    /**
     * Retrieve a set of all valid instance members for this class.
     */
    get members(): Member[] {
        return this._members ??= superMergeElements(this.ownMembers, this.super?.members ?? []);
    }

    private _methods: Method[];

    /**
     * Retrieve a set of all valid instance methods for this class.
     */
    get methods() {
        return this._methods ??= this.members.filter(x => x instanceof Method) as Method[];
    }

    private _properties: Property[];

    /**
     * Retrieve a set of all valid instance properties for this class.
     */
    get properties() {
        return this._properties ??= this.members.filter(x => x instanceof Property) as Property[];
    }

    /**
     * Retrieve a set of all valid constructors for this class.
     */
    get constructors() {
        return this._constructors ??= this.members.filter(x => x instanceof ConstructorMember) as ConstructorMember[];
    }

    getProperty(name: string) {
        return this.getOwnProperty(name) ?? this.super?.getProperty(name);
    }

    getMethod(name: string) {
        return this.getOwnMethod(name) ?? this.super?.getMethod(name);
    }

    //#endregion
    //#region Own Static Members

    private _ownStaticMembers: Member[];
    get ownStaticMembers(): Readonly<Member[]> {
        if (!this._ownStaticMembers)
            this._ownStaticMembers = this.ref.m.filter(m => m.f?.includes(format.F_STATIC)).map(m => Member.createFromRef(m));

        return this._ownStaticMembers;
    }

    private _ownStaticProperties: Property[];
    get ownStaticProperties(): Readonly<Property>[] {
        return this._ownStaticProperties ??= <Property[]>this.ownStaticMembers.filter(x => x instanceof Property);
    }

    private _ownStaticMethods: Method[];
    get ownStaticMethods(): Readonly<Method>[] {
        return this._ownStaticMethods ??= <Method[]>this.ownStaticMembers.filter(x => x instanceof Method);
    }

    private _dynamicStaticMembers: Member[] = [];

    getOwnStaticProperty(name: string) {
        let prop = this.ownStaticProperties.find(x => x.name === name);
        prop ??= this._dynamicStaticMembers.filter(x => x instanceof Property).find(x => x.name === name) as Property;
        if (!prop && this.class) {
            let typeHint = Reflect.getMetadata('design:type', this.class, name);
            if (typeHint) {
                this._dynamicStaticMembers.push(prop = Member.createFromRef(synthesizeMember(this.class, name)) as Property);
            }
        }

        return prop;
    }

    getOwnStaticMethod(name: string) {
        let method = this.ownStaticMethods.find(x => x.name === name);
        method ??= this._dynamicStaticMembers.filter(x => x instanceof Method).find(x => x.name === name) as Method;
        if (!method && this.class) {
            let typeHint = Reflect.getMetadata('design:type', this.class, name);
            if (typeHint) {
                this._dynamicStaticMembers.push(method = Member.createFromRef(synthesizeMember(this.class, name)) as Method);
            }
        }

        return method;
    }

    //#endregion
    //#region All Static Members

    get staticMembers() {
        return superMergeElements(this.ownStaticMembers, this.super?.staticMembers ?? []);
    }

    private _staticProperties: Property[];
    get staticProperties(): Readonly<Property>[] {
        return this._staticProperties ??= <Property[]>this.staticMembers.filter(x => x instanceof Property);
    }

    private _staticMethods: Method[];
    get staticMethods(): Readonly<Method>[] {
        return this._staticMethods ??= <Method[]>this.staticMembers.filter(x => x instanceof Method);
    }

    getStaticProperty(name: string) {
        return this.getOwnStaticProperty(name) ?? this.super?.getStaticProperty(name);
    }

    getStaticMethod(name: string) {
        return this.getOwnStaticMethod(name) ?? this.staticMethods.find(x => x.name === name);
    }

    //#endregion

    /**
     * Get the interfaces that this class implements, or that this interface extends.
     * Note that if the class implements another class as an interface, you will receive
     * a class type reference for that, not an interface type reference.
     */
    get interfaces() {
        return this._interfaces ??= this.ref.i?.map(t => Type.createFromRtRef(t)) ?? [];
    }

    override matchesValue(value: any, options?: MatchesValueOptions) {
        options ??= {};
        options.errors ??= [];

        if (this.ref.C === String)
            return typeof value === 'string';
        else if (this.ref.C === Number)
            return typeof value === 'number';
        else if (this.ref.C === Boolean)
            return typeof value === 'boolean';
        else if (this.ref.C === Object)
            return typeof value === 'object';
        else if (this.ref.C === Function)
            return typeof value === 'function';
        else if (this.ref.C === Symbol)
            return typeof value === 'symbol'
        else if (this.ref.C === BigInt)
            return typeof value === 'bigint';
        else if (this.ref.C)
            return value instanceof this.ref.C;

        throw new Error(`Indeterminable (constructor reference not available)`);
    }
}

/**
 * Represents an interface type.
 */
@Type.Kind('interface')
export class InterfaceType extends Type<format.RtInterfaceType> {
    get kind() { return 'interface' as const; }
    get name() { return this.ref.n; }

    toString() { return `interface ${this.name}`; }

    //#region Super Types

    private _super: Type[];
    get super() {
        return this._super ??= (this.ref.e ?? []).map(x => Type.createFromRtRef(x));
    }

    //#endregion
    //#region Own Instance Members

    private _ownMembers: Member[];
    get ownMembers(): Readonly<Member[]> {
        if (!this._ownMembers)
            this._ownMembers = this.ref.m.map(m => Member.createFromRef(m));

        return this._ownMembers;
    }

    private _ownProperties: Property[];
    get ownProperties(): Readonly<Property>[] {
        return this._ownProperties ??= <Property[]>this.ownMembers.filter(x => x instanceof Property);
    }

    private _ownMethods: Method[];
    get ownMethods(): Readonly<Method>[] {
        return this._ownMethods ??= <Method[]>this.ownMembers.filter(x => x instanceof Method);
    }

    getOwnMember(name: string) {
        return this.ownMembers.find(x => x.name === name);
    }

    getOwnProperty(name: string) {
        return this.ownProperties.find(x => x.name === name);
    }

    getOwnMethod(name: string) {
        return this.ownMethods.find(x => x.name === name);
    }

    //#endregion
    //#region All Instance Members

    /**
     * Retrieve all members for this interface.
     */
    get members() {
        return superMergeElements(this.ownMembers, this.super.flatMap(s => gatherMembers(s)));
    }

    /**
     * Retrieve all members for this interface.
     * Alias for `members`.
     */
    get allMembers() {
        return this.members;
    }

    private _properties: Property[];
    get properties(): Readonly<Property>[] {
        return this._properties ??= <Property[]>this.members.filter(x => x instanceof Property);
    }

    private _methods: Method[];
    get methods(): Readonly<Method>[] {
        return this._methods ??= <Method[]>this.members.filter(x => x instanceof Method);
    }

    getProperty(name: string) {
        return this.properties.find(x => x.name === name);
    }

    getMethod(name: string) {
        return this.methods.find(x => x.name === name);
    }

    //#endregion
    //#region Matches/Equals

    protected override matches(ref : this): boolean {
        if (this.ownMembers.length !== ref.ownMembers.length)
            return false;

        return this.ownMembers.every(member => ref.ownMembers.some(x => member.equals(x)));
    }

    /**
     * Check if the given value matches the shape of this type, and thus would be a valid assignment.
     * @param object
     * @param errors
     * @returns
     */
    matchesValue(object, options?: MatchesValueOptions) {
        options ??= {};
        options.errors ??= [];

        if (object === null || object === void 0) {
            options.errors.push(new Error(`Value is undefined`));
            return false;
        }

        if (typeof object !== 'object') {
            options.errors.push(new Error(`Value must be an object`));
            return false;
        }

        let matches = true;

        if (globalThis.RTTI_TRACE === true)
            console.log(`Type checking value against type '${this.name}'`);

        for (let method of this.methods) {
            let hasValue = method.name in object;
            let value = object[method.name];

            if (!hasValue && !method.isOptional) {
                options.errors.push(new Error(`Method '${method.name}()' is missing in value`));
                matches = false;
            }

            if (!hasValue)
                continue;

            let propMatch = method.matchesValue(value, options);
            if (globalThis.RTTI_TRACE === true)
                console.log(` - ${this.name}#${method.name} : ${method.type} | valid(${JSON.stringify(value)}) => `
                    + `${propMatch}`);

            matches &&= propMatch;
        }

        for (let prop of this.ownProperties) {
            let hasValue = prop.name in object;
            let value = object[prop.name];

            if (!hasValue && !prop.isOptional) {
                options.errors.push(new Error(`Property '${prop.name}' is missing in value`));
                matches = false;
            }
            if (!hasValue)
                continue;
            let propMatch = prop.matchesValue(value, options);
            if (globalThis.RTTI_TRACE === true)
                console.log(` - ${this.name}#${prop.name} : ${prop.type} | valid(${JSON.stringify(value)}) => `
                    + `${propMatch}`);

            matches &&= propMatch;
        }

        let unaccountedMembers = Object.keys(object)
            .filter(x => !this.ownMembers.some(y => y.name === x) && !this.methods.some(y => y.name === x))
        ;

        if (options.allowExtraProperties !== true && unaccountedMembers.length > 0) {
            options.errors.push(
                new Error(
                    `Object contains the following undeclared members: `
                    + `${unaccountedMembers.join(', ')}`
                )
            );
            matches = false;
        }

        return matches;
    }
}

@Type.Kind('literal')
export class LiteralType<Class extends format.Literal = format.Literal> extends Type<format.RtLiteralType> {
    get kind() { return 'literal' as const; }
    get value() { return <Class>this.ref.v; }
    toString() { return JSON.stringify(this.ref.v); }

    protected override matches(ref : this) {
        return this.value === ref.value;
    }

    override matchesValue(value: any, options?: MatchesValueOptions): boolean {
        options ??= {};
        options.errors ??= [];
        return this.value === value;
    }
}

@Type.Kind('union')
export class UnionType extends Type<format.RtUnionType> {
    get kind() { return 'union' as const; }
    toString() { return `[${this.types.join(' | ')}]`; }

    private _types: Type[];
    get types(): Type[] {
        if (this._types)
            return this._types;
        return this._types = (this.ref.t || []).map(t => Type.createFromRtRef(t));
    }

    protected override matches(ref : this) {
        if (this.types.length !== ref.types.length)
            return false;
        for (let type of this.types) {
            if (!ref.types.some(x => type.equals(x)))
                return false;
        }
        return true;
    }

    override matchesValue(value: any, options?: MatchesValueOptions) {
        options ??= {};
        options.errors ??= [];
        return this.types.some(t => t.matchesValue(value, options));
    }
}

@Type.Kind('intersection')
export class IntersectionType extends Type<format.RtIntersectionType> {
    get kind() { return 'intersection' as const; }
    toString() { return `${this.types.join(' & ')}`; }

    private _types: Type[];
    get types() {
        if (this._types)
            return this._types;
        return this._types = (this.ref.t || []).map(t => Type.createFromRtRef(t));
    }

    protected override matches(ref : this) {
        if (this.types.length !== ref.types.length)
            return false;
        for (let type of this.types) {
            if (!ref.types.some(x => type.equals(x)))
                return false;
        }
        return true;
    }

    override matchesValue(value: any, options?: MatchesValueOptions) {
        options ??= {};
        options.errors ??= [];
        return this.types.every(t => t.matchesValue(value, options));
    }
}

@Type.Kind('array')
export class ArrayType extends Type<format.RtArrayType> {
    get kind() { return 'array' as const; }
    toString() { return `${this.elementType}[]`; }

    private _elementType: Type;
    get elementType(): Type {
        if (this._elementType)
            return this._elementType;
        return this._elementType = Type.createFromRtRef(this.ref.e);
    }

    protected override matches(ref : this) {
        return this.elementType.equals(ref.elementType);
    }

    override matchesValue(value: any, options?: MatchesValueOptions): boolean {
        options ??= {};
        options.errors ??= [];

        if (!Array.isArray(value)) {
            options.errors.push(new TypeError(`Value should be an array`));
            return false;
        }

        return (value as any[]).every(value => this.elementType.matchesValue(value, options));
    }
}

@Type.Kind('void')
export class VoidType extends Type<format.RtVoidType> {
    get kind() { return 'void' as const; }
    toString() { return `void`; }

    override matchesValue(value: any, options?: MatchesValueOptions): boolean {
        options ??= {};
        options.errors ??= [];
        if (value !== void 0) {
            options.errors.push(new Error(`Value must not be present`));
            return false;
        }

        return true;
    }
}

@Type.Kind('null')
export class NullType extends Type<format.RtNullType> {
    get kind() { return 'null' as const; }
    toString() { return `null`; }

    override matchesValue(value: any, options?: MatchesValueOptions): boolean {
        options ??= {};
        options.errors ??= [];
        return value === null;
    }
}

@Type.Kind('undefined')
export class UndefinedType extends Type<format.RtUndefinedType> {
    get kind() { return 'undefined' as const; }
    toString() { return `undefined`; }

    override matchesValue(value: any, options?: MatchesValueOptions): boolean {
        options ??= {};
        options.errors ??= [];
        return value === undefined;
    }
}

@Type.Kind('false')
export class FalseType extends Type<format.RtFalseType> {
    get kind() { return 'false' as const; }
    toString() { return `false`; }

    override matchesValue(value: any, options?: MatchesValueOptions): boolean {
        options ??= {};
        options.errors ??= [];
        return value === false;
    }
}

@Type.Kind('true')
export class TrueType extends Type<format.RtTrueType> {
    get kind() { return 'true' as const; }
    toString() { return `true`; }

    override matchesValue(value: any, options?: MatchesValueOptions): boolean {
        options ??= {};
        options.errors ??= [];
        return value === true;
    }
}

@Type.Kind('unknown')
export class UnknownType extends Type<format.RtUnknownType> {
    get kind() { return 'unknown' as const; }
    toString() { return `unknown`; }

    override matchesValue(value: any, options?: MatchesValueOptions): boolean {
        options ??= {};
        options.errors ??= [];
        return true;
    }
}

@Type.Kind('any')
export class AnyType extends Type<format.RtAnyType> {
    get kind() { return 'any' as const; }
    toString() { return `any`; }

    override matchesValue(value: any, options?: MatchesValueOptions): boolean {
        options ??= {};
        options.errors ??= [];
        return true;
    }
}

@Type.Kind('tuple')
export class TupleType extends Type<format.RtTupleType> {
    get kind() { return 'tuple' as const; }
    toString() { return `[${this.elements.join(', ')}]`; }

    private _elements: TupleElement[];
    get elements(): TupleElement[] {
        if (this._elements)
            return this._elements;
        return this._elements = (this.ref.e || []).map(e => new TupleElement(e));
    }

    protected override matches(ref : this) {
        if (this.elements.length !== ref.elements.length)
            return false;
        return this.elements.every((x, i) => x.name === ref.elements[i].name && x.type.equals(ref.elements[i].type));
    }

    override matchesValue(value: any, options?: MatchesValueOptions): boolean {
        options ??= {};
        options.errors ??= [];
        if (!Array.isArray(value)) {
            options.errors.push(new Error(`Value must be an array`));
            return false;
        }

        let array = <any[]>value;

        if (array.length !== this.elements.length) {
            options.errors.push(new Error(`Array must have ${this.elements.length} values to match tuple type`));
            return false;
        }

        return this.elements.every((v, i) => v.type.matchesValue(array[i], options));
    }
}

@Type.Kind('generic')
export class GenericType extends Type<format.RtGenericType> {
    get kind() { return 'generic' as const; }
    toString() { return `${this.baseType}<${this.typeParameters.join(', ')}>`; }

    private _baseType: Type;
    get baseType(): Type {
        if (this._baseType)
            return this._baseType;
        return this._baseType = Type.createFromRtRef(this.ref.t);
    }

    private _typeParameters: Type[];
    get typeParameters(): Type[] {
        if (this._typeParameters)
            return this._typeParameters;
        return this._typeParameters = this.ref.p.map(p => Type.createFromRtRef(p));
    }

    protected override matches(ref : this) {
        if (this.typeParameters.length !== ref.typeParameters.length)
            return false;
        return this.typeParameters.every((x, i) => x.equals(ref.typeParameters[i]));
    }

    override matchesValue(value: any, options?: MatchesValueOptions): boolean {
        options ??= {};
        options.errors ??= [];
        return this.baseType.matchesValue(value, options);
    }
}

@Type.Kind('enum-literal')
export class EnumLiteralType extends Type<format.RtEnumLiteralType> {
    get kind() { return 'enum-literal' as const; }
    toString() { return `${this.enum.name}.${this.name} [${this.value}]`; }

    private _enum: EnumType;

    get name() {
        return this.ref.n;
    }

    get enum() {
        return this._enum ??= EnumType.createFromRtRef(this.ref.e);
    }

    get value() {
        return this.ref.v;
    }
}

@Type.Kind('enum')
export class EnumType extends Type<format.RtEnumType> {
    get kind() { return 'enum' as const; }
    toString() { return `enum ${this.name}`; }

    private _name: string;

    get name() {
        if (!this._name)
            this._name = this.ref.n;
        return this._name;
    }

    private _values: EnumValue[];
    private _valueSet: Set<any>;
    private _keySet: Set<string>;

    get valueSet() {
        return this._valueSet ??= new Set(this.values.map(x => x.value));
    }

    get nameSet() {
        return this._keySet ??= new Set(this.values.map(x => x.name));
    }

    get values() {
        if (!this._values) {
            this._values = Object.entries(this.ref.v)
                .map(([name, value]) => ({ name, value }))
            ;
        }

        return this._values;
    }

    protected override matches(ref : this) {
        if (ref.values.length !== this.values.length)
            return false;

        let otherMap = new Map<string, any>(ref.values.map(x => [x.name, x.value]));
        for (let item of this.values) {
            if (item.value !== otherMap.get(item.name))
                return false;
        }

        return true;
    }

    override matchesValue(value: any, options?: MatchesValueOptions): boolean {
        options ??= {};
        options.errors ??= [];
        return this.valueSet.has(value);
    }
}

@Type.Kind('function')
export class FunctionType extends Type<format.RtFunctionType> {
    get kind() { return 'function' as const; }
    toString() { return `function`; } // TODO: details

    static from(func: Function) {
        const ref = Type.getTypeRef(func);

        if (ref)
            return this.createFromRtRef(ref);

        return this.createFromRtRef({
            TΦ: format.T_FUNCTION,
            n: func.name,
            f: '',
            p: getParameterNames(func).map(n => (<format.RtParameter>{ n })),
            r: { TΦ: format.T_ANY }
        })
    }

    private _returnType: Type;

    get name() {
        return this.ref.n;
    }

    get returnType() {
        return this._returnType ??= Type.createFromRtRef(this.ref.r);
    }

    private _parameters: Parameter[];

    get parameters() {
        return this._parameters ??= (this.ref.p ?? []).map((p, i) => new Parameter(p, i));
    }

    private _flags: Flags;

    /**
     * No use for this yet, reserved for future use
     * @internal
     */
    get flags() {
        return this._flags ??= new Flags(this.ref.f);
    }

    get isAsync() {
        return this.flags.isAsync;
    }

    /**
     * True if this function is a variadic function.
     */
    get isVariadic() {
        return this.parameters.find(v => v.isRest) !== undefined;
    }

    protected override matches(ref: this) {
        return this.returnType.equals(ref.returnType)
            && this.parameters.every((p, i) => p.equals(ref.parameters[i]))
            && this.flags.toString() === ref.flags.toString()
        ;
    }

    override matchesValue(value: any, options?: MatchesValueOptions): boolean {
        options ??= {};
        options.errors ??= [];

        if (typeof value !== 'function')
            return false;

        if (value.length !== this.parameters.length)
            return false;

        return true;
    }
}

export interface EnumValue {
    name: string;
    value: number;
}

@Type.Kind('mapped')
export class MappedType extends Type<format.RtMappedType> {
    get kind() { return 'mapped' as const; }
    toString() { return `${this.baseType}<${this.typeParameters.join(', ')}>`; }

    private _baseType: Type;
    get baseType(): Type {
        if (this._baseType)
            return this._baseType;
        return this._baseType = Type.createFromRtRef(this.ref.t);
    }

    private _typeParameters: Type[];
    get typeParameters(): Type[] {
        if (this._typeParameters)
            return this._typeParameters;
        return this._typeParameters = this.ref.p.map(p => Type.createFromRtRef(p));
    }

    private _members: ObjectMember[];

    get members(): Readonly<ObjectMember[]> {
        if (!this._members)
            this._members = this.ref.m.map(m => new ObjectMember(m));

        return this._members;
    }

    protected override matches(ref : this) {
        if (this.typeParameters.length !== ref.typeParameters.length)
            return false;
        return this.typeParameters.every((x, i) => x.equals(ref.typeParameters[i]));
    }

    override matchesValue(value: any, options?: MatchesValueOptions): boolean {
        options ??= {};
        options.errors ??= [];

        if (!this.ref.m)
            return this.baseType.matchesValue(value, options);

        if (typeof value !== 'object')
            return false;

        let matches = true;
        for (let member of this.members) {
            let hasValue = member.name in value;

            if (!hasValue) {
                if (!member.isOptional) {
                    options.errors.push(new TypeError(`Missing value for member ${member.toString()}`));
                    matches = false;
                }
                continue;
            }

            let memberValue = value[member.name];
            let memberErrors = [];
            if (!member.type.matchesValue(memberValue, { ...options, errors: memberErrors })) {
                options.errors.push(new TypeError(`Value for member ${member.toString()} is invalid`));
                options.errors.push(...memberErrors);
                matches = false;
            }
        }

        return matches;
    }
}

export class TupleElement {
    constructor(readonly ref: Readonly<format.RtTupleElement>) {
    }

    toString() {
        return `${this.name} : ${this.type}`;
    }

    get name(): string {
        return this.ref.n;
    }

    private _type: Type;
    get type(): Type {
        if (this._type)
            return this._type;
        return this._type = Type.createFromRtRef(this.ref.t);
    }
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

    @Flag(format.F_READONLY) isReadonly: boolean;
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

    toString() {
        return Object.keys(this.propertyToFlag)
            .map(property => this[property] ? this.propertyToFlag[property] : '')
            .join('');
    }

}

export type Visibility = 'public' | 'private' | 'protected';

/**
 * Reflection data for a parameter
 */
export class Parameter<ValueT = any> {
    constructor(
        readonly rawMetadata: format.RtParameter,
        readonly index: number
    ) {
    }

    private _flags: Flags;

    get isBinding() {
        return this.isArrayBinding || this.isObjectBinding;
    }

    /**
     * True if this parameter is an array binding expression (destructured assignment).
     */
    get isArrayBinding() {
        return this.flags.isArrayBinding;
    }

    /**
     * True if this parameter is an object binding expression (destructured assignment).
     */
    get isObjectBinding() {
        return this.flags.isObjectBinding;
    }

    /**
     * True if this parameter is an omitted slot within an array binding expression.
     * ie, if the user declares [foo, ,bar], then the second binding will have isOmitted true.
     * See: destructured assignment.
     */
    get isOmitted() {
        return this.flags.isOmitted;
    }

    private _bindings: Parameter[];

    /**
     * If this is an object/array binding (ie destructured assignment),
     * this will return the individual bindings that are part of this declaration.
     */
    get bindings() {
        if (!this.isBinding)
            return undefined;

        if (!this._bindings) {
            (this.rawMetadata.b || []).map((bindingElement, i) => new Parameter(bindingElement, i))
        }

        return this._bindings;
    }

    /**
     * Get the unmangled original name for this parameter. This may be undefined if the parameter is an array/object
     * binding expression (destructured assignment).
     */
    get name() {
        return this.rawMetadata.n;
    }

    private _type: Type;

    /**
     * Get the reflected type of this parameter
     */
    get type(): Type {
        if (this._type)
            return this._type;
        return this._type = Type.createFromRtRef(this.rawMetadata.t);
    }

    /**
     * Get flags that define aspects of this property.
     */
    get flags() {
        if (this._flags)
            return this._flags;

        return this._flags = new Flags(this.rawMetadata.f);
    }

    /**
     * True if this parameter is optional
     */
    get isOptional() {
        return this.flags.isOptional;
    }

    /**
     * True if this parameter is a rest parameter
     */
    get isRest() {
        return this.flags.isRest;
    }

    /**
     * Retrieve the initializer for this parameter. Invoking the initializer produces the
     * default value for the parameter. Caution: The initializer depends on the value of 'this'.
     * Use evaluateInitializer() to properly invoke the initializer.
     */
    get initializer(): () => ValueT {
        return this.rawMetadata.v;
    }

    /**
     * Evaluate the initializer for this parameter with the given value for 'this'. If not provided,
     * 'this' is an empty object. This is suitable for constructor parameters but instance method parameters
     * may reference properties of the object, and so getting the correct value may require passing an
     * appropriate instance.
     *
     * @param thisObject
     * @returns
     */
    evaluateInitializer(thisObject: any = {}) {
        return this.initializer.apply(thisObject, []);
    }

    /**
     * Check if this parameter declaration is identical to another parameter declaration (including its name).
     *
     * @param other The other parameter to check against
     * @param checkName If true, the name is checked, otherwise it is ignored
     * @returns
     */
    equals(other: Parameter, checkName = true) {
        return (!checkName || this.name === other.name)
            && this.type.equals(other.type)
            && this.flags.toString() === other.flags.toString()
        ;
    }
}

/**
 * Reflection data for a constructor parameter
 */
export class ConstructorParameter extends Parameter {
    constructor(
        readonly rawMetadata: format.RtParameter,
        readonly index: number
    ) {
        super(rawMetadata, index);
    }

    /**
     * True if this constructor parameter is declared readonly, meaning it is
     * also an instance property of the class.
     */
    get isReadonly() {
        return this.flags.isReadonly;
    }

    /**
     * True if this constructor parameter is declared public, meaning it is
     * also an instance property of the class.
     */
    get isPublic() {
        return this.flags.isPublic;
    }

    /**
     * True if this constructor parameter is declared protected, meaning it is
     * also an instance property of the class.
     */
    get isProtected() {
        return this.flags.isProtected;
    }

    /**
     * True if this constructor parameter is declared private, meaning it is
     * also an instance property of the class.
     */
    get isPrivate() {
        return this.flags.isPrivate;
    }

    /**
     * Get visibility of this constructor parameter. If the constructor
     * parameter has no visibility modifiers, this is null.
     */
    get visibility(): Visibility {
        return this.isPublic ? 'public'
            : this.isProtected ? 'protected'
                : this.isPrivate ? 'private'
                    : null;
    }

    /**
     * True if the constructor parameter is also a property.
     */
    get isProperty() {
        return this.visibility !== null || this.isReadonly;
    }
}

/**
 * Reflection data for a class member
 */
export class Member {
    constructor(
        readonly ref: format.RtObjectMember
    ) {
    }

    private _flags: Flags;

    static createFromRef(ref: format.RtObjectMember) {
        let flags = new Flags(ref.f);

        if (flags.isMethod)
            return new Method(ref);
        else if (flags.isProperty)
            return new Property(ref);
        else if (flags.isConstructor)
            return new ConstructorMember(ref);

        return new Member(ref);
    }

    /**
     * Given a method function, return a Method representing it.
     * If the function is not a method, throws an error. See also getClassOfMethod().
     * @param func
     * @returns
     */
    static from(func: Function) {
        const klass = this.getClassOfMethod(func);
        const flags = String(Reflect.getMetadata('rt:f', func) ?? '');

        if (!klass)
            throw new Error(`Function does not appear to be a method`);

        if (flags.includes(format.F_STATIC))
            return ClassType.from(klass).getStaticMethod(func.name);
        else
            return ClassType.from(klass).getMethod(func.name);
    }

    /**
     * Given a method function, return the constructor for the class the method
     * was declared in, if available.
     * @param func
     * @returns
     */
    static getClassOfMethod(func: Function) {
        return <Constructor<any>>Reflect.getMetadata('rt:h', func)?.();
    }

    get name() { return this.ref.n; }

    /**
     * Get the flags for this member. Includes modifiers and other properties about
     * the member.
     */
    get flags(): Readonly<Flags> {
        if (this._flags)
            return this._flags;

        return this._flags = new Flags(this.ref.f);
    }

    /**
     * True if this member is static.
     */
    get isStatic() { return this.flags.isStatic; }

    /**
     * True if this member is abstract.
     */
    get isAbstract() { return this.flags.isAbstract; }

    /**
     * True if this member has private visibility.
     */
    get isPrivate() { return this.flags.isPrivate; }

    /**
     * True if this member has public visibility.
     */
    get isPublic() { return this.visibility === 'public'; }

    /**
     * True if this member is specifically marked as public
     * (as opposed to default visibility).
     */
    get isMarkedPublic() { return this.flags.isPublic; }

    /**
     * True if this member has protected visibility.
     */
    get isProtected() { return this.flags.isProtected; }

    /**
     * Get the visibility (accessibility) of this member.
     * Can be 'public', 'protected', or 'private'
     */
    get visibility(): Visibility {
        return this.isMarkedPublic ? 'public'
            : this.isProtected ? 'protected'
                : this.isPrivate ? 'private'
                    : 'public';
    }

    /**
     * Whether this member is marked as optional.
     */
    get isOptional() {
        return this.flags.isOptional;
    }

    matchesValue(value, options?: MatchesValueOptions): boolean {
        throw new Error(`Not determinable`);
    }

    equals(member: this) {
        return this.matches(member);
    }

    protected matches(member: this) {
        return member instanceof this.constructor && this.name === member.name
            && this.flags.toString() === member.flags.toString();
    }
}

export class ObjectMember extends Member {
    constructor(ref: format.RtObjectMember) {
        super(ref);
        this.type = Type.createFromRtRef(this.ref.t);
    }

    readonly type: Type;

    override matches(member: this) {
        return this.name === member.name && this.type.equals(member.type);
    }

    toString() { return `${this.name}: ${this.type?.toString() ?? '<error>'}`; }
}

@Type.Kind('object')
export class ObjectType extends Type<format.RtObjectType> {
    get kind() { return 'object' as const; }

    private _members: ObjectMember[];

    get members(): Readonly<ObjectMember[]> {
        if (!this._members)
            this._members = this.ref.m.map(m => new ObjectMember(m));

        return this._members;
    }

    toString() { return `{ ${this.members.map(m => m.toString()).join(', ')} }`; }

    protected override matches(ref : this) {
        if (this.members.length !== ref.members.length)
            return false;

        for (let member of this.members) {
            let matchingMember = ref.members.find(x => x.name);
            if (!member.equals(matchingMember))
                return false;
        }

        return true;
    }

    override matchesValue(value: any, options?: MatchesValueOptions) {
        options ??= {};
        options.errors ??= [];

        if (typeof value !== 'object')
            return false;

        let matches = true;
        for (let member of this.members) {
            let hasValue = member.name in value;

            if (!hasValue) {
                if (!member.isOptional) {
                    options.errors.push(new TypeError(`Missing value for member ${member.toString()}`));
                    matches = false;
                }
                continue;
            }

            let memberValue = value[member.name];
            let memberErrors = [];
            if (!member.type.matchesValue(memberValue, { ...options, errors: memberErrors })) {
                options.errors.push(new TypeError(`Value for member ${member.toString()} is invalid`));
                options.errors.push(...memberErrors);
                matches = false;
            }
        }

        let unaccountedProperties = Object.keys(value).filter(x => !this.members.some(y => y.name === x));
        if (options.allowExtraProperties !== true && unaccountedProperties.length > 0) {
            options.errors.push(
                new Error(
                    `Object contains the following undeclared properties: `
                    + `${unaccountedProperties.join(', ')}`
                )
            );
            matches = false;
        }

        return matches;
    }
}

export class ConstructorMember extends Member {
    private _type: FunctionType;

    get type() {
        return this._type ??= FunctionType.createFromRtRef(this.ref.t);
    }

    /**
     * Retrieve the set of reflected parameters for this method.
     */
    get parameters() {
        return this.type.parameters;
    }

    /**
     * Get a reflected parameter by name
     * @param name
     * @returns The reflected parameter
     */
    getParameter(name: string) {
        return this.parameters.find(x => x.name === name);
    }

    /**
     * Get the return type of this method.
     */
    get returnType(): Type {
        return this.type.returnType;
    }

    /**
     * True if the return type was inferred using the Typescript type checker. False if
     * the return type was defined explicitly.
     */
    get returnTypeInferred() {
        return this.flags.isInferred;
    }

    /**
     * True if this function is a variadic function.
     */
    get isVariadic() {
        return this.parameters.find(v => v.isRest) !== undefined;
    }

    protected override matches(member: this) {
        if (!super.matches(member))
            return false;

        if (this.parameters.length !== member.parameters.length)
            return false;

        for (let i = 0, max = this.parameters.length; i < max; ++i) {
            const param1 = this.parameters[i];
            const param2 = member.parameters[i];

            if (!param1.equals(param2, true))
                return false;
        }

        return true;
    }
}

/**
 * Reflection data for a class method
 */
export class Method extends Member {
    private _type: FunctionType;

    get type() {
        return this._type ??= FunctionType.createFromRtRef(this.ref.t);
    }

    /**
     * Retrieve the set of reflected parameters for this method.
     */
    get parameters() {
        return this.type.parameters;
    }

    /**
     * Get a reflected parameter by name
     * @param name
     * @returns The reflected parameter
     */
    getParameter(name: string) {
        return this.parameters.find(x => x.name === name);
    }

    /**
     * Get the return type of this method.
     */
    get returnType(): Type {
        return this.type.returnType;
    }

    /**
     * True if the return type was inferred using the Typescript type checker. False if
     * the return type was defined explicitly.
     */
    get returnTypeInferred() {
        return this.flags.isInferred;
    }

    /**
     * True if this method is declared as async.
     */
    get isAsync() {
        return this.flags.isAsync;
    }

    /**
     * True if this function is a variadic function.
     */
    get isVariadic() {
        return this.parameters.find(v => v.isRest) !== undefined;
    }

    protected override matches(member: this) {
        if (!super.matches(member))
            return false;

        if (this.parameters.length !== member.parameters.length)
            return false;

        for (let i = 0, max = this.parameters.length; i < max; ++i) {
            const param1 = this.parameters[i];
            const param2 = member.parameters[i];

            if (!param1.equals(param2, true))
                return false;
        }

        return true;
    }

    override matchesValue(value, options?: MatchesValueOptions): boolean {
        if (typeof value !== 'function')
            return false;

        if (value.length !== this.parameters.length)
            return false;

        return true;
    }
}

/**
 * Represents a constructor for a specific type.
 */
export interface Constructor<T> extends Function {
    new(...args): T;
}

/**
 * Represents a reflected property of a class or interface.
 */
export class Property extends Member {
    private _type: Type;

    get type() { return this._type ??= Type.createFromRtRef(this.ref.t); }

    /**
     * True if this property is marked readonly.
     */
    get isReadonly() {
        return this.flags.isReadonly;
    }

    /**
     * Check if the given value matches the type of this property, and would
     * thus be a valid assignment.
     * @param object
     * @param errors
     * @returns
     */
    matchesValue(object, options?: MatchesValueOptions) {
        options ??= {};
        options.errors ??= [];
        return this.type.matchesValue(object, options);
    }

    protected override matches(member: this) {
        if (!super.matches(member))
            return false;

        return this.type.equals(member.type);
    }
}

/**
 * Returns true if the given value matches the shape of the interface / class passed as interfaceType.
 *
 * @param value
 * @param interfaceType
 * @returns True if the value is the correct shape
 */
export function matchesShape<T>(value, callSite?: CallSite) {
    return reflect(callSite).typeParameters[0].matchesValue(value);
}

/**
 * Get the reflected call site
 * @returns The reflected call site
 */
export function reflect(value: CallSite): ReflectedCallSite;
/**
 * Get the reflected class for the given constructor or instance.
 * @param value A constructor, Interface value, or an instance of a class
 * @returns The reflected class
 */
export function reflect<T>(value: Constructor<T>): ClassType;
export function reflect<T extends Function>(value: T): FunctionType;

/**
 * Reflect upon the type identified by T.
 * @rtti:callsite 1
 */
export function reflect<T>(value: T): Type;
export function reflect<T>(unused?: never, callSite?: CallSite): Type;
/**
 * @rtti:callsite 1
 */
export function reflect(value: any = NotProvided, callSite?: CallSite) {
    if (value === NotProvided && !callSite) {
        throw new Error(`reflect<T>() can only be used when project is built with the typescript-rtti transformer`);
    }

    if (!value)
        throw new TypeError(`Could not reflect on null/undefined`);

    if (isCallSite(value))
        return new ReflectedCallSite(value);

    if (value === NotProvided && isCallSite(callSite))
        return new ReflectedCallSite(callSite).typeParameters[0];

    let ref = Type.getTypeRef(value) ?? Type.getTypeRef(value.constructor);

    if (!ref && typeof value === 'function' && !value.prototype) {
        return FunctionType.from(value);
    }

    if (!ref) {
        return ClassType.from(value instanceof Function ? value : value.constructor);
    }

    return Type.createFromRtRef(ref);
}

function isBuiltIn(func: Function) {
    return func.toString().includes('[native code]');
}

/**
 * Enables call-site reflection. Add as the last parameter of your function or method to enable.
 */
export interface CallSite {
    TΦ: 'c';
}

export class ReflectedCallSite {
    constructor(callSite: CallSite) {
        this.callSite = <format.RtCallSite>callSite;
    }

    private callSite: format.RtCallSite;

    private _parameters: Type[];

    get parameters() {
        if (!this._parameters)
            this._parameters = this.callSite.p.map(x => Type.createFromRtRef(x));
        return this._parameters;
    }

    private _typeParameters: Type[];

    get typeParameters() {
        if (!this._typeParameters) {
            this._typeParameters = this.callSite.tp.map(x => Type.createFromRtRef(x));
        }

        return this._typeParameters;
    }

    // private _target : Type;

    // get target() {
    //     if (!this._target)
    //         this._target = Type.createFromRtRef(this.callSite.t);
    //     return this._target;
    // }

    // private _return : Type;

    // get return() {
    //     if (!this._return)
    //         this._return = Type.createFromRtRef(this.callSite.r);
    //     return this._return;
    // }
}

function superMergeElements<T extends { name: string }>(ownSet: readonly T[], superSet: readonly T[]): T[] {
    return superSet.map(superItem => ownSet.find(ownItem => ownItem.name === superItem.name) ?? superItem)
        .concat(ownSet.filter(ownItem => !superSet.some(superItem => ownItem.name === superItem.name)));
}

function superMergeNames(ownSet: string[], superSet: string[]): string[] {
    return superSet.concat(ownSet.filter(x => !superSet.includes(x)));
}

function gatherMembers(type: Type): readonly Member[] {
    if (type.is('class')) {
        return type.members;
    } else if (type.is('interface')) {
        return type.members;
    } else if (type.is('mapped')) {
        return type.members;
    } else if (type.is('object')) {
        return type.members;
    }

    return [];
}

function synthesizeMember(obj, name, flags = '') {
    let isMethod = false;

    // All properties which have `get` defined must be considered properties, not methods.
    // We need to avoid executing getters inadvertently while determining the type of the property.
    // https://github.com/typescript-rtti/typescript-rtti/issues/52
    let descriptor = Object.getOwnPropertyDescriptor(obj, name);
    if (descriptor?.get)
        isMethod = false;
    else
        isMethod = typeof obj[name] === 'function';

    if (isMethod) {
        const returnTypeHint = Reflect.getMetadata('design:returntype', obj, name);
        const paramTypeHints = Reflect.getMetadata('design:paramtypes', obj, name) ?? [];
        return <format.RtObjectMember>{
            n: name,
            f: `${format.F_METHOD}${flags}`,
            t: <format.RtFunctionType>{
                TΦ: format.T_FUNCTION,
                f: '',
                n: name,
                p: getParameterNames(obj[name]).map((name, i) => (<format.RtParameter>{
                    n: name,
                    t: ClassType.synthesizeRef(paramTypeHints[i]) ?? { TΦ: format.T_ANY }
                })),
                r: ClassType.synthesizeRef(returnTypeHint) ?? { TΦ: format.T_ANY }
            }
        };
    } else {
        const typeHint = Reflect.getMetadata('design:type', obj, name);
        return <format.RtObjectMember>{
            n: name,
            f: `${format.F_PROPERTY}${flags}`,
            t: ClassType.synthesizeRef(typeHint) ?? { TΦ: format.T_ANY }
        };
    }
}