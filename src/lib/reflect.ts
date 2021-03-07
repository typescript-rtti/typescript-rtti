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

    get type() {
        return this.rawMetadata.t();
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
    private _returnType : Function;
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

    get returnType(): Function {
        if (this._returnType !== undefined)
            return this._returnType;

        let typeResolver = Reflect.getMetadata('rt:t', this.host, this.name);
        if (!typeResolver) {
            let designReturnType = Reflect.getMetadata('design:returntype', this.host, this.name);
            typeResolver = () => (designReturnType || null);
        }

        return this._returnType = typeResolver ? typeResolver() : null;
    }

    get isAsync() {
        return this.flags.isAsync;
    }
}

export interface Constructor<T> extends Function {
    new(...args) : T;
}

export class ReflectedProperty extends ReflectedMember {
    private _type : Function;

    get type(): Function {
        if (this._type !== undefined)
            return this._type;

        let typeResolver = Reflect.getMetadata('rt:t', this.host, this.name);
        if (!typeResolver) {
            let designType = Reflect.getMetadata('design:type', this.host, this.name);
            typeResolver = () => designType;
        }

        return this._type = typeResolver ? typeResolver() : null;
    }

    get isReadonly() {
        return this.flags.isReadonly;
    }
}

export class ReflectedClass<ClassT = Function> {
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
        if (rawParams === void 0) {
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

    getProperty(name : string) {
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
