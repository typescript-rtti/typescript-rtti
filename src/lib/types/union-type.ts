import * as format from '../../common/format';
import { MatchesValueOptions } from './matches-values-options';
import { Type } from './type';

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
