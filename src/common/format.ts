import type * as ts from "typescript";

export const F_READONLY: 'R' = 'R';
export const F_ABSTRACT: 'A' = 'A';
export const F_PUBLIC: '$' = '$';
export const F_PRIVATE: '#' = '#';
export const F_PROTECTED: '@' = '@';
export const F_PROPERTY: 'P' = 'P';
export const F_METHOD: 'M' = 'M';
export const F_STATIC: 'S' = 'S';
export const F_CLASS: 'C' = 'C';
export const F_INTERFACE: 'I' = 'I';
export const F_FUNCTION: 'F' = 'F';
export const F_ARROW_FUNCTION: '>' = '>';
export const F_OPTIONAL: '?' = '?';
export const F_REST: '3' = '3';
export const F_ASYNC: 'a' = 'a';
export const F_EXPORTED: 'e' = 'e';
export const F_INFERRED: '.' = '.';
export const F_OMITTED: ',' = ',';

/* all allowed flags */
export type F_FLAG = typeof F_READONLY | typeof F_ABSTRACT | typeof F_PUBLIC
    | typeof F_PRIVATE | typeof F_PROTECTED | typeof F_PROPERTY | typeof F_METHOD
    | typeof F_STATIC | typeof F_CLASS | typeof F_INTERFACE | typeof F_FUNCTION
    | typeof F_ARROW_FUNCTION | typeof F_OPTIONAL | typeof F_REST | typeof F_ASYNC
    | typeof F_EXPORTED | typeof F_INFERRED | typeof F_OMITTED;

// TODO add flags validation when typescript regex type is implemented
// https://github.com/microsoft/TypeScript/issues/41160
export type F_FLAGS = `${F_FLAG}${F_FLAG}${F_FLAG}${string}` | '' | F_FLAG | `${F_FLAG}${F_FLAG}` | `${F_FLAG}${F_FLAG}${F_FLAG}`; // this type validate only the first 3 flags

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
export const T_STAND_IN: '5' = '5';
export const T_OBJECT: 'O' = 'O';
export const T_ENUM: 'e' = 'e';
export const T_FUNCTION: 'F' = 'F';
export const T_ALIAS: 'd' = 'd';
export const T_VARIABLE: 'v' = 'v';
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
export interface InterfaceToken<T = any> {
    name: string;
    prototype: any;
    identity: symbol;
}
export interface AliasToken<T = any> {
    name: string;
    identity: symbol;
}


export type RtType = RtIntrinsicType | RtObjectType | RtUnionType | RtIntersectionType | RtTupleType | RtArrayType
    | RtGenericType | RtMappedType | RtEnumType | RtCallSite | { TΦ: typeof T_STAND_IN } | RtFunctionType
    | Function | Literal | InterfaceToken | AliasToken | RtVariableType | RtAliasType;

export type RtBrandedType = {
    TΦ:
    typeof T_UNION | typeof T_INTERSECTION | typeof T_ANY | typeof T_UNKNOWN | typeof T_VOID | typeof T_UNDEFINED
    | typeof T_NULL | typeof T_TUPLE | typeof T_ARRAY | typeof T_THIS | typeof T_GENERIC | typeof T_MAPPED
    | typeof T_TRUE | typeof T_FALSE | typeof T_CALLSITE | typeof T_ENUM | typeof T_STAND_IN | typeof T_ALIAS;
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

export interface RtAliasType {
    TΦ: typeof T_ALIAS;
    name: string;
    a: ()=>AliasToken;
    t: RtType;
    p: Array<string> | undefined;
}

export interface RtVariableType {
    TΦ: typeof T_VARIABLE;
    name: string;
    t: RtType; // type reference
}

export interface RtUnionType {
    TΦ: typeof T_UNION;
    t: RtType[];
}

export interface RtObjectType {
    TΦ: typeof T_OBJECT;
    m: RtObjectMember[];
}

export interface RtFunctionType {
    TΦ: typeof T_FUNCTION;
    r: RtType;
    p: RtParameter[];
    f: F_FLAGS;
}
export interface RtObjectMember {
    n: string;
    f: F_FLAGS;
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
    t: RtType;
    p: RtType[];
}

export interface RtGenericType {
    TΦ: typeof T_GENERIC;
    t: RtType; // base type that can be another generic, alias ect
    p: RtType[];
}

export interface RtEnumType {
    TΦ: typeof T_ENUM;
    /**
     * This will be the runtime enum object, if it exists.
     * It will be undefined for const enums.
     */
    e: any;

    /**
     * Name of the enum
     */
    n?: string;

    /**
     * Values of the enum. Only provided for constant enums.
     */
    v?: Map<string,any>;
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
    t?: () => any;

    /**
     * The initializer for this parameter. Calling may cause side effects.
     * Only present if we are not an array/object binding
     */
    v?: () => any;

    /**
     * The flags for this parameter.
     */
    f?: F_FLAGS;
}

export interface LiteralSerializedNode {
    $__isTSNode: true;
    node: ts.Expression;
}

export interface CodeSerializedNode {
    $__isTSNode: true;
    code: string;
}

export type RtSerialized<T> = T | {
    [K in keyof T]: T[K] | RtSerialized<T[K]> | (T[K] extends Array<any> ? LiteralSerializedNode[] : LiteralSerializedNode) | typeof Object | Function;
};

export function isLiteralNode<T>(node: T | LiteralSerializedNode): node is LiteralSerializedNode {
    return !!node['$__isTSNode'];
}
export function isCodeNode<T>(node: T | CodeSerializedNode): node is CodeSerializedNode {
    return !!node['$__isTSNode'] && node['code'] !== undefined;
}
export function isStatementNode<T>(node: ts.Node): boolean {
    return node.hasOwnProperty('_statementBrand');
}

const handler = {
    construct() {
        return handler
    }
}

export const isConstructorFunction = x => {
    if (typeof x !== 'function') {
        return false;
    }
    try {
        return !!(new (new Proxy(x, handler))())
    } catch (e) {
        return false
    }
}

