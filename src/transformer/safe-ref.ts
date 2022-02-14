import ts from "typescript";

export function safeRefWithFallback(ref : ts.Expression, fallback : ts.Expression) {
    return ts.factory.createConditionalExpression(
        ts.factory.createStrictInequality(
            ts.factory.createTypeOfExpression(ref),
            ts.factory.createStringLiteral('undefined')
        ),
        ts.factory.createToken(ts.SyntaxKind.QuestionToken),
        ref,
        ts.factory.createToken(ts.SyntaxKind.ColonToken),
        fallback
    );

}

export function safeRef(ref : ts.Expression) {
    return safeRefWithFallback(ref, ts.factory.createVoidZero());
}