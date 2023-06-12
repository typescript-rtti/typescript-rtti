import { expect } from "chai";
import { describe, it } from "@jest/globals";
import { CallSite, reflect } from "../reflect";

describe('Library: Generic transience', () => {
    it('reflects upon callsites', async () => {

        let callSite = reflect(<CallSite>{
            TΦ: 'c',
            t: undefined,
            p: [123, Boolean],
            r: undefined,
            tp: [String, 321],
        });

        expect(callSite.parameters.length).to.equal(2);
        expect(callSite.parameters[0].isClass(Number)).to.be.true;
        expect(callSite.parameters[0].is('literal')).to.be.true;
        expect(callSite.parameters[0].as('literal').value).to.equal(123);
        expect(callSite.parameters[1].isClass(Boolean)).to.be.true;
        expect(callSite.parameters[1].as('class').class).to.equal(Boolean);
        expect(callSite.parameters[1].is('literal')).to.be.false;

        expect(callSite.typeParameters.length).to.equal(2);
        expect(callSite.typeParameters[0].isClass(String)).to.be.true;
        expect(callSite.typeParameters[0].is('literal')).to.be.false;
        expect(callSite.typeParameters[1].isClass(Number)).to.be.true;
        expect(callSite.typeParameters[1].is('literal')).to.be.true;
        expect(callSite.typeParameters[1].as('literal').value).to.equal(321);

    });
});