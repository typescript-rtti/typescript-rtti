import * as format from '../../common/format';
import { MatchesValueOptions } from './matches-values-options';
import { Type } from './type';

@Type.Kind('true')
export class TrueType extends Type<format.RtTrueType> {
    get kind() { return 'true' as const; }
    toString() { return `true`; }

    override matchesValue(value: any, options?: MatchesValueOptions): boolean {
        options ??= {};
        options.errors ??= [];
        return value === true;
    }
}
