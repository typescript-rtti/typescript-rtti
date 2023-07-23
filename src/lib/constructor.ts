/**
 * Represents a constructor for a specific type.
 */
export interface Constructor<T> extends Function {
    new(...args): T;
}
