import { Visit, VisitorBase } from "./visitor-base";
import { ClassDetails } from "./class-details";
import * as ts from 'typescript';

export class ClassAnalyzer extends VisitorBase {
    private isStatic(decl : ts.Declaration) {
        return (decl.modifiers ?? <ts.Modifier[]>[]).some(x => x.kind === ts.SyntaxKind.StaticKeyword);
    }

    static analyze(decl : ts.ClassDeclaration, context : ts.TransformationContext) {
        try {
            let analyzer = new ClassAnalyzer(context);
            analyzer.visitEachChild(decl);
            return analyzer.details;
        } catch (e) {
            console.error(`RTTI: During analyzer for class ${decl.name.getText()}: ${e.message}`);
            throw e;
        }
    }

    details : ClassDetails = {
        methodNames: [],
        propertyNames: [],
        staticMethodNames: [],
        staticPropertyNames: []
    };

    private addItem(list : string[], prop : string) {
        if (!list.includes(prop))
            list.push(prop);
    }

    @Visit([ts.SyntaxKind.PropertyDeclaration, ts.SyntaxKind.GetAccessor, ts.SyntaxKind.SetAccessor])
    property(decl : ts.PropertyDeclaration | ts.GetAccessorDeclaration | ts.SetAccessorDeclaration) {
        this.addItem(
            this.isStatic(decl) 
            ? this.details.staticPropertyNames 
            : this.details.propertyNames, 
            decl.name.getText()
        );
    }

    @Visit(ts.SyntaxKind.MethodDeclaration)
    method(decl : ts.MethodDeclaration) {
        this.addItem(
            this.isStatic(decl) 
            ? this.details.staticMethodNames 
            : this.details.methodNames, 
            decl.name.getText()
        );
    }

    @Visit(ts.SyntaxKind.Constructor)
    ctor(decl : ts.ConstructorDeclaration) {
        for (let param of decl.parameters) {
            let isProperty = 
                param.modifiers 
                && (
                    param.modifiers.some(x => x.kind === ts.SyntaxKind.PublicKeyword)
                    || param.modifiers.some(x => x.kind === ts.SyntaxKind.ProtectedKeyword)
                    || param.modifiers.some(x => x.kind === ts.SyntaxKind.PrivateKeyword)
                    || param.modifiers.some(x => x.kind === ts.SyntaxKind.ReadonlyKeyword)
                )
            ;

            if (isProperty)
                this.addItem(this.details.propertyNames, param.name.getText());
        }
    }
}