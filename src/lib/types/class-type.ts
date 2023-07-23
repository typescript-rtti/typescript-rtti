import { Type } from './type';
import * as format from '../../common/format';
import { Member } from './member';
import { Method } from './method';
import { synthesizeMember } from './synthesis';
import { Property } from './property';
import { ConstructorMember } from './constructor-member';
import { Constructor } from '../constructor';
import { isBuiltIn, superMergeElements } from '../utils';
import { getParameterNames } from '../get-parameter-names';
import { Flags } from './flags';
import { MatchesValueOptions } from './matches-values-options';

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
    get isBuiltIn() { return isBuiltIn(this.class); }

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

    getMember(name: string) {
        return this.members.find(x => x.name === name);
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

    getProperty(name: string): Property {
        return this.getOwnProperty(name) ?? this.super?.getProperty(name);
    }

    getMethod(name: string): Method {
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
