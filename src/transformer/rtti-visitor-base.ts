import { RttiContext } from "./rtti-context";
import { VisitorBase } from "./common/visitor-base";

export class RttiVisitor extends VisitorBase {
    constructor(
        readonly ctx : RttiContext
    ) {
        super(ctx.transformationContext);
    }

    get program() { return this.ctx.program; }
    get checker() { return this.ctx.checker; }
    get trace() { return this.ctx.trace; }
    get sourceFile() { return this.ctx.sourceFile; }
    get importMap() { return this.ctx.importMap; }
}