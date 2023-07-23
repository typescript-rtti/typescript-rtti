import type * as ts from "typescript";

export const F_READONLY: 'R' = 'R';
export const F_ABSTRACT: 'A' = 'A';
export const F_PUBLIC: '$' = '$';
export const F_PRIVATE: '#' = '#';
export const F_PROTECTED: '@' = '@';
export const F_PROPERTY: 'P' = 'P';
export const F_METHOD: 'M' = 'M';
export const F_STATIC: 'S' = 'S';
export const F_CONSTRUCTOR: '+' = '+';
export const F_PARAMETER: 'p' = 'p';
export const F_FUNCTION: 'F' = 'F';
export const F_ARROW_FUNCTION: '>' = '>';
export const F_OPTIONAL: '?' = '?';
export const F_REST: '3' = '3';
export const F_ASYNC: 'a' = 'a';
export const F_EXPORTED: 'e' = 'e';
export const F_INFERRED: '.' = '.';
export const F_OMITTED: ',' = ',';
export const F_GET_ACCESSOR: 'G' = 'G';
export const F_DEFAULT_LIB: 'D' = 'D';
export const F_SET_ACCESSOR: 's' = 's';
export const F_ACCESSOR: '/' = '/';

export type RtMemberBrand = typeof F_PROPERTY | typeof F_METHOD | typeof F_CONSTRUCTOR;

/**
 * Flag attached to parameters which indicates that the parameter
 * is actually an array binding expression (aka destructured assignment).
 */
export const F_ARRAY_BINDING: '[' = '[';

/**
 * Flag attached to parameters which indicates that the parameter
 * is actually an object binding expression (aka destructured assignment).
 */
export const F_OBJECT_BINDING: 'O' = 'O';

export const T_UNION: '|' = '|';
export const T_INTERSECTION: '&' = '&';
export const T_ANY: '~' = '~';
export const T_UNKNOWN: 'U' = 'U';
export const T_VOID: 'V' = 'V';
export const T_UNDEFINED: 'u' = 'u';
export const T_NULL: 'n' = 'n';
export const T_TUPLE: 'T' = 'T';
export const T_ARRAY: '[' = '[';
export const T_THIS: 't' = 't';
export const T_GENERIC: 'g' = 'g';
export const T_MAPPED: 'm' = 'm';
export const T_TRUE: '1' = '1';
export const T_FALSE: '0' = '0';
export const T_CALLSITE: 'c' = 'c';
export const T_OBJECT: 'O' = 'O';
export const T_ENUM: 'e' = 'e';
export const T_ENUM_LITERAL: 'E' = 'E';
export const T_FUNCTION: 'F' = 'F';
export const T_CLASS: 'C' = 'C';
export const T_INTERFACE: 'I' = 'I';
export const T_LITERAL: 'L' = 'L';
export const T_INTRINSICS = [T_VOID, T_ANY, T_UNKNOWN, T_UNDEFINED, T_TRUE, T_FALSE, T_THIS, T_NULL];

export const TI_VOID: RtIntrinsicType = { TΦ: T_VOID };
export const TI_ANY: RtIntrinsicType = { TΦ: T_ANY };
export const TI_UNKNOWN: RtIntrinsicType = { TΦ: T_UNKNOWN };
export const TI_UNDEFINED: RtIntrinsicType = { TΦ: T_UNDEFINED };
export const TI_TRUE: RtIntrinsicType = { TΦ: T_TRUE };
export const TI_FALSE: RtIntrinsicType = { TΦ: T_FALSE };
export const TI_THIS: RtIntrinsicType = { TΦ: T_THIS };
export const TI_NULL: RtIntrinsicType = { TΦ: T_NULL };
export type Literal = number | string | bigint;

/**
 * Represents a type within the serialized emit RTTI format.
 */
export type RtType = RtIntrinsicType | RtObjectType | RtUnionType | RtClassType | RtInterfaceType
    | RtIntersectionType | RtTupleType | RtArrayType | RtGenericType | RtMappedType | RtEnumType | RtEnumLiteralType | RtCallSite
    | RtFunctionType | RtLiteralType
;

export type RtBrandedType = {
    TΦ:
    typeof T_UNION | typeof T_INTERSECTION | typeof T_ANY | typeof T_UNKNOWN | typeof T_VOID | typeof T_UNDEFINED
    | typeof T_NULL | typeof T_TUPLE | typeof T_ARRAY | typeof T_THIS | typeof T_GENERIC | typeof T_MAPPED
    | typeof T_TRUE | typeof T_FALSE | typeof T_CALLSITE | typeof T_ENUM | typeof T_CLASS | typeof T_INTERFACE;
};

export type RtIntrinsicIndicator = typeof T_VOID | typeof T_ANY | typeof T_UNKNOWN | typeof T_UNDEFINED | typeof T_TRUE | typeof T_FALSE | typeof T_THIS | typeof T_NULL;
export type RtIntrinsicType<T extends RtIntrinsicIndicator = RtIntrinsicIndicator> = { TΦ: T; };
export type RtVoidType = RtIntrinsicType<typeof T_VOID>;
export type RtNullType = RtIntrinsicType<typeof T_NULL>;
export type RtUndefinedType = RtIntrinsicType<typeof T_UNDEFINED>;
export type RtFalseType = RtIntrinsicType<typeof T_FALSE>;
export type RtTrueType = RtIntrinsicType<typeof T_TRUE>;
export type RtUnknownType = RtIntrinsicType<typeof T_UNKNOWN>;
export type RtAnyType = RtIntrinsicType<typeof T_ANY>;
export type RtThisType = RtIntrinsicType<typeof T_THIS>;

export interface RtCallSite {
    TΦ: typeof T_CALLSITE;

    /**
     * Type of `this`. Not currently supported, always undefined.
     */
    t: RtType;

    /**
     * Parameter types of the call
     */
    p: RtType[];

    /**
     * Type parameters (generics)
     */
    tp: RtType[];
    r: RtType;
}

export interface RtUnionType {
    TΦ: typeof T_UNION;
    t: RtType[];
}

export interface RtClassType {
    TΦ: typeof T_CLASS;
    n?: string;

    f?: string;

    /**
     * The constructor itself, if it was available during compilation.
     * Builtins (ie String, Number) are always provided.
     */
    C?: Function;

    /**
     * Implements
     */
    i?: RtInterfaceType[];

    /**
     * Extends
     */
    e?: RtClassType;
    m: RtObjectMember[];
}

export interface RtInterfaceType {
    TΦ: typeof T_INTERFACE;
    n?: string;
    f?: string;

    /**
     * Extends
     */
    e?: RtInterfaceType[];
    m: RtObjectMember[];
}

export interface RtObjectType {
    TΦ: typeof T_OBJECT;
    n?: string;
    m: RtObjectMember[];
    c: RtSignature[];
}

export interface RtLiteralType {
    TΦ: typeof T_LITERAL;
    v: any;
}

export interface RtSignature {
    p: RtParameter[];
    r: RtType;
    f?: string;
}

export interface RtFunctionType extends RtSignature {
    TΦ: typeof T_FUNCTION;
    n?: string;
}
export interface RtObjectMember {
    n: string;
    f: string;
    t: RtType;
}

export interface RtIntersectionType {
    TΦ: typeof T_INTERSECTION;
    t: RtType[];
}

export interface RtArrayType {
    TΦ: typeof T_ARRAY;
    e: RtType;
}

export interface RtTupleElement {
    n: string;
    t: RtType;
}

export interface RtTupleType {
    TΦ: typeof T_TUPLE;
    e: RtTupleElement[];
}

export interface RtMappedType {
    TΦ: typeof T_MAPPED;

    /**
     * The underlying mapped type
     */
    t: RtType;

    /**
     * Generic parameters of this type
     */
    p: RtType[];

    /**
     * The resulting object members after applying the mapped type
     */
    m?: RtObjectMember[];
}

export interface RtGenericType {
    TΦ: typeof T_GENERIC;
    t: RtType;
    p: RtType[];
}

export interface RtEnumType {
    TΦ: typeof T_ENUM;

    /**
     * Name of the enum
     */
    n?: string;

    /**
     * Values of the enum. Only provided for constant enums.
     */
    v?: Record<string,any>;
}

export interface RtEnumLiteralType {
    TΦ: typeof T_ENUM_LITERAL;
    n: string;
    e: RtEnumType;
    v: any;
}

/**
 * Represents an encoded function/method parameter.
 */
export interface RtParameter {
    /**
     * Name of the parameter. Not present when this parameter is an array or object binding.
     */
    n?: string;

    /**
     * Whether this parameter is an array ('a') or object ('o') binding. Additionally RtParameters
     * which have `bt` set to ',' are omitted expressions (only valid in array binding expressions).
     * Array binding is Typescript's name for "destructuring assignment", see
     * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring_assignment
     * for details.
     */
    bt?: 'a' | 'o' | ',';

    /**
     * The bindings for this parameter slot. Only present when `bt` is set to 'a' or 'o'
     * (meaning this parameter is an array or object binding, respectively)
     */
    b?: RtParameter[];

    /**
     * The type of this parameter.
     */
    t?: RtType;

    /**
     * The initializer for this parameter. Calling may cause side effects.
     * Only present if we are not an array/object binding
     */
    v?: () => any;

    /**
     * The flags for this parameter.
     */
    f?: string;
}

export interface LiteralSerializedNode {
    $__isTSNode: true;
    node: ts.Expression;
}

export type RtSerialized<T> = T | {
    [K in keyof T]: T[K] | RtSerialized<T[K]> | (T[K] extends Array<any> ? LiteralSerializedNode[] : LiteralSerializedNode);
};

export function isLiteralNode<T>(node: T | LiteralSerializedNode): node is LiteralSerializedNode {
    return !!node['$__isTSNode'];
}
