import * as format from '../../common/format';
import { MatchesValueOptions } from './matches-values-options';
import { Type } from './type';

@Type.Kind('null')
export class NullType extends Type<format.RtNullType> {
    get kind() { return 'null' as const; }
    toString() { return `null`; }

    override matchesValue(value: any, options?: MatchesValueOptions): boolean {
        options ??= {};
        options.errors ??= [];
        return value === null;
    }
}
