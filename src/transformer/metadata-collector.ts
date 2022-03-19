import * as ts from 'typescript';

export interface MetadataCollector {
    collect<T extends ts.Node>(node: T, decorators: ts.Decorator[]): T;
}

export class InlineMetadataCollector {
    collect<T extends ts.Node>(node: T, decorators: ts.Decorator[]): T {
        if (decorators.length === 0)
            return node;

        if (ts.isPropertyDeclaration(node)) {
            return <any>ts.factory.updatePropertyDeclaration(
                node,
                [...(node.decorators || []), ...decorators],
                node.modifiers,
                node.name,
                node.questionToken || node.exclamationToken,
                node.type,
                node.initializer
            );
        } else if (ts.isGetAccessor(node)) {
            return <any>ts.factory.updateGetAccessorDeclaration(
                node,
                [...(node.decorators || []), ...decorators],
                node.modifiers,
                node.name,
                node.parameters,
                node.type,
                node.body
            );
        } else if (ts.isSetAccessor(node)) {
            return <any>ts.factory.updateSetAccessorDeclaration(
                node,
                [...(node.decorators || []), ...decorators],
                node.modifiers,
                node.name,
                node.parameters,
                node.body
            );
        } else if (ts.isMethodDeclaration(node)) {
            return <any>ts.factory.updateMethodDeclaration(
                node,
                [...(node.decorators || []), ...decorators],
                node.modifiers,
                node.asteriskToken,
                node.name,
                node.questionToken,
                node.typeParameters,
                node.parameters,
                node.type,
                node.body
            );
        } else if (ts.isClassDeclaration(node)) {
            return <any>ts.factory.updateClassDeclaration(
                node,
                [...(node.decorators || []), ...decorators],
                node.modifiers,
                node.name,
                node.typeParameters,
                node.heritageClauses,
                node.members
            );
        } else {
            throw new TypeError(`Not sure how to collect metadata onto ${node}`);
        }
    }
}

export interface ExternalDecorator {
    property?: ts.PropertyName;
    node: ts.Node;
    decorator: ts.Decorator;
    direct: boolean;
}

export class ExternalMetadataCollector implements MetadataCollector {
    private inlineCollector = new InlineMetadataCollector();
    decorators: ExternalDecorator[] = [];

    collect<T extends ts.Node>(node: T, addedDecorators: ts.Decorator[]): T {
        let property: ts.PropertyName;

        if (
            ts.isMethodDeclaration(node)
            || ts.isPropertyDeclaration(node)
            || ts.isGetAccessor(node)
            || ts.isSetAccessor(node)
            || ts.isMethodSignature(node)
            || ts.isPropertySignature(node)
        ) {
            property = node.name;
        }

        let legacyDecorators = addedDecorators.filter(decorator => decorator['__Φlegacy']);
        let nonLegacyDecorators = addedDecorators.filter(decorator => !decorator['__Φlegacy']);

        this.decorators.push(...nonLegacyDecorators.map(decorator => (<ExternalDecorator>{
            property, node, decorator, direct: decorator['__Φdirect'] ?? false
        })));

        // Only apply legacy decorators (inline) when there are other
        // decorators to match TS' own semantics

        if (node.decorators?.length > 0 && legacyDecorators.length > 0) {
            node = this.inlineCollector.collect(node, legacyDecorators);
        }

        return node;
    }
}
