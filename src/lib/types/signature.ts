import * as format from '../../common/format';

import { Parameter } from './parameter';
import { TupleType } from './tuple-type';
import { Type } from './type';

export class Signature {
    constructor(readonly ref: format.RtSignature) {
    }

    private _returnType: Type;

    get returnType() {
        return this._returnType ??= Type.createFromRtRef(this.ref.r);
    }

    private _parameters: Parameter[];

    get parameters() {
        return this._parameters ??= (this.ref.p ?? []).map((p, i) => new Parameter(p, i));
    }

    /**
     * Returns true if this signature is assignable from a function of the given signature.
     * @param other
     */
    assignableFrom(other: Signature) {
        for (let i = 0, max = this.parameters.length; i < max; ++i) {
            let myParam = this.parameters[i];
            let otherParam = other.parameters[i];

            if (!otherParam && myParam.isOptional)
                return true;

            if (myParam.isRest) {
                if (!myParam.type.as('array').assignableFrom(TupleType.of(...other.parameters.slice(i).map(x => x.type)))) {
                    return false;
                }
            }

            if (!myParam.type.assignableFrom(otherParam.type))
                return false;
        }

        return true;
    }
}
