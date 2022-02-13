import ts from 'typescript';
import { serialize } from './serialize';

export function metadataDecorator(key : string, object : any) {
    let metadataFuncExpr : ts.Expression = ts.factory.createIdentifier('__RtΦ');

    return ts.factory.createDecorator(
        ts.factory.createCallExpression(
            metadataFuncExpr, [],
            [
                ts.factory.createStringLiteral(key),
                serialize(object)
            ]
        )
    )
}

export function directMetadataDecorator(key : string, object : any) {
    let dec = metadataDecorator(key, object)
    dec['__Φdirect'] = true;
    return dec;
}

export function decorateFunctionExpression(func : ts.FunctionExpression | ts.ArrowFunction, decorators : ts.Decorator[]) {
    return ts.factory.createCallExpression(
        ts.factory.createIdentifier('__RfΦ'),
        [], [
            func,
            ts.factory.createArrayLiteralExpression(decorators.map(d => d.expression))
        ]
    )
}