import ts from 'typescript';
import { legacyDecorator } from './legacy-decorator';
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

export function legacyMetadataDecorator(key : string, object : any) {
    return legacyDecorator(metadataDecorator(key, object));
}

export function directMetadataDecorator(key : string, object : any) {
    let dec = metadataDecorator(key, object)
    dec['__Φdirect'] = true;
    return dec;
}

export function decorateFunctionExpression(func : ts.FunctionExpression | ts.ArrowFunction, decorators : ts.Decorator[]) {
    let name = '';

    if (func.parent) {
        // In JS, anonymous unnamed functions inherit the name of the property they are being assigned to.
        // Because we are inserting __RfΦ, this property will be lost unless we specifically patch the function's
        // name.
        if (ts.isPropertyAssignment(func.parent) || ts.isVariableDeclaration(func.parent)) {
            name = func.parent.name.getText();
        }
    }

    return ts.factory.createCallExpression(
        ts.factory.createIdentifier('__RfΦ'),
        [], [
            func,
            ts.factory.createArrayLiteralExpression(decorators.map(d => d.expression)),
            ts.factory.createStringLiteral(name)
        ]
    )
}