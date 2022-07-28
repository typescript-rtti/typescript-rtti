import * as ts from 'typescript';
import {CodeSerializedNode} from '../common';

/**
 *
 * @param code @typescript string code
 */
export function codeNode(code:string): CodeSerializedNode {
    return { $__isTSNode: true, code };
}
