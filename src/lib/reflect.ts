import * as Flags from '../common/flags';

function Flag(value : string) {
    return (target, propertyKey) => {
        target.flagToProperty[value] = propertyKey;
        target.propertyToFlag[propertyKey] = value;
    };
}

export class ReflectedFlags {
    constructor(flags : string) {
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

    get name() {
        return this.rawMetadata.n;
    }

    get type() {
        return this.rawMetadata.t;
    }

    private _flags : ReflectedFlags;

    get flags() {
        if (this._flags)
            return this._flags;

        return this._flags = new ReflectedFlags(this.rawMetadata.f)
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
        readonly name : string
    ) {
        this._class = reflectedClass;
    }

    private _class : ReflectedClass;
    private _flags : ReflectedFlags;

    get class() {
        return this._class;
    }
    
    get flags(): Readonly<ReflectedFlags> {
        if (this._flags)
            return this._flags;
        
        return this._flags = new ReflectedFlags(Reflect.getMetadata('rt:f', this.class.prototype, this.name));
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

    get rawParameterMetadata(): RawParameterMetadata[] {
        if (this._rawParameterMetadata)
            return this._rawParameterMetadata;
        
        return this._rawParameterMetadata = Reflect.getMetadata('rt:p', this.class.prototype, this.name);
    }

    private _parameters : ReflectedMethodParameter[];

    get parameterNames() {
        return this.rawParameterMetadata.map(x => x.n);
    }

    get parameterTypes() {
        return this.rawParameterMetadata.map(x => x.t);
    }

    get parameters() {
        if (this._parameters)
            return this._parameters;
        
        return this._parameters = this._rawParameterMetadata.map(x => new ReflectedMethodParameter(this, x));
    }

    get returnType(): Function {
        if (this._returnType)
            return this._returnType;

        return this._returnType = Reflect.getMetadata('rt:t', this.class.prototype, this.name);
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
        if (this._type)
            return this._type;

        return this._type = Reflect.getMetadata('rt:t', this.class.prototype, this.name);
    }

    get isReadonly() {
        return this.flags.isReadonly;
    }
}

export class ReflectedClass<ClassT = Function> {
    constructor(
        klass : Constructor<ClassT>
    ) {
    }

    _class : Constructor<ClassT>;
    _isAbstract : boolean;

    get prototype() {
        return this._class.prototype;
    }

    get class() {
        return this._class;
    }

    get isAbstract() {
        return this._isAbstract;
    }

    private _super : ReflectedClass;

    get super() : ReflectedClass {
        if (this._super !== undefined)
            return this._super;

        let parentClass = Object.getPrototypeOf(this.class.prototype).constructor;
        if (parentClass === Object)
            return this._super = null;
        else
            return this._super = new ReflectedClass(parentClass);
    }

    private _methods : ReflectedMethod[];
    private _ownPropertyNames : string[];
    private _ownMethodNames : string[];

    get ownPropertyNames(): string[] {
        if (this._ownPropertyNames)
            return this._ownPropertyNames;
        
        return this._ownPropertyNames = Reflect.getMetadata('rt:P', this.class);
    }

    get ownMethodNames(): string[] {
        if (this._ownMethodNames)
            return this._ownMethodNames;
        
        return this._ownMethodNames = Reflect.getMetadata('rt:m', this.class);
    }

    private _methodNames : string[];

    get methodNames(): string[] {
        if (this._methodNames)
            return this._methodNames;
           
        if (this.super) {
            return this._methodNames = this.super.methodNames.concat(this.ownMethodNames);
        } else {
            return this._methodNames = this.ownMethodNames;
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

    private _ownMethods : ReflectedMethod[];

    get ownMethods(): ReflectedMethod[] {
        if (this._ownMethods)
            return this._ownMethods;

        return this._ownMethods = this.ownMethodNames.map(name => new ReflectedMethod(<any>this, name));
    }

    get methods(): ReflectedMethod[] {
        if (this._methods)
            return this._methods;
        
        if (this.super)
            return this._methods = this.super.methods.concat(this.methods);
        else
            return this._methods = this.ownMethods;
    }

    private _rawParameterMetadata : RawParameterMetadata[];

    get rawParameterMetadata(): RawParameterMetadata[] {
        if (this._rawParameterMetadata)
            return this._rawParameterMetadata;
        
        return this._rawParameterMetadata = Reflect.getMetadata('rt:p', this.class.prototype);
    }

    private _parameters : ReflectedConstructorParameter[];

    get parameterNames() {
        return this.rawParameterMetadata.map(x => x.n);
    }

    get parameterTypes() {
        return this.rawParameterMetadata.map(x => x.t);
    }

    get parameters() {
        if (this._parameters)
            return this._parameters;
        
        return this._parameters = this._rawParameterMetadata.map(x => new ReflectedConstructorParameter(this, x));
    }
}
