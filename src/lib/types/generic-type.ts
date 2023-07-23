import * as format from '../../common/format';
import { MatchesValueOptions } from './matches-values-options';
import { Type } from './type';

@Type.Kind('generic')
export class GenericType extends Type<format.RtGenericType> {
    get kind() { return 'generic' as const; }
    toString() { return `${this.baseType}<${this.typeParameters.join(', ')}>`; }

    private _baseType: Type;
    get baseType(): Type {
        if (this._baseType)
            return this._baseType;
        return this._baseType = Type.createFromRtRef(this.ref.t);
    }

    private _typeParameters: Type[];
    get typeParameters(): Type[] {
        if (this._typeParameters)
            return this._typeParameters;
        return this._typeParameters = this.ref.p.map(p => Type.createFromRtRef(p));
    }

    protected override matches(ref : this) {
        if (this.typeParameters.length !== ref.typeParameters.length)
            return false;
        return this.typeParameters.every((x, i) => x.equals(ref.typeParameters[i]));
    }

    override matchesValue(value: any, options?: MatchesValueOptions): boolean {
        options ??= {};
        options.errors ??= [];
        return this.baseType.matchesValue(value, options);
    }
}
