import * as format from '../../common/format';
import { getParameterNames } from '../get-parameter-names';
import { Flags } from './flags';
import { MatchesValueOptions } from './matches-values-options';
import { Parameter } from './parameter';
import { Signature } from './signature';
import { Type } from './type';

@Type.Kind('function')
export class FunctionType extends Type<format.RtFunctionType> {
    get kind() { return 'function' as const; }
    toString() { return `function`; } // TODO: details

    private _returnType: Type;

    get name() {
        return this.ref.n;
    }

    get returnType() {
        return this._returnType ??= Type.createFromRtRef(this.ref.r);
    }

    private _parameters: Parameter[];

    get parameters() {
        return this._parameters ??= (this.ref.p ?? []).map((p, i) => new Parameter(p, i));
    }

    private _flags: Flags;

    /**
     * No use for this yet, reserved for future use
     * @internal
     */
    get flags() {
        return this._flags ??= new Flags(this.ref.f);
    }

    get isAsync() {
        return this.flags.isAsync;
    }

    /**
     * True if this function is a variadic function.
     */
    get isVariadic() {
        return this.parameters.find(v => v.isRest) !== undefined;
    }

    protected override matches(ref: this) {
        return this.returnType.equals(ref.returnType)
            && this.parameters.every((p, i) => p.equals(ref.parameters[i]))
            && this.flags.toString() === ref.flags.toString()
        ;
    }

    private _signature: Signature;
    get signature() {
        return this._signature ??= new Signature(this.ref);
    }

    override matchesValue(value: any, options?: MatchesValueOptions): boolean {
        options ??= {};
        options.errors ??= [];

        if (typeof value !== 'function')
            return false;

        if (value.length !== this.parameters.length)
            return false;

        return true;
    }
}
