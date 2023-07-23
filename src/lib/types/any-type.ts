import * as format from '../../common/format';
import { MatchesValueOptions } from './matches-values-options';
import { Type } from './type';

@Type.Kind('any')
export class AnyType extends Type<format.RtAnyType> {
    get kind() { return 'any' as const; }
    toString() { return `any`; }

    override matchesValue(value: any, options?: MatchesValueOptions): boolean {
        options ??= {};
        options.errors ??= [];
        return true;
    }
}
