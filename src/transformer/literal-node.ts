import * as ts from 'typescript';
import { LiteralSerializedNode } from '../common';

export function literalNode(node : ts.Node): LiteralSerializedNode {
    return { $__isTSNode: true, node };
}
