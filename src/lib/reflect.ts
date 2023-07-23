import { CallSite } from './callsite';
import { Constructor } from './constructor';
import { ClassType, FalseType, FunctionType, LiteralType, NullType, ReflectedCallSite, TrueType, Type, UndefinedType } from './types';

export function isCallSite(callSite: CallSite) {
    return callSite?.TΦ === 'c';
}

export function reflect(value: null): NullType;
export function reflect(value: undefined): UndefinedType;
export function reflect(value: true): TrueType;
export function reflect(value: false): FalseType;
export function reflect(value: number): LiteralType<number>;
export function reflect(value: string): LiteralType<string>;
export function reflect(value: bigint): LiteralType<bigint>;
export function reflect(value: boolean): TrueType | FalseType;
/**
 * Get the reflected class for the given constructor or instance.
 * @param value A constructor, Interface value, or an instance of a class
 * @returns The reflected class
 */
export function reflect(value: Constructor<any>): ClassType;
export function reflect(value: Function): FunctionType;
export function reflect(value: any): Type;

/**
 * Reflect upon the type identified by T.
 * @rtti:callsite 1
 */
export function reflect<T>(): Type;
export function reflect(...args: any[]) {
    if (args.length === 0) {
        throw new Error(`reflect<T>() can only be used when project is built with the typescript-rtti transformer`);
    }

    let value = args[0];
    if (isCallSite(value))
        return ReflectedCallSite.from(value).typeParameters[0];

    return Type.from(value);
}