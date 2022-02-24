import { Visit, VisitorBase } from "./common/visitor-base";
import { RttiVisitor } from "./rtti-visitor-base";
import * as ts from "typescript";
import { ApiCallTransformer } from "./api-call-transformer";
import { RttiContext } from "./rtti-context";

export class DeclarationsEmitter extends RttiVisitor {
    static emit(sourceFile : ts.SourceFile, ctx : RttiContext): ts.SourceFile {
        return new DeclarationsEmitter(ctx).visitNode(sourceFile);
    }

    @Visit(ts.SyntaxKind.FunctionDeclaration)
    functionDecl(decl : ts.FunctionDeclaration) {
        
        // let apiCallChecker = new ApiCallTransformer(this.ctx);
        // apiCallChecker.visitNode(decl);

        // if (apiCallChecker.usesApi) {
        //     decl = ts.factory.updateFunctionDeclaration(
        //         decl, decl.decorators, decl.modifiers, decl.asteriskToken, decl.name,
        //         decl.typeParameters.concat(
        //             ts.factory.createTypeParameterDeclaration(`RΦg`, undefined, ts.factory.createToken(ts.SyntaxKind.AnyKeyword))
        //         ), 
        //         decl.parameters, decl.type, decl.body
        //     )
        // }
        
        return decl;
    }
}