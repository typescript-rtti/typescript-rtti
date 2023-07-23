import * as format from '../../common/format';
import { MatchesValueOptions } from './matches-values-options';
import { TupleElement } from './tuple-element';
import { Type } from './type';

@Type.Kind('tuple')
export class TupleType extends Type<format.RtTupleType> {
    get kind() { return 'tuple' as const; }
    toString() { return `[${this.elements.join(', ')}]`; }

    private _elements: TupleElement[];
    get elements(): TupleElement[] {
        if (this._elements)
            return this._elements;
        return this._elements = (this.ref.e || []).map(e => new TupleElement(e));
    }

    protected override matches(ref : this) {
        if (this.elements.length !== ref.elements.length)
            return false;
        return this.elements.every((x, i) => x.name === ref.elements[i].name && x.type.equals(ref.elements[i].type));
    }

    override matchesValue(value: any, options?: MatchesValueOptions): boolean {
        options ??= {};
        options.errors ??= [];
        if (!Array.isArray(value)) {
            options.errors.push(new Error(`Value must be an array`));
            return false;
        }

        let array = <any[]>value;

        if (array.length !== this.elements.length) {
            options.errors.push(new Error(`Array must have ${this.elements.length} values to match tuple type`));
            return false;
        }

        return this.elements.every((v, i) => v.type.matchesValue(array[i], options));
    }

    static of(...elements: (TupleElement | Type)[]) {
        return TupleType.createFromRtRef({
            TΦ: format.T_TUPLE,
            e: elements.map(e => e instanceof Type ? TupleElement.of(e) : e)
        });
    }
}
