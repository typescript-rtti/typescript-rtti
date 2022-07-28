import {runSimple} from "../../runner.test";
import {expect} from "chai";
import {
    InterfaceToken,
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

    it('reference alias inside <T> argument', async () => {
        let exports = await runSimple({
            code: `
                export interface I<T> {
                    a: T;
                    b: T;
                }
                export type B = number;
                export type A = I<B>;
            `
        });
        const cls = exports.AΦA;
        const AA = Reflect.getMetadata('rt:t', cls)() as RtAliasType;
        expect(AA.TΦ).to.eql(T_ALIAS);
        expect(AA.name).to.eql("A");
        const IB = (AA.t) as RtGenericType;
        expect(IB.TΦ).to.eql(T_GENERIC);
        expect(IB.p[0]).to.eql(Reflect.getMetadata('rt:t', exports.AΦB)());

        const AB = (IB.t) as InterfaceToken;
        expect(AB.name).to.eql("I");

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
        const AC = Reflect.getMetadata('rt:t', cls)() as RtAliasType;
        expect(AC.TΦ).to.eql(T_ALIAS);
        expect(AC.name).to.eql("C");
        const AC2 = (AC.t) as RtAliasType;
        expect(AC2.TΦ).to.eql(T_ALIAS);
        expect(AC2.name).to.eql("C2");
        const DA = (AC2.t) as RtGenericType;
        expect(DA.TΦ).to.eql(T_GENERIC);
        expect(DA.p[0]).to.eql(Reflect.getMetadata('rt:t', exports.AΦA)());

        const D = (DA.t) as InterfaceToken;
        expect(D.name).to.eql("D");

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

        const AG = (T.t) as RtGenericType;
        expect(AG.TΦ).to.eql(T_GENERIC);
        expect(AG.p.length).to.eql(1);
        const A = (AG.t) as RtAliasType;
        expect(A.TΦ).to.eql(T_ALIAS);
        expect(A.name).to.eql("A");
        const BG = (A.t) as RtGenericType;
        expect(BG.TΦ).to.eql(T_GENERIC);
        expect(BG.p.length).to.eql(1);
        const B = (BG.t) as RtAliasType;
        expect(B.TΦ).to.eql(T_ALIAS);
        expect(B.name).to.eql("B");
        const CG = (B.t) as RtGenericType;
        expect(CG.TΦ).to.eql(T_GENERIC);
        expect(CG.p.length).to.eql(1);
        const C = (CG.t) as RtAliasType;
        expect(C.TΦ).to.eql(T_ALIAS);
        expect(C.name).to.eql("C");
        const I = (C.t) as RtGenericType;
        expect(I.TΦ).to.eql(T_GENERIC);
        expect(I.p.length).to.eql(2);

        const Ia = (I.t) as InterfaceToken;
        expect(Ia.name).to.eql("I");

    });

});



