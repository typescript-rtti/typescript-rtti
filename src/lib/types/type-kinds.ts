import * as format from '../../common/format';

export type TypeKind = 'union' | 'intersection' | 'any'
    | 'unknown' | 'tuple' | 'array' | 'class' | 'any' | 'unknown' | 'generic' | 'mapped' | 'literal'
    | 'void' | 'interface' | 'null' | 'undefined' | 'true' | 'false' | 'object' | 'enum' | 'enum-literal'
    | 'function' | 'class' | 'interface';

export const TYPE_REF_KIND_EXPANSION: Record<string, TypeKind> = {
    [format.T_UNKNOWN]: 'unknown',
    [format.T_ANY]: 'any',
    [format.T_UNION]: 'union',
    [format.T_INTERSECTION]: 'intersection',
    [format.T_TUPLE]: 'tuple',
    [format.T_ARRAY]: 'array',
    [format.T_GENERIC]: 'generic',
    [format.T_VOID]: 'void',
    [format.T_NULL]: 'null',
    [format.T_UNDEFINED]: 'undefined',
    [format.T_MAPPED]: 'mapped',
    [format.T_ENUM]: 'enum',
    [format.T_ENUM_LITERAL]: 'enum-literal',
    [format.T_FALSE]: 'false',
    [format.T_TRUE]: 'true',
    [format.T_OBJECT]: 'object',
    [format.T_CLASS]: 'class',
    [format.T_INTERFACE]: 'interface',
    [format.T_FUNCTION]: 'function',
    [format.T_LITERAL]: 'literal'
};