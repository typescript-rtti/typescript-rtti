import * as format from '../../common/format';
import { MatchesValueOptions } from './matches-values-options';
import { Member } from './member';
import { ObjectMember } from './object-member';
import { Property } from './property';
import { Type } from './type';

@Type.Kind('mapped')
export class MappedType extends Type<format.RtMappedType> {
    get kind() { return 'mapped' as const; }
    toString() { return `${this.baseType}<${this.typeParameters.join(', ')}>`; }

    get name(): string {
        // TODO
        return '<mapped-type>';
    }

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

    private _members: Member[];

    get members(): Readonly<Member[]> {
        if (!this._members)
            this._members = this.ref.m.map(m => Member.createFromRef(m));

        return this._members;
    }

    getMember(name: string) {
        return this.members.find(x => x.name === name);
    }

    private _properties: Property[];
    get properties() {
        return this._properties ??= this.members.filter(x => x instanceof Property) as Property[];
    }

    getProperty(name: string) {
        return this.properties.find(x => x.name === name);
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
