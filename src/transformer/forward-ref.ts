import ts from 'typescript';

/**
 * Create a forward ref using an arrow function (() => ...). This is useful when
 * the expression in the forward ref does not depend on this.
 * @param expr 
 * @returns 
 */
export function forwardRef(expr : ts.Expression) {
    if (!expr)
        throw new Error(`Cannot make forwardRef without an expression`);
    return ts.factory.createArrowFunction(
        [], [], [], undefined, 
        ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken), 
        expr
    );
}

/**
 * Create a forward ref using a function expression (function() { ... }). This is useful
 * when the expression in the forward ref depends on 'this'
 * @param expr 
 * @returns 
 */
export function functionForwardRef(expr : ts.Expression) {
    if (!expr)
        throw new Error(`Cannot make forwardRef without an expression`);
    return ts.factory.createFunctionExpression(
        [], undefined, '', [], [], undefined,
        ts.factory.createBlock([
            ts.factory.createReturnStatement(expr)
        ])
    );
}