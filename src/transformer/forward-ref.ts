import ts from 'typescript';

export function forwardRef(expr : ts.Expression) {
    if (!expr)
        throw new Error(`Cannot make forwardRef without an expression`);
    return ts.factory.createArrowFunction(
        [], [], [], null, 
        ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken), 
        expr
    );
}