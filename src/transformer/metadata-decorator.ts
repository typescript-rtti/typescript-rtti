import ts from 'typescript';
import { legacyDecorator } from './legacy-decorator';
import { literalNode } from './literal-node';
import { ExternalDecorator } from './metadata-collector';
import {serialize, serializeExpression} from './serialize';
import { expressionForPropertyName, hasFlag, hasModifier } from './utils';

export function metadataDecorator(key: string, object: any) {
    return ts.factory.createDecorator(
        ts.factory.createCallExpression(
            ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('__RΦ'), 'm'),
            [],
            [
                ts.factory.createStringLiteral(key),
                serializeExpression(object)
            ]
        )
    );
}

export function hostMetadataDecorator() {
    let factory = ts.factory;

    let dec = ts.factory.createDecorator(factory.createArrowFunction(
        undefined,
        undefined,
        [
            factory.createParameterDeclaration(
                undefined,
                undefined,
                undefined,
                factory.createIdentifier("t"),
                undefined,
                undefined,
                undefined
            ),
            factory.createParameterDeclaration(
                undefined,
                undefined,
                undefined,
                factory.createIdentifier("p"),
                undefined,
                undefined,
                undefined
            )
        ],
        undefined,
        factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
        factory.createCallExpression(
            factory.createCallExpression(
                factory.createPropertyAccessExpression(
                    factory.createIdentifier("__RΦ"),
                    factory.createIdentifier("m")
                ),
                undefined,
                [
                    factory.createStringLiteral("rt:h"),
                    factory.createArrowFunction(
                        undefined,
                        undefined,
                        [],
                        undefined,
                        factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
                        factory.createConditionalExpression(
                            factory.createBinaryExpression(
                                factory.createTypeOfExpression(factory.createIdentifier("t")),
                                factory.createToken(ts.SyntaxKind.EqualsEqualsEqualsToken),
                                factory.createStringLiteral("object")
                            ),
                            factory.createToken(ts.SyntaxKind.QuestionToken),
                            factory.createPropertyAccessExpression(
                                factory.createIdentifier("t"),
                                factory.createIdentifier("constructor")
                            ),
                            factory.createToken(ts.SyntaxKind.ColonToken),
                            factory.createIdentifier("t")
                        )
                    )
                ]
            ),
            undefined,
            [factory.createElementAccessExpression(
                factory.createIdentifier("t"),
                factory.createIdentifier("p")
            )]
        )
    ));
    return dec;
}

export function legacyMetadataDecorator(key: string, object: any) {
    return legacyDecorator(metadataDecorator(key, object));
}

export function directMetadataDecorator(key: string, object: any) {
    let dec = metadataDecorator(key, object);
    dec['__Φdirect'] = true;
    return dec;
}

export function decorateFunctionExpression(func: ts.FunctionExpression | ts.ArrowFunction, decorators: ts.Decorator[]) {
    let name = '';

    if (func.parent) {
        // In JS, function expressions inherit the name of the property they are being assigned to.
        // Because we are inserting __RΦ.f(), this property will be lost unless we specifically patch the function's
        // name.
        if (ts.isPropertyAssignment(func.parent) || ts.isVariableDeclaration(func.parent)) {
            name = func.parent.name.getText();
        }
    }

    return ts.factory.createCallExpression(
        ts.factory.createPropertyAccessExpression(
            ts.factory.createIdentifier('__RΦ'),
            'f'
        ),
        [], [
        func,
        ts.factory.createArrayLiteralExpression(decorators.map(d => d.expression)),
        ts.factory.createStringLiteral(name)
    ]
    );
}

export function decorateClassExpression(classExpr: ts.ClassExpression, decorators: ts.Decorator[], externalDecorators: ExternalDecorator[]) {
    let name = '';

    if (classExpr.name) {
        name = classExpr.name.text;
    } else if (classExpr.parent) {
        // In JS, class expressions inherit the name of the property they are being assigned to.
        // Because we are inserting __RΦ.f(), this property will be lost unless we specifically patch the function's
        // name.
        if (ts.isPropertyAssignment(classExpr.parent) || ts.isVariableDeclaration(classExpr.parent)) {
            name = classExpr.parent.name.getText();
        }
    }

    let propDecorators = externalDecorators.filter(x => x.property);
    let staticPropDecorators = propDecorators.filter(x => hasModifier(x.node.modifiers, ts.SyntaxKind.StaticKeyword));
    let instancePropDecorators = propDecorators.filter(x => !hasModifier(x.node.modifiers, ts.SyntaxKind.StaticKeyword));

    return ts.factory.createCallExpression(
        ts.factory.createPropertyAccessExpression(
            ts.factory.createIdentifier('__RΦ'),
            'c'
        ),
        [], [
        classExpr,
            serializeExpression(decorators.map(d => literalNode(d.expression))), // on class
            serializeExpression(
            instancePropDecorators
                .map(x => [
                    literalNode(expressionForPropertyName(x.property)),
                    literalNode(x.decorator.expression)
                ])
        ),
            serializeExpression(
            staticPropDecorators
                .map(x => [
                    literalNode(expressionForPropertyName(x.property)),
                    literalNode(x.decorator.expression)
                ])
        ),
        name ? ts.factory.createStringLiteral(name) : ts.factory.createVoidZero()
    ]
    );
}
