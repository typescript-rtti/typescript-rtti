import * as ts from 'typescript';
import { F_ARROW_FUNCTION, F_CLASS, F_FUNCTION, F_INFERRED, F_INTERFACE, F_METHOD, F_OPTIONAL, F_PRIVATE, F_PROPERTY, 
         F_PROTECTED, F_PUBLIC, F_READONLY, F_STATIC, RtParameter, RtSerialized } from '../common/format';
import { ClassDetails } from './common/class-details';
import { getVisibility, isAbstract, isAsync, isExported, isReadOnly } from './flags';
import { forwardRef, functionForwardRef } from './forward-ref';
import { LegacyTypeEncoder } from './legacy-type-encoder';
import { literalNode } from './literal-node';
import { legacyMetadataDecorator, metadataDecorator } from './metadata-decorator';
import { RttiContext } from './rtti-context';
import { serialize } from './serialize';
import { TypeEncoder } from './type-encoder';
import { expressionForPropertyName, hasFlag, referenceSymbol } from './utils';

/**
 * Extracts type metadata from various syntactic elements and outputs 
 * arrays of Typescript decorators using the Typescript RTTI metadata 
 * format.
 */
export class MetadataEncoder {
    constructor(
        readonly ctx : RttiContext
    ) {
    }

    get emitStandardMetadata() { return this.ctx.emitStandardMetadata; }
    get checker() { return this.ctx.checker; }
    get importMap() { return this.ctx.importMap; }

    typeEncoder = new TypeEncoder(this.ctx);
    legacyTypeEncoder = new LegacyTypeEncoder(this.ctx);

    typeNode(typeNode : ts.TypeNode, standardName : string, allowStandardMetadata = true) {
        return this.type(this.checker.getTypeAtLocation(typeNode), typeNode, standardName, allowStandardMetadata);
    }

    type(type : ts.Type, typeNode : ts.TypeNode, standardName : string, allowStandardMetadata = true) {
        let decs : ts.Decorator[] = [];
        decs.push(metadataDecorator('rt:t', literalNode(forwardRef(this.typeEncoder.referToType(type, typeNode)))));
        if (this.emitStandardMetadata && allowStandardMetadata)
            decs.push(legacyMetadataDecorator(`design:${standardName}`, literalNode(this.legacyTypeEncoder.referToType(type))));
        return decs;
    }

    private prepareElementNames(elementNames : ts.PropertyName[]): any[] {
        return elementNames.map(elementName => literalNode(expressionForPropertyName(elementName)));
    }

    class(klass : ts.ClassDeclaration | ts.ClassExpression | ts.InterfaceDeclaration, details : ClassDetails) {
        let type = this.checker.getTypeAtLocation(klass);

        let decs : ts.Decorator[] = [
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

        if (details.propertyNames.length > 0) {
            if (ts.isClassDeclaration(klass) || ts.isClassExpression(klass))
                decs.push(metadataDecorator('rt:SP', this.prepareElementNames(details.staticPropertyNames)));
            decs.push(metadataDecorator('rt:P', this.prepareElementNames(details.propertyNames)));
        }

        if (details.methodNames.length > 0) {
            if (ts.isClassDeclaration(klass) || ts.isClassExpression(klass))
                decs.push(metadataDecorator('rt:Sm', this.prepareElementNames(details.staticMethodNames)));
            decs.push(metadataDecorator('rt:m', this.prepareElementNames(details.methodNames)));
        }

        if (ts.isClassDeclaration(klass) || ts.isClassExpression(klass)) {
            let constructor = klass.members.find(x => ts.isConstructorDeclaration(x)) as ts.ConstructorDeclaration;
            if (constructor) {
                decs.push(...this.params(constructor));
            }
        }

        // `implements`

        let impls = klass.heritageClauses?.find(x => x.token === ts.SyntaxKind.ImplementsKeyword);
        if (impls) {
            let typeRefs : ts.Expression[] = [];
            for (let heritageType of impls.types) {
                let checker = this.checker;
                let symbol = checker.getSymbolAtLocation(heritageType.expression);
                let type = checker.getTypeAtLocation(heritageType.expression);

                if (symbol) {
                    let localName = heritageType.expression.getText();
                    
                    // let decls = symbol.getDeclarations();
                    // let interfaceDecl = decls.find(x => ts.isInterfaceDeclaration(x));
                    // let classDecl = decls.find(x => ts.isClassDeclaration(x) || ts.isClassExpression(x));

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

        let fType = ts.isInterfaceDeclaration(klass) ? F_INTERFACE : F_CLASS;
        decs.push(metadataDecorator(
            'rt:f', 
            `${fType}${getVisibility(klass.modifiers)}${isAbstract(klass.modifiers)}${isExported(klass.modifiers)}`
        ));

        return decs;
    }

    property(
        node : ts.PropertyDeclaration | ts.PropertySignature 
                    | ts.GetAccessorDeclaration | ts.SetAccessorDeclaration
    ) {
        let type : ts.TypeNode = node.type;
        if (!type && ts.isSetAccessor(node) && node.parameters.length > 0) {
            type = node.parameters[0].type;
        }

        return [
            ...this.typeNode(
                type, 'type', 
                (ts.isPropertyDeclaration(node) || ts.isGetAccessor(node) || ts.isSetAccessor(node)) 
                    && node.decorators?.length > 0
            ),
            metadataDecorator('rt:f', `${F_PROPERTY}${getVisibility(node.modifiers)}${isReadOnly(node.modifiers)}${node.questionToken ? F_OPTIONAL : ''}`)
        ];
    }

    methodFlags(node : ts.MethodDeclaration | ts.MethodSignature | ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction) {
        if (ts.isFunctionDeclaration(node) || ts.isArrowFunction(node)) {
            let type = F_FUNCTION;
            return `${type}${isAsync(node.modifiers)}${ts.isArrowFunction(node) ? F_ARROW_FUNCTION : ''}`;
        }
        
        let type = F_METHOD;
        let flags = `${type}${getVisibility(node.modifiers)}${isAbstract(node.modifiers)}${isAsync(node.modifiers)}`;
        
        if (ts.isMethodDeclaration(node) && (node.modifiers ?? <ts.Modifier[]>[]).some(x => x.kind === ts.SyntaxKind.StaticKeyword))
            flags += F_STATIC;

        if (node.questionToken)
            flags += F_OPTIONAL;
        
        if (!node.type)
            flags += F_INFERRED;
        
        return flags;
    }

    method(node : ts.MethodDeclaration | ts.MethodSignature | ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction) {
        let decs : ts.Decorator[] = [];

        if (this.emitStandardMetadata && ts.isMethodDeclaration(node) && node.decorators?.length > 0)
            decs.push(legacyMetadataDecorator('design:type', literalNode(ts.factory.createIdentifier('Function'))));
                        
        decs.push(...this.params(node));
        decs.push(metadataDecorator('rt:f', this.methodFlags(node)));

        let allowStandardMetadata = ts.isMethodDeclaration(node) && node.decorators?.length > 0;

        if (node.type) {
            decs.push(...this.typeNode(node.type, 'returntype', allowStandardMetadata));
        } else {
            let signature = this.checker.getSignatureFromDeclaration(node);
            if (signature)
                decs.push(...this.type(signature.getReturnType(), undefined, 'returntype', allowStandardMetadata));
        }

        return decs;
    }

    params(node : ts.FunctionLikeDeclaration | ts.MethodSignature): ts.Decorator[] {
        let decs : ts.Decorator[] = [];
        let standardParamTypes : ts.Expression[] = [];
        let serializedParamMeta : any[] = [];

        for (let param of node.parameters) {
            if (param.name.getText() === 'this')
                continue;
            
            let expr = this.legacyTypeEncoder.referToTypeNode(param.type);
            standardParamTypes.push(expr);
            let f : string[] = [];

            if (param.modifiers) {
                for (let modifier of Array.from(param.modifiers)) {
                    if (modifier.kind === ts.SyntaxKind.ReadonlyKeyword)
                        f.push(F_READONLY);
                    if (modifier.kind === ts.SyntaxKind.PrivateKeyword)
                        f.push(F_PRIVATE);
                    if (modifier.kind === ts.SyntaxKind.PublicKeyword)
                        f.push(F_PUBLIC);
                    if (modifier.kind === ts.SyntaxKind.ProtectedKeyword)
                        f.push(F_PROTECTED);
                }
            }

            if (param.questionToken)
                f.push(F_OPTIONAL)

            let meta : RtSerialized<RtParameter> = {
                n: param.name?.getText(),
                t: literalNode(forwardRef(this.typeEncoder.referToTypeOfInitializer(param.initializer, param.type))),
                v: param.initializer ? literalNode(functionForwardRef(param.initializer)) : null
            };

            if (f.length > 0)
                meta.f = f.join('');
            
            serializedParamMeta.push(literalNode(serialize(meta)));
        }

        decs.push(metadataDecorator('rt:p', serializedParamMeta));

        let eligibleForLegacyDecorators = (ts.isMethodDeclaration(node) || ts.isConstructorDeclaration(node));
        let isDecorated = node.decorators?.length > 0;
        if (ts.isConstructorDeclaration(node)) {
            isDecorated = node.parent.decorators?.length > 0;
        }

        if (this.emitStandardMetadata && eligibleForLegacyDecorators && isDecorated)
            decs.push(metadataDecorator('design:paramtypes', standardParamTypes.map(t => literalNode(t))));
        
        return decs;
    }

}
