import * as format from '../../common/format';
import { MatchesValueOptions } from './matches-values-options';
import { Type } from './type';

@Type.Kind('undefined')
export class UndefinedType extends Type<format.RtUndefinedType> {
    get kind() { return 'undefined' as const; }
    toString() { return `undefined`; }

    override matchesValue(value: any, options?: MatchesValueOptions): boolean {
        options ??= {};
        options.errors ??= [];
        return value === undefined;
    }
}
