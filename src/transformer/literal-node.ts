import * as ts from 'typescript';
import { LiteralSerializedNode } from '../common';

export function literalNode(expr : ts.Expression): LiteralSerializedNode {
    return { $__isTSNode: true, node: expr };
}
