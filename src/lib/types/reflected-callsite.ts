import { CallSite } from '../callsite';
import * as format from '../../common/format';
import { Type } from './type';

export class ReflectedCallSite {
    private constructor(callSite: CallSite) {
        this.callSite = <format.RtCallSite>callSite;
    }

    static from(callSite: CallSite | format.RtCallSite) {
        return new ReflectedCallSite(callSite);
    }

    private callSite: format.RtCallSite;

    private _parameters: Type[];

    get parameters() {
        if (!this._parameters)
            this._parameters = this.callSite.p.map(x => Type.createFromRtRef(x));
        return this._parameters;
    }

    private _typeParameters: Type[];

    get typeParameters() {
        if (!this._typeParameters) {
            this._typeParameters = this.callSite.tp.map(x => Type.createFromRtRef(x));
        }

        return this._typeParameters;
    }

    // private _target : Type;

    // get target() {
    //     if (!this._target)
    //         this._target = Type.createFromRtRef(this.callSite.t);
    //     return this._target;
    // }

    // private _return : Type;

    // get return() {
    //     if (!this._return)
    //         this._return = Type.createFromRtRef(this.callSite.r);
    //     return this._return;
    // }
}
