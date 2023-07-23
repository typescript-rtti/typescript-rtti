import * as format from '../../common/format';
import { MatchesValueOptions } from './matches-values-options';
import { Member } from './member';
import { Type } from './type';

/**
 * Represents a reflected property of a class or interface.
 */
@Member.Kind(format.F_PROPERTY)
export class Property extends Member {
    private _type: Type;

    get type() { return this._type ??= Type.createFromRtRef(this.ref.t); }

    /**
     * True if this property is marked readonly.
     */
    get isReadOnly() {
        return this.flags.isReadOnly;
    }

    /**
     * Check if the given value matches the type of this property, and would
     * thus be a valid assignment.
     * @param object
     * @param errors
     * @returns
     */
    matchesValue(object, options?: MatchesValueOptions) {
        options ??= {};
        options.errors ??= [];
        return this.type.matchesValue(object, options);
    }

    protected override matches(member: this) {
        if (!super.matches(member))
            return false;

        return this.type.equals(member.type);
    }
}
