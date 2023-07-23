import * as format from '../../common/format';
import { Flags } from './flags';
import { Type } from './type';

/**
 * Reflection data for a parameter
 */
export class Parameter<ValueT = any> {
    constructor(
        readonly rawMetadata: format.RtParameter,
        readonly index: number
    ) {
    }

    private _flags: Flags;

    get isBinding() {
        return this.isArrayBinding || this.isObjectBinding;
    }

    /**
     * True if this parameter is an array binding expression (destructured assignment).
     */
    get isArrayBinding() {
        return this.flags.isArrayBinding;
    }

    /**
     * True if this parameter is an object binding expression (destructured assignment).
     */
    get isObjectBinding() {
        return this.flags.isObjectBinding;
    }

    /**
     * True if this parameter is an omitted slot within an array binding expression.
     * ie, if the user declares [foo, ,bar], then the second binding will have isOmitted true.
     * See: destructured assignment.
     */
    get isOmitted() {
        return this.flags.isOmitted;
    }

    private _bindings: Parameter[];

    /**
     * If this is an object/array binding (ie destructured assignment),
     * this will return the individual bindings that are part of this declaration.
     */
    get bindings() {
        if (!this.isBinding)
            return undefined;

        if (!this._bindings) {
            (this.rawMetadata.b || []).map((bindingElement, i) => new Parameter(bindingElement, i))
        }

        return this._bindings;
    }

    /**
     * Get the unmangled original name for this parameter. This may be undefined if the parameter is an array/object
     * binding expression (destructured assignment).
     */
    get name() {
        return this.rawMetadata.n;
    }

    private _type: Type;

    /**
     * Get the reflected type of this parameter
     */
    get type(): Type {
        if (this._type)
            return this._type;
        return this._type = Type.createFromRtRef(this.rawMetadata.t);
    }

    /**
     * Get flags that define aspects of this property.
     */
    get flags() {
        if (this._flags)
            return this._flags;

        return this._flags = new Flags(this.rawMetadata.f);
    }

    /**
     * True if this parameter is optional
     */
    get isOptional() {
        return this.flags.isOptional;
    }

    /**
     * True if this parameter is a rest parameter
     */
    get isRest() {
        return this.flags.isRest;
    }

    /**
     * Retrieve the initializer for this parameter. Invoking the initializer produces the
     * default value for the parameter. Caution: The initializer depends on the value of 'this'.
     * Use evaluateInitializer() to properly invoke the initializer.
     */
    get initializer(): () => ValueT {
        return this.rawMetadata.v;
    }

    /**
     * Evaluate the initializer for this parameter with the given value for 'this'. If not provided,
     * 'this' is an empty object. This is suitable for constructor parameters but instance method parameters
     * may reference properties of the object, and so getting the correct value may require passing an
     * appropriate instance.
     *
     * @param thisObject
     * @returns
     */
    evaluateInitializer(thisObject: any = {}) {
        return this.initializer.apply(thisObject, []);
    }

    /**
     * Check if this parameter declaration is identical to another parameter declaration (including its name).
     *
     * @param other The other parameter to check against
     * @param checkName If true, the name is checked, otherwise it is ignored
     * @returns
     */
    equals(other: Parameter, checkName = true) {
        return (!checkName || this.name === other.name)
            && this.type.equals(other.type)
            && this.flags.toString() === other.flags.toString()
        ;
    }
}
