import * as format from '../../common/format';
import { FunctionType } from './function-type';
import { MatchesValueOptions } from './matches-values-options';
import { Member } from './member';
import { Method } from './method';
import { Property } from './property';
import { Signature } from './signature';
import { structuralAssignableFrom } from './structural-assignable-from';
import { structuralMatcher } from './structural-matcher';

import { Type } from './type';

@Type.Kind('object')
export class ObjectType extends Type<format.RtObjectType> {
    get kind() { return 'object' as const; }

    get name() { return this.ref.n; }

    private _members: Readonly<Member[]>;
    get members(): Readonly<Member[]> {
        return this._members ??= this.ref.m.map(m => Member.createFromRef(m));
    }

    private _properties: Readonly<Property[]>;
    get properties(): Readonly<Property[]> {
        return this._properties ??= this.members.filter(x => x instanceof Property) as Property[];
    }

    private _methods: Readonly<Method[]>;
    get methods(): Readonly<Method[]> {
        return this._methods ??= this.members.filter(x => x instanceof Method) as Method[];
    }

    private _callSignatures: Signature[];

    get callSignatures(): Readonly<Signature[]> {
        return this._callSignatures ??= (this.ref.c ?? []).map(c => new Signature(c));
    }

    toString() { return `{ ${this.members.map(m => m.toString()).join(', ')} }`; }

    getMember(name: string) {
        return this.members.find(x => x.name === name);
    }

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

    assignableFrom(type: Type<format.RtType>): boolean {
        return structuralAssignableFrom(this, type, false);
    }

    override matchesValue(value: any, options?: MatchesValueOptions) {
        options ??= {};
        options.errors ??= [];

        if (this.callSignatures.length > 0) {
            if (typeof value !== 'function') {
                options.errors.push(new Error(`Non-function cannot match callable structural type '${this.name ?? '<unnamed>'}'`));
                return false;
            }

            let functionType = FunctionType.from(value);
            if (!this.callSignatures.some(sig => sig.assignableFrom(functionType.signature))) {
                options.errors.push(new Error(`No compatible function signatures found`));
            }
        }

        return structuralMatcher(this, value, options);
    }
}
