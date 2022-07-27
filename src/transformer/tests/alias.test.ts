import {runSimple} from "../../runner.test";
import {expect} from "chai";
import {
    F_OPTIONAL,
    RtAliasType, RtGenericType, RtObjectMember,
    RtObjectType,
    RtType,
    T_ALIAS, T_ANY, T_ARRAY,
    T_GENERIC, T_INTERSECTION,
    T_OBJECT, T_TUPLE,
    T_UNION,
    T_VARIABLE
} from "../../common";
import {describe} from "razmin";

function getAType(exports,identity: string | RtType) {
    let name = identity;
    let type = null;
    let talias = null;
    if (typeof identity !== 'object') {
        talias = exports["AΦ" + name];
        let ftype: () => RtAliasType = Reflect.getMetadata('rt:t', talias);
        expect(ftype).not.undefined;
        type = ftype();
    } else {
        type = identity;
        expect(type.TΦ).to.equal(T_ALIAS);
        return type.t;
    }

    expect(type.TΦ).to.equal(T_ALIAS);
    expect(type.name).to.equal(name);
    expect(type.a().identity).to.equal(talias.identity);
    // resolve alias type
    return type.t
}

describe('alias compiler', it => {
    it('rt:t is emitted on alias', async () => {
        let exports = await runSimple({
            code: `
                 export interface I {}
                 export type A = number;
                 export type B = number;
                 export type C = string;
                 export type G = C;
                 export type D<T> = bigint;
                 export type E<T> = {v:T,a:D<string>};
                 export type F = B | C | D<E<B>>;
                 export type K<T> = T;
                 export type L = K<any>;
                 export type H = E<number>;
                 export type J = I;
                 export type Recursive = Recursive;
                 export type Recursive2<T> = Recursive2<T>;
            `
        });

        function getAType(identity: string | RtType) {
            let name = identity;
            let type = null;
            let talias = null;
            if (typeof identity !== 'object') {
                talias = exports["AΦ" + name];
                let ftype: () => RtAliasType = Reflect.getMetadata('rt:t', talias);
                expect(ftype).not.undefined;
                type = ftype();
            } else {
                type = identity;
                expect(type.TΦ).to.equal(T_ALIAS);
                return type.t;
            }

            expect(type.TΦ).to.equal(T_ALIAS);
            expect(type.name).to.equal(name);
            expect(type.a().identity).to.equal(talias.identity);
            // resolve alias type
            return type.t
        }

        expect(getAType('A')).to.eql(Number);
        expect(getAType('B')).to.eql(Number);
        expect(getAType('C')).to.eql(String);
        expect(getAType(getAType('G'))).to.eql(String);
        expect(getAType('D')).to.eql(BigInt);

        expect(getAType('E')['TΦ']).to.eql(T_OBJECT);
        expect(getAType('E')['m'].find(v => v.n === 'a').t["TΦ"]).to.eql(T_GENERIC);

        expect(getAType('F')['TΦ']).to.eql(T_UNION);

        expect(getAType('K')['TΦ']).to.eql(T_VARIABLE);
        expect(getAType(getAType('K')['t'])).to.eql(getAType('K'));

        expect(getAType('L')['TΦ']).to.eql(T_GENERIC);
        expect(getAType('H')['TΦ']).to.eql(T_GENERIC);
        expect(getAType('J')['name']).to.eql("I");

        expect(getAType('Recursive')['TΦ']).to.eql(T_ALIAS);
        expect(getAType('Recursive')['name']).to.eql("Recursive");

        expect(getAType('Recursive2')['TΦ']).to.eql(T_GENERIC);
        expect(getAType('Recursive2')['t']['TΦ']).to.eql(T_ALIAS);

    });

    it('alias chain', async () => {
        let exports = await runSimple({
            code: `
                 export interface I {}
                 export type A = I;
                 export type B = A;
                 export type C = B;
            `
        });

        function getAType(identity: string | RtType) {
            let name = identity;
            let type = null;
            let talias = null;
            if (typeof identity !== 'object') {
                talias = exports["AΦ" + name];
                let ftype: () => RtAliasType = Reflect.getMetadata('rt:t', talias);
                expect(ftype).not.undefined;
                type = ftype();
            } else {
                type = identity;
                expect(type.TΦ).to.equal(T_ALIAS);
                return (type.t);
            }

            expect(type.TΦ).to.equal(T_ALIAS);
            expect(type.name).to.equal(name);
            expect(type.a().identity).to.equal(talias.identity);
            // resolve alias type
            return (type.t)
        }

        expect(getAType('C')['name']).to.eql("B");
        expect(getAType(getAType('C'))["name"]).to.eql("A");
        expect(getAType(getAType(getAType('C')))["name"]).to.eql("I");
    });

    it('is emitted for alias usage ObjectLiteral', async () => {
        let exports = await runSimple({
            code: `
                 export interface I {}
                 export type A = number;
                 export type B<T> = T;
                 export type C = I;
                 export type OBJ = {a:A,b:B<C>};
                 export type OBJT<T> = {a:T,b:B<C>};

                 export function f():{a:A,b:B<C>} {
                     return {a:1,b:{}};
                 }
            `
        });

        let f = Reflect.getMetadata('rt:t', exports.f );


        let ft: RtObjectType = f();
        expect(ft.TΦ).to.equal(T_OBJECT);
        let a:RtAliasType = ft.m.find(v => v.n === 'a').t as RtAliasType;
        let b:RtGenericType = ft.m.find(v => v.n === 'b').t as RtGenericType;
        expect(a.TΦ).to.equal(T_ALIAS);
        expect(a.name).to.equal("A");
        expect((a.t)).to.equal(Number);

        expect(b.TΦ).to.equal(T_GENERIC);
        expect(((b.t) as RtAliasType).TΦ).to.equal(T_ALIAS);
        expect(((b.t) as RtAliasType).name).to.equal("B");

        // @TODO object literal declare on type alias


    });

    it('is emitted for alias usage interface', async () => {
        let exports = await runSimple({
            code: `
                 export interface I {}
                 export type A = number;
                 export type B = number;
                 export type C = string;
                 export type G = C;
                 export type D<T> = bigint;
                 export type E<T> = {v:T,a:D<string>};
                 export type F = B | C | D<E<B>>;
                 export type K<T> = T;
                 export type L = K<any>;
                 export type H = E<number>;
                 export type J = I;
                 export type V<T> = K<T>;
                 export type REC = REC;
                 export type REC2<T> = REC2<T>;

                 export interface I2 {
                  a:A;
                  b:B
                  c:C;
                  g:G;
                  d:D<string>;
                  e:E<number>;
                  f:F;
                  k:K<string>;
                  l:L;
                  h:H;
                  j:J;
                  v:V<number>;
                  rec:REC;
                  rec2:REC2<string>;
                 }
            `
        });

        function getAType(identity: string) {
            const interf = exports.IΦI2;
            const ftype = Reflect.getMetadata('rt:t', interf.prototype, identity);
            expect(ftype).not.undefined;
            let type = ftype();
            if (type.TΦ === T_ALIAS) {
                expect(type.name).to.equal(identity.toUpperCase());
                // resolve alias type
                return (type.t)
            }
            if (type.TΦ === T_GENERIC) {
                expect((type.t)["TΦ"]).to.equal(T_ALIAS);
                expect((type.t)["name"]).to.equal(identity.toUpperCase());
                return type;
            }
            expect(type.TΦ).to.equal(T_ALIAS);
        }

        expect(getAType('a')).to.eql(Number);
        expect(getAType('b')).to.eql(Number);
        expect(getAType('c')).to.eql(String);

        expect(getAType('g')['TΦ']).to.eql(T_ALIAS);
        expect((getAType('g')['t'])).to.eql(String);

        expect(getAType('d')['TΦ']).to.eql(T_GENERIC);
        expect(getAType('e')['TΦ']).to.eql(T_GENERIC);
        expect(getAType('f')['TΦ']).to.eql(T_UNION);
        expect(getAType('k')['TΦ']).to.eql(T_GENERIC);
        expect(getAType('l')['TΦ']).to.eql(T_GENERIC);
        expect(getAType('h')['TΦ']).to.eql(T_GENERIC);
        expect(getAType('j')['name']).to.eql("I");
        expect(getAType('v')['TΦ']).to.eql(T_GENERIC);
        expect(getAType('rec')['TΦ']).to.eql(T_ALIAS);
        expect(getAType('rec2')['TΦ']).to.eql(T_GENERIC);


    });

    it('is emitted for alias usage class', async () => {
        let exports = await runSimple({
            code: `
                 export interface I {}
                 export type A = number;
                 export type B = number;
                 export type C = string;
                 export type G = C;
                 export type D<T> = bigint;
                 export type E<T> = {v:T,a:D<string>};
                 export type F = B | C | D<E<B>>;
                 export type K<T> = T;
                 export type L = K<any>;
                 export type H = E<number>;
                 export type J = I;
                 export type V<T> = K<T>;
                 export type REC = REC;
                 export type REC2<T> = REC2<T>;

                 export class C2 {
                  a:A;
                  b:B
                  c:C;
                  g:G;
                  d:D<string>;
                  e:E<number>;
                  f:F;
                  k:K<string>;
                  l:L;
                  h:H;
                  j:J;
                  v:V<number>;
                  rec:REC;
                  rec2:REC2<string>;
                 }
            `
        });

        function getAType(identity: string) {
            const interf = exports.C2;
            const ftype = Reflect.getMetadata('rt:t', interf.prototype, identity);
            expect(ftype).not.undefined;
            let type = ftype();
            if (type.TΦ === T_ALIAS) {
                expect(type.name).to.equal(identity.toUpperCase());
                // resolve alias type
                return (type.t)
            }
            if (type.TΦ === T_GENERIC) {
                expect((type.t)["TΦ"]).to.equal(T_ALIAS);
                expect((type.t)["name"]).to.equal(identity.toUpperCase());
                return type;
            }
            expect(type.TΦ).to.equal(T_ALIAS);
        }

        expect(getAType('a')).to.eql(Number);
        expect(getAType('b')).to.eql(Number);
        expect(getAType('c')).to.eql(String);

        expect(getAType('g')['TΦ']).to.eql(T_ALIAS);
        expect((getAType('g')['t'])).to.eql(String);

        expect(getAType('d')['TΦ']).to.eql(T_GENERIC);
        expect(getAType('e')['TΦ']).to.eql(T_GENERIC);
        expect(getAType('f')['TΦ']).to.eql(T_UNION);
        expect(getAType('k')['TΦ']).to.eql(T_GENERIC);
        expect(getAType('l')['TΦ']).to.eql(T_GENERIC);
        expect(getAType('h')['TΦ']).to.eql(T_GENERIC);
        expect(getAType('j')['name']).to.eql("I");
        expect(getAType('v')['TΦ']).to.eql(T_GENERIC);
        expect(getAType('rec')['TΦ']).to.eql(T_ALIAS);
        expect(getAType('rec2')['TΦ']).to.eql(T_GENERIC);


    });

    it('is emitted for alias method & functions', async () => {
        let exports = await runSimple({
            code: `
                 export interface I {}
                 export type A = number;
                 export type B = number;
                 export type C = string;
                 export type G = C;
                 export type D<T> = bigint;
                 export type E<T> = {v:T,a:D<string>};
                 export type F = B | C | D<E<B>>;
                 export type K<T> = T;
                 export type L = K<any>;
                 export type H = E<number>;
                 export type J = I;
                 export type V<T> = K<T>;
                 export type REC = REC;
                 export type REC2<T> = REC2<T>;

                 export function fA(a:A):A{
                    return 1;
                 }

                 export function fAimp(a:A){
                    return <A>1;
                 }

                 export class CA{
                     fA(a:A):A{
                         return 1;
                        }

                      fAimp(a:A){
                         return <A>1;
                        }
                 }
            `
        });

        let CAfA = Reflect.getMetadata('rt:t', exports.CA.prototype, 'fA');
        let CAfAimp = Reflect.getMetadata('rt:t', exports.CA.prototype, 'fAimp');
        let fA = Reflect.getMetadata('rt:t', exports.fA );
        let fAimp = Reflect.getMetadata('rt:t', exports.fAimp );


        let aliastype: RtAliasType = CAfA();
        expect(aliastype.TΦ).to.equal(T_ALIAS);
        let type = (aliastype.t) as Number;
        expect(type).to.equal(Number);

         aliastype = fA();
        expect(aliastype.TΦ).to.equal(T_ALIAS);
        type = (aliastype.t) as Number;
        expect(type).to.equal(Number);

        // @TODO to be implemented

        // aliastype = CAfAimp();
        // expect(aliastype.TΦ).to.equal(T_ALIAS);
        // type = resolveType(aliastype.t) as Number;
        // expect(type).to.equal(Number);
        //
        // aliastype = fAimp();
        // expect(aliastype.TΦ).to.equal(T_ALIAS);
        // type = resolveType(aliastype.t) as Number;
        // expect(type).to.equal(Number);

    });
    /**
     * as typescript 4.7 this type is invalid and is resolved naturally to any
     */
    it('rt:t is emitted on alias union', async () => {
        let exports = await runSimple({
            code: `
                export type A = A | number;
            `
        });

        expect(getAType(exports,'A')['TΦ']).to.eql(T_ANY);
    });
    /**
     * as typescript 4.7 this type is invalid and is resolved naturally to any
     */
    it('rt:t is emitted on alias intersection', async () => {
        let exports = await runSimple({
            code: `
                export type A = A & number;
            `
        });

        expect(getAType(exports,'A')['TΦ']).to.eql(T_ANY);
    });

    it('rt:t is emitted on alias self', async () => {
        let exports = await runSimple({
            code: `
                export type A = A;
            `
        });

        expect(getAType(exports,'A')['TΦ']).to.eql(T_ALIAS);
    });

    it('rt:t is emitted on alias tuple self', async () => {
        let exports = await runSimple({
            code: `
                export type A = [A];
            `
        });

        expect(getAType(exports,'A')['TΦ']).to.eql(T_TUPLE);
    });

    it('rt:t is emitted on alias array self', async () => {
        let exports = await runSimple({
            code: `
                export type A = A[];
            `
        });

        expect(getAType(exports,'A')['TΦ']).to.eql(T_ARRAY);
    });
});

