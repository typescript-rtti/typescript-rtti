import * as format from '../../common/format';
import { Member } from './member';
import { Type } from './type';

export class ObjectMember extends Member {
    constructor(ref: format.RtObjectMember) {
        super(ref);
    }

    private _type: Type;
    get type() { return this._type ??= Type.createFromRtRef(this.ref.t); }

    override matches(member: this) {
        return this.name === member.name && this.type.equals(member.type);
    }

    toString() { return `${this.name}: ${this.type?.toString() ?? '<error>'}`; }
}
