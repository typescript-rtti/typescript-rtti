import * as format from '../../common/format';
import { FunctionType } from './function-type';
import { MatchesValueOptions } from './matches-values-options';
import { Member } from './member';
import { Type } from './type';

/**
 * Reflection data for a class method
 */
@Member.Kind(format.F_METHOD)
export class Method extends Member {
    private _type: FunctionType;

    get type() {
        return this._type ??= FunctionType.createFromRtRef(this.ref.t);
    }

    /**
     * Retrieve the set of reflected parameters for this method.
     */
    get parameters() {
        return this.type.parameters;
    }

    /**
     * Get a reflected parameter by name
     * @param name
     * @returns The reflected parameter
     */
    getParameter(name: string) {
        return this.parameters.find(x => x.name === name);
    }

    /**
     * Get the return type of this method.
     */
    get returnType(): Type {
        return this.type.returnType;
    }

    /**
     * True if the return type was inferred using the Typescript type checker. False if
     * the return type was defined explicitly.
     */
    get returnTypeInferred() {
        return this.flags.isInferred;
    }

    /**
     * True if this method is declared as async.
     */
    get isAsync() {
        return this.flags.isAsync;
    }

    /**
     * True if this function is a variadic function.
     */
    get isVariadic() {
        return this.parameters.find(v => v.isRest) !== undefined;
    }

    protected override matches(member: this) {
        if (!super.matches(member))
            return false;

        if (this.parameters.length !== member.parameters.length)
            return false;

        for (let i = 0, max = this.parameters.length; i < max; ++i) {
            const param1 = this.parameters[i];
            const param2 = member.parameters[i];

            if (!param1.equals(param2, true))
                return false;
        }

        return true;
    }

    override matchesValue(value, options?: MatchesValueOptions): boolean {
        if (typeof value !== 'function')
            return false;

        if (value.length !== this.parameters.length)
            return false;

        return true;
    }
}
