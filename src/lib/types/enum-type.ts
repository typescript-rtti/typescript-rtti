import * as format from '../../common/format';
import { EnumValue } from './enum-value';
import { MatchesValueOptions } from './matches-values-options';
import { Type } from './type';

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
