import * as format from '../../common/format';
import { Type } from './type';

export class TupleElement {
    constructor(readonly ref: Readonly<format.RtTupleElement>) {
    }

    toString() {
        return `${this.name} : ${this.type}`;
    }

    get name(): string {
        return this.ref.n;
    }

    private _type: Type;
    get type(): Type {
        if (this._type)
            return this._type;
        return this._type = Type.createFromRtRef(this.ref.t);
    }

    static of(type: Type);
    static of(name: string, type: Type);
    static of(...args: (string | Type)[]) {
        if (args.length === 1)
            return this.of(undefined, args[0] as Type);

        let element = new TupleElement({
            n: args[0] as string,
            t: (args[1] as Type).ref
        });

        element._type = args[1] as Type;
        return element;
    }
}
