import * as format from '../../common/format';
import { EnumType } from './enum-type';
import { Type } from './type';

@Type.Kind('enum-literal')
export class EnumLiteralType extends Type<format.RtEnumLiteralType> {
    get kind() { return 'enum-literal' as const; }
    toString() { return `${this.enum.name}.${this.name} [${this.value}]`; }

    private _enum: EnumType;

    get name() {
        return this.ref.n;
    }

    get enum() {
        return this._enum ??= EnumType.createFromRtRef(this.ref.e);
    }

    get value() {
        return this.ref.v;
    }
}
