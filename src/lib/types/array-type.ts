import * as format from '../../common/format';
import { MatchesValueOptions } from './matches-values-options';
import { Type } from './type';

@Type.Kind('array')
export class ArrayType extends Type<format.RtArrayType> {
    get kind() { return 'array' as const; }
    toString() { return `${this.elementType}[]`; }

    private _elementType: Type;
    get elementType(): Type {
        if (this._elementType)
            return this._elementType;

        return this._elementType = Type.createFromRtRef(this.ref.e);
    }

    protected override matches(ref : this) {
        return this.elementType.equals(ref.elementType);
    }

    override assignableFrom(type: Type) {
        if (type.is('tuple')) {
            return type.elements.every(element => this.elementType.assignableFrom(element.type));
        } else if (type.is('array')) {
            return this.elementType.assignableFrom(type.elementType);
        } else if (type.is('any')) {
            return true;
        }

        return false;
    }

    override matchesValue(value: any, options?: MatchesValueOptions): boolean {
        options ??= {};
        options.errors ??= [];

        if (!Array.isArray(value)) {
            options.errors.push(new TypeError(`Value should be an array`));
            return false;
        }

        return (value as any[]).every(value => this.elementType.matchesValue(value, options));
    }

    static of(type: Type) {
        const arrayType = ArrayType.createFromRtRef({
            TΦ: format.T_ARRAY,
            e: type.ref
        });
        arrayType._elementType = type;
        return arrayType;
    }
}
