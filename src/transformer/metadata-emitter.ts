import { RttiVisitor } from "./rtti-visitor-base";
import * as ts from 'typescript';
import { RttiContext } from "./rtti-context";
import { Visit } from "./common/visitor-base";
import { decorateClassExpression, decorateFunctionExpression, directMetadataDecorator, hostMetadataDecorator, metadataDecorator } from "./metadata-decorator";
import { ExternalDecorator, ExternalMetadataCollector, InlineMetadataCollector, MetadataCollector } from "./metadata-collector";
import { expressionForPropertyName, getModifiers, getRttiDocTagFromNode, hasModifier, hasModifiers, isStatement } from "./utils";
import { literalNode } from './literal-node';
import { WORKAROUND_TYPESCRIPT_49794 } from './workarounds';
import { TypeEncoder } from './type-encoder';
import { forwardRef } from './forward-ref';
import { methodFlags } from './flags';

export class MetadataEmitter extends RttiVisitor {
    static emit(sourceFile: ts.SourceFile, ctx: RttiContext): ts.SourceFile {
        return <ts.SourceFile>new MetadataEmitter(ctx).visitNode(sourceFile);
    }

    typeEncoder = new TypeEncoder(this.ctx);
    collector: MetadataCollector = new InlineMetadataCollector();

    /**
     * The outboard metadata collector is used for class elements which are compiled away in the
     * resulting Javascript, for instance abstract methods. In that case the decorators on the
     * item are discarded. So instead we collect the metadata for placement outside the class
     * definition, which is the nearest place where it is valid to insert a call expression.
     */
    outboardCollector: MetadataCollector;

    collectMetadata<T = any>(callback: () => T): { node: T, decorators: ExternalDecorator[]; } {
        let originalCollector = this.collector;
        let originalOutboardCollector = this.outboardCollector;

        let collector = new ExternalMetadataCollector();

        if (WORKAROUND_TYPESCRIPT_49794) {
            this.collector = this.outboardCollector = collector;
        } else {
            this.outboardCollector = collector;
        }

        try {
            return {
                node: callback(),
                decorators: collector.decorators
            };
        } finally {
            this.collector = originalCollector;
            this.outboardCollector = originalOutboardCollector;
        }
    }

    /**
     * In some cases we need to collect all metadata under an entire node subtree. An example is for class expressions
     * which are not valid decorator targets, but we still support emitting for them.
     * @param callback
     * @returns
     */
    collectAllMetadata<T = any>(callback: () => T): { node: T, decorators: ExternalDecorator[]; } {
        let originalCollector = this.collector;
        let originalOutboardCollector = this.outboardCollector;

        let collector = new ExternalMetadataCollector();
        this.collector = collector;
        this.outboardCollector = collector;

        try {
            return {
                node: callback(),
                decorators: collector.decorators
            };
        } finally {
            this.collector = originalCollector;
            this.outboardCollector = originalOutboardCollector;
        }
    }


    scope<T = any>(nameScope: ts.ClassDeclaration | ts.ClassExpression | ts.EnumDeclaration, callback: () => T) {
        let originalScope = this.ctx.currentNameScope;
        this.ctx.currentNameScope = nameScope;

        try {
            return callback();
        } finally {
            this.ctx.currentNameScope = originalScope;
        }
    }

    protected override everyNode(node: ts.Node): boolean | void {
        // If `@rtti:skip` is present in the JSDoc, skip this node
        if (getRttiDocTagFromNode(node, 'skip') === '')
            return false;

        if (isStatement(node) && node.parent && ts.isSourceFile(node.parent)) {
            this.ctx.currentTopStatement = node;
        }
    }

    @Visit(ts.SyntaxKind.ClassDeclaration)
    class(decl: ts.ClassDeclaration) {
        if (hasModifier(ts.canHaveModifiers(decl) ? ts.getModifiers(decl) : [], ts.SyntaxKind.DeclareKeyword))
            return decl;

        return this.scope(decl, () => {
            let outboardMetadata = this.collectMetadata(() => {
                try {
                    decl = this.collector.collect(decl, [ this.typeDecorator(decl) ]);
                    decl = this.visitEachChild(decl);
                    return <ts.ClassDeclaration>decl;
                } catch (e) {
                    console.error(`RTTI: During outboard metadata collection for class ${decl.name.getText()}: ${e.message}`);
                    throw e;
                }
            });

            return [
                decl,
                ...(this.emitOutboardMetadata(decl as ts.ClassDeclaration, outboardMetadata))
            ];
        });
    }

    @Visit(ts.SyntaxKind.EnumDeclaration)
    enum(decl: ts.EnumDeclaration) {
        let modifiers = getModifiers(decl);
        if (hasModifier(modifiers, ts.SyntaxKind.ConstKeyword))
            return decl;

        return this.scope(decl, () => {
            let outboardMetadata = this.collectMetadata(() => {
                try {
                    decl = this.collector.collect(decl, [ this.typeDecorator(decl) ]);
                    decl = this.visitEachChild(decl);
                    return decl;
                } catch (e) {
                    console.error(`RTTI: During outboard metadata collection for class ${decl.name.getText()}: ${e.message}`);
                    throw e;
                }
            });

            return [
                decl,
                ...(this.emitOutboardMetadata(decl, outboardMetadata))
            ];
        });
    }

    @Visit(ts.SyntaxKind.FunctionDeclaration)
    functionDecl(decl: ts.FunctionDeclaration) {
        if (!decl.body)
            return;

        // Note that we check for node.body here ^^ in case of
        // "function a();" which will trigger an error later anyway.

        let functionName = decl.name.getText();

        if (decl.parent && !ts.isBlock(decl.parent) && !ts.isSourceFile(decl.parent)) {
            // Care must be taken here. Take this example:
            //   if (true) function foo() { return 123 }
            //   expect(foo()).to.equal(123)
            //
            // In that case, foo() is *declared*, not an expression,
            // and it should be available outside the if() statement.
            // A corner case, but one that we shouldn't break on.
            // Since a function declaration in an expression becomes a
            // function expression, and named function expressions have
            // their own scope, we can't just emit ie:
            //
            //   if (true) __RΦ.f(function a() { }, [ ... ])
            //
            // ...because a() will no longer be in scope.
            // Thankfully, since function declaration semantics match those of
            // the var keyword, we can accomplish this with:
            //
            //    if (true) var a = __RΦ.f(function a() { }, [ ... ])

            let expr = ts.factory.createFunctionExpression(
                getModifiers(decl), decl.asteriskToken, decl.name, decl.typeParameters, decl.parameters,
                decl.type, decl.body
            );

            try {
                expr = this.visitEachChild(expr);
            } catch (e) {
                console.error(`RTTI: During non-block function declaration ${functionName}: ${e.message}`);
                throw e;
            }

            return ts.factory.createVariableStatement([], [
                ts.factory.createVariableDeclaration(
                    decl.name.getText(), undefined, undefined,
                    decorateFunctionExpression(expr, [ this.typeDecorator(decl) ])
                )
            ]);
        }

        try {
            decl = this.visitEachChild(decl);
        } catch (e) {
            console.error(`RTTI: During function declaration ${functionName}: ${e.message}`);
            throw e;
        }

        return [
            decl,
            ts.factory.createExpressionStatement(
                ts.factory.createCallExpression(
                    this.typeDecorator(decl).expression,
                    undefined,
                    [
                        ts.factory.createIdentifier(`${(decl as ts.FunctionDeclaration).name.text}`)
                    ]
                )
            )
        ];
    }

    typeDecorator(decl: ts.Node) {
        return metadataDecorator(
            'rtti:type',
            literalNode(forwardRef(
                this.typeEncoder.referToType(
                    this.checker.getTypeAtLocation(decl)
                )
            ))
        );
    }

    @Visit([ts.SyntaxKind.FunctionExpression, ts.SyntaxKind.ArrowFunction])
    functionExpr(decl: ts.FunctionExpression | ts.ArrowFunction) {
        return decorateFunctionExpression(this.visitEachChild(decl), [ this.typeDecorator(decl) ]);
    }

    @Visit(ts.SyntaxKind.ClassExpression)
    classExpr(decl: ts.ClassExpression) {
        return this.scope(decl, () => {
            let result = this.collectAllMetadata(() => {
                try {
                    decl = this.visitEachChild(decl);
                } catch (e) {
                    console.error(`RTTI: During metadata collection for class expression: ${e.message}`);
                    throw e;
                }
            });

            return decorateClassExpression(decl, [
                metadataDecorator(
                    'rtti:type',
                    literalNode(forwardRef(
                        this.typeEncoder.referToType(
                            this.checker.getTypeOfSymbolAtLocation(
                                this.checker.getTypeAtLocation(decl).getProperty('prototype'),
                                decl
                            )
                        )
                    ))
                )
            ], result.decorators);
        });
    }

    @Visit(ts.SyntaxKind.MethodDeclaration)
    methodDecl(decl: ts.MethodDeclaration) {
        if (!decl.parent || !(ts.isClassDeclaration(decl.parent) || ts.isClassExpression(decl.parent)))
            return;

        if (this.trace)
            console.log(`Decorating class method ${decl.parent.name?.text ?? '<anonymous>'}#${decl.name.getText()}`);

        if (!hasModifier(getModifiers(decl), ts.SyntaxKind.AbstractKeyword)) {
            // Also collect the flags and host reference on the concrete method itself for resolving
            // Method from a bare method function.

            this.outboardCollector.collect(decl, [
                directMetadataDecorator('rt:f', methodFlags(decl)),
                hostMetadataDecorator()
            ]);

            decl = this.collector.collect(decl, [ this.typeDecorator(decl) ]);
        }

        return this.visitEachChild(decl);
    }

    emitOutboardMetadataExpressions<NodeT extends ts.ClassDeclaration | ts.EnumDeclaration>(
        node: NodeT,
        outboardMetadata: { node: NodeT, decorators: ExternalDecorator[]; }
    ): ts.Expression[] {
        let nodes: ts.Expression[] = [];
        let elementName = node.name.text;

        for (let dec of outboardMetadata.decorators) {
            let host: ts.Expression = ts.factory.createIdentifier(elementName);

            let isStatic = false;

            if (ts.isPropertyDeclaration(dec.node) || ts.isMethodDeclaration(dec.node) || ts.isGetAccessor(dec.node) || ts.isSetAccessor(dec.node))
                isStatic = hasModifier(getModifiers(dec.node), ts.SyntaxKind.StaticKeyword);
            if (ts.isClassDeclaration(dec.node))
                isStatic = true;

            if (!isStatic)
                host = ts.factory.createPropertyAccessExpression(host, 'prototype');

            if (dec.property) {
                if (dec.direct) {
                    host = ts.factory.createElementAccessExpression(host, expressionForPropertyName(dec.property));
                    nodes.push(ts.factory.createCallExpression(dec.decorator.expression, undefined, [
                        host
                    ]));
                } else {
                    nodes.push(ts.factory.createCallExpression(dec.decorator.expression, undefined, [
                        host,
                        expressionForPropertyName(dec.property)
                    ]));
                }
            } else {
                nodes.push(ts.factory.createCallExpression(dec.decorator.expression, undefined, [
                    host
                ]));
            }
        }

        return nodes;
    }

    emitOutboardMetadata<NodeT extends ts.ClassDeclaration | ts.EnumDeclaration>(
        node: NodeT,
        outboardMetadata: { node: NodeT, decorators: ExternalDecorator[]; }
    ): ts.ExpressionStatement[] {
        return this.emitOutboardMetadataExpressions(node, outboardMetadata)
            .map(x => ts.factory.createExpressionStatement(x));
    }
}
