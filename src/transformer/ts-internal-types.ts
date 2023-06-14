/**
 * Contains types that are marked as internal within Typescript.
 * It's not clear why these are marked as internal where most others are not,
 * particularly MappedType.
 */

import * as ts from 'typescript';

export const enum TypeMapKind {
    Simple,
    Array,
    Function,
    Composite,
    Merged,
}

export const enum InternalNodeFlags {
    PossiblyContainsDynamicImport = 1 << 21,
    PossiblyContainsImportMeta    = 1 << 22,
    Ambient                       = 1 << 24, // If node was inside an ambient context -- a declaration file, or inside something with the `declare` modifier.
    InWithStatement               = 1 << 25, // If any ancestor of node was the `statement` of a WithStatement (not the `expression`)
    TypeCached                    = 1 << 27, // If a type was cached for node at any point
    Deprecated                    = 1 << 28, // If has '@deprecated' JSDoc tag
}

export type TypeMapper =
    | { kind: TypeMapKind.Simple, source: ts.Type, target: ts.Type; }
    | { kind: TypeMapKind.Array, sources: readonly ts.Type[], targets: readonly ts.Type[] | undefined; }
    | { kind: TypeMapKind.Function, func: (t: ts.Type) => ts.Type; }
    | { kind: TypeMapKind.Composite | TypeMapKind.Merged, mapper1: TypeMapper, mapper2: TypeMapper; };

// An instantiated anonymous type has a target and a mapper
export interface AnonymousType extends ts.ObjectType {
    target?: AnonymousType;  // Instantiation target
    mapper?: TypeMapper;     // Instantiation mapper
    instantiations?: Map<string, ts.Type>; // Instantiations of generic type alias (undefined if non-generic)
}
export interface MappedType extends AnonymousType {
    declaration: ts.MappedTypeNode;
    typeParameter?: ts.TypeParameter;
    constraintType?: ts.Type;
    nameType?: ts.Type;
    templateType?: ts.Type;
    modifiersType?: ts.Type;
    resolvedApparentType?: ts.Type;
    containsError?: boolean;
}

export enum TypeReferenceSerializationKind {
    // The TypeReferenceNode could not be resolved.
    // The type name should be emitted using a safe fallback.
    Unknown,

    // The TypeReferenceNode resolves to a type with a constructor
    // function that can be reached at runtime (e.g. a `class`
    // declaration or a `var` declaration for the static side
    // of a type, such as the global `Promise` type in lib.d.ts).
    TypeWithConstructSignatureAndValue,

    // The TypeReferenceNode resolves to a Void-like, Nullable, or Never type.
    VoidNullableOrNeverType,

    // The TypeReferenceNode resolves to a Number-like type.
    NumberLikeType,

    // The TypeReferenceNode resolves to a BigInt-like type.
    BigIntLikeType,

    // The TypeReferenceNode resolves to a String-like type.
    StringLikeType,

    // The TypeReferenceNode resolves to a Boolean-like type.
    BooleanType,

    // The TypeReferenceNode resolves to an Array-like type.
    ArrayLikeType,

    // The TypeReferenceNode resolves to the ESSymbol type.
    ESSymbolType,

    // The TypeReferenceNode resolved to the global Promise constructor symbol.
    Promise,

    // The TypeReferenceNode resolves to a Function type or a type with call signatures.
    TypeWithCallSignature,

    // The TypeReferenceNode resolves to any other type.
    ObjectType,
}
