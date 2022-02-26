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
        // For future use
    }
}
