import * as format from '../common/format';
import { expect } from 'chai';
import { ClassType, FunctionType, InterfaceType, MatchesValueOptions, ObjectType, Type } from './types';

export function type(obj) {
    return Reflect.getMetadata('rtti:type', obj)?.();
}

export function member(type: format.RtClassType, name) {
    return type.m.find(x => x.n === name) as any;
}

export function union(...types) {
    return {
        TΦ: format.T_UNION,
        t: types
    };
}

export function arrayType(elementType) {
    return { TΦ: format.T_ARRAY, e: elementType };
}

export function tupleType(...elements: (Function | format.RtTupleElement)[]) {
    return { TΦ: format.T_TUPLE, e: elements.map(e => typeof e === 'function' ? { t: builtinClass(e) } : e) };
}

export function tupleElement(name: string, type): format.RtTupleElement {
    return { n: name, t: typeof type === 'function' ? builtinClass(type) : type };
}

export function intersection(...types) {
    return {
        TΦ: format.T_INTERSECTION,
        t: types
    }
}

export function literal(value) {
    if (value === null) return { TΦ: format.T_NULL };
    if (value === undefined) return { TΦ: format.T_UNDEFINED };
    if (value === true) return { TΦ: format.T_TRUE };
    if (value === false) return { TΦ: format.T_FALSE };

    return { TΦ: format.T_LITERAL, v: value };
}

export function voidType() {
    return { TΦ: format.T_VOID };
}

export function functionType(params: format.RtParameter[], returnType: format.RtType) {
    return <format.RtFunctionType>{
        TΦ: format.T_FUNCTION,
        f: '',
        p: params,
        r: returnType
    };
}

export function builtinClass(klass: Function) {
    return {
        TΦ: format.T_CLASS,
        C: klass,
        n: klass.name,
        i: [],
        m: [],
        f: `${format.F_DEFAULT_LIB}`
    };
}

export function thisType() {
    return { TΦ: format.T_THIS };
}

export function genericType(baseType: format.RtType, params: format.RtType[]) {
    return <format.RtGenericType>{
        TΦ: format.T_GENERIC,
        t: baseType,
        p: params
    };
}


export function expectValueToMatch(type: Type, value: any, options?: MatchesValueOptions) {
    let errors: Error[] = [];
    let matches = type.matchesValue(value, { ...options, errors })
    expect(matches, `Expected value to match, but there were errors: ${JSON.stringify(errors.map(e => e.message))}`)
        .to.be.true;
}

export function expectValueNotToMatch(type: Type, value: any, options?: MatchesValueOptions) {
    let errors: Error[] = [];
    let matches = type.matchesValue(value, { ...options, errors })
    expect(matches, `Expected value not to match, recorded errors: ${JSON.stringify(errors.map(e => e.message))}`)
        .to.be.false;
}

export function reflectClassType(type: Omit<format.RtClassType, 'TΦ'>) {
    return <ClassType>Type.createFromRtRef({ TΦ: format.T_CLASS, ...type });
}

export function reflectObjectType(type: Omit<format.RtObjectType, 'TΦ'>) {
    return <ObjectType>Type.createFromRtRef({ TΦ: format.T_OBJECT, ...type });
}

export function reflectInterfaceType(type: Omit<format.RtInterfaceType, 'TΦ'>) {
    return <InterfaceType>Type.createFromRtRef({ TΦ: format.T_INTERFACE, ...type });
}

export function reflectFunctionType(type: Omit<format.RtFunctionType, 'TΦ'>) {
    return <FunctionType>Type.createFromRtRef({ TΦ: format.T_FUNCTION, ...type });
}