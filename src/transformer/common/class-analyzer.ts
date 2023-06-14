import { Visit, VisitorBase } from "./visitor-base";
import { ClassDetails } from "./class-details";
import * as ts from 'typescript';
import { getModifiers } from '../utils';

export class ClassAnalyzer extends VisitorBase {
    private isStatic(decl: ts.Declaration) {
        return (getModifiers(decl)).some(x => x.kind === ts.SyntaxKind.StaticKeyword);
    }

    static analyze(decl: ts.ClassDeclaration | ts.ClassExpression, context: ts.TransformationContext) {
        try {
            let analyzer = new ClassAnalyzer(context);
            analyzer.visitEachChild(decl);
            return analyzer.details;
        } catch (e) {
            console.error(`RTTI: During analyzer for class ${decl.name.getText()}: ${e.message}`);
            throw e;
        }
    }

    details: ClassDetails = {
        methodNames: [],
        propertyNames: [],
        staticMethodNames: [],
        staticPropertyNames: []
    };

    private addItem<T>(list: T[], prop: T) {
        if (!list.includes(prop))
            list.push(prop);
    }

    @Visit([ts.SyntaxKind.PropertyDeclaration, ts.SyntaxKind.GetAccessor, ts.SyntaxKind.SetAccessor])
    property(decl: ts.PropertyDeclaration | ts.GetAccessorDeclaration | ts.SetAccessorDeclaration) {
        this.addItem(
            this.isStatic(decl)
                ? this.details.staticPropertyNames
                : this.details.propertyNames,
            decl.name
        );
    }

    @Visit(ts.SyntaxKind.MethodDeclaration)
    method(decl: ts.MethodDeclaration) {
        this.addItem(
            this.isStatic(decl)
                ? this.details.staticMethodNames
                : this.details.methodNames,
            decl.name
        );
    }

    @Visit(ts.SyntaxKind.Constructor)
    ctor(decl: ts.ConstructorDeclaration) {
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

            if (isProperty) {
                if (ts.isIdentifier(param.name)) {
                    this.addItem(this.details.propertyNames, param.name);
                } else {
                    // This *should* be impossible, as it would have to be something like:
                    // constructor(readonly [a, b]) which at the time this was written is not
                    // valid Typescript

                    throw new Error(
                        `Unexpected binding name as property in constructor for class ${decl.name.getText()}! Please file a bug!`
                    );
                }
            }
        }
    }
}