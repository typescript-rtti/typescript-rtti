import * as ts from 'typescript';
import {
    F_ARROW_FUNCTION, F_CLASS, F_FUNCTION, F_INFERRED, F_INTERFACE, F_METHOD, F_OPTIONAL, F_PRIVATE, F_PROPERTY,
    F_PROTECTED, F_PUBLIC, F_READONLY, F_STATIC, RtParameter, RtSerialized
} from '../common/format';
import { ClassDetails } from './common/class-details';
import { encodeParameter } from './encode-parameter';
import { getVisibility, isAbstract, isAsync, isExported, isReadOnly } from './flags';
import { forwardRef, functionForwardRef } from './forward-ref';
import { LegacyTypeEncoder } from './legacy-type-encoder';
import { literalNode } from './literal-node';
import { legacyMetadataDecorator, metadataDecorator } from './metadata-decorator';
import { RttiContext } from './rtti-context';
import { serialize } from './serialize';
import { TypeEncoder } from './type-encoder';
import { expressionForPropertyName, hasFlag, hasModifier, propertyNameToString, referenceSymbol } from './utils';

/**
 * Extracts type metadata from various syntactic elements and outputs
 * arrays of Typescript decorators using the Typescript RTTI metadata
 * format.
 */
export class MetadataEncoder {
    constructor(
        readonly ctx: RttiContext
    ) {
    }

    get emitStandardMetadata() { return this.ctx.emitStandardMetadata; }
    get checker() { return this.ctx.checker; }
    get importMap() { return this.ctx.importMap; }

    typeEncoder = new TypeEncoder(this.ctx);
    legacyTypeEncoder = new LegacyTypeEncoder(this.ctx);

    typeNode(typeNode: ts.TypeNode, standardName: string, allowStandardMetadata = true) {
        return this.type(this.checker.getTypeAtLocation(typeNode), typeNode, standardName, allowStandardMetadata);
    }

    type(type: ts.Type, typeNode: ts.TypeNode, standardName: string, allowStandardMetadata = true) {
        let decs: ts.Decorator[] = [];
        decs.push(metadataDecorator('rt:t', literalNode(forwardRef(this.typeEncoder.referToType(type, typeNode)))));
        if (this.emitStandardMetadata && allowStandardMetadata)
            decs.push(legacyMetadataDecorator(`design:${standardName}`, literalNode(this.legacyTypeEncoder.referToType(type, typeNode))));
        return decs;
    }

    private prepareElementNames(elementNames: ts.PropertyName[]): any[] {
        return elementNames.map(elementName => literalNode(expressionForPropertyName(elementName)));
    }

    class(klass: ts.ClassDeclaration | ts.ClassExpression | ts.InterfaceDeclaration, details: ClassDetails) {
        let type = this.checker.getTypeAtLocation(klass);

        let decs: ts.Decorator[] = [
            ts.factory.createDecorator(
                ts.factory.createArrowFunction(
                    [], [],
                    [
                        ts.factory.createParameterDeclaration([], [], undefined, 't')
                    ],
                    undefined,
                    ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
                    ts.factory.createBinaryExpression(
                        ts.factory.createElementAccessExpression(
                            ts.factory.createPropertyAccessExpression(
                                ts.factory.createIdentifier('__RΦ'),
                                't'
                            ),
                            type['id']
                        ),
                        ts.factory.createToken(ts.SyntaxKind.EqualsToken),
                        ts.factory.createIdentifier('t')
                    )
                )
            )
        ];

        if (ts.isClassDeclaration(klass) || ts.isClassExpression(klass))
            decs.push(metadataDecorator('rt:SP', this.prepareElementNames(details.staticPropertyNames)));
        decs.push(metadataDecorator('rt:P', this.prepareElementNames(details.propertyNames)));

        if (ts.isClassDeclaration(klass) || ts.isClassExpression(klass))
            decs.push(metadataDecorator('rt:Sm', this.prepareElementNames(details.staticMethodNames)));
        decs.push(metadataDecorator('rt:m', this.prepareElementNames(details.methodNames)));

        if (ts.isClassDeclaration(klass) || ts.isClassExpression(klass)) {
            let constructor = klass.members.find(x => ts.isConstructorDeclaration(x)) as ts.ConstructorDeclaration;
            if (constructor) {
                decs.push(...this.params(constructor, klass));
            }
        }

        // `implements`

        let impls = klass.heritageClauses?.find(x => x.token === (ts.isInterfaceDeclaration(klass)
            ? ts.SyntaxKind.ExtendsKeyword : ts.SyntaxKind.ImplementsKeyword));

        if (impls) {
            let typeRefs: ts.Expression[] = [];
            for (let heritageType of impls.types) {
                let checker = this.checker;
                let symbol = checker.getSymbolAtLocation(heritageType.expression);
                let type = checker.getTypeAtLocation(heritageType.expression);

                if (symbol) {
                    let localName = heritageType.expression.getText();
                    typeRefs.push(
                        referenceSymbol(
                            this.ctx, localName,
                            hasFlag(type.flags, ts.TypeFlags.Any)
                                ? undefined
                                : type.isClass()
                        )
                    );

                } else {
                    console.error(`RTTI: Cannot identify type ${heritageType.getText()} on implements clause for class ${klass.name.text} [please report]`);
                    typeRefs.push(undefined);
                }
            }

            decs.push(metadataDecorator('rt:i', typeRefs.map(tr => tr ? literalNode(forwardRef(tr)) : undefined)));
        }

        // flags

        let klassModifiers = ts.canHaveModifiers(klass) ? ts.getModifiers(klass) : [];
        let fType = ts.isInterfaceDeclaration(klass) ? F_INTERFACE : F_CLASS;

        decs.push(metadataDecorator(
            'rt:f',
            `${fType}${getVisibility(klassModifiers)}${isAbstract(klassModifiers)}${isExported(klassModifiers)}`
        ));

        return decs;
    }

    private getClassName(node: ts.Declaration) {
        if (!node.parent)
            return `unknown class/interface`;

        if (ts.isClassDeclaration(node.parent)) {
            if (node.parent.name)
                return `class ${node.parent.name.text}`;
            else if (hasModifier(ts.canHaveModifiers(node.parent) ? ts.getModifiers(node.parent) : [], ts.SyntaxKind.DefaultKeyword))
                return `default class`;
            else
                return `unknown class`;
        } else if (ts.isClassExpression(node.parent)) {
            if (node.parent.name)
                return `class ${node.parent.name.text}`;
            else
                return `unnamed class expression`;
        } else if (ts.isInterfaceDeclaration(node.parent)) {
            if (node.parent.name)
                return `interface ${node.parent.name.text}`;
            else if (hasModifier(node.parent.modifiers, ts.SyntaxKind.DefaultKeyword))
                return `default interface`;
            else
                return `unknown interface`;
        }

        return `unknown class`;
    }

    property(
        node: ts.PropertyDeclaration | ts.PropertySignature
            | ts.GetAccessorDeclaration | ts.SetAccessorDeclaration
    ) {
        let typeNode: ts.TypeNode = node.type;
        let type: ts.Type;

        if (!typeNode && ts.isSetAccessor(node) && node.parameters.length > 0) {
            typeNode = node.parameters[0].type;
        }

        this.ctx.locationHint = `Property '${propertyNameToString(node.name)}' of ${this.getClassName(node)}`;

        if (typeNode) {
            type = this.checker.getTypeAtLocation(typeNode);
        } else {
            type = this.checker.getTypeAtLocation(node);
        }

        const nodeModifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : [];

        return [
            ...this.type(
                type,
                typeNode, 'type',
                (ts.isPropertyDeclaration(node) || ts.isGetAccessor(node) || ts.isSetAccessor(node))
                && ts.canHaveDecorators(node) && ts.getDecorators(node)?.length > 0
            ),
            metadataDecorator('rt:f', `${F_PROPERTY}${getVisibility(nodeModifiers)}${isReadOnly(nodeModifiers)}${node.questionToken ? F_OPTIONAL : ''}`)
        ];
    }

    methodFlags(node: ts.MethodDeclaration | ts.MethodSignature | ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction) {
        if (ts.isFunctionDeclaration(node) || ts.isArrowFunction(node)) {
            let type = F_FUNCTION;
            return `${type}${isAsync(node.modifiers)}${ts.isArrowFunction(node) ? F_ARROW_FUNCTION : ''}`;
        }

        const nodeModifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : [];
        let type = F_METHOD;
        let flags = `${type}${getVisibility(nodeModifiers)}${isAbstract(nodeModifiers)}${isAsync(nodeModifiers)}`;

        if (ts.isMethodDeclaration(node) && (node.modifiers ?? <ts.Modifier[]>[]).some(x => x.kind === ts.SyntaxKind.StaticKeyword))
            flags += F_STATIC;

        if (node.questionToken)
            flags += F_OPTIONAL;

        if (!node.type)
            flags += F_INFERRED;

        return flags;
    }

    method(node: ts.MethodDeclaration | ts.MethodSignature | ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction) {
        let propNameStr = propertyNameToString(node.name);

        if (ts.isMethodDeclaration(node) || ts.isMethodSignature(node)) {

            this.ctx.locationHint = `Method ${propNameStr ?? '<unknown>'}() of ${this.getClassName(node)}`;
        } else if (ts.isFunctionDeclaration(node)) {
            this.ctx.locationHint = `Function ${propNameStr ?? '<unknown>'}()`;
        } else if (ts.isFunctionExpression(node)) {
            if (node.name)
                this.ctx.locationHint = `Function ${propNameStr}()`;
            else
                this.ctx.locationHint = `Unnamed function expression`;
        } else if (ts.isArrowFunction(node)) {
            this.ctx.locationHint = `Arrow function`;
        }

        let methodHint = this.ctx.locationHint;

        let decs: ts.Decorator[] = [];
        let nodeDecorators: readonly ts.Decorator[] = [];

        if (ts.canHaveDecorators(node))
            nodeDecorators = ts.getDecorators(node);

        if (this.emitStandardMetadata && ts.isMethodDeclaration(node) && nodeDecorators?.length > 0)
            decs.push(legacyMetadataDecorator('design:type', literalNode(ts.factory.createIdentifier('Function'))));

        decs.push(...this.params(node));
        decs.push(metadataDecorator('rt:f', this.methodFlags(node)));

        let allowStandardMetadata = ts.isMethodDeclaration(node) && nodeDecorators?.length > 0;

        if (node.type) {
            decs.push(...this.typeNode(node.type, 'returntype', allowStandardMetadata));
        } else {
            let signature = this.checker.getSignatureFromDeclaration(node);
            if (signature) {
                this.ctx.locationHint = `[Return type of] ${methodHint}`;
                decs.push(...this.type(signature.getReturnType(), undefined, 'returntype', allowStandardMetadata));
            }
        }

        return decs;
    }

    params(node: ts.FunctionLikeDeclaration | ts.MethodSignature, containingNode? : ts.ClassDeclaration | ts.ClassExpression): ts.Decorator[] {
        let decs: ts.Decorator[] = [];
        let standardParamTypes: ts.Expression[] = [];
        let serializedParamMeta: any[] = [];

        for (let param of node.parameters) {
            let name: string;

            if (ts.isIdentifier(param.name))
                name = param.name.text;

            if (name === 'this')
                continue;

            let expr = this.legacyTypeEncoder.referToTypeNode(param.type);
            standardParamTypes.push(expr);

            serializedParamMeta.push(literalNode(serialize(encodeParameter(this.typeEncoder, param))));
        }

        decs.push(metadataDecorator('rt:p', serializedParamMeta));

        let eligibleForLegacyDecorators = (ts.isMethodDeclaration(node) || ts.isConstructorDeclaration(node));

        if (this.emitStandardMetadata && eligibleForLegacyDecorators) {
            let parent = containingNode ?? node.parent;
            let isDecorated = false;

            if (ts.canHaveDecorators(node))
                isDecorated = ts.getDecorators(node)?.length > 0;

            if (ts.isConstructorDeclaration(node) && parent && ts.canHaveDecorators(parent))
                isDecorated = ts.getDecorators(parent)?.length > 0;

            if (isDecorated)
                decs.push(metadataDecorator('design:paramtypes', standardParamTypes.map(t => literalNode(t))));
        }

        return decs;
    }

}
