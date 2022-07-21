import {runSimple} from "../../runner.test";
import {expect} from "chai";
import {
    InterfaceToken,
    resolveType,
    RtAliasType,
    RtGenericType,
    RtType,
    T_ALIAS,
    T_GENERIC,
    T_OBJECT,
    T_UNION,
    T_VARIABLE
} from "../../common";
import {describe} from "razmin";

describe('generics compiler', it => {
    it('parameters info is emitted for alias', async () => {
        let exports = await runSimple({
            code: `
                 export type A<T,K,L> = T | K | L;
            `
        });
        const talias = Reflect.getMetadata('rt:t', exports["AΦA"] )()  as RtAliasType;
        expect(talias.p).to.eql(["T", "K", "L"]);
    });

    it('parameters info is emitted for interface', async () => {
        let exports = await runSimple({
            code: `
                 export interface A<T,K,L> {
                     a: T;
                     b: K;
                     c: L;
                     };
            `
        });
        const interf = exports.IΦA;
        const params = Reflect.getMetadata('rt:tp', interf) as string[];
        expect(params).to.eql(["T", "K", "L"]);
    });

    it('parameters info is emitted for class', async () => {
        let exports = await runSimple({
            code: `
                 export class A<T,K,L> {
                     a: T;
                     b: K;
                     c: L;
                     };
            `
        });
        const cls = exports.A;
        const params = Reflect.getMetadata('rt:tp', cls) as string[];
        expect(params).to.eql(["T", "K", "L"]);
    });


    it('deep aliased generics', async () => {
        let exports = await runSimple({
            code: `
                export type Something = number;
                export type SomethingLiteral = 1;
                export interface C {
                    a: Something;
                    b: SomethingLiteral;
                }
                export interface D<T> {
                    a: T;
                    b: T;
                }
                export type B = C;
                export type A = B;
                export type C2 = D<A>;
                export type C = C2;
            `
        });
        const cls = exports.AΦC;
        const c = Reflect.getMetadata('rt:t', cls)() as RtAliasType;
        expect(c.TΦ).to.eql(T_ALIAS);
        const c2 = resolveType(c.t) as RtAliasType;
        expect(c2.TΦ).to.eql(T_ALIAS);
        const da = resolveType(c2.t) as RtGenericType;
        expect(da.TΦ).to.eql(T_GENERIC);
        expect(da.p.length).to.eql(1);
        const pa = da.p[0] as RtAliasType;
        expect(pa.TΦ).to.eql(T_ALIAS);
        expect(pa.name).to.eql("A");
    });

    it('deep aliased generics 2', async () => {
        let exports = await runSimple({
            code: `
                   import { reflect } from 'typescript-rtti';
                    export interface I<T,K>{
                        a:T;
                        b:K;
                    }
                    export type C<T> = I<T,string>;
                    export type B<T> = C<T>;
                    export type A<T> = B<T>;
                    export type T = A<{a:string}>;
            `
        });
        const cls = exports.AΦT;
        const T = Reflect.getMetadata('rt:t', cls)() as RtAliasType;
        expect(T.TΦ).to.eql(T_ALIAS);

        const AG = resolveType(T.t) as RtGenericType;
        expect(AG.TΦ).to.eql(T_GENERIC);
        expect(AG.p.length).to.eql(1);
        const A = resolveType(AG.t) as RtAliasType;
        expect(A.TΦ).to.eql(T_ALIAS);
        expect(A.name).to.eql("A");
        const BG = resolveType(A.t) as RtGenericType;
        expect(BG.TΦ).to.eql(T_GENERIC);
        expect(BG.p.length).to.eql(1);
        const B = resolveType(BG.t) as RtAliasType;
        expect(B.TΦ).to.eql(T_ALIAS);
        expect(B.name).to.eql("B");
        const CG = resolveType(B.t) as RtGenericType;
        expect(CG.TΦ).to.eql(T_GENERIC);
        expect(CG.p.length).to.eql(1);
        const C = resolveType(CG.t) as RtAliasType;
        expect(C.TΦ).to.eql(T_ALIAS);
        expect(C.name).to.eql("C");
        const I = resolveType(C.t) as RtGenericType;
        expect(I.TΦ).to.eql(T_GENERIC);
        expect(I.p.length).to.eql(2);

        const Ia = resolveType(I.t) as InterfaceToken;
        expect(Ia.name).to.eql("I");

    });

});



