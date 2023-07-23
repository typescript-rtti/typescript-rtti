import * as format from '../../../common/format';
import { getParameterNames } from '../../get-parameter-names';

/**
 * @internal
 */
export function synthesizeMember(obj, name, flags = '') {
    let isMethod = false;

    // All properties which have `get` defined must be considered properties, not methods.
    // We need to avoid executing getters inadvertently while determining the type of the property.
    // https://github.com/typescript-rtti/typescript-rtti/issues/52
    let descriptor = Object.getOwnPropertyDescriptor(obj, name);
    if (descriptor?.get)
        isMethod = false;
    else
        isMethod = typeof obj[name] === 'function';

    if (isMethod) {
        const returnTypeHint = Reflect.getMetadata('design:returntype', obj, name);
        const paramTypeHints = Reflect.getMetadata('design:paramtypes', obj, name) ?? [];
        return <format.RtObjectMember>{
            n: name,
            f: `${format.F_METHOD}${flags}`,
            t: <format.RtFunctionType>{
                TΦ: format.T_FUNCTION,
                f: '',
                n: name,
                p: getParameterNames(obj[name]).map((name, i) => (<format.RtParameter>{
                    n: name,
                    t: synthesizeClassRef(paramTypeHints[i]) ?? { TΦ: format.T_ANY }
                })),
                r: synthesizeClassRef(returnTypeHint) ?? { TΦ: format.T_ANY }
            }
        };
    } else {
        const typeHint = Reflect.getMetadata('design:type', obj, name);
        return <format.RtObjectMember>{
            n: name,
            f: `${format.F_PROPERTY}${flags}`,
            t: synthesizeClassRef(typeHint) ?? { TΦ: format.T_ANY }
        };
    }
}

/**
 * @internal
 */
export function synthesizeClassRef(constructor: Function): format.RtType {
    if (!constructor)
        return undefined;

    let ctorParamTypeHints = Reflect.getMetadata('design:paramtypes', constructor) ?? [];
    let paramNames = getParameterNames(constructor);

    return {
        TΦ: format.T_CLASS,
        C: constructor,
        n: constructor.name,
        i: [],
        m: [
            {
                f: format.F_CONSTRUCTOR,
                n: 'constructor',
                t: {
                    TΦ: format.T_FUNCTION,
                    n: 'constructor',
                    r: { TΦ: format.T_VOID },
                    f: '',
                    p: paramNames.map((name, i) => (<format.RtParameter>{
                        n: name,
                        t: synthesizeClassRef(ctorParamTypeHints[i]) ?? { TΦ: format.T_ANY }
                    }))
                }
            },
            ...Object.getOwnPropertyNames(constructor.prototype)
                .filter(x => !['constructor'].includes(x))
                .map(name => synthesizeMember(constructor.prototype, name)),
            ...Object.getOwnPropertyNames(constructor)
                .filter(x => !['length', 'prototype', 'name'].includes(x))
                .map(name => synthesizeMember(constructor, name, format.F_STATIC)),
        ],
        f: `${format.F_DEFAULT_LIB}`
    }
}