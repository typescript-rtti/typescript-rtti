import { Visit, VisitorBase } from "./visitor-base";
import { InterfaceDetails } from "./interface-details";
import * as ts from 'typescript';

export class InterfaceAnalyzer extends VisitorBase {
    details : InterfaceDetails = {
        methodNames: [],
        propertyNames: []
    }

    static analyze(decl : ts.InterfaceDeclaration, context : ts.TransformationContext) {
        try {
            let analyzer = new InterfaceAnalyzer(context);
            analyzer.visitEachChild(decl);
            return analyzer.details;
        } catch (e) {
            console.error(`RTTI: During analyzer for interface ${decl.name.getText()}: ${e.message}`);
            throw e;
        }
    }
    
    private addItem(array : string[], item : string) {
        if (!array.includes(item))
            array.push(item);
    }

    @Visit(ts.SyntaxKind.PropertySignature)
    property(signature : ts.PropertySignature) {
        this.addItem(this.details.propertyNames, signature.name.getText());
    }

    @Visit(ts.SyntaxKind.MethodSignature)
    method(signature : ts.MethodSignature) {
        this.addItem(this.details.methodNames, signature.name.getText());
    }
}