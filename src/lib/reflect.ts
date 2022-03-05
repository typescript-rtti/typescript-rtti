import * as Flags from '../common/flags';
import { InterfaceToken, RtVoidType, RtUnknownType, RtAnyType, RtParameter } from '../common';

import { getParameterNames } from './get-parameter-names';
import { Sealed } from './sealed';

const NotProvided = Symbol();

/**
 * Obtain an object which uniquely identifies an interface type.
 * You may prefer reflect<InterfaceType>() if you are writing reflect(reify<InterfaceType>()) or 
 * ReflectedClass.from(reify<InterfaceType>())
 */
export function reify<InterfaceType>(callSite? : CallSite): InterfaceToken {
    if (!isCallSite(callSite))
        throw new Error(`reify<T>() can only be used when project is built with the typescript-rtti transformer`);
    
    let param = reflect(callSite).typeParameters[0];
    if (param.is('interface'))
        return param.token;
    
    throw new Error(`reify<${param}>(): Type parameter must be an interface reference, not an arbitrary type`);
}

export function isCallSite(callSite : CallSite) {
    return callSite?.TΦ === 'c';
}

function Flag(value : string) {
    return (target, propertyKey) => {
        if (!target.flagToProperty)
            target.flagToProperty = {};
        if (!target.propertyToFlag)
            target.propertyToFlag = {};
        target.flagToProperty[value] = propertyKey;
        target.propertyToFlag[propertyKey] = value;
    };
}

type Literal = true | false | null | number | string;
type RtTypeRef = RtType | Function | Literal | InterfaceToken;

interface RtType {
    TΦ : string;
}

interface RtUnionType {
    TΦ : typeof Flags.T_UNION;
    t : RtTypeRef[];
}

interface RtIntersectionType {
    TΦ : typeof Flags.T_INTERSECTION;
    t : RtTypeRef[];
}

interface RtArrayType {
    TΦ : typeof Flags.T_ARRAY;
    e : RtTypeRef;
}

interface RtTupleElement {
    n : string;
    t : RtTypeRef;
}

interface RtTupleType {
    TΦ : typeof Flags.T_TUPLE;
    e : RtTupleElement[];
}

interface RtUnknown {
    TΦ : typeof Flags.T_UNKNOWN;
}

interface RtAny {
    TΦ : typeof Flags.T_ANY;
}

interface RtGenericRef {
    TΦ : typeof Flags.T_GENERIC;
    t : RtTypeRef;
    p : RtTypeRef[];
}

export type ReflectedTypeRefKind = 'union' | 'intersection' | 'any' 
    | 'unknown' | 'tuple' | 'array' | 'class' | 'any' | 'unknown' | 'generic' | 'literal' | 'void' | 'interface';

export const TYPE_REF_KIND_EXPANSION : Record<string, ReflectedTypeRefKind> = {
    [Flags.T_UNKNOWN]: 'unknown',
    [Flags.T_ANY]: 'any',
    [Flags.T_UNION]: 'union',
    [Flags.T_INTERSECTION]: 'intersection',
    [Flags.T_TUPLE]: 'tuple',
    [Flags.T_ARRAY]: 'array',
    [Flags.T_GENERIC]: 'generic',
    [Flags.T_VOID]: 'void'
};

export class ReflectedTypeRef<T = RtTypeRef> {
    /** @internal */
    constructor(
        private _ref : T
    ) {
    }

    toString() {
        return `[${this.kind} type]`;
    }

    /** @internal */
    static Kind(kind : ReflectedTypeRefKind) {
        return (target) => {
            ReflectedTypeRef.kinds[kind] = target;
        }
    }

    /**
     * Check if the given value matches this type reference. Collects any errors into the `errors` list.
     * @param value 
     * @param errors 
     * @param context 
     * @returns 
     */
    matchesValue(value, errors? : Error[], context? : string) {
        errors.push(new Error(`No validation available for type with kind '${this.kind}'`));
        return false;
    }

    private static kinds : Record<ReflectedTypeRefKind, Constructor<ReflectedTypeRef>> = <any>{};

    get kind() : ReflectedTypeRefKind {
        let ref = this._ref;
        if (ref === null || ['undefined', 'string', 'number', 'boolean'].includes(typeof ref))
            return 'literal';

        if (typeof ref === 'object' && 'TΦ' in ref) 
            return TYPE_REF_KIND_EXPANSION[(<RtType><unknown>ref).TΦ];
        
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
    isPromise<T = Function>(klass? : Constructor<T>): this is ReflectedGenericRef {
        if (this.isClass(Promise))
            return !klass;

        if (this.isGeneric(Promise)) {
            if (this.typeParameters.length === 0)
                return !klass;
            
            return this.typeParameters[0].isClass(klass);
        }
        return false;
    }

    /**
     * Checks if this type reference is a class. Note: If the class reference has type parameters, 
     * (ie it is generic) this check will fail, and instead isGeneric() will succeed.
     * @param klass 
     */
    isClass<T = Function>(klass? : Constructor<T>): this is ReflectedClassRef<T> {
        let literalTypes = {
            'string': String,
            'number': Number,
            'boolean': Boolean,
            'object': Object
        };

        if (this.kind === 'literal')
            return literalTypes[typeof this.ref] === klass;
        
        return this.kind === 'class' && (!klass || <any>this.ref === klass);
    }

    isInterface(interfaceType? : InterfaceToken): this is ReflectedInterfaceRef {
        if (interfaceType)
            return this.isInterface() && (this.ref as unknown as InterfaceToken).identity === interfaceType.identity;
        else
            return this.kind === 'interface';
    }

    /**
     * Checks if this type is a literal type (null/true/false/undefined or a literal expression)
     * @param value 
     * @returns 
     */
    isLiteral<T = any>(value : T): this is ReflectedLiteralRef<T>;
    isLiteral(): this is ReflectedLiteralRef<any>;
    isLiteral(value = NotProvided): boolean
    {
        return this.kind === 'literal' && (value === NotProvided || <unknown>this.ref === value);
    }

    
    /** Check if this type reference is an interface type    */ is(kind : 'interface'): this is ReflectedInterfaceRef;
    /** Check if this type reference is a class type         */ is(kind : 'class'): this is ReflectedClassRef<any>;
    /** Check if this type reference is a generic type       */ is(kind : 'generic'): this is ReflectedGenericRef;
    /** Check if this type reference is an array type        */ is(kind : 'array'): this is ReflectedArrayRef;
    /** Check if this type reference is an intersection type */ is(kind : 'intersection'): this is ReflectedIntersectionRef;
    /** Check if this type reference is a union type         */ is(kind : 'union'): this is ReflectedUnionRef;
    /** Check if this type reference is a tuple type         */ is(kind : 'tuple'): this is ReflectedTupleRef;
    /** Check if this type reference is a void type          */ is(kind : 'void'): this is ReflectedVoidRef;
    /** Check if this type reference is an any type          */ is(kind : 'any'): this is ReflectedAnyRef;
    /** Check if this type reference is an unknown type      */ is(kind : 'unknown'): this is ReflectedUnknownRef;
    /** Check if this type reference is a literal type       */ is(kind : 'literal'): this is ReflectedLiteralRef<any>;
    /**
     * Check if this type reference is an instance of the given ReflectedTypeRef subclass.
     * @param type The subclass of ReflectedTypeRef to check
     */
    is<T, U extends T>(this : T, type : Constructor<U>) : this is U;
    is(this, kind : ReflectedTypeRefKind | Constructor<any>): boolean {
        if (typeof kind === 'function')
            return this instanceof kind;
        else if (typeof kind === 'string')
            return this.kind === kind;
    }

    /**
     * Assert that this type reference is an interface type and cast it to ReflectedInterfaceRef.
     * If the reference is not the correct type an error is thrown.
     */
    as(kind : 'interface'): ReflectedInterfaceRef;
    /**
     * Assert that this type reference is a class type and cast it to ReflectedClassRef.
     * If the reference is not the correct type an error is thrown.
     */
    as<T = any>(kind : 'class'): ReflectedClassRef<T>;
    /**
     * Assert that this type reference is a generic type and cast it to ReflectedGenericRef.
     * If the reference is not the correct type an error is thrown.
     */
    as<T = any>(kind : 'generic'): ReflectedGenericRef;
    /**
     * Assert that this type reference is an array type and cast it to ReflectedArrayRef.
     * If the reference is not the correct type an error is thrown.
     */
    as(kind : 'array'): ReflectedArrayRef;
    /**
     * Assert that this type reference is an intersection type and cast it to ReflectedIntersectionRef.
     * If the reference is not the correct type an error is thrown.
     */
    as(kind : 'intersection'): ReflectedIntersectionRef;
    /**
     * Assert that this type reference is a union type and cast it to ReflectedUnionRef.
     * If the reference is not the correct type an error is thrown.
     */
    as(kind : 'union'): ReflectedUnionRef;
    /**
     * Assert that this type reference is a tuple type and cast it to ReflectedTupleRef.
     * If the reference is not the correct type an error is thrown.
     */
    as(kind : 'tuple'): ReflectedTupleRef;
    /**
     * Assert that this type reference is a void type and cast it to ReflectedVoidRef.
     * If the reference is not the correct type an error is thrown.
     */
    as(kind : 'void'): ReflectedVoidRef;
    /**
     * Assert that this type reference is a void type and cast it to ReflectedVoidRef.
     * If the reference is not the correct type an error is thrown.
     */
    as(kind : 'unknown'): ReflectedUnknownRef;
    /**
     * Assert that this type reference is a void type and cast it to ReflectedVoidRef.
     * If the reference is not the correct type an error is thrown.
     */
    as(kind : 'any'): ReflectedAnyRef;
    /**
     * Assert that this type reference is a void type and cast it to ReflectedVoidRef.
     * If the reference is not the correct type an error is thrown.
     */
    as(kind : 'literal'): ReflectedLiteralRef;
    /**
     * Assert that this type reference is the given ReflectedTypeRef subclass.
     * If the reference is not the correct type an error is thrown.
     */
    as<T, U extends T>(this : T, subclass : Constructor<U>): U;
    as(this, subclass : ReflectedTypeRefKind | Constructor<any>) {
        if (typeof subclass === 'function' && !(this instanceof subclass))
            throw new TypeError(`Value of type ${this.constructor.name} cannot be converted to ${subclass.name}`);
        else if (typeof subclass === 'string' && this.kind !== subclass)
            throw new TypeError(`Type has kind ${this.kind}, expected ${subclass}`);
        return this;
    }

    isVoid():           this is ReflectedVoidRef               { return this.kind === 'void'; }
    isNull():           this is ReflectedLiteralRef<null>      { return this.isLiteral(null); }
    isUndefined():      this is ReflectedLiteralRef<undefined> { return this.isLiteral(void 0); }
    isTrue():           this is ReflectedLiteralRef<true>      { return this.isLiteral(true); }
    isFalse():          this is ReflectedLiteralRef<false>     { return this.isLiteral(false); }
    isStringLiteral():  this is ReflectedLiteralRef<string>    { return this.kind === 'literal' && typeof this.ref === 'string'; }
    isNumberLiteral():  this is ReflectedLiteralRef<number>    { return this.kind === 'literal' && typeof this.ref === 'number'; }
    isBooleanLiteral(): this is ReflectedLiteralRef<number>    { return this.kind === 'literal' && typeof this.ref === 'boolean'; }

    /**
     * Check if this type reference is a generic type, optionally checking if the generic's
     * base type is the given class. For instance isGeneric(Promise) is true for Promise<string>.
     * @param klass 
     */
    isGeneric<T = Function>(klass? : Constructor<T>): this is ReflectedGenericRef {
        if (this.kind === 'generic') {
            let rtGeneric : RtGenericRef = <any>this.ref;
            if (!rtGeneric.t['TΦ']) { // this is a class
                return !klass || rtGeneric.t === klass;
            }
            return true;
        }

        return false;
    }

    isUnion(elementDiscriminator? : (elementType : ReflectedTypeRef) => boolean): this is ReflectedUnionRef {
        return elementDiscriminator
            ? this.isUnion() && this.types.every(e => elementDiscriminator(e))
            : this.kind === 'union';
    }

    isIntersection(elementDiscriminator? : (elementType : ReflectedTypeRef) => boolean): this is ReflectedIntersectionRef {
        return elementDiscriminator
            ? this.isIntersection() && this.types.every(e => elementDiscriminator(e))
            : this.kind === 'intersection';
    }

    isArray(elementDiscriminator? : (elementType : ReflectedTypeRef) => boolean): this is ReflectedArrayRef {
        return elementDiscriminator 
            ? this.isArray() && elementDiscriminator(this.elementType)
            : this.kind === 'array'
        ;
    }

    isTuple(elementDiscriminators? : ((elementType : ReflectedTupleElement) => boolean)[]): this is ReflectedTupleRef {
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
        return this.createFromRtRef({ TΦ: Flags.T_UNKNOWN });
    }

    /** @internal */
    static createFromRtRef(ref : RtTypeRef) {
        let kind : ReflectedTypeRefKind;
        
        if (ref === null || !['object', 'function'].includes(typeof ref))
            kind = 'literal';
        else if (typeof ref === 'object' && 'TΦ' in <object>ref)
            kind = TYPE_REF_KIND_EXPANSION[(ref as RtType).TΦ];
        else if (typeof ref === 'object')
            kind = 'interface';
        else
            kind = 'class';
        
        return new (ReflectedTypeRef.kinds[kind] || ReflectedTypeRef)(ref);
    }
}

@ReflectedTypeRef.Kind('class')
export class ReflectedClassRef<Class> extends ReflectedTypeRef<Constructor<Class>> {
    get kind() { return 'class' as const; }
    get class() : Constructor<Class> { return <any>this.ref; }
    get reflectedClass() { return ReflectedClass.for(this.class); }

    toString() { return `class ${this.class.name}`; }

    matchesValue(value: any, errors : Error[] = [], context? : string) {
        if (this.ref === String)
            return typeof value === 'string';
        else if (this.ref === Number)
            return typeof value === 'number';
        else if (this.ref === Boolean)
            return typeof value === 'boolean';
        else if (this.ref === Object)
            return typeof value === 'object';
        else if (this.ref === Function)
            return typeof value === 'function';
        else if (this.ref === Symbol)
            return typeof value === 'symbol';
        
        return ReflectedClass.for(this.ref).matchesValue(value);
    }
}

@ReflectedTypeRef.Kind('interface')
export class ReflectedInterfaceRef extends ReflectedTypeRef<InterfaceToken> {
    get kind() { return 'interface' as const; }
    get token() : InterfaceToken { return this.ref; }
    get reflectedInterface() { return ReflectedClass.for(this.token); }

    toString() { return `interface ${this.token.name}`; }

    matchesValue(value: any, errors : Error[] = [], context? : string) {
        return ReflectedClass.for(this.ref).matchesValue(value);
    }
}

@ReflectedTypeRef.Kind('literal')
export class ReflectedLiteralRef<Class = any> extends ReflectedTypeRef<Class> {
    get kind() { return 'literal' as const; }
    get value() { return <Class>this.ref; }
    toString() { return JSON.stringify(this.value); }

    matchesValue(value: any, errors?: Error[], context?: string): boolean {
        return this.ref === value;
    }
}

@ReflectedTypeRef.Kind('union')
export class ReflectedUnionRef extends ReflectedTypeRef<RtUnionType> {
    get kind() { return 'union' as const; }
    toString() { return `[${this.types.join(' | ')}]`; }
    
    private _types : ReflectedTypeRef[];
    get types(): ReflectedTypeRef[] {
        if (this._types)
            return this._types;
        return this._types = (this.ref.t || []).map(t => ReflectedTypeRef.createFromRtRef(t));
    }

    matchesValue(value: any, errors : Error[] = [], context? : string) {
        return this.types.some(t => t.matchesValue(value, errors, context));
    }
}

@ReflectedTypeRef.Kind('intersection')
export class ReflectedIntersectionRef extends ReflectedTypeRef<RtIntersectionType> {
    get kind() { return 'intersection' as const; }
    toString() { return `${this.types.join(' & ')}`; }
    
    private _types : ReflectedTypeRef[];
    get types() {
        if (this._types)
            return this._types;
        return this._types = (this.ref.t || []).map(t => ReflectedTypeRef.createFromRtRef(t));
    }

    matchesValue(value: any, errors : Error[] = [], context? : string) {
        return this.types.every(t => t.matchesValue(value, errors, context));
    }
}

@ReflectedTypeRef.Kind('array')
export class ReflectedArrayRef extends ReflectedTypeRef<RtArrayType> {
    get kind() { return 'array' as const; }
    toString() { return `${this.elementType}[]`; }
    
    private _elementType : ReflectedTypeRef;
    get elementType(): ReflectedTypeRef {
        if (this._elementType)
            return this._elementType;
        return this._elementType = ReflectedTypeRef.createFromRtRef(this.ref.e);
    }

    matchesValue(value: any, errors?: Error[], context?: string): boolean {
        if (!Array.isArray(value)) {
             errors.push(new TypeError(`Value should be an array`));
             return false;
        }

        return (value as any[]).every(value => this.elementType.matchesValue(value, errors, context));
    }
}

@ReflectedTypeRef.Kind('void')
export class ReflectedVoidRef extends ReflectedTypeRef<RtVoidType> {
    get kind() { return 'void' as const; }
    toString() { return `void`; }

    matchesValue(value: any, errors?: Error[], context?: string): boolean {
        if (value !== void 0) {
            errors.push(new Error(`Value must not be present`));
            return false;
        }

        return true;
    }
}

@ReflectedTypeRef.Kind('unknown')
export class ReflectedUnknownRef extends ReflectedTypeRef<RtUnknownType> {
    get kind() { return 'unknown' as const; }
    toString() { return `unknown`; }

    matchesValue(value: any, errors?: Error[], context?: string): boolean {
        return true;
    }
}

@ReflectedTypeRef.Kind('any')
export class ReflectedAnyRef extends ReflectedTypeRef<RtAnyType> {
    get kind() { return 'any' as const; }
    toString() { return `any`; }

    matchesValue(value: any, errors?: Error[], context?: string): boolean {
        return true;
    }
}

@ReflectedTypeRef.Kind('tuple')
export class ReflectedTupleRef extends ReflectedTypeRef<RtTupleType> {
    get kind() { return 'tuple' as const; }
    toString() { return `[${this.elements.join(', ')}]`; }
    
    private _types : ReflectedTupleElement[];
    get elements(): ReflectedTupleElement[] {
        if (this._types)
            return this._types;
        return this._types = (this.ref.e || []).map(e => new ReflectedTupleElement(e));
    }

    matchesValue(value: any, errors?: Error[], context?: string): boolean {
        if (!Array.isArray(value)) {
            errors.push(new Error(`Value must be an array`));
            return false;
        }

        let array = <any[]>value;

        if (array.length !== this.elements.length) {
            errors.push(new Error(`Array must have ${this.elements.length} values to match tuple type`));
            return false;
        }

        return this.elements.every((v, i) => v.type.matchesValue(array[i], errors, context));
    }
}

@ReflectedTypeRef.Kind('generic')
export class ReflectedGenericRef extends ReflectedTypeRef<RtGenericRef> {
    get kind() { return 'generic' as const; }
    toString() { return `${this.baseType}<${this.typeParameters.join(', ')}>`; }

    private _baseType : ReflectedTypeRef;
    get baseType() : ReflectedTypeRef { 
        if (this._baseType)
            return this._baseType;
        return this._baseType = ReflectedTypeRef.createFromRtRef(this.ref.t)
    }

    private _typeParameters : ReflectedTypeRef[];
    get typeParameters() : ReflectedTypeRef[] { 
        if (this._typeParameters)
            return this._typeParameters;
        return this._typeParameters = this.ref.p.map(p => ReflectedTypeRef.createFromRtRef(p));
    }

    matchesValue(value: any, errors?: Error[], context?: string): boolean {
        return this.baseType.matchesValue(value, errors, context);
    }
}

export class ReflectedTupleElement {
    constructor(readonly ref : Readonly<RtTupleElement>) {
    }

    toString() {
        return `${this.name} : ${this.type}`;
    }

    get name() : string {
        return this.ref.n;
    }

    private _type : ReflectedTypeRef;
    get type() : ReflectedTypeRef {
        if (this._type)
            return this._type;
        return this._type = ReflectedTypeRef.createFromRtRef(this.ref.t);
    }
}

export class ReflectedFlags {
    constructor(flags : string) {
        if (!flags)
            flags = '';
        Object.keys(this.flagToProperty)
            .forEach(flag => this[this.flagToProperty[flag]] = flags.includes(flag));
    }
   
    private flagToProperty : Record<string, string>;
    private propertyToFlag : Record<string, string>;

    @Flag(Flags.F_READONLY) isReadonly : boolean;
    @Flag(Flags.F_ABSTRACT) isAbstract : boolean;
    @Flag(Flags.F_PUBLIC) isPublic : boolean;
    @Flag(Flags.F_PRIVATE) isPrivate : boolean;
    @Flag(Flags.F_PROTECTED) isProtected : boolean;
    @Flag(Flags.F_PROPERTY) isProperty : boolean;
    @Flag(Flags.F_METHOD) isMethod : boolean;
    @Flag(Flags.F_CLASS) isClass : boolean;
    @Flag(Flags.F_INTERFACE) isInterface : boolean;
    @Flag(Flags.F_OPTIONAL) isOptional : boolean;
    @Flag(Flags.F_ASYNC) isAsync : boolean;
    @Flag(Flags.F_EXPORTED) isExported : boolean;
    @Flag(Flags.F_INFERRED) isInferred : boolean;

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
export class ReflectedParameter<ValueT = any> {
    constructor(
        readonly rawMetadata : RtParameter,
        readonly index : number
    ) {
    }

    private _flags : ReflectedFlags;

    /**
     * Get the unmangled original name for this parameter
     */
    get name() {
        return this.rawMetadata.n;
    }

    private _type : ReflectedTypeRef;

    /**
     * Get the reflected type of this parameter
     */
    get type(): ReflectedTypeRef {
        if (this._type)
            return this._type;
        return this._type = ReflectedTypeRef.createFromRtRef(this.rawMetadata.t());
    }

    /**
     * Get flags that define aspects of this property.
     */
    get flags() {
        if (this._flags)
            return this._flags;

        return this._flags = new ReflectedFlags(this.rawMetadata.f)
    }

    /**
     * True if this parameter is optional
     */
    get isOptional() {
        return this.flags.isOptional;
    }

    /**
     * Retrieve the initializer for this parameter. Invoking the initializer produces the 
     * default value for the parameter. Caution: The initializer depends on the value of 'this'.
     * Use evaluateInitializer() to properly invoke the initializer.
     */
    get initializer(): () => ValueT {
        return this.rawMetadata.t;
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
    evaluateInitializer(thisObject : any = {}) {
        return this.initializer.apply(thisObject, []);
    }
}

/**
 * Reflection data for a method parameter
 */
 export class ReflectedMethodParameter extends ReflectedParameter {
    constructor(
        readonly method : ReflectedMethod,
        readonly rawMetadata : RtParameter,
        readonly index : number,
    ) {
        super(rawMetadata, index);
    }
    
    get parent() { return this.method; }
    get class() { return this.method.class; }
}

/**
 * Reflection data for a method parameter
 */
 export class ReflectedFunctionParameter extends ReflectedParameter {
    constructor(
        readonly func : ReflectedFunction,
        readonly rawMetadata : RtParameter,
        readonly index : number
    ) {
        super(rawMetadata, index);
    }

    get parent() { return this.func; }
}

/**
 * Reflection data for a constructor parameter
 */
export class ReflectedConstructorParameter extends ReflectedParameter {
    constructor(
        readonly reflectedClass : ReflectedClass,
        readonly rawMetadata : RtParameter,
        readonly index : number
    ) {
        super(rawMetadata, index);
        this._class = reflectedClass;
    }

    private _class : ReflectedClass;

    get parent() { return this.class; }

    /**
     * Retrieve the reflected class that this constructor parameter is defined on.
     */
    get class() {
        return this._class;
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
export class ReflectedMember implements ReflectedMetadataTarget {
    constructor(
        reflectedClass : ReflectedClass,
        readonly name : string,
        readonly isStatic : boolean
    ) {
        this._class = reflectedClass;
    }

    private _class : ReflectedClass;
    private _flags : ReflectedFlags;

    /**
     * Get the given metadata key for this member. This is equivalent to
     * Reflect.getMetadata(key, this.host, this.name)
     * @param key 
     * @returns 
     */
    getMetadata<T = any>(key : string): T {
        return Reflect.getMetadata(key, this.host, this.name);
    }

    /**
     * Define a metadata key for this member. This is equivalent to
     * Reflect.defineMetadata(key, value, this.host, this.name)
     * @param key 
     * @returns 
     */
    defineMetadata<T = any>(key : string, value : T) {
        Reflect.defineMetadata(key, value, this.host, this.name);
        return value;
    }

    /**
     * Get or define a metadata item for this member. If the key already exists, its 
     * value is returned without calling the passed function. Otherwise the passed function 
     * is called and its value is saved to the given metadata key.
     * 
     * @param key The metadata key to fetch
     * @param definer A function which will define the value of the metadata 
     * @returns The value of the existing metadata key or the new value returned by the definer function
     *          which will also be defined as the appropriate metadata item on this member.
     */
    metadata<T = any>(key : string, definer : () => T) : T {
        if (this.hasMetadata(key))
            return this.getMetadata(key);
        let value = definer();
        this.defineMetadata(key, value);
        return value;
    }

    /**
     * Check if a metadata key exists for this member. This is equivalent to
     * Reflect.hasMetadata(key, this.host, this.name)
     * @param key 
     * @returns 
     */
    hasMetadata(key : string): boolean {
        return Reflect.hasMetadata(key, this.host, this.name);
    }

    /**
     * Get the host object for this method. For static members this is the 
     * class constructor. For instance members this is the class's prototype.
     */
    get host() {
        return this.isStatic ? this.class.class : this.class.prototype;
    }

    /**
     * Get the reflected class that hosts this member
     */
    get class() {
        return this._class;
    }
    
    /**
     * Get the flags for this member. Includes modifiers and other properties about 
     * the member.
     */
    get flags(): Readonly<ReflectedFlags> {
        if (this._flags)
            return this._flags;
        
        return this._flags = new ReflectedFlags(this.getMetadata('rt:f'));
    }

    /**
     * True if this member is abstract.
     */
    get isAbstract() {
        return this.flags.isAbstract;
    }

    /**
     * True if this member has private visibility.
     */
    get isPrivate() {
        return this.flags.isPrivate;
    }

    /**
     * True if this member has public visibility.
     */
    get isPublic() {
        return this.visibility === 'public';
    }

    /**
     * True if this member is specifically marked as public
     * (as opposed to default visibility).
     */
    get isMarkedPublic() {
        return this.flags.isPublic;
    }

    /**
     * True if this member has protected visibility.
     */
    get isProtected() {
        return this.flags.isProtected;
    }

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
}

export class ReflectedFunction<T extends Function = Function> implements ReflectedMetadataTarget {
    private constructor(
        readonly func : T
    ) {
    }

    private _flags : ReflectedFlags;
    private _returnType : ReflectedTypeRef;
    private _RtParameter : RtParameter[];
    private _parameters : ReflectedFunctionParameter[];

    private static reflectedFunctions = new WeakMap<object, ReflectedFunction>();

    static for(func : Function): ReflectedFunction {
        if (typeof func !== 'function')
            throw new TypeError(`Passed value is not a function`);

        let existing = this.reflectedFunctions.get(func);
        if (!existing) {
            this.reflectedFunctions.set(
                func, 
                existing = new ReflectedFunction<Function>(func)
            );
        }

        return existing;
    }

    /** 
     * Create a new ReflectedClass instance for the given type without sharing. Used during testing.
     * @internal 
     **/
    static new<FunctionT extends Function>(func : FunctionT) {
        return new ReflectedFunction<FunctionT>(func);
    }

    matchesValue(object, errors : Error[] = [], context? : string) {
        return object === this.func;
    }

    /**
     * Check if the function has the given metadata key defined. This is equivalent
     * to Reflect.hasMetadata(key, value, this.func)
     * @param key 
     * @returns 
     */
    hasMetadata(key : string): boolean {
        return Reflect.hasMetadata(key, this.func);
    }

    /**
     * Get the specified metadata key for this function. This is equivalent
     * to Reflect.getMetadata(key, value, this.func)
     * @param key
     * @returns 
     */
    getMetadata<T = any>(key : string): T {
        return Reflect.getMetadata(key, this.func);
    }

    /**
     * Define a metadata key for this function. This is equivalent
     * to Reflect.defineMetadata(key, value, this.func)
     * @param key The metadata key to define.
     * @param value 
     */
    defineMetadata<T = any>(key : string, value : T) {
        Reflect.defineMetadata(key, value, this.func);
        return value;
    }
    
    /**
     * Get or define a metadata item for this function. If the key already exists, its 
     * value is returned without calling the passed function. Otherwise the passed function 
     * is called and its value is saved to the given metadata key.
     * 
     * @param key The metadata key to fetch
     * @param definer A function which will define the value of the metadata 
     * @returns The value of the existing metadata key or the new value returned by the definer function
     *          which will also be defined as the appropriate metadata item on this function.
     */
     metadata<T = any>(key : string, definer : () => T) : T {
        if (this.hasMetadata(key))
            return this.getMetadata(key);
        let value = definer();
        this.defineMetadata(key, value);
        return value;
    }

    /**
     * Get the flags for this function.
     */
    get flags(): Readonly<ReflectedFlags> {
        if (this._flags)
            return this._flags;
        
        return this._flags = new ReflectedFlags(this.getMetadata('rt:f'));
    }

    /**
     * @internal
     */
    get RtParameter(): RtParameter[] {
        if (this._RtParameter)
            return this._RtParameter;
        
        return this._RtParameter = this.getMetadata('rt:p');
    }

    /**
     * Names of the parameters for this function.
     */
    get parameterNames() {
        return this.RtParameter.map(x => x.n);
    }

    private _parameterTypes : ReflectedTypeRef[];

    /**
     * Types for the parameter types of this function.
     */
    get parameterTypes() {
        if (this._parameterTypes !== undefined)
            return this._parameterTypes;
        
        if (this.RtParameter !== undefined) {
            return this._parameterTypes = this.RtParameter.map(param => {
                return param.t ? ReflectedTypeRef.createFromRtRef(param.t()) : ReflectedTypeRef.createUnknown();
            });
        } else if (this.hasMetadata('design:paramtypes')) {
            let params : Function[] = this.getMetadata('design:paramtypes');
            return this._parameterTypes = params.map(t => ReflectedTypeRef.createFromRtRef(() => t));
        }
    }

    /**
     * Retrieve the set of reflected parameters for this method.
     */
    get parameters(): ReflectedFunctionParameter[] {
        if (this._parameters)
            return this._parameters;
        
        return this._parameters = this.RtParameter.map((x, i) => new ReflectedFunctionParameter(this, x, i));
    }

    /**
     * Get the parameter with the specified name
     * @param name 
     * @returns The reflected parameter
     */
    getParameter(name : string) {
        return this.parameters.find(x => x.name === name);
    }

    /**
     * Retrieve the return type of this function. 
     */
    get returnType(): ReflectedTypeRef {
        if (this._returnType !== undefined)
            return this._returnType;

        let typeResolver = this.getMetadata('rt:t');
        if (!typeResolver && this.hasMetadata('design:returntype')) {
            let designReturnType = this.getMetadata('design:returntype');
            typeResolver = () => (designReturnType || null);
        }

        if (!typeResolver)
            return ReflectedTypeRef.createUnknown();
        
        return this._returnType = ReflectedTypeRef.createFromRtRef(typeResolver());
    }

    /**
     * True if the return type was inferred using the Typescript type checker. False if 
     * the return type was defined explicitly.
     */
    get returnTypeInferred() {
        return this.flags.isInferred;
    }

    /**
     * True if this function is declared as async.
     */
    get isAsync() {
        return this.flags.isAsync;
    }
}

/**
 * Reflection data for a class method
 */
export class ReflectedMethod<T extends Function = Function> extends ReflectedMember {
    private _returnType : ReflectedTypeRef;
    private _RtParameter : RtParameter[];
    private _parameters : ReflectedMethodParameter[];

    matchesValue(object, errors : Error[] = [], context? : string) {
        return object === this.func;
    }

    get func() {
        if (this.isStatic)
            return this.class[this.name];
        else
            return this.class.prototype[this.name];
    }

    /**
     * @internal
     */
    get RtParameter(): RtParameter[] {
        if (this._RtParameter)
            return this._RtParameter;
        
        return this._RtParameter = this.getMetadata('rt:p');
    }

    /**
     * Retrieve the reflected method for the given method function.
     * If the function is not a method, a TypeError is thrown.
     * @param method 
     */
    static for(method : Function) {
        if (!hasAnyFlag(method, [ Flags.F_METHOD ]))
            throw new TypeError(`The function is not a method, or the class is not annotated with runtime type metadata`);
        
        if (!Reflect.hasMetadata('rt:h', method))
            throw new TypeError(`The function is a method, but is not annotated with a host class`);
        
        let host = Reflect.getMetadata('rt:h', method);

        if (!host)
            throw new TypeError(`The method has a defined host, but it is null/undefined`);
        
        return ReflectedClass.for(host()).getMethod(method.name);
    }

    /**
     * Retrieve an array with the parameter names for this method.
     */
    get parameterNames() {
        return this.RtParameter.map(x => x.n);
    }

    private _parameterTypes : ReflectedTypeRef[];

    /**
     * Retrieve an array with the parameter types for this method.
     */
    get parameterTypes() {
        if (this._parameterTypes !== undefined)
            return this._parameterTypes;
        
        if (this.RtParameter !== undefined) {
            return this._parameterTypes = this.RtParameter.map(param => {
                return param.t ? ReflectedTypeRef.createFromRtRef(param.t()) : ReflectedTypeRef.createUnknown();
            });
        } else if (this.hasMetadata('design:paramtypes')) {
            let params : Function[] = this.getMetadata('design:paramtypes');
            return this._parameterTypes = params.map(t => ReflectedTypeRef.createFromRtRef(() => t));
        }
    }

    /**
     * Retrieve the set of reflected parameters for this method.
     */
    get parameters() {
        if (this._parameters)
            return this._parameters;
        
        return this._parameters = this.RtParameter.map((x, i) => new ReflectedMethodParameter(this, x, i));
    }

    /**
     * Get a reflected parameter by name
     * @param name 
     * @returns The reflected parameter
     */
    getParameter(name : string) {
        return this.parameters.find(x => x.name === name);
    }

    /**
     * Get the return type of this method.
     */
    get returnType(): ReflectedTypeRef {
        if (this._returnType !== undefined)
            return this._returnType;

        let typeResolver = this.getMetadata('rt:t');
        if (!typeResolver && this.hasMetadata('design:returntype')) {
            let designReturnType = this.getMetadata('design:returntype');
            typeResolver = () => (designReturnType || null);
        }

        if (!typeResolver)
            return ReflectedTypeRef.createUnknown();
        
        return this._returnType = ReflectedTypeRef.createFromRtRef(typeResolver());
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
}

/**
 * Represents a constructor for a specific type.
 */
export interface Constructor<T> extends Function {
    new(...args) : T;
}

/**
 * Represents a reflected property of a class or interface.
 */
export class ReflectedProperty extends ReflectedMember {
    private _type : ReflectedTypeRef;

    /**
     * Get the type of this property.
     */
    get type(): ReflectedTypeRef {
        if (this._type !== undefined)
            return this._type;

        let typeResolver : () => any;
        if (this.hasMetadata('rt:t')) {
            typeResolver = this.getMetadata('rt:t');
        } else if (this.hasMetadata('design:type')) {
            let designType = this.getMetadata('design:type');
            typeResolver = () => designType;
        }

        if (!typeResolver)
            return this._type = ReflectedTypeRef.createUnknown();

        return this._type = ReflectedTypeRef.createFromRtRef(typeResolver());
    }

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
    matchesValue(object, errors : Error[] = []) {
        return this.type.matchesValue(object, errors);
    }
}

function getFlags(value): string {
    if (!Reflect.hasMetadata('rt:f', value))
        return '';

    let flagsValue = Reflect.getMetadata('rt:f', value);
    if (typeof flagsValue === 'string')
        return flagsValue;
    return '';
}

function hasAnyFlag(value, desiredFlags : string[]) {
    let flags = getFlags(value);
    return desiredFlags.some(x => flags.includes(x));
}

function hasAllFlags(value, desiredFlags : string[]) {
    let flags = getFlags(value);
    return desiredFlags.every(x => flags.includes(x));
}

export interface ReflectedMetadataTarget {
    /**
     * Check if the target has the given metadata key defined.
     * @param key 
     * @returns 
     */
    hasMetadata(key : string): boolean;

    /**
     * Get the specified metadata key. 
     * @param key 
     * @returns 
     */
    getMetadata<T = any>(key : string): T;

    /**
     * Define a metadata key on this class. 
     * @param key 
     * @param value 
     * @returns 
     */
    defineMetadata<T = any>(key : string, value : T): T;

    /**
     * Get or define a metadata item for this target. If the key already exists, its 
     * value is returned without calling the passed function. Otherwise the passed function 
     * is called and its value is saved to the given metadata key.
     * 
     * @param key The metadata key to fetch
     * @param definer A function which will define the value of the metadata 
     * @returns The value of the existing metadata key or the new value returned by the definer function
     *          which will also be defined as the appropriate metadata item on this target.
     */
     metadata<T = any>(key : string, definer : () => T) : T;
}

/**
 * Provides access to the known runtime type metadata for a particular class 
 * or Interface value (as obtained by reify<InterfaceT>()). 
 */
@Sealed()
export class ReflectedClass<ClassT = any> implements ReflectedMetadataTarget {
    /**
     * Constructs a new ReflectedClass. Use ReflectedClass.for() to obtain a ReflectedClass.
     */
    private constructor(
        klass : Constructor<ClassT> | InterfaceToken
    ) {
        this._class = klass;
    }

    /**
     * Obtain a ReflectedClass for the given class constructor, Interface value or instance.
     * @param constructorOrValue Can be a class constructor, Interface, or an instance of a class (in which case the 
     *                           instance's constructor will be used)
     * @returns The ReflectedClass.
     */
    static for<ClassT>(constructorOrValue : Constructor<ClassT> | InterfaceToken | Function | InstanceType<Constructor<ClassT>>) {

        let flags = getFlags(constructorOrValue);
        if (flags.includes(Flags.F_INTERFACE))
            return this.forConstructorOrInterface(<InterfaceToken>constructorOrValue);
        else if (flags.includes(Flags.F_CLASS))
            return this.forConstructorOrInterface(<Constructor<ClassT>>constructorOrValue);
        else if (flags.includes(Flags.F_FUNCTION))
            throw new TypeError(`Value is a function, use ReflectedFunction.for() or reflect(func) instead`);

        // Heuristic based on shape
        if (typeof constructorOrValue === 'function' || ('name' in constructorOrValue && 'prototype' in constructorOrValue && typeof constructorOrValue.identity === 'symbol'))
            return this.forConstructorOrInterface(<Constructor<ClassT> | InterfaceToken>constructorOrValue);
        
        // Assume it's an instance of a class
        return this.forConstructorOrInterface(<Constructor<ClassT>>constructorOrValue.constructor);
    }

    private static reflectedClasses = new WeakMap<object, ReflectedClass>();

    /** 
     * Create a new ReflectedClass instance for the given type without sharing. Used during testing.
     * @internal 
     **/
    static new<ClassT>(constructorOrInterface : Constructor<ClassT> | InterfaceToken) {
        return new ReflectedClass<ClassT>(<Constructor<ClassT> | InterfaceToken>constructorOrInterface);
    }


    private static forConstructorOrInterface<ClassT>(constructorOrInterface : Constructor<ClassT> | InterfaceToken) {
        let existing = this.reflectedClasses.get(constructorOrInterface);
        if (!existing) {
            this.reflectedClasses.set(
                constructorOrInterface, 
                existing = new ReflectedClass<ClassT>(<Constructor<ClassT> | InterfaceToken>constructorOrInterface)
            );
        }

        return existing;
    }

    private _class : Constructor<ClassT> | InterfaceToken;
    private _ownMethods : ReflectedMethod[];
    private _methods : ReflectedMethod[];
    private _ownPropertyNames : string[];
    private _ownMethodNames : string[];
    private _methodNames : string[];
    private _super : ReflectedClass;
    private _RtParameter : RtParameter[];
    private _parameters : ReflectedConstructorParameter[];
    private _ownProperties : ReflectedProperty[];
    private _properties : ReflectedProperty[];
    private _flags : ReflectedFlags;

    private _interfaces : ReflectedTypeRef[];

    /**
     * Get the interfaces that this class implements.
     */
    get interfaces() {
        if (this._interfaces !== undefined)
            return this._interfaces;

        if (this.hasMetadata('rt:i')) {
            return this._interfaces = (<(() => RtTypeRef)[]>this.getMetadata('rt:i'))
                .map(resolver => resolver())
                .filter(x => !!x)
                .map(ref => ReflectedTypeRef.createFromRtRef(ref))
            ;
        }

        return [];
    }

    /**
     * Check if this class implements the given interface. The parameter can be a reified interface 
     * reference or a class reference. Note that implementing a class is not the same as extending a class.
     * 
     * @param interfaceType 
     * @returns boolean
     */
    implements(interfaceType : InterfaceToken | Constructor<any>) {
        return !!this.interfaces.find(i => typeof interfaceType === 'function' ? i.isClass(interfaceType) : i.isInterface(interfaceType));
    }

    /**
     * Check if the given value matches the shape of this type, and thus would be a valid assignment.
     * @param object 
     * @param errors 
     * @returns 
     */
    matchesValue(object, errors : Error[] = []) {
        if (object === null || object === void 0) {
            errors.push(new Error(`Value is undefined`));
            return false;
        }
        
        if (typeof object !== 'object') {
            errors.push(new Error(`Value must be an object`));
            return false;
        }

        let matches = true;

        if (globalThis.RTTI_TRACE === true)
            console.log(`Type checking value against type '${this.class.name}'`);
        for (let prop of this.properties) {
            let hasValue = prop.name in object;
            let value = object[prop.name];

            if (!hasValue && !prop.isOptional) {
                errors.push(new Error(`Property '${prop.name}' is missing in value`));
                matches = false;
            }
            if (!hasValue)
                continue;
            let propMatch = prop.matchesValue(value, errors);
            if (globalThis.RTTI_TRACE === true)
                console.log(` - ${this.class.name}#${prop.name} : ${prop.type} | valid(${JSON.stringify(value)}) => ${propMatch}`);

            matches &&= propMatch;
        }

        return matches;
    }

    /**
     * Get the prototype object for this reflected class.
     */
    get prototype() {
        return this._class.prototype;
    }

    /**
     * Get the class constructor for this reflected class.
     */
    get class() {
        return this._class;
    }

    /**
     * Get the reflected superclass for this class.
     */
    get super() : ReflectedClass {
        if (this._super !== undefined)
            return this._super;

        let parentClass = Object.getPrototypeOf(this.class.prototype)?.constructor ?? Object;
        if (parentClass === Object)
            return this._super = null;
        else
            return this._super = ReflectedClass.for(parentClass);
    }

    private _hasPropertyNamesMeta = false;

    /**
     * Check if the function has the given metadata key defined. This is equivalent
     * to Reflect.hasMetadata(key, this.class)
     * @param key 
     * @returns 
     */
    hasMetadata(key : string): boolean {
        return Reflect.hasMetadata(key, this.class);
    }

    /**
     * Get the specified metadata key. This is equivalent to Reflect.getMetadata(key, this.class).
     * @param key 
     * @returns 
     */
    getMetadata<T = any>(key : string): T {
        return Reflect.getMetadata(key, this.class);
    }

    /**
     * Define a metadata key on this class. This is equivalent to Reflect.defineMetadata(key, value, this.class).
     * @param key 
     * @param value 
     * @returns 
     */
    defineMetadata<T = any>(key : string, value : T): T {
        Reflect.defineMetadata(key, value, this.class);
        return value;
    }

    /**
     * Get or define a metadata item for this class/interface. If the key already exists, its 
     * value is returned without calling the passed function. Otherwise the passed function 
     * is called and its value is saved to the given metadata key.
     * 
     * @param key The metadata key to fetch
     * @param definer A function which will define the value of the metadata 
     * @returns The value of the existing metadata key or the new value returned by the definer function
     *          which will also be defined as the appropriate metadata item on this class/interface.
     */
     metadata<T = any>(key : string, definer : () => T) : T {
        if (this.hasMetadata(key))
            return this.getMetadata(key);
        let value = definer();
        this.defineMetadata(key, value);
        return value;
    }

    /**
     * Define a metadata key on this class's prototype object. This is equivalent to Reflect.defineMetadata(key, value, this.class.prototype)
     * @param key 
     * @param value 
     * @returns 
     */
    definePrototypeMetadata<T = any>(key : string, value : T): T {
        Reflect.defineMetadata(key, value, this.class.prototype);
        return value;
    }

    /**
     * Retrieve the set of property names that are defined directly on this class, excluding 
     * those which are inherited.
     */
    get ownPropertyNames(): string[] {
        if (this._ownPropertyNames)
            return this._ownPropertyNames;
        
        let propertyNames : string[];

        if (this.hasMetadata('rt:P')) {
            propertyNames = this.getMetadata('rt:P');
            this._hasPropertyNamesMeta = !!propertyNames;
        } else {
            propertyNames = Object.getOwnPropertyNames(this.class.prototype)
                .filter(x => x !== 'constructor')
                .filter(x => typeof this.class.prototype[x] === 'function');
        }

        return this._ownPropertyNames = propertyNames || [];
    }

    /**
     * Retrieve the set of method names that are defined directly on this class, excluding 
     * those which are inherited.
     */
    get ownMethodNames(): string[] {
        if (this._ownMethodNames)
            return this._ownMethodNames;
        
        let methodNames = this.getMetadata('rt:m');
        if (!methodNames) {
            methodNames = Object.getOwnPropertyNames(this.class.prototype)
                .filter(x => x !== 'constructor')
                .filter(x => typeof this.class.prototype[x] === 'function');
        }

        return this._ownMethodNames = methodNames;
    }

    private _ownStaticPropertyNames : string[];
    private _hasStaticPropertyNameMeta = false;

    /**
     * Retrieve the set of static property names that are defined directly on this class, excluding 
     * those which are inherited. Always empty for interfaces.
     */
    get ownStaticPropertyNames(): string[] {
        if (this._ownStaticPropertyNames)
            return this._ownStaticPropertyNames;
        
        let ownStaticPropertyNames = this.getMetadata('rt:SP');
        this._hasStaticPropertyNameMeta = !!ownStaticPropertyNames;
        if (!ownStaticPropertyNames) {
            this._hasStaticPropertyNameMeta = false;
            ownStaticPropertyNames = Object.getOwnPropertyNames(this.class)
                .filter(x => !['length', 'prototype', 'name'].includes(x))
                .filter(x => typeof this.class[x] !== 'function')
            ;
        }
        return this._ownStaticPropertyNames = ownStaticPropertyNames;
    }

    private _ownStaticMethodNames : string[];

    /**
     * Retrieve the set of static method names that are defined directly on this class, 
     * excluding those which are inherited. Always empty for interfaces
     */
    get ownStaticMethodNames(): string[] {
        if (this._ownStaticMethodNames)
            return this._ownStaticMethodNames;
        
        let ownStaticMethodNames = this.getMetadata('rt:Sm');
        if (!ownStaticMethodNames) {
            ownStaticMethodNames = Object.getOwnPropertyNames(this.class)
                .filter(x => !['length', 'prototype', 'name'].includes(x))
                .filter(x => typeof this.class[x] === 'function')
        }

        return this._ownStaticMethodNames = ownStaticMethodNames;
    }

    /**
     * Retrieve the set of flags for this class/interface. Use this to check for modifiers or other properties
     * of the class/interface.
     */
    get flags(): Readonly<ReflectedFlags> {
        if (this._flags)
            return this._flags;
        
        return this._flags = new ReflectedFlags(this.getMetadata('rt:f'));
    }

    /**
     * True if the class is marked abstract.
     */
    get isAbstract() {
        return this.flags.isAbstract;
    }

    /**
     * Get the instance method names for this reflected class/interface.
     */
    get methodNames(): string[] {
        if (this._methodNames)
            return this._methodNames;
           
        if (this.super) {
            return this._methodNames = this.super.methodNames.concat(this.ownMethodNames);
        } else {
            return this._methodNames = this.ownMethodNames;
        }
    }


    private _staticPropertyNames : string[];

    /**
     * Get the static property names defined for this reflected class. Always empty for interfaces.
     */
    get staticPropertyNames() {
        if (this._staticPropertyNames)
            return this._staticPropertyNames;

        if (this.super) {
            return this._staticPropertyNames = this.super.staticPropertyNames.concat(this.ownStaticPropertyNames);
        } else {
            return this._staticPropertyNames = this.ownStaticPropertyNames;
        }
    }

    private _staticMethodNames : string[];

    /**
     * Retrieve an array of the names of static methods defined on this reflected class.
     * Always empty for interfaces.
     */
    get staticMethodNames(): string[] {
        if (this._staticMethodNames)
            return this._staticMethodNames;

        if (this.super) {
            return this._staticMethodNames = this.super.staticMethodNames.concat(this.ownStaticMethodNames);
        } else {
            return this._staticMethodNames = this.ownStaticMethodNames;
        }
    }

    private _propertyNames : string[];

    /**
     * Retrieve an array of the names of instance properties defined on this class/interface
     */
    get propertyNames(): string[] {
        if (this._propertyNames)
            return this._propertyNames;

        if (this.super) {
            return this._propertyNames = this.super.propertyNames.concat(this.ownPropertyNames);
        } else {
            return this._propertyNames = this.ownPropertyNames;
        }
    }

    /**
     * Retrieve the set of reflected methods defined directly on this class/interface.
     */
    get ownMethods(): ReflectedMethod[] {
        if (this._ownMethods)
            return this._ownMethods;

        return this._ownMethods = this.ownMethodNames.map(name => new ReflectedMethod(<any>this, name, false));
    }

    private _ownStaticProperties : ReflectedProperty[];

    /**
     * Retrieve the set of reflected static properties defined directly on this class. Always empty
     * for interfaces.
     */
    get ownStaticProperties(): ReflectedProperty[] {
        if (this._ownStaticProperties)
            return this._ownStaticProperties;
        
        return this._ownStaticProperties = this.staticPropertyNames.map(x => new ReflectedProperty(<any>this, x, true));
    }

    private _ownStaticMethods : ReflectedMethod[];

    /**
     * Retrieve the set of reflected static methods defined directly on this class. Always
     * empty for interfaces.
     */
    get ownStaticMethods(): ReflectedMethod[] {
        if (this._ownStaticMethods)
            return this._ownStaticMethods;

        return this._ownStaticMethods = this.ownStaticMethodNames.map(name => new ReflectedMethod(<any>this, name, true));
    }

    /**
     * Retrieve the set of reflected instance methods defined on this class/interface.
     */
    get methods(): ReflectedMethod[] {
        if (this._methods)
            return this._methods;
        
        if (this.super)
            return this._methods = this.super.methods.concat(this.ownMethods);
        else
            return this._methods = this.ownMethods;
    }

    private _staticProperties : ReflectedProperty[];

    /**
     * Retrieve the set of reflected static properties defined on this class. Always 
     * empty for interfaces.
     */
    get staticProperties() {
        if (this._staticProperties)
            return this._staticProperties;
        
        if (this.super)
            return this._staticProperties = this.super.staticProperties.concat(this.ownStaticProperties);
        else
            return this._staticProperties = this.ownStaticProperties;
    }

    private _staticMethods : ReflectedMethod[];

    /**
     * Retrieve the set of reflected static methods defined on this class. Always
     * empty for interfaces
     */
    get staticMethods(): ReflectedMethod[] {
        if (this._staticMethods)
            return this._staticMethods;
        
        if (this.super)
            return this._staticMethods = this.super.staticMethods.concat(this.ownStaticMethods);
        else
            return this._staticMethods = this.ownStaticMethods;
    }

    /**
     * Retrieve the set of reflected instance properties defined directly on this class/interface
     */
    get ownProperties(): ReflectedProperty[] {
        if (this._ownProperties)
            return this._ownProperties;

        return this._ownProperties = this.ownPropertyNames.map(name => new ReflectedProperty(<any>this, name, false));
    }

    /**
     * Retrieve the set of reflected instance methods defined on this class/interface
     */
    get properties(): ReflectedProperty[] {
        if (this._properties)
            return this._properties;
        
        if (this.super)
            return this._properties = this.super.properties.concat(this.ownProperties);
        else
            return this._properties = this.ownProperties;
    }

    private get RtParameter(): RtParameter[] {
        if (this._RtParameter)
            return this._RtParameter;
        
        let rawParams = this.getMetadata('rt:p');
        if (rawParams === void 0 && this.hasMetadata('design:paramtypes')) {
            let types = this.getMetadata('design:paramtypes');
            let names = getParameterNames(<Function>this.class);
            rawParams = names.map((n, i) => ({ n, t: () => types[i] }));
        }

        return this._RtParameter = rawParams || [];
    }

    /**
     * Retrieve an array of the parameter names for this class's constructor.
     */
    get parameterNames() {
        return this.RtParameter.map(x => x.n);
    }

    /**
     * Retrieve an array of the types for the parameters of this class's
     * constructor.
     */
    get parameterTypes() {
        return this.RtParameter.map(x => x.t);
    }

    /**
     * Retrieve the set of reflected parameters for this class's constructor.
     */
    get parameters(): ReflectedConstructorParameter[] {
        if (this._parameters)
            return this._parameters;
        
        return this._parameters = this.RtParameter.map((x, i) => new ReflectedConstructorParameter(<any>this, x, i));
    }

    /**
     * Get a reflected constructor parameter by name.
     * @param name 
     * @returns 
     */
    getParameter(name : string) {
        return this.parameters.find(x => x.name === name);
    }

    /**
     * Get a reflected instance method (declared directly on this class) by name
     * @param name 
     * @returns 
     */
    getOwnMethod(name : string) {
        return this.ownMethods.find(x => x.name === name);
    }

    /**
     * Get a reflected instance method by name
     * @param name 
     * @returns 
     */
    getMethod(name : string) {
        return this.methods.find(x => x.name === name);
    }

    /**
     * Get a reflected static method by name
     * @param name 
     * @returns 
     */
    getStaticMethod(name : string) {
        return this.staticMethods.find(x => x.name === name);
    }

    private _dynamicStaticProperties = new Map<string,ReflectedProperty>();

    /**
     * Get a reflected static property (declared directly on this class) by name
     * @param name 
     * @returns 
     */
    getOwnStaticProperty(name : string) {
        let matchingProp = this.ownStaticProperties.find(x => x.name === name);
        if (matchingProp)
            return matchingProp;

        if (!this._hasStaticPropertyNameMeta) {
            if (this._dynamicStaticProperties.has(name))
                return this._dynamicStaticProperties.get(name);
            
            let prop = new ReflectedProperty(this, name, true);
            this._dynamicStaticProperties.set(name, prop);
            return prop;
        }
    }

    /**
     * Get a reflected static property by name
     * @param name 
     * @returns 
     */
    getStaticProperty(name : string) {
        let matchingProp = this.staticProperties.find(x => x.name === name);
        if (matchingProp)
            return matchingProp;

        if (!this._hasStaticPropertyNameMeta) {
            if (this._dynamicStaticProperties.has(name))
                return this._dynamicStaticProperties.get(name);
            
            let prop = new ReflectedProperty(this, name, true);
            this._dynamicStaticProperties.set(name, prop);
            return prop;
        }
    }

    /**
     * Get a reflected instance property (declared directly on this class) by name
     * @param name 
     * @returns 
     */
    getOwnProperty(name : string) {
        let matchingProp = this.ownProperties.find(x => x.name === name);
        if (matchingProp)
            return matchingProp;

        if (!this._hasPropertyNamesMeta) {
            if (this._dynamicProperties.has(name))
                return this._dynamicProperties.get(name);
            
            let prop = new ReflectedProperty(this, name, false);
            this._dynamicProperties.set(name, prop);
            return prop;
        }
    }

    private _dynamicProperties = new Map<string, ReflectedProperty>();

    /**
     * Get a reflected instance property by name
     * @param name 
     * @returns 
     */
    getProperty(name : string): ReflectedProperty {
        let matchingProp = this.properties.find(x => x.name === name);
        if (matchingProp)
            return matchingProp;

        if (!this._hasPropertyNamesMeta) {
            if (this._dynamicProperties.has(name))
                return this._dynamicProperties.get(name);
            
            let prop = new ReflectedProperty(this, name, false);
            this._dynamicProperties.set(name, prop);
            return prop;
        }
    }
}

/**
 * Returns true if the class (or the class of the given value) implement the given interface.
 * Note that interfaceType can be a class constructor. Implementing a class is not the same as extending a class.
 * 
 * @param value The value to check. Can be a constructor or a value (whose constructor will be checked)
 * @param interfaceType The interface type to use. Can be a class constructor or an Interface object.
 * @returns True if the interface is implemented
 */
export function implementsInterface(value, interfaceType : InterfaceToken | Constructor<any>) {
    if (value === null || value === undefined || !['object', 'function'].includes(typeof value))
        return false;
    if (interfaceType === null || interfaceType === undefined)
        throw new TypeError(`Interface type must not be undefined`);
    
    if (typeof value === 'object')
        return ReflectedClass.for(value.constructor).implements(interfaceType);
    else if (typeof value === 'function')
        return ReflectedClass.for(value).implements(interfaceType);
}

/**
 * Returns true if the given value matches the shape of the interface / class passed as interfaceType.
 * 
 * @param value 
 * @param interfaceType 
 * @returns True if the value is the correct shape
 */
export function matchesShape(value, interfaceType : InterfaceToken | Constructor<any>) {
    if (interfaceType === null || interfaceType === undefined)
        throw new TypeError(`Interface type must not be undefined`);
    
    return ReflectedClass.for(interfaceType).matchesValue(value);
}

/**
 * Get the reflected call site
 * @returns The reflected call site
 */
 export function reflect(value : CallSite) : ReflectedCallSite;
/**
 * Get the reflected interface object for the given interface (identified by T)
 * @param callSite Do not pass a value here. This opts in to call site reflection.
 * @returns The reflected interface
 */
export function reflect<T>(unused? : never, callSite? : CallSite) : ReflectedTypeRef;
/**
 * Get the reflected class for the given constructor or instance.
 * @param value A constructor, Interface value, or an instance of a class
 * @returns The reflected class
 */
export function reflect<T>(value : Constructor<T>) : ReflectedClass<Constructor<T>>;
export function reflect<T extends Function>(value : T) : (ReflectedFunction<T> | ReflectedMethod<T>);
export function reflect<T>(value : T) : ReflectedClass<Constructor<T>>;
export function reflect(value : any = NotProvided, callSite? : CallSite) {
    if (value === NotProvided && !callSite) {
        throw new Error(`reflect<T>() can only be used when project is built with the typescript-rtti transformer`);
    }

    if (!value)
        throw new TypeError(`Could not reflect on null/undefined`);

    if (isCallSite(value))
        return new ReflectedCallSite(value);

    if (value === NotProvided && isCallSite(callSite))
        return new ReflectedCallSite(callSite).typeParameters[0];

    let flags = getFlags(value);

    if (flags.includes(Flags.F_FUNCTION))
        return ReflectedFunction.for(value);
    if (flags.includes(Flags.F_METHOD))
        return ReflectedMethod.for(value);

    if (typeof value === 'function' && !value.prototype)
        return ReflectedFunction.for(value);
    
    return ReflectedClass.for(value);
}

export interface CallSite {
    TΦ: 'c'
}

interface RtCallSite {
    TΦ: typeof Flags.T_CALLSITE;
    t: RtTypeRef;
    p: RtTypeRef[];
    tp: RtTypeRef[];
    r: RtTypeRef;
}

export class ReflectedCallSite {
    constructor(callSite : CallSite) {
        this.callSite = <RtCallSite>callSite;
    }

    private callSite : RtCallSite;

    private _parameters : ReflectedTypeRef[];

    get parameters() {
        if (!this._parameters)
            this._parameters = this.callSite.p.map(x => ReflectedTypeRef.createFromRtRef(x));
        return this._parameters;
    }

    private _typeParameters : ReflectedTypeRef[];

    get typeParameters() {
        if (!this._typeParameters) {
            this._typeParameters = this.callSite.tp.map(x => ReflectedTypeRef.createFromRtRef(x));
        }

        return this._typeParameters;
    }

    // private _target : ReflectedTypeRef;

    // get target() {
    //     if (!this._target)
    //         this._target = ReflectedTypeRef.createFromRtRef(this.callSite.t);
    //     return this._target;
    // }

    // private _return : ReflectedTypeRef;

    // get return() {
    //     if (!this._return)
    //         this._return = ReflectedTypeRef.createFromRtRef(this.callSite.r);
    //     return this._return;
    // }
}