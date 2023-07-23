import * as format from '../../common/format';
import { Parameter } from './parameter';
import { Visibility } from './visibility';

/**
 * Reflection data for a constructor parameter
 */
export class ConstructorParameter extends Parameter {
    constructor(
        readonly rawMetadata: format.RtParameter,
        readonly index: number
    ) {
        super(rawMetadata, index);
    }

    /**
     * True if this constructor parameter is declared readonly, meaning it is
     * also an instance property of the class.
     */
    get isReadonly() {
        return this.flags.isReadOnly;
    }

    /**
     * True if this constructor parameter is declared public, meaning it is
     * also an instance property of the class.
     */
    get isPublic() {
        return this.flags.isPublic;
    }

    /**
     * True if this constructor parameter is declared protected, meaning it is
     * also an instance property of the class.
     */
    get isProtected() {
        return this.flags.isProtected;
    }

    /**
     * True if this constructor parameter is declared private, meaning it is
     * also an instance property of the class.
     */
    get isPrivate() {
        return this.flags.isPrivate;
    }

    /**
     * Get visibility of this constructor parameter. If the constructor
     * parameter has no visibility modifiers, this is null.
     */
    get visibility(): Visibility {
        return this.isPublic ? 'public'
            : this.isProtected ? 'protected'
                : this.isPrivate ? 'private'
                    : null;
    }

    /**
     * True if the constructor parameter is also a property.
     */
    get isProperty() {
        return this.visibility !== null || this.isReadonly;
    }
}
