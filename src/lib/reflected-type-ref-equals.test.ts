import { expect } from 'chai';
import { describe } from 'razmin';
import * as format from '../common/format';
import { ReflectedTypeRef } from './reflect';

describe('ReflectedTypeRef#equals()', it => {
    it('matches by reference', () => {
        let ref = new ReflectedTypeRef({ TΦ: format.T_VOID });
        expect(ref.equals(ref)).to.be.true;
    });
    it('matches intrinsics correctly', () => {
        let intrinsics = <format.RtIntrinsicIndicator[]>[
            format.T_VOID, format.T_ANY, format.T_UNKNOWN, format.T_UNDEFINED, format.T_TRUE, format.T_FALSE
        ];

        for (let intrinsic of intrinsics) {
            let ref = ReflectedTypeRef.createFromRtRef({ TΦ: intrinsic });
            expect(ref.equals(ref)).to.be.true;
            for (let intrinsic2 of intrinsics) {
                let ref2 = ReflectedTypeRef.createFromRtRef({ TΦ: intrinsic2 });
                expect(ref.equals(ref2)).to.equal(intrinsic === intrinsic2);
            }
        }
    });
    it('matches unions correctly', () => {
        let unionTypes1 = [ { TΦ: format.T_VOID }, { TΦ: format.T_UNKNOWN } ];
        let unionTypes2 = [ { TΦ: format.T_NULL }, { TΦ: format.T_UNDEFINED } ];

        let ref1 = ReflectedTypeRef.createFromRtRef({ TΦ: format.T_UNION, t: unionTypes1 });
        let ref2 = ReflectedTypeRef.createFromRtRef({ TΦ: format.T_UNION, t: unionTypes1.slice().reverse() });
        let ref3 = ReflectedTypeRef.createFromRtRef({ TΦ: format.T_UNION, t: unionTypes2 });
        let ref4 = ReflectedTypeRef.createFromRtRef({ TΦ: format.T_UNION, t: unionTypes2.slice().reverse() });
        let ref5 = ReflectedTypeRef.createFromRtRef({ TΦ: format.T_UNION, t: unionTypes1.slice(1) });

        expect(ref1.equals(ref1)).to.be.true;
        expect(ref1.equals(ref2)).to.be.true;
        expect(ref1.equals(ref3)).to.be.false;
        expect(ref1.equals(ref4)).to.be.false;
        expect(ref1.equals(ref5)).to.be.false;

        expect(ref2.equals(ref1)).to.be.true;
        expect(ref2.equals(ref2)).to.be.true;
        expect(ref2.equals(ref3)).to.be.false;
        expect(ref2.equals(ref4)).to.be.false;
        expect(ref2.equals(ref5)).to.be.false;

        expect(ref3.equals(ref1)).to.be.false;
        expect(ref3.equals(ref2)).to.be.false;
        expect(ref3.equals(ref3)).to.be.true;
        expect(ref3.equals(ref4)).to.be.true;
        expect(ref3.equals(ref5)).to.be.false;

        expect(ref4.equals(ref1)).to.be.false;
        expect(ref4.equals(ref2)).to.be.false;
        expect(ref4.equals(ref3)).to.be.true;
        expect(ref4.equals(ref4)).to.be.true;
        expect(ref4.equals(ref5)).to.be.false;

        expect(ref5.equals(ref1)).to.be.false;
        expect(ref5.equals(ref2)).to.be.false;
        expect(ref5.equals(ref3)).to.be.false;
        expect(ref5.equals(ref4)).to.be.false;
        expect(ref5.equals(ref5)).to.be.true;
    });
    it('matches intersections correctly', () => {
        let intersectTypes1 = [ { TΦ: format.T_VOID }, { TΦ: format.T_UNKNOWN } ];
        let intersectTypes2 = [ { TΦ: format.T_NULL }, { TΦ: format.T_UNDEFINED } ];

        let ref1 = ReflectedTypeRef.createFromRtRef({ TΦ: format.T_INTERSECTION, t: intersectTypes1 });
        let ref2 = ReflectedTypeRef.createFromRtRef({ TΦ: format.T_INTERSECTION, t: intersectTypes1.slice().reverse() });
        let ref3 = ReflectedTypeRef.createFromRtRef({ TΦ: format.T_INTERSECTION, t: intersectTypes2 });
        let ref4 = ReflectedTypeRef.createFromRtRef({ TΦ: format.T_INTERSECTION, t: intersectTypes2.slice().reverse() });
        let ref5 = ReflectedTypeRef.createFromRtRef({ TΦ: format.T_INTERSECTION, t: intersectTypes1.slice(1) });

        expect(ref1.equals(ref1)).to.be.true;
        expect(ref1.equals(ref2)).to.be.true;
        expect(ref1.equals(ref3)).to.be.false;
        expect(ref1.equals(ref4)).to.be.false;
        expect(ref1.equals(ref5)).to.be.false;

        expect(ref2.equals(ref1)).to.be.true;
        expect(ref2.equals(ref2)).to.be.true;
        expect(ref2.equals(ref3)).to.be.false;
        expect(ref2.equals(ref4)).to.be.false;
        expect(ref2.equals(ref5)).to.be.false;

        expect(ref3.equals(ref1)).to.be.false;
        expect(ref3.equals(ref2)).to.be.false;
        expect(ref3.equals(ref3)).to.be.true;
        expect(ref3.equals(ref4)).to.be.true;
        expect(ref3.equals(ref5)).to.be.false;

        expect(ref4.equals(ref1)).to.be.false;
        expect(ref4.equals(ref2)).to.be.false;
        expect(ref4.equals(ref3)).to.be.true;
        expect(ref4.equals(ref4)).to.be.true;
        expect(ref4.equals(ref5)).to.be.false;

        expect(ref5.equals(ref1)).to.be.false;
        expect(ref5.equals(ref2)).to.be.false;
        expect(ref5.equals(ref3)).to.be.false;
        expect(ref5.equals(ref4)).to.be.false;
        expect(ref5.equals(ref5)).to.be.true;
    });
    it('matches arrays correctly', () => {
        let ref1 = ReflectedTypeRef.createFromRtRef({ TΦ: format.T_ARRAY, e: format.TI_VOID });
        let ref2 = ReflectedTypeRef.createFromRtRef({ TΦ: format.T_ARRAY, e: format.TI_NULL });

        expect(ref1.equals(ref1)).to.be.true;
        expect(ref1.equals(ref2)).to.be.false;
        expect(ref2.equals(ref1)).to.be.false;
        expect(ref2.equals(ref2)).to.be.true;
    });
    it('matches generics correctly', () => {
        let ref1 = ReflectedTypeRef.createFromRtRef({ TΦ: format.T_GENERIC, t: format.TI_VOID, p: [format.TI_UNKNOWN, format.TI_FALSE] });
        let ref2 = ReflectedTypeRef.createFromRtRef({ TΦ: format.T_GENERIC, t: format.TI_VOID, p: [format.TI_UNKNOWN, format.TI_FALSE] });
        let ref3 = ReflectedTypeRef.createFromRtRef({ TΦ: format.T_GENERIC, t: format.TI_VOID, p: [format.TI_FALSE, format.TI_UNKNOWN] });
        let ref4 = ReflectedTypeRef.createFromRtRef({ TΦ: format.T_GENERIC, t: format.TI_VOID, p: [format.TI_FALSE] });
        let ref5 = ReflectedTypeRef.createFromRtRef({ TΦ: format.T_GENERIC, t: format.TI_NULL, p: [format.TI_FALSE, format.TI_UNKNOWN] });
        let ref6 = ReflectedTypeRef.createFromRtRef({ TΦ: format.T_GENERIC, t: format.TI_VOID, p: [] });

        expect(ref1.equals(ref1)).to.be.true;
        expect(ref1.equals(ref2)).to.be.true;
        expect(ref1.equals(ref3)).to.be.false;
        expect(ref1.equals(ref4)).to.be.false;
        expect(ref1.equals(ref5)).to.be.false;
        expect(ref1.equals(ref6)).to.be.false;

        expect(ref2.equals(ref1)).to.be.true;
        expect(ref2.equals(ref2)).to.be.true;
        expect(ref2.equals(ref3)).to.be.false;
        expect(ref2.equals(ref4)).to.be.false;
        expect(ref2.equals(ref5)).to.be.false;
        expect(ref2.equals(ref6)).to.be.false;
    });
    it('matches tuples correctly', () => {
        let ref1 = ReflectedTypeRef.createFromRtRef({ TΦ: format.T_TUPLE, e: [{ n: 'a', t: format.TI_UNKNOWN }, { n: 'b', t: format.TI_FALSE }] });
        let ref2 = ReflectedTypeRef.createFromRtRef({ TΦ: format.T_TUPLE, e: [{ n: 'a', t: format.TI_UNKNOWN }, { n: 'b', t: format.TI_FALSE }] });
        let ref3 = ReflectedTypeRef.createFromRtRef({ TΦ: format.T_TUPLE, e: [{ n: 'b', t: format.TI_UNKNOWN }, { n: 'a', t: format.TI_FALSE }] });
        let ref4 = ReflectedTypeRef.createFromRtRef({ TΦ: format.T_TUPLE, e: [{ n: 'a', t: format.TI_UNKNOWN }] });
        let ref5 = ReflectedTypeRef.createFromRtRef({ TΦ: format.T_TUPLE, e: [{ n: 'b', t: format.TI_UNKNOWN }] });
        let ref6 = ReflectedTypeRef.createFromRtRef({ TΦ: format.T_TUPLE, e: [] });

        expect(ref1.equals(ref1)).to.be.true;
        expect(ref1.equals(ref2)).to.be.true;
        expect(ref1.equals(ref3)).to.be.false;
        expect(ref1.equals(ref4)).to.be.false;
        expect(ref1.equals(ref5)).to.be.false;
        expect(ref1.equals(ref6)).to.be.false;
    });
    it('matches mapped types correctly', () => {
        let ref1 = ReflectedTypeRef.createFromRtRef({ TΦ: format.T_MAPPED, t: format.TI_VOID, p: [format.TI_UNKNOWN, format.TI_FALSE] });
        let ref2 = ReflectedTypeRef.createFromRtRef({ TΦ: format.T_MAPPED, t: format.TI_VOID, p: [format.TI_UNKNOWN, format.TI_FALSE] });
        let ref3 = ReflectedTypeRef.createFromRtRef({ TΦ: format.T_MAPPED, t: format.TI_VOID, p: [format.TI_FALSE, format.TI_UNKNOWN] });
        let ref4 = ReflectedTypeRef.createFromRtRef({ TΦ: format.T_MAPPED, t: format.TI_VOID, p: [format.TI_FALSE] });
        let ref5 = ReflectedTypeRef.createFromRtRef({ TΦ: format.T_MAPPED, t: format.TI_NULL, p: [format.TI_FALSE, format.TI_UNKNOWN] });
        let ref6 = ReflectedTypeRef.createFromRtRef({ TΦ: format.T_MAPPED, t: format.TI_VOID, p: [] });

        expect(ref1.equals(ref1)).to.be.true;
        expect(ref1.equals(ref2)).to.be.true;
        expect(ref1.equals(ref3)).to.be.false;
        expect(ref1.equals(ref4)).to.be.false;
        expect(ref1.equals(ref5)).to.be.false;
        expect(ref1.equals(ref6)).to.be.false;

        expect(ref2.equals(ref1)).to.be.true;
        expect(ref2.equals(ref2)).to.be.true;
        expect(ref2.equals(ref3)).to.be.false;
        expect(ref2.equals(ref4)).to.be.false;
        expect(ref2.equals(ref5)).to.be.false;
        expect(ref2.equals(ref6)).to.be.false;
    });
    it('matches classes correctly', () => {
        class A { }
        class B { }

        let ref1 = ReflectedTypeRef.createFromRtRef(A);
        let ref2 = ReflectedTypeRef.createFromRtRef(A);
        let ref3 = ReflectedTypeRef.createFromRtRef(B);

        expect(ref1.equals(ref1)).to.be.true;
        expect(ref1.equals(ref2)).to.be.true;
        expect(ref1.equals(ref3)).to.be.false;
    });
    it('matches interfaces correctly', () => {
        let IΦA = { name: 'A', prototype: {}, identity: Symbol('A (interface)') };
        let IΦB = { name: 'A', prototype: {}, identity: Symbol('A (interface)') };

        let ref1 = ReflectedTypeRef.createFromRtRef(IΦA);
        let ref2 = ReflectedTypeRef.createFromRtRef(IΦA);
        let ref3 = ReflectedTypeRef.createFromRtRef(IΦB);

        expect(ref1.equals(ref1)).to.be.true;
        expect(ref1.equals(ref2)).to.be.true;
        expect(ref1.equals(ref3)).to.be.false;
    });
});