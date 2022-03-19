import ts from 'typescript';
import { isLiteralNode, RtSerialized } from '../common';

export function serialize<T>(object: T | RtSerialized<T>): ts.Expression {
    if (object === null)
        return ts.factory.createNull();
    if (object === undefined)
        return ts.factory.createVoidZero();

    if (object instanceof Array)
        return ts.factory.createArrayLiteralExpression(object.map(x => serialize(x)));
    if (typeof object === 'string')
        return ts.factory.createStringLiteral(object);
    if (typeof object === 'number')
        return ts.factory.createNumericLiteral(object);
    if (typeof object === 'boolean')
        return object ? ts.factory.createTrue() : ts.factory.createFalse();
    if (typeof object === 'function')
        throw new Error(`Cannot serialize a function`);
    if (isLiteralNode(object))
        return object.node;

    let props: ts.ObjectLiteralElementLike[] = [];
    for (let key of Object.keys(object))
        props.push(ts.factory.createPropertyAssignment(key, serialize(object[key])));

    return ts.factory.createObjectLiteralExpression(props, false);
}
