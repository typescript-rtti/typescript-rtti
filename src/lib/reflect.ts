import * as Flags from '../common/flags';
import { getParameterNames } from './get-parameter-names';

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
type RtTypeRef = RtType | Function | Literal;

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
    | 'unknown' | 'tuple' | 'array' | 'class' | 'any' | 'unknown' | 'generic' | 'literal';

export const TYPE_REF_KIND_EXPANSION : Record<string, ReflectedTypeRefKind> = {
    [Flags.T_UNKNOWN]: 'unknown',
    [Flags.T_ANY]: 'any',
    [Flags.T_UNION]: 'union',
    [Flags.T_INTERSECTION]: 'intersection',
    [Flags.T_TUPLE]: 'tuple',
    [Flags.T_ARRAY]: 'array',
    [Flags.T_GENERIC]: 'generic'
};

export class ReflectedTypeRef<T extends RtTypeRef = RtTypeRef> {
    protected constructor(
        private _ref : T
    ) {
    }

    /** @internal */
    static Kind(kind : ReflectedTypeRefKind) {
        return (target) => {
            ReflectedTypeRef.kinds[kind] = target;
        }
    }

    private static kinds : Record<ReflectedTypeRefKind, Constructor<ReflectedTypeRef>> = <any>{};

    get kind() : ReflectedTypeRefKind {
        let ref : RtTypeRef = this._ref;
        if (ref === null || ['string', 'number', 'boolean'].includes(typeof ref))
            return 'literal';

        return (typeof ref === 'object' && 'TΦ' in ref) ? TYPE_REF_KIND_EXPANSION[ref.TΦ] : 'class';
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
    isPromise<T = Function>(klass? : Constructor<T>): boolean {
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

    /**
     * Checks if this type is a literal type (null/true/false/undefined or a literal expression)
     * @param value 
     * @returns 
     */
    isLiteral(value : any) {
        return this.ref === value;
    }

    get isLiteralValue() { return this.kind === 'literal'; }
    get isTrue() { return this.isLiteral(true); }
    get isFalse() { return this.isLiteral(false); }
    get isNull() { return this.isLiteral(null); }
    get isStringLiteral() { return typeof this.ref === 'string'; }
    get isNumberLiteral() { return typeof this.ref === 'number'; }
    get isBooleanLiteral() { return typeof this.ref === 'boolean'; }
    get isUndefined() { return this.isLiteral(void 0); }

    get literalValue(): any {
        return this.kind === 'literal' ? this.ref : void 0;
    }

    /**
     * Check if this type reference is a generic type, optionally checking if the generic's
     * base type is the given class. For instance isGeneric(Promise) is true for Promise<string>.
     * @param klass 
     */
    isGeneric<T = Function>(klass? : Constructor<T>): this is ReflectedGenericRef<T> {
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

    isIntersection(elementDiscriminator? : (elementType : ReflectedTypeRef) => boolean): this is ReflectedUnionRef {
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
        if (ref === null || typeof ref !== 'object')
            return new ReflectedTypeRef(ref);
        
        let kind = ('TΦ' in <object>ref) ? TYPE_REF_KIND_EXPANSION[ref.TΦ] : 'class';
        return new (ReflectedTypeRef.kinds[kind] || ReflectedTypeRef)(ref);
    }
}

@ReflectedTypeRef.Kind('class')
export class ReflectedClassRef<Class> extends ReflectedTypeRef<Constructor<Class>> {
    get kind() { return 'class' as const; }
    get class() : Constructor<Class> { return <any>this.ref; }
}

@ReflectedTypeRef.Kind('union')
export class ReflectedUnionRef extends ReflectedTypeRef<RtUnionType> {
    get kind() { return 'union' as const; }
    
    private _types : ReflectedTypeRef[];
    get types(): ReflectedTypeRef[] {
        if (this._types)
            return this._types;
        return this._types = (this.ref.t || []).map(t => ReflectedTypeRef.createFromRtRef(t));
    }
}

@ReflectedTypeRef.Kind('intersection')
export class ReflectedIntersectionRef extends ReflectedTypeRef<RtIntersectionType> {
    get kind() { return 'intersection' as const; }
    
    private _types : ReflectedTypeRef[];
    get types() {
        if (this._types)
            return this._types;
        return this._types = (this.ref.t || []).map(t => ReflectedTypeRef.createFromRtRef(t));
    }
}

@ReflectedTypeRef.Kind('array')
export class ReflectedArrayRef extends ReflectedTypeRef<RtArrayType> {
    get kind() { return 'array' as const; }
    
    private _elementType : ReflectedTypeRef;
    get elementType(): ReflectedTypeRef {
        if (this._elementType)
            return this._elementType;
        return this._elementType = ReflectedTypeRef.createFromRtRef(this.ref.e);
    }
}

@ReflectedTypeRef.Kind('tuple')
export class ReflectedTupleRef extends ReflectedTypeRef<RtTupleType> {
    get kind() { return 'tuple' as const; }
    
    private _types : ReflectedTupleElement[];
    get elements(): ReflectedTupleElement[] {
        if (this._types)
            return this._types;
        return this._types = (this.ref.e || []).map(e => new ReflectedTupleElement(e));
    }
}

@ReflectedTypeRef.Kind('generic')
export class ReflectedGenericRef<Class> extends ReflectedTypeRef<RtGenericRef> {
    get kind() { return 'generic' as const; }

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
}

export class ReflectedTupleElement {
    constructor(readonly ref : Readonly<RtTupleElement>) {
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
    @Flag(Flags.F_OPTIONAL) isOptional : boolean;
    @Flag(Flags.F_ASYNC) isAsync : boolean;
    @Flag(Flags.F_EXPORTED) isExported : boolean;

    toString() {
        return Object.keys(this.propertyToFlag)
            .map(property => this[property] ? this.propertyToFlag[property] : '')
            .join('');
    }

}

export type Visibility = 'public' | 'private' | 'protected';

export interface RawParameterMetadata {
    n : string;
    t : Function;
    f? : string;
}

/**
 * Reflection data for a parameter
 */
export class ReflectedParameter {
    constructor(
        readonly rawMetadata : RawParameterMetadata
    ) {
    }

    private _flags : ReflectedFlags;

    get name() {
        return this.rawMetadata.n;
    }

    private _type : ReflectedTypeRef;

    get type(): ReflectedTypeRef {
        if (this._type)
            return this._type;
        return this._type = ReflectedTypeRef.createFromRtRef(this.rawMetadata.t());
    }

    get flags() {
        if (this._flags)
            return this._flags;

        return this._flags = new ReflectedFlags(this.rawMetadata.f)
    }

    get isOptional() {
        return this.flags.isOptional;
    }
}

/**
 * Reflection data for a method parameter
 */
export class ReflectedMethodParameter extends ReflectedParameter {
    constructor(
        readonly method : ReflectedMethod,
        readonly rawMetadata : RawParameterMetadata
    ) {
        super(rawMetadata);
    }
}

/**
 * Reflection data for a constructor parameter
 */
export class ReflectedConstructorParameter extends ReflectedParameter {
    constructor(
        readonly reflectedClass : ReflectedClass,
        readonly rawMetadata : RawParameterMetadata
    ) {
        super(rawMetadata);
        this._class = reflectedClass;
    }

    private _class : ReflectedClass;

    get class() {
        return this._class;
    }

    get isReadonly() {
        return this.flags.isReadonly;
    }

    get isPublic() {
        return this.flags.isPublic;
    }

    get isProtected() {
        return this.flags.isProtected;
    }

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
export class ReflectedMember {
    constructor(
        reflectedClass : ReflectedClass,
        readonly name : string,
        readonly isStatic : boolean
    ) {
        this._class = reflectedClass;
    }

    private _class : ReflectedClass;
    private _flags : ReflectedFlags;

    get host() {
        return this.isStatic ? this.class.class : this.class.prototype;
    }

    get class() {
        return this._class;
    }
    
    get flags(): Readonly<ReflectedFlags> {
        if (this._flags)
            return this._flags;
        
        return this._flags = new ReflectedFlags(Reflect.getMetadata('rt:f', this.host, this.name));
    }

    get isAbstract() {
        return this.flags.isAbstract;
    }

    get isPrivate() {
        return this.flags.isPrivate;
    }

    get isPublic() {
        return this.flags.isPublic;
    }

    get isProtected() {
        return this.flags.isProtected;
    }

    get visibility(): Visibility {
        return this.isPublic ? 'public' 
             : this.isProtected ? 'protected' 
             : this.isPrivate ? 'private' 
             : 'public';
    }

    get isOptional() {
        return this.flags.isOptional;
    }
}

/**
 * Reflection data for a class method
 */
export class ReflectedMethod extends ReflectedMember {
    private _returnType : ReflectedTypeRef;
    private _rawParameterMetadata : RawParameterMetadata[];
    private _parameters : ReflectedMethodParameter[];

    get rawParameterMetadata(): RawParameterMetadata[] {
        if (this._rawParameterMetadata)
            return this._rawParameterMetadata;
        
        return this._rawParameterMetadata = Reflect.getMetadata('rt:p', this.host, this.name) || [];
    }

    get parameterNames() {
        return this.rawParameterMetadata.map(x => x.n);
    }

    get parameterTypes() {
        return this.rawParameterMetadata.map(x => x.t);
    }

    get parameters() {
        if (this._parameters)
            return this._parameters;
        
        return this._parameters = this.rawParameterMetadata.map(x => new ReflectedMethodParameter(this, x));
    }

    getParameter(name : string) {
        return this.parameters.find(x => x.name === name);
    }

    get returnType(): ReflectedTypeRef {
        if (this._returnType !== undefined)
            return this._returnType;

        let typeResolver = Reflect.getMetadata('rt:t', this.host, this.name);
        if (!typeResolver && Reflect.hasMetadata('design:returntype', this.host, this.name)) {
            let designReturnType = Reflect.getMetadata('design:returntype', this.host, this.name);
            typeResolver = () => (designReturnType || null);
        }

        if (!typeResolver)
            return ReflectedTypeRef.createUnknown();
        
        return this._returnType = ReflectedTypeRef.createFromRtRef(typeResolver());
    }

    get isAsync() {
        return this.flags.isAsync;
    }
}

export interface Constructor<T> extends Function {
    new(...args) : T;
}

export class ReflectedProperty extends ReflectedMember {
    private _type : ReflectedTypeRef;

    get type(): ReflectedTypeRef {
        if (this._type !== undefined)
            return this._type;

        let typeResolver = Reflect.getMetadata('rt:t', this.host, this.name);
        if (!typeResolver && Reflect.hasMetadata('design:type', this.host, this.name)) {
            let designType = Reflect.getMetadata('design:type', this.host, this.name);
            typeResolver = () => designType;
        }

        if (!typeResolver)
            return ReflectedTypeRef.createUnknown();

        return this._type = ReflectedTypeRef.createFromRtRef(typeResolver());
    }

    get isReadonly() {
        return this.flags.isReadonly;
    }
}

export class ReflectedClass<ClassT = any> {
    constructor(
        klass : Constructor<ClassT>
    ) {
        this._class = klass;
    }

    private _class : Constructor<ClassT>;
    private _ownMethods : ReflectedMethod[];
    private _methods : ReflectedMethod[];
    private _ownPropertyNames : string[];
    private _ownMethodNames : string[];
    private _methodNames : string[];
    private _super : ReflectedClass;
    private _rawParameterMetadata : RawParameterMetadata[];
    private _parameters : ReflectedConstructorParameter[];
    private _ownProperties : ReflectedProperty[];
    private _properties : ReflectedProperty[];
    private _flags : ReflectedFlags;

    get prototype() {
        return this._class.prototype;
    }

    get class() {
        return this._class;
    }

    get super() : ReflectedClass {
        if (this._super !== undefined)
            return this._super;

        let parentClass = Object.getPrototypeOf(this.class.prototype).constructor;
        if (parentClass === Object)
            return this._super = null;
        else
            return this._super = new ReflectedClass(parentClass);
    }

    private _hasPropertyNamesMeta = false;

    get ownPropertyNames(): string[] {
        if (this._ownPropertyNames)
            return this._ownPropertyNames;
        
        let propertyNames = Reflect.getMetadata('rt:P', this.class);
        this._hasPropertyNamesMeta = !!propertyNames;
        return this._ownPropertyNames = propertyNames || [];
    }

    get ownMethodNames(): string[] {
        if (this._ownMethodNames)
            return this._ownMethodNames;
        
        let methodNames = Reflect.getMetadata('rt:m', this.class);
        if (!methodNames) {
            methodNames = Object.getOwnPropertyNames(this.class.prototype)
                .filter(x => x !== 'constructor')
                .filter(x => typeof this.class.prototype[x] === 'function');
        }

        return this._ownMethodNames = methodNames;
    }

    private _ownStaticPropertyNames : string[];
    private _hasStaticPropertyNameMeta = false;

    get ownStaticPropertyNames(): string[] {
        if (this._ownStaticPropertyNames)
            return this._ownStaticPropertyNames;
        
        let ownStaticPropertyNames = Reflect.getMetadata('rt:SP', this.class);
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
    get ownStaticMethodNames(): string[] {
        if (this._ownStaticMethodNames)
            return this._ownStaticMethodNames;
        
        let ownStaticMethodNames = Reflect.getMetadata('rt:Sm', this.class);
        if (!ownStaticMethodNames) {
            ownStaticMethodNames = Object.getOwnPropertyNames(this.class)
                .filter(x => !['length', 'prototype', 'name'].includes(x))
                .filter(x => typeof this.class[x] === 'function')
        }

        return this._ownStaticMethodNames = ownStaticMethodNames;
    }

    get flags(): Readonly<ReflectedFlags> {
        if (this._flags)
            return this._flags;
        
        return this._flags = new ReflectedFlags(Reflect.getMetadata('rt:f', this.class));
    }

    get isAbstract() {
        return this.flags.isAbstract;
    }

    get isPrivate() {
        return this.flags.isPrivate;
    }

    get isPublic() {
        return this.flags.isPublic;
    }

    get isProtected() {
        return this.flags.isProtected;
    }

    get visibility(): Visibility {
        return this.isPublic ? 'public' 
             : this.isProtected ? 'protected' 
             : this.isPrivate ? 'private' 
             : 'public';
    }

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

    get propertyNames(): string[] {
        if (this._propertyNames)
            return this._propertyNames;

        if (this.super) {
            return this._propertyNames = this.super.propertyNames.concat(this.ownPropertyNames);
        } else {
            return this._propertyNames = this.ownPropertyNames;
        }
    }

    get ownMethods(): ReflectedMethod[] {
        if (this._ownMethods)
            return this._ownMethods;

        return this._ownMethods = this.ownMethodNames.map(name => new ReflectedMethod(<any>this, name, false));
    }

    private _ownStaticProperties : ReflectedProperty[];
    get ownStaticProperties(): ReflectedProperty[] {
        if (this._ownStaticProperties)
            return this._ownStaticProperties;
        
        return this._ownStaticProperties = this.staticPropertyNames.map(x => new ReflectedProperty(<any>this, x, true));
    }

    private _ownStaticMethods : ReflectedMethod[];
    get ownStaticMethods(): ReflectedMethod[] {
        if (this._ownStaticMethods)
            return this._ownStaticMethods;

        return this._ownStaticMethods = this.ownStaticMethodNames.map(name => new ReflectedMethod(<any>this, name, true));
    }

    get methods(): ReflectedMethod[] {
        if (this._methods)
            return this._methods;
        
        if (this.super)
            return this._methods = this.super.methods.concat(this.ownMethods);
        else
            return this._methods = this.ownMethods;
    }

    private _staticProperties : ReflectedProperty[];
    get staticProperties() {
        if (this._staticProperties)
            return this._staticProperties;
        
        if (this.super)
            return this._staticProperties = this.super.staticProperties.concat(this.ownStaticProperties);
        else
            return this._staticProperties = this.ownStaticProperties;
    }

    private _staticMethods : ReflectedMethod[];
    get staticMethods(): ReflectedMethod[] {
        if (this._staticMethods)
            return this._staticMethods;
        
        if (this.super)
            return this._staticMethods = this.super.staticMethods.concat(this.ownStaticMethods);
        else
            return this._staticMethods = this.ownStaticMethods;
    }

    get ownProperties(): ReflectedProperty[] {
        if (this._ownProperties)
            return this._ownProperties;

        return this._ownProperties = this.ownPropertyNames.map(name => new ReflectedProperty(<any>this, name, false));
    }

    get properties(): ReflectedProperty[] {
        if (this._properties)
            return this._properties;
        
        if (this.super)
            return this._properties = this.super.properties.concat(this.ownProperties);
        else
            return this._properties = this.ownProperties;
    }

    get rawParameterMetadata(): RawParameterMetadata[] {
        if (this._rawParameterMetadata)
            return this._rawParameterMetadata;
        
        let rawParams = Reflect.getMetadata('rt:p', this.class);
        if (rawParams === void 0 && Reflect.hasMetadata('design:paramtypes', this.class)) {
            let types = Reflect.getMetadata('design:paramtypes', this.class);
            let names = getParameterNames(this.class);
            rawParams = names.map((n, i) => ({ n, t: () => types[i] }));
        }

        return this._rawParameterMetadata = rawParams || [];
    }

    get parameterNames() {
        return this.rawParameterMetadata.map(x => x.n);
    }

    get parameterTypes() {
        return this.rawParameterMetadata.map(x => x.t);
    }

    get parameters(): ReflectedConstructorParameter[] {
        if (this._parameters)
            return this._parameters;
        
        return this._parameters = this.rawParameterMetadata.map(x => new ReflectedConstructorParameter(<any>this, x));
    }

    getParameter(name : string) {
        return this.parameters.find(x => x.name === name);
    }

    getOwnMethod(name : string) {
        return this.ownMethods.find(x => x.name === name);
    }

    getMethod(name : string) {
        return this.methods.find(x => x.name === name);
    }

    getStaticMethod(name : string) {
        return this.staticMethods.find(x => x.name === name);
    }

    private _dynamicStaticProperties = new Map<string,ReflectedProperty>();

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