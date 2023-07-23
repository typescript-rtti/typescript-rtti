import { CallSite } from './callsite';
import { ReflectedCallSite } from './types';

/**
 * Returns true if the given value matches the shape of the interface / class passed as interfaceType.
 *
 * @param value
 * @param interfaceType
 * @returns True if the value is the correct shape
 */
export function matchesShape<T>(value, callSite?: CallSite) {
    return ReflectedCallSite.from(callSite).typeParameters[0].matchesValue(value);
}
