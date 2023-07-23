import * as format from '../../common/format';
import { superMergeElements } from '../utils';
import { MatchesValueOptions } from './matches-values-options';
import { Member } from './member';
import { Method } from './method';
import { Property } from './property';
import { StructuralType } from './structural-type';
import { Type } from './type';

/**
 * Represents an interface type.
 */
@Type.Kind('interface')
export class InterfaceType extends Type<format.RtInterfaceType> {
    get kind() { return 'interface' as const; }
    get name() { return this.ref.n; }

    toString() { return `interface ${this.name}`; }

    //#region Super Types

    private _super: StructuralType[];
    get super() {
        return this._super ??= (this.ref.e ?? []).map(x => Type.createFromRtRef(x) as StructuralType);
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
        return superMergeElements(this.ownMembers, this.super.flatMap(s => s.members));
    }

    getMember(name: string) {
        return this.members.find(x => x.name === name);
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
