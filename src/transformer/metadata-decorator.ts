import ts from 'typescript';
import { serialize } from './serialize';

export function metadataDecorator(key : string, object : any) {
    // let metadataFuncExpr : ts.Expression = ts.factory.createPropertyAccessExpression(
    //     ts.factory.createIdentifier('Reflect'),
    //     ts.factory.createIdentifier('metadata')
    // );
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