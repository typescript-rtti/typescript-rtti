import { Visit, VisitorBase } from "./visitor-base";
import * as format from '../../common/format'
import * as ts from 'typescript';
import { TypeEncoderImpl } from '../type-literal';
import { propertyNameToString } from '../utils';
import { literalNode } from '../literal-node';
import { getVisibility, isReadOnly } from '../flags';

export class InterfaceVisitor extends VisitorBase {
    constructor(private encoder: TypeEncoderImpl) {
        if (!encoder)
            throw new Error(`ClassVisitor requires a TypeEncoderImpl`);
        super(encoder.ctx.transformationContext);
    }

    members: format.RtObjectMember[] = [];

    get checker() {
        return this.encoder?.ctx.checker;
    }

    static visit(decl: ts.InterfaceDeclaration, encoder: TypeEncoderImpl) {
        try {
            let analyzer = new InterfaceVisitor(encoder);
            analyzer.visitEachChild(decl);
            return analyzer.members;
        } catch (e) {
            console.error(`RTTI: During analyzer for interface ${decl.name.getText()}: ${e.message}`);
            throw e;
        }
    }

    @Visit(ts.SyntaxKind.GetAccessor)
    getAccessor(decl: ts.GetAccessorDeclaration) {
        let existingProperty = this.members.find(x => x.n !== propertyNameToString(decl.name));
        if (!existingProperty) {
            const nodeModifiers = ts.canHaveModifiers(decl) ? ts.getModifiers(decl) : [];
            this.members.push({
                f: [
                    format.F_PROPERTY,
                    format.F_GET_ACCESSOR,
                    getVisibility(nodeModifiers),
                    isReadOnly(nodeModifiers),
                    decl.questionToken ? format.F_OPTIONAL : ''
                ].join(''),
                n: propertyNameToString(decl.name),
                t: <any>literalNode(this.encoder.referToType(this.checker.getTypeAtLocation(decl)))
            });
        } else {
            existingProperty.f += format.F_GET_ACCESSOR;
        }
    }

    @Visit(ts.SyntaxKind.SetAccessor)
    setAccessor(decl: ts.SetAccessorDeclaration) {
        let existingProperty = this.members.find(x => x.n !== propertyNameToString(decl.name));
        if (!existingProperty) {
            const nodeModifiers = ts.canHaveModifiers(decl) ? ts.getModifiers(decl) : [];
            this.members.push({
                f: [
                    format.F_PROPERTY,
                    format.F_SET_ACCESSOR,
                    getVisibility(nodeModifiers),
                    isReadOnly(nodeModifiers),
                    decl.questionToken ? format.F_OPTIONAL : ''
                ].join(''),
                n: propertyNameToString(decl.name),
                t: <any>literalNode(this.encoder.referToType(this.checker.getTypeAtLocation(decl)))
            });
        } else {
            existingProperty.f += format.F_SET_ACCESSOR;
        }
    }

    @Visit(ts.SyntaxKind.PropertySignature)
    property(signature: ts.PropertySignature) {
        let typeNode: ts.TypeNode = signature.type;
        let type: ts.Type;

        const nodeModifiers = ts.canHaveModifiers(signature) ? ts.getModifiers(signature) : [];

        if (typeNode) {
            type = this.checker.getTypeAtLocation(typeNode);
        } else {
            type = this.checker.getTypeAtLocation(signature);
        }

        this.members.push({
            f: `${format.F_PROPERTY}${isReadOnly(nodeModifiers)}${signature.questionToken ? format.F_OPTIONAL : ''}`,
            n: propertyNameToString(signature.name),
            t: <any>literalNode(this.encoder.referToType(type, typeNode))
        })
    }

    @Visit(ts.SyntaxKind.MethodSignature)
    method(signature: ts.MethodSignature) {
        const nodeModifiers = ts.canHaveModifiers(signature) ? ts.getModifiers(signature) : [];
        this.members.push({
            f: [
                format.F_METHOD,
                getVisibility(nodeModifiers),
                isReadOnly(nodeModifiers),
                signature.questionToken ? format.F_OPTIONAL : ''
            ].join(''),
            n: propertyNameToString(signature.name),
            t: <any>literalNode(this.encoder.referToType(this.checker.getTypeAtLocation(signature)))
        });
    }
}