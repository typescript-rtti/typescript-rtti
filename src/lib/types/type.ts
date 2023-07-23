import * as format from '../../common/format';
import { TypeKind, TYPE_REF_KIND_EXPANSION } from './type-kinds';
import { Constructor } from '../constructor';
import { isBuiltIn } from '../utils';
import { MatchesValueOptions } from './matches-values-options';

import type { AnyType } from './any-type';
import type { ArrayType } from './array-type';
import type { ClassType } from './class-type';
import type { EnumLiteralType } from './enum-literal-type';
import type { EnumType } from './enum-type';
import type { FalseType } from './false-type';
import type { FunctionType } from './function-type';
import type { GenericType } from './generic-type';
import type { InterfaceType } from './interface-type';
import type { IntersectionType } from './intersection-type';
import type { LiteralType } from './literal-type';
import type { MappedType } from './mapped-type';
import type { NullType } from './null-type';
import type { ObjectType } from './object-type';
import type { StructuralType } from './structural-type';
import type { TrueType } from './true-type';
import type { TupleElement } from './tuple-element';
import type { TupleType } from './tuple-type';
import type { UndefinedType } from './undefined-type';
import type { UnionType } from './union-type';
import type { UnknownType } from './unknown-type';
import type { VoidType } from './void-type';
import { getParameterNames } from '../get-parameter-names';
import { synthesizeClassRef } from './synthesis';

export class Type<T extends format.RtType = format.RtType> {
    /** @internal */
    constructor(
        private _ref: T
    ) {
    }

    /**
     * @internal
     */
    static getTypeRef(value) {
        // Handle well known intrinsics

        if (value === void 0)             return { TΦ: format.T_UNDEFINED };
        if (value === null)               return { TΦ: format.T_NULL };
        if (value === true)               return { TΦ: format.T_TRUE };
        if (value === false)              return { TΦ: format.T_FALSE };
        if (!['object', 'function'].includes(typeof value))
            return { TΦ: format.T_LITERAL, v: value };

        // Check for a reflected typeref

        let ref = Reflect.getMetadata('rtti:type', typeof value === 'object' ? value.constructor : value)?.();

        // If we don't have a reflected type ref, we must synthesize one

        if (!ref && typeof value === 'object' && isBuiltIn(value.constructor)) {
            ref = { TΦ: format.T_CLASS, n: value.constructor.name, C: value.constructor, m: [] };
        }

        if (!ref && typeof value === 'function' && !value.prototype) {
            return {
                TΦ: format.T_FUNCTION,
                n: value.name,
                f: '',
                p: getParameterNames(value).map(n => (<format.RtParameter>{ n })),
                r: { TΦ: format.T_ANY }
            };
        }

        if (!ref) {
            if (typeof value === 'function') {
                ref = synthesizeClassRef(value);
            } else {
                ref = synthesizeClassRef(value.constructor);
            }
        }

        return ref;
    }

    toString() {
        return `[${this.kind} type]`;
    }

    /** @internal */
    static Kind(kind: TypeKind) {
        return (target) => {
            Type.kinds[kind] = target;
        };
    }

    /**
     * Check if the given value matches this type reference. Collects any errors into the `errors` list.
     * @param value
     * @param errors
     * @param context
     * @returns
     */
    matchesValue(value, options?: MatchesValueOptions) {
        options ??= {};
        options.errors ??= [];
        options.errors.push(new Error(`No validation available for type with kind '${this.kind}'`));
        return false;
    }

    /**
     * Returns true if the given type can be assigned to this type.
     * @param type
     */
    assignableFrom(type: Type) {
        return false;
    }

    /**
     * Check if the given type reference is equivalent to this type reference.
     * @param ref
     * @returns
     */
    equals(ref : this) {
        if (this === ref)
            return true;

        if (ref.constructor !== this.constructor)
            return false;

        return this.matches(ref);
    }

    protected matches(ref : this) {
        if (!(ref instanceof this.constructor))
            return false;

        return true;
    }

    private static kinds: Record<TypeKind, Constructor<Type>> = <any>{};

    get kind(): TypeKind {
        let ref = this._ref;
        if (ref === null || ['string', 'number', 'bigint'].includes(typeof ref))
            return 'literal';

        if (typeof ref === 'object' && 'TΦ' in ref)
            return TYPE_REF_KIND_EXPANSION[(<format.RtBrandedType>ref).TΦ];

        if (typeof ref === 'object')
            return 'interface';

        return 'class';
    }

    /** @internal */
    get ref(): Readonly<T> {
        return this._ref;
    }

    /**
     * Checks if this type reference is a Promise, optionally a Promise of a specific type.
     * If the type reference does not specify a type of Promise but you have provided a type
     * to check for, this will return false.
     * @param klass The type of promise to check for. Would be String when looking for Promise<string>
     */
    isPromise(): this is GenericType {
        if (this.isGeneric() && this.baseType.isBuiltinClass(Promise))
            return true;
        return false;
    }

    /**
     * True if the type is considered to be an instance of the given constructor.
     * This does not mean this type is a ClassType, since literals and other more
     * specialized types are not represented by ClassType.
     * @param klass
     */
    isBuiltinClass<T>(klass?: Constructor<T> | BigIntConstructor): this is ClassType {
        if (this.isClass()) {
            return isBuiltIn(klass) && this.class === klass;
        }

        return false;
    }

    /**
     * Checks if this type reference is a class. Note: If the class reference has type parameters,
     * (ie it is generic) this check will fail, and instead isGeneric() will succeed.
     * @param klass
     */
    isClass(): this is ClassType {
        return this.kind === 'class';
    }

    isTypeLiteral(): this is ObjectType {
        return this.kind === 'object';
    }

    isStructural(): this is StructuralType {
        return ['object', 'interface', 'class', 'mapped'].includes(this.kind);
    }

    isInterface(): this is InterfaceType {
        return this.kind === 'interface';
    }

    /**
     * Checks if this type is a literal type (null/true/false or a string/number literal).
     * Caution: You cannot use this to check for `undefined`. Use `isUndefined()` instead.
     * @param value
     * @returns
     */
    isLiteral(value: null): this is NullType;
    isLiteral(value: undefined): this is UndefinedType;
    isLiteral(value: true): this is TrueType;
    isLiteral(value: false): this is FalseType;
    isLiteral<T extends format.Literal>(value: T): this is LiteralType<T>;
    isLiteral(): this is LiteralType<any>;
    isLiteral(value: number | bigint | string): boolean;
    isLiteral(...args): boolean {
        if (args.length > 0) {
            let value = args[0];
            if (value === null) return this.isNull();
            if (value === true) return this.isTrue();
            if (value === false) return this.isFalse();

            if (this.isLiteral())
                return this.ref.v === value;
            else
                return false;
        } else {
            return this.kind === 'literal';
        }
    }


    /** Check if this type reference is a function type      */ is(kind: 'function'): this is FunctionType;
    /** Check if this type reference is an interface type    */ is(kind: 'interface'): this is InterfaceType;
    /** Check if this type reference is a class type         */ is(kind: 'class'): this is ClassType;
    /** Check if this type reference is a generic type       */ is(kind: 'generic'): this is GenericType;
    /** Check if this type reference is an array type        */ is(kind: 'array'): this is ArrayType;
    /** Check if this type reference is an intersection type */ is(kind: 'intersection'): this is IntersectionType;
    /** Check if this type reference is a union type         */ is(kind: 'union'): this is UnionType;
    /** Check if this type reference is an enum type         */ is(kind: 'enum'): this is EnumType;
    /** Check if this type reference is an enum literal type */ is(kind: 'enum-literal'): this is EnumLiteralType;
    /** Check if this type reference is a tuple type         */ is(kind: 'tuple'): this is TupleType;
    /** Check if this type reference is a void type          */ is(kind: 'void'): this is VoidType;
    /** Check if this type reference is an any type          */ is(kind: 'any'): this is AnyType;
    /** Check if this type reference is a false type         */ is(kind: 'false'): this is FalseType;
    /** Check if this type reference is a true type          */ is(kind: 'true'): this is TrueType;
    /** Check if this type reference is an undefined type    */ is(kind: 'undefined'): this is UndefinedType;
    /** Check if this type reference is a null type          */ is(kind: 'null'): this is NullType;
    /** Check if this type reference is an unknown type      */ is(kind: 'unknown'): this is UnknownType;
    /** Check if this type reference is an mapped type       */ is(kind: 'mapped'): this is MappedType;
    /** Check if this type reference is a structural type    */ is(kind: 'object'): this is ObjectType;
    /** Check if this type reference is a literal type       */ is(kind: 'literal'): this is LiteralType<any>;
    /**
     * Check if this type reference is an instance of the given Type subclass.
     * @param type The subclass of Type to check
     */
    is<T, U extends T>(this: T, type: Constructor<U>): this is U;
    is(this, kind: TypeKind | Constructor<any>): boolean {
        if (typeof kind === 'function')
            return this instanceof kind;
        else if (typeof kind === 'string')
            return this.kind === kind;
    }

    /**
     * Assert that this type reference is an interface type and cast it to InterfaceType.
     * If the reference is not the correct type an error is thrown.
     */
     as(kind: 'interface'): InterfaceType;
     /**
      * Assert that this type reference is a Function type and cast it to FunctionType.
      * If the reference is not the correct type an error is thrown.
      */
     as(kind: 'function'): FunctionType;
    /**
     * Assert that this type reference is a class type and cast it to ClassType.
     * If the reference is not the correct type an error is thrown.
     */
    as<T = any>(kind: 'class'): ClassType;
    /**
     * Assert that this type reference is a generic type and cast it to GenericType.
     * If the reference is not the correct type an error is thrown.
     */
    as<T = any>(kind: 'generic'): GenericType;
    /**
     * Assert that this type reference is an enum type and cast it to EnumType.
     * If the reference is not the correct type an error is thrown. Given `enum Foo { Bar = 1 }`,
     * an enum type would be `Foo` (as opposed to `Foo.Bar`, which is an enum literal type)
     */
    as<T = any>(kind: 'enum'): EnumType;
    /**
     * Assert that this type reference is an enum literal type and cast it to EnumLiteralType.
     * If the reference is not the correct type an error is thrown. Given `enum Foo { Bar = 1 }`,
     * an enum literal type would be `Foo.Bar` (as opposed to `Foo`, which is an enum type)
     */
    as<T = any>(kind: 'enum-literal'): EnumLiteralType;
    /**
     * Assert that this type reference is an array type and cast it to ArrayType.
     * If the reference is not the correct type an error is thrown.
     */
    as(kind: 'array'): ArrayType;
    /**
     * Assert that this type reference is an intersection type and cast it to IntersectionType.
     * If the reference is not the correct type an error is thrown.
     */
    as(kind: 'intersection'): IntersectionType;
    /**
     * Assert that this type reference is a union type and cast it to UnionType.
     * If the reference is not the correct type an error is thrown.
     */
    as(kind: 'union'): UnionType;
    /**
     * Assert that this type reference is a tuple type and cast it to TupleType.
     * If the reference is not the correct type an error is thrown.
     */
    as(kind: 'tuple'): TupleType;
    /**
     * Assert that this type reference is a void type and cast it to VoidType.
     * If the reference is not the correct type an error is thrown.
     */
    as(kind: 'void'): VoidType;
    /**
     * Assert that this type reference is a void type and cast it to UnknownType.
     * If the reference is not the correct type an error is thrown.
     */
    as(kind: 'unknown'): UnknownType;
    /**
     * Assert that this type reference is a void type and cast it to AnyType.
     * If the reference is not the correct type an error is thrown.
     */
    as(kind: 'any'): AnyType;
    /**
     * Assert that this type reference is a void type and cast it to LiteralType.
     * If the reference is not the correct type an error is thrown.
     */
    as(kind: 'literal'): LiteralType;
    /**
     * Assert that this type reference is the given Type subclass.
     * If the reference is not the correct type an error is thrown.
     */
    as<T, U extends T>(this: T, subclass: Constructor<U>): U;
    as(this, subclass: TypeKind | Constructor<any>) {
        if (typeof subclass === 'function' && !(this instanceof subclass))
            throw new TypeError(`Value of type ${this.constructor.name} cannot be converted to ${subclass.name}`);
        else if (typeof subclass === 'string' && this.kind !== subclass)
            throw new TypeError(`Type has kind ${this.kind}, expected ${subclass}`);
        return this;
    }

    isVoid(): this is VoidType { return this.kind === 'void'; }
    isNull(): this is NullType { return this.kind === 'null'; }
    isUndefined(): this is UndefinedType { return this.kind === 'undefined'; }
    isTrue(): this is TrueType { return this.kind === 'true'; }
    isFalse(): this is FalseType { return this.kind === 'false'; }
    isStringLiteral(): this is LiteralType<string> { return this.kind === 'literal' && typeof this.ref === 'string'; }
    isNumberLiteral(): this is LiteralType<number> { return this.kind === 'literal' && typeof this.ref === 'number'; }
    isBigIntLiteral(): this is LiteralType<bigint> { return this.kind === 'literal' && typeof this.ref === 'bigint'; }
    isBooleanLiteral(): this is LiteralType<number> { return this.isTrue() || this.isFalse(); }

    /**
     * Check if this type reference is a generic type, optionally checking if the generic's
     * base type is the given class. For instance isGeneric(Promise) is true for Promise<string>.
     * @param klass
     */
    isGeneric(): this is GenericType {
        return this.kind === 'generic';
    }

    isUnion(elementDiscriminator?: (elementType: Type) => boolean): this is UnionType {
        return elementDiscriminator
            ? this.isUnion() && this.types.every(e => elementDiscriminator(e))
            : this.kind === 'union';
    }

    isIntersection(elementDiscriminator?: (elementType: Type) => boolean): this is IntersectionType {
        return elementDiscriminator
            ? this.isIntersection() && this.types.every(e => elementDiscriminator(e))
            : this.kind === 'intersection';
    }

    isArray(elementDiscriminator?: (elementType: Type) => boolean): this is ArrayType {
        return elementDiscriminator
            ? this.isArray() && elementDiscriminator(this.elementType)
            : this.kind === 'array'
            ;
    }

    isTuple(elementDiscriminators?: ((elementType: TupleElement) => boolean)[]): this is TupleType {
        return elementDiscriminators
            ? this.isTuple() && this.elements.every((e, i) => elementDiscriminators[i](e))
            : this.kind === 'tuple';
    }

    isUnknown() {
        return this.kind === 'unknown';
    }

    isAny() {
        return this.kind === 'any';
    }

    static from<T>(this: Constructor<T>, value: any): T {
        if (this !== <Constructor<Type>>Type) {
            let kind = Object.entries(Type.kinds)
                .filter(([kind, ctor]) => ctor === this)
                .map(([kind, ctor]) => kind)[0];
            let rtKind = Object.entries(TYPE_REF_KIND_EXPANSION)
                .filter(([_, K]) => kind === K)
                .map(([rtKind, _]) => rtKind)[0];

            let ref = Type.getTypeRef(value);
            if (ref?.TΦ !== rtKind)
                throw new Error(`Value is of kind '${ref?.TΦ ?? '<none>'}' not '${kind}'`);

            return <T>Type.createFromRtRef(ref);
        }

        return <T>Type.createFromRtRef(Type.getTypeRef(value));
    }

    /**
     * Creates an "unknown"
     * @internal
     */
    static createUnknown() {
        return this.createFromRtRef({ TΦ: format.T_UNKNOWN });
    }

    static getTypeKindConstructor<T extends Type<format.RtType>>(kind: TypeKind): Constructor<T> & typeof Type {
        return <Constructor<T> & typeof Type>(this.kinds[kind] ?? Type);
    }

    /** @internal */
    static createFromRtRef<T>(this: Constructor<T>, ref: format.RtType): T {
        if (ref === undefined)
            return undefined;
        if (ref === null)
            return null;

        let kind: TypeKind;

        if (ref === null || !['object', 'function'].includes(typeof ref))
            kind = 'literal';
        else if (typeof ref === 'object' && 'TΦ' in <object>ref)
            kind = TYPE_REF_KIND_EXPANSION[(ref as format.RtBrandedType).TΦ];
        else if (typeof ref === 'object')
            kind = 'interface';
        else
            kind = 'class';

        return <T> new (Type.getTypeKindConstructor(kind))(ref);
    }
}
