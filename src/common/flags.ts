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

export type RtSimpleType<T>   = { TΦ: T };
export type RtVoidType        = RtSimpleType<typeof T_VOID>;
export type RtUnknownType     = RtSimpleType<typeof T_UNKNOWN>
export type RtAnyType         = RtSimpleType<typeof T_ANY>;
export type RtThisType        = RtSimpleType<typeof T_THIS>;

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