import * as format from '../../common/format';
import { MatchesValueOptions } from './matches-values-options';
import { Type } from './type';

@Type.Kind('unknown')
export class UnknownType extends Type<format.RtUnknownType> {
    get kind() { return 'unknown' as const; }
    toString() { return `unknown`; }

    override matchesValue(value: any, options?: MatchesValueOptions): boolean {
        options ??= {};
        options.errors ??= [];
        return true;
    }
}
