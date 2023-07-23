import * as format from '../common/format';
import { getParameterNames } from './get-parameter-names';

export const NotProvided = Symbol();

export function isBuiltIn(func: Function) {
    return func.toString().includes('[native code]');
}

export function superMergeElements<T extends { name: string }>(ownSet: readonly T[], superSet: readonly T[]): T[] {
    return superSet.map(superItem => ownSet.find(ownItem => ownItem.name === superItem.name) ?? superItem)
        .concat(ownSet.filter(ownItem => !superSet.some(superItem => ownItem.name === superItem.name)));
}