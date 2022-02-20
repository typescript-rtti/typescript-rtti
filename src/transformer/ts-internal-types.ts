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

export type TypeMapper =
    | { kind: TypeMapKind.Simple, source: ts.Type, target: ts.Type }
    | { kind: TypeMapKind.Array, sources: readonly ts.Type[], targets: readonly ts.Type[] | undefined }
    | { kind: TypeMapKind.Function, func: (t: ts.Type) => ts.Type }
    | { kind: TypeMapKind.Composite | TypeMapKind.Merged, mapper1: TypeMapper, mapper2: TypeMapper };

// An instantiated anonymous type has a target and a mapper
export interface AnonymousType extends ts.ObjectType {
    target?: AnonymousType;  // Instantiation target
    mapper?: TypeMapper;     // Instantiation mapper
    instantiations?: ts.ESMap<string, ts.Type>; // Instantiations of generic type alias (undefined if non-generic)
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