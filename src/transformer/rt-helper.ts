import ts from 'typescript';

export function rtHelper() {
    const factory = ts.factory;
    return factory.createVariableStatement(
        undefined,
        factory.createVariableDeclarationList(
            [factory.createVariableDeclaration(
                factory.createIdentifier("__RtΦ"),
                undefined,
                undefined,
                factory.createArrowFunction(
                    undefined,
                    undefined,
                    [
                        factory.createParameterDeclaration(
                            undefined,
                            undefined,
                            undefined,
                            factory.createIdentifier("k"),
                            undefined,
                            undefined,
                            undefined
                        ),
                        factory.createParameterDeclaration(
                            undefined,
                            undefined,
                            undefined,
                            factory.createIdentifier("v"),
                            undefined,
                            undefined,
                            undefined
                        )
                    ],
                    undefined,
                    factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
                    factory.createCallExpression(
                        factory.createPropertyAccessExpression(
                            factory.createIdentifier("Reflect"),
                            factory.createIdentifier("metadata")
                        ),
                        undefined,
                        [
                            factory.createIdentifier("k"),
                            factory.createIdentifier("v")
                        ]
                    )
                )
            )],
            ts.NodeFlags.Const
        )
    );
}
