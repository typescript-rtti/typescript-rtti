import * as format from '../../common/format';
import { MatchesValueOptions } from './matches-values-options';
import { Type } from './type';

@Type.Kind('false')
export class FalseType extends Type<format.RtFalseType> {
    get kind() { return 'false' as const; }
    toString() { return `false`; }

    override matchesValue(value: any, options?: MatchesValueOptions): boolean {
        options ??= {};
        options.errors ??= [];
        return value === false;
    }
}
