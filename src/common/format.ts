import type * as ts from "typescript";

export const F_READONLY       = 'R';
export const F_ABSTRACT       = 'A';
export const F_PUBLIC         = '$';
export const F_PRIVATE        = '#';
export const F_PROTECTED      = '@';
export const F_PROPERTY       = 'P';
export const F_METHOD         = 'M';
export const F_STATIC         = 'S';
export const F_CLASS          = 'C';
export const F_INTERFACE      = 'I';
export const F_FUNCTION       = 'F';
export const F_ARROW_FUNCTION = '>';
export const F_OPTIONAL       = '?';
export const F_ASYNC          = 'a';
export const F_EXPORTED       = 'e';
export const F_INFERRED       = '.';

export const T_UNION          = '|';
export const T_INTERSECTION   = '&';
export const T_ANY            = '~';
export const T_UNKNOWN        = 'U';
export const T_VOID           = 'V';
export const T_UNDEFINED      = 'u';
export const T_NULL           = 'n';
export const T_TUPLE          = 'T';
export const T_ARRAY          = '[';
export const T_THIS           = 't';
export const T_GENERIC        = 'g';
export const T_MAPPED         = 'm';
export const T_TRUE           = '1';
export const T_FALSE          = '0';
export const T_CALLSITE       = 'c';
export const T_STAND_IN        = '5';

export type Literal = number | string;

export interface InterfaceToken<T = any> {
    name : string;
    prototype : any;
    identity : symbol;
}

export type RtType = RtBrandedType | Function | Literal | InterfaceToken;
export type RtBrandedType = { 
    TΦ: 
        typeof T_UNION
        | typeof T_INTERSECTION
        | typeof T_ANY
        | typeof T_UNKNOWN
        | typeof T_VOID
        | typeof T_UNDEFINED
        | typeof T_NULL
        | typeof T_TUPLE
        | typeof T_ARRAY
        | typeof T_THIS
        | typeof T_GENERIC
        | typeof T_MAPPED
        | typeof T_TRUE
        | typeof T_FALSE
        | typeof T_CALLSITE
        | typeof T_STAND_IN
};

export type RtIntrinsicType<T> = { TΦ: T };
export type RtVoidType         = RtIntrinsicType<typeof T_VOID>;
export type RtNullType         = RtIntrinsicType<typeof T_NULL>;
export type RtUndefinedType    = RtIntrinsicType<typeof T_UNDEFINED>;
export type RtFalseType        = RtIntrinsicType<typeof T_FALSE>;
export type RtTrueType         = RtIntrinsicType<typeof T_TRUE>;
export type RtUnknownType      = RtIntrinsicType<typeof T_UNKNOWN>;
export type RtAnyType          = RtIntrinsicType<typeof T_ANY>;
export type RtThisType         = RtIntrinsicType<typeof T_THIS>;

export interface RtUnionType {
    TΦ : typeof T_UNION;
    t : RtType[];
}

export interface RtIntersectionType {
    TΦ : typeof T_INTERSECTION;
    t : RtType[];
}

export interface RtArrayType {
    TΦ : typeof T_ARRAY;
    e : RtType;
}

export interface RtTupleElement {
    n : string;
    t : RtType;
}

export interface RtTupleType {
    TΦ : typeof T_TUPLE;
    e : RtTupleElement[];
}

export interface RtGenericType {
    TΦ : typeof T_GENERIC;
    t : RtType;
    p : RtType[];
}

export interface RtParameter {
    n : string;
    t : () => any;
    v : () => any;
    f? : string;
}

export interface LiteralSerializedNode {
    $__isTSNode: true;
    node: ts.Node;
}

export type RtSerialized<T> = {
    [K in keyof T] : T[K] | LiteralSerializedNode;
}