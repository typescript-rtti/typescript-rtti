import { Visit, VisitorBase } from "./visitor-base";
import * as ts from 'typescript';
import * as format from '../../common/format';
import { cloneNode, getModifiers, hasModifier, propertyNameToString } from '../utils';
import { TypeEncoderImpl } from '../type-literal';
import { literalNode } from '../literal-node';
import { getVisibility, isAsync, isReadOnly, methodFlags } from '../flags';
import { forwardRef, functionForwardRef } from '../forward-ref';

export class ClassVisitor extends VisitorBase {
    constructor(private encoder: TypeEncoderImpl) {
        if (!encoder)
            throw new Error(`ClassVisitor requires a TypeEncoderImpl`);
        super(encoder.ctx.transformationContext);
    }

    members: format.RtObjectMember[] = [];

    static visit(decl: ts.ClassDeclaration | ts.ClassExpression, encoder: TypeEncoderImpl) {
        if (!encoder)
            throw new Error(`ClassVisitor requires a TypeEncoderImpl`);

        try {
            let visitor = new ClassVisitor(encoder);
            visitor.visitEachChild(decl);
            return visitor.members;
        } catch (e) {
            console.error(`RTTI: During analyzer for class ${decl.name.getText()}: ${e.message}`);
            throw e;
        }
    }

    get checker() {
        return this.encoder?.ctx.checker;
    }

    @Visit([ts.SyntaxKind.PropertyDeclaration, ts.SyntaxKind.GetAccessor, ts.SyntaxKind.SetAccessor])
    property(decl: ts.PropertyDeclaration | ts.GetAccessorDeclaration | ts.SetAccessorDeclaration) {

        let typeNode: ts.TypeNode = decl.type;
        let type: ts.Type;
        if (!typeNode && ts.isSetAccessor(decl) && decl.parameters.length > 0) {
            typeNode = decl.parameters[0].type;
        }

        const nodeModifiers = ts.canHaveModifiers(decl) ? ts.getModifiers(decl) : [];

        if (typeNode) {
            type = this.checker.getTypeAtLocation(typeNode);
        } else {
            type = this.checker.getTypeAtLocation(decl);
        }

        this.members.push({
            f: `${format.F_PROPERTY}${getVisibility(nodeModifiers)}${isReadOnly(nodeModifiers)}${decl.questionToken ? format.F_OPTIONAL : ''}`,
            n: propertyNameToString(decl.name),
            t: <any>literalNode(this.encoder.referToType(type, typeNode))
        })
    }

    @Visit(ts.SyntaxKind.MethodDeclaration)
    method(decl: ts.MethodDeclaration) {
        this.members.push({
            f: methodFlags(decl),
            n: propertyNameToString(decl.name),
            t: <any>literalNode(this.encoder.referToType(this.checker.getTypeAtLocation(decl)))
        })
    }

    @Visit(ts.SyntaxKind.Constructor)
    ctor(decl: ts.ConstructorDeclaration) {
        const params: format.RtParameter[] = [];

        for (let param of decl.parameters) {
            let paramModifiers = getModifiers(param);
            let isProperty =
                paramModifiers
                && (
                    paramModifiers.some(x => x.kind === ts.SyntaxKind.PublicKeyword)
                    || paramModifiers.some(x => x.kind === ts.SyntaxKind.ProtectedKeyword)
                    || paramModifiers.some(x => x.kind === ts.SyntaxKind.PrivateKeyword)
                    || paramModifiers.some(x => x.kind === ts.SyntaxKind.ReadonlyKeyword)
                )
            ;

            if (isProperty && ts.isIdentifier(param.name)) {
                this.members.push({
                    f: `${format.F_PROPERTY}`,
                    n: param.name.text,
                    t: <any>literalNode(this.encoder.referToType(this.checker.getTypeAtLocation(param)))
                });
            }

            params.push(this.parameter(param));
        }

        const nodeModifiers = ts.canHaveModifiers(decl) ? ts.getModifiers(decl) : [];
        this.members.push({
            n: 'constructor',
            f: '',
            t: <format.RtFunctionType>{
                TΦ: format.T_FUNCTION,
                f: `${format.F_CONSTRUCTOR}${getVisibility(nodeModifiers)}`,
                p: params,
                r: undefined
            }
        })
    }

    private parameter(param: ts.ParameterDeclaration): format.RtParameter {
        const modifiers = ts.canHaveModifiers(param) ? ts.getModifiers(param) : [];
        let flags: string = `${format.F_PARAMETER}`;

        if (hasModifier(modifiers, ts.SyntaxKind.PublicKeyword))
            flags += format.F_PUBLIC;
        if (hasModifier(modifiers, ts.SyntaxKind.ProtectedKeyword))
            flags += format.F_PROTECTED;
        if (hasModifier(modifiers, ts.SyntaxKind.PrivateKeyword))
            flags += format.F_PRIVATE;
        if (hasModifier(modifiers, ts.SyntaxKind.ReadonlyKeyword))
            flags += format.F_READONLY;
        if (param.questionToken)
            flags += format.F_OPTIONAL;
        if (param.dotDotDotToken)
            flags += format.F_REST;

        if (ts.isIdentifier(param.name)) {
            // Simple parameter
            return {
                n: param.name.text,
                f: flags,
                t: <any>literalNode(this.encoder.referToType(this.checker.getTypeAtLocation(param), param.type)),
                v: param.initializer ? <any>literalNode(functionForwardRef(cloneNode(param.initializer))) : undefined
            };
        } else if (ts.isArrayBindingPattern(param.name)) {
            return {
                f: flags,
                bt: 'a',
                b: Array.from(param.name.elements).map(x => this.bindingElement(x)),
                t: <any>literalNode(this.encoder.referToType(this.checker.getTypeAtLocation(param), param.type)),
                v: param.initializer ? <any>literalNode(functionForwardRef(cloneNode(param.initializer))) : undefined
            }
        } else if (ts.isObjectBindingPattern(param.name)) {
            return {
                f: flags,
                bt: 'o',
                b: Array.from(param.name.elements).map(x => this.bindingElement(x)),
                t: <any>literalNode(this.encoder.referToType(this.checker.getTypeAtLocation(param), param.type)),
                v: param.initializer ? <any>literalNode(functionForwardRef(cloneNode(param.initializer))) : undefined
            }
        }
    }

    private bindingElement(bindingElement: ts.ArrayBindingElement): format.RtParameter {
        if (ts.isOmittedExpression(bindingElement)) {
            return { bt: ',' };
        } else {
            if (ts.isObjectBindingPattern(bindingElement.name)) {
                return {
                    bt: 'o',
                    b: bindingElement.name.elements.map(x => this.bindingElement(x)),
                    v: bindingElement.initializer ? <any>literalNode(functionForwardRef(cloneNode(bindingElement.initializer))) : undefined
                }
            } else if (ts.isArrayBindingPattern(bindingElement.name)) {
                return {
                    bt: 'a',
                    b: bindingElement.name.elements.map(x => this.bindingElement(x)),
                    v: bindingElement.initializer ? <any>literalNode(functionForwardRef(cloneNode(bindingElement.initializer))) : undefined
                }
            }
            return { bt: 'a', }
        }
    }
}