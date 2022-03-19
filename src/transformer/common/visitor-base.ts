import * as ts from 'typescript';

export function Visit(kind: ts.SyntaxKind | ts.SyntaxKind[]) {
    if (!Array.isArray(kind))
        kind = [kind];

    let kinds = <ts.SyntaxKind[]>kind;
    return (target, propertyKey) => { target[propertyKey].kinds = kinds; };
}

export class VisitorBase {
    constructor(readonly context: ts.TransformationContext) {
    }

    #visitationMap: Map<ts.SyntaxKind, string[]>;

    traceVisits = false;

    #buildMap() {
        if (this.#visitationMap)
            return;

        this.#visitationMap = new Map();

        let methodNames = Object.getOwnPropertyNames(this.constructor.prototype)
            .filter(x => !['constructor', 'visitEachChild'].includes(x))
            .filter(x => typeof this.constructor.prototype[x] === 'function')
            ;

        for (let methodName of methodNames) {
            let kinds = this.constructor.prototype[methodName].kinds ?? [];
            for (let kind of kinds) {
                let receivers = this.#visitationMap.get(kind) ?? [];
                receivers.push(methodName);
                this.#visitationMap.set(kind, receivers);
            }
        }

        this.#visitor = (node: ts.Node) => {
            if (!node)
                return;

            let receivers = this.#visitationMap.get(node.kind) ?? [];
            if (receivers.length === 0) {
                if (this.traceVisits)
                    console.log(`${this.constructor.name}: [Auto] Visiting ${ts.SyntaxKind[node.kind]}`);
                return ts.visitEachChild(node, this.#visitor, this.context);
            }

            if (this.traceVisits)
                console.log(`${this.constructor.name}: Visiting ${ts.SyntaxKind[node.kind]}`);

            for (let receiver of receivers) {
                let result = this[receiver](node);

                if (result === null)
                    return undefined;
                if (result === undefined)
                    continue;

                node = result;
            }

            return node;
        };
    }

    #visitor: (node: ts.Node) => ts.VisitResult<ts.Node>;

    visitNode<T extends ts.Node>(node: T) {
        this.#buildMap();
        return ts.visitNode(node, this.#visitor);
    }

    visitEachChild<T extends ts.Node>(node: T) {
        this.#buildMap();
        return ts.visitEachChild(node, this.#visitor, this.context);
    }
}