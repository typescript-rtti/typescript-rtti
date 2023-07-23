import * as format from '../../common/format';
import { MatchesValueOptions } from './matches-values-options';
import { Type } from './type';

@Type.Kind('void')
export class VoidType extends Type<format.RtVoidType> {
    get kind() { return 'void' as const; }
    toString() { return `void`; }

    override matchesValue(value: any, options?: MatchesValueOptions): boolean {
        options ??= {};
        options.errors ??= [];
        if (value !== void 0) {
            options.errors.push(new Error(`Value must not be present`));
            return false;
        }

        return true;
    }
}
