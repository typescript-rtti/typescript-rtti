import * as format from '../../common/format';
import { MatchesValueOptions } from './matches-values-options';
import { Type } from './type';

@Type.Kind('literal')
export class LiteralType<Class extends format.Literal = format.Literal> extends Type<format.RtLiteralType> {
    get kind() { return 'literal' as const; }
    get value() { return <Class>this.ref.v; }
    toString() { return JSON.stringify(this.ref.v); }

    protected override matches(ref : this) {
        return this.value === ref.value;
    }

    override matchesValue(value: any, options?: MatchesValueOptions): boolean {
        options ??= {};
        options.errors ??= [];
        return this.value === value;
    }
}
