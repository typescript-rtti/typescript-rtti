import ts from 'typescript';

export function nothingDecorator() {
    return [ts.factory.createDecorator(
        ts.factory.createCallExpression(
            ts.factory.createParenthesizedExpression(
                ts.factory.createArrowFunction(
                    [], [], [], null, 
                    ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken), 
                    ts.factory.createBlock([]))
            ), [], []
        )
    )]
}