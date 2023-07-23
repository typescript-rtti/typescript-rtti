import { MatchesValueOptions } from './matches-values-options';
import { StructuralType } from './structural-type';

export function structuralMatcher(type: StructuralType, object: any, options: MatchesValueOptions) {
    options ??= {};
    options.errors ??= [];

    if (object === null || object === void 0) {
        options.errors.push(new Error(`Value is undefined`));
        return false;
    }

    if (typeof object !== 'object') {
        options.errors.push(new Error(`Value must be an object`));
        return false;
    }

    let matches = true;

    if (globalThis.RTTI_TRACE === true)
        console.log(`Type checking value against type '${type.name}'`);

    if (type.isClass() || type.isInterface()) {
        for (let method of type.methods) {
            let hasValue = method.name in object;
            let value = object[method.name];

            if (!hasValue && !method.isOptional) {
                options.errors.push(new Error(`Method '${method.name}()' is missing in value`));
                matches = false;
            }

            if (!hasValue)
                continue;

            let propMatch = method.matchesValue(value, options);
            if (globalThis.RTTI_TRACE === true)
                console.log(` - ${type.name}#${method.name} : ${method.type} | valid(${JSON.stringify(value)}) => `
                    + `${propMatch}`);

            matches &&= propMatch;
        }

    }

    for (let prop of type.properties) {
        let hasValue = prop.name in object;
        let value = object[prop.name];

        if (!hasValue && !prop.isOptional) {
            options.errors.push(new Error(`Property '${prop.name}' is missing in value`));
            matches = false;
        }
        if (!hasValue)
            continue;
        let propMatch = prop.matchesValue(value, options);
        if (globalThis.RTTI_TRACE === true)
            console.log(` - ${type.name}#${prop.name} : ${prop.type} | valid(${JSON.stringify(value)}) => `
                + `${propMatch}`);

        matches &&= propMatch;
    }

    let unaccountedMembers = Object.keys(object).filter(x => !type.members.some(y => y.name === x));
    if (options.allowExtraProperties !== true && unaccountedMembers.length > 0) {
        options.errors.push(
            new Error(
                `Object contains the following undeclared members: `
                + `${unaccountedMembers.join(', ')}`
            )
        );
        matches = false;
    }

    return matches;
}