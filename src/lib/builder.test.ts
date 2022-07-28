import {expect} from "chai";
import {describe} from "razmin";
import {
    AliasTypeBuilder, ArrayTypeBuilder, GenericTypeBuilder,
    InterfaceTypeBuilder, IntersectionTypeBuilder,
    ObjectLikeTypeBuilder, TupleTypeBuilder,
    TypeBuilder, UnionTypeBuilder,
    VariableTypeBuilder
} from "./builder";
import {F_OPTIONAL} from "../common";
import {ReflectedInterfaceRef, ReflectedObjectRef} from "./reflect";


describe('Type builders', it => {
    it('TypeBuilder', async () => {
        const builder = new TypeBuilder();
        builder.defineMetadata("aaa", 1)
        builder.defineMetadata("aaa", 2, "bbb")

        expect(builder.getMetadata("aaa")).to.equal(1);
        expect(builder.getMetadata("aaa", "bbb")).to.equal(2);

        const defaultType = builder.getType();
        expect(defaultType.isUnknown()).to.be.true;
    });

    it('VariableTypeBuilder', async () => {
        const builder = new VariableTypeBuilder();
        builder.name = "T";
        builder.setTypeDeclaration(new ObjectLikeTypeBuilder())

        const v = builder.getType();
        expect(v.kind).to.equal("variable");
        expect(v.as("variable").name).to.equal("T");
        expect(v.as("variable").typeDecl.kind).to.equal("object");
    });

    it('AliasTypeBuilder', async () => {
        const builder = new AliasTypeBuilder();
        builder.name = "A";
        builder.setAliasedType(new ObjectLikeTypeBuilder())
        builder.addParameters("T", "K")

        const v = builder.getType();
        expect(v.kind).to.equal("object");
        expect(v.isAliased()).to.equal(true);
        expect(v.as("alias").name).to.equal("A");
        expect(v.as("alias").arguments).to.have.same.members(["T", "K"]);
    });

    it('ObjectLikeBuilder', async () => {
        const builderA = new ObjectLikeTypeBuilder();
        builderA.addProperty("a", Number);
        builderA.addProperty("b", String, F_OPTIONAL);

        const builderB = new ObjectLikeTypeBuilder();
        builderB.extend(builderA);
        builderB.addProperty("c", Number);
        builderB.addProperty("d", String);
        builderB.extend({
            pop: 1,
            prop2: {
                type: String,
                flags: F_OPTIONAL,
            },
            sub: builderA.getType(),
        });

        const typeA = builderA.getType();
        expect(typeA.kind).to.equal("object");
        const mem = typeA.as(ReflectedObjectRef).members;

        expect(mem.length).to.equal(2);
        expect(mem[0].name).to.equal("a");
        expect(mem[0].type.kind).to.equal("class");
        expect(mem[0].type.as("class").isClass(Number)).to.equal(true);
        expect(mem[0].isOptional).to.equal(false);
        expect(mem[1].name).to.equal("b");
        expect(mem[1].type.kind).to.equal("class");
        expect(mem[1].type.as("class").isClass(String)).to.equal(true);
        expect(mem[1].isOptional).to.equal(true);

        const typeB = builderB.getType();
        expect(typeB.kind).to.equal("object");
        const memB = typeB.as(ReflectedObjectRef).members;
        expect(memB.length).to.equal(7);
        expect(memB[0].name).to.equal("a");
        expect(memB[0].type.kind).to.equal("class");
        expect(memB[0].type.as("class").isClass(Number)).to.equal(true);
        expect(memB[1].name).to.equal("b");
        expect(memB[1].type.kind).to.equal("class");
        expect(memB[1].type.as("class").isClass(String)).to.equal(true);
        expect(memB[1].isOptional).to.equal(true);
        expect(memB[2].name).to.equal("c");
        expect(memB[2].type.kind).to.equal("class");
        expect(memB[3].name).to.equal("d");
        expect(memB[3].type.kind).to.equal("class");
        expect(memB[4].name).to.equal("pop");
        expect(memB[4].type.kind).to.equal("literal");
        expect(memB[4].type.as("literal").value).to.equal(1);
        expect(memB[5].name).to.equal("prop2");
        expect(memB[5].type.kind).to.equal("class");
        expect(memB[5].type.as("class").isClass(String)).to.equal(true);
        expect(memB[5].isOptional).to.equal(true);

        const sub = typeB.as(ReflectedObjectRef).members[6].type.as(ReflectedObjectRef);
        expect(sub.members.length).to.equal(2);
        expect(sub.members[0].name).to.equal("a");
        expect(sub.members[0].type.kind).to.equal("class");
        expect(sub.members[0].type.as("class").isClass(Number)).to.equal(true);
        expect(sub.members[1].name).to.equal("b");
        expect(sub.members[1].type.kind).to.equal("class");
        expect(sub.members[1].type.as("class").isClass(String)).to.equal(true);
        expect(sub.members[1].isOptional).to.equal(true);

    });

    it('InterfaceTypeBuilder', async () => {
        const builderA = new InterfaceTypeBuilder();
        builderA.name = "A";
        builderA.addProperty("a", Number);
        builderA.addProperty("b", String, F_OPTIONAL);

        expect(builderA.getMetadata('rt:P')).to.have.same.members(["a", "b"]);

        builderA.defineMetadata("aaa", 1)
        builderA.defineMetadata("aaa", 2, "a")

        expect(builderA.getMetadata("aaa")).to.equal(1);
        expect(builderA.getMetadata("aaa", "a")).to.equal(2);
        const tokA = builderA.getToken();
        expect(Reflect.getMetadata("aaa", tokA)).to.equal(1);
        expect(Reflect.getMetadata("aaa", tokA.prototype, "a")).to.equal(2);
        expect(Reflect.getMetadata("rt:f", tokA.prototype, "b")).to.equal("P?");

        const builderB = new InterfaceTypeBuilder();
        builderB.name = "B";
        builderB.extend(builderA);
        builderB.addProperty("c", Number);
        builderB.addProperty("d", String);
        builderB.extend({
            pop: 1,
            prop2: {
                type: String,
                flags: F_OPTIONAL,
            },
            sub: builderA.getType(),
        });
        builderB.addParameters("T", "K")

        const typeA = builderA.getType();
        expect(typeA.kind).to.equal("interface");
        const mem = typeA.as(ReflectedInterfaceRef).reflectedInterface.properties;

        expect(mem.length).to.equal(2);
        expect(mem[0].name).to.equal("a");
        expect(mem[0].type.kind).to.equal("class");
        expect(mem[0].type.as("class").isClass(Number)).to.equal(true);
        expect(mem[0].isOptional).to.equal(false);
        expect(mem[1].name).to.equal("b");
        expect(mem[1].type.kind).to.equal("class");
        expect(mem[1].type.as("class").isClass(String)).to.equal(true);
        expect(mem[1].isOptional).to.equal(true);

        const typeB = builderB.getType();
        expect(typeB.kind).to.equal("interface");
        expect(typeB.as(ReflectedInterfaceRef).reflectedInterface.arguments).to.eql(["T","K"]);
        const memB = typeB.as(ReflectedInterfaceRef).reflectedInterface.properties;
        expect(memB.length).to.equal(7);
        expect(memB[0].name).to.equal("a");
        expect(memB[0].type.kind).to.equal("class");
        expect(memB[0].type.as("class").isClass(Number)).to.equal(true);
        expect(memB[1].name).to.equal("b");
        expect(memB[1].type.kind).to.equal("class");
        expect(memB[1].type.as("class").isClass(String)).to.equal(true);
        expect(memB[1].isOptional).to.equal(true);
        expect(memB[2].name).to.equal("c");
        expect(memB[2].type.kind).to.equal("class");
        expect(memB[3].name).to.equal("d");
        expect(memB[3].type.kind).to.equal("class");
        expect(memB[4].name).to.equal("pop");
        expect(memB[4].type.kind).to.equal("literal");
        expect(memB[4].type.as("literal").value).to.equal(1);
        expect(memB[5].name).to.equal("prop2");
        expect(memB[5].type.kind).to.equal("class");
        expect(memB[5].type.as("class").isClass(String)).to.equal(true);
        expect(memB[5].isOptional).to.equal(true);

        const sub = typeB.as(ReflectedInterfaceRef).reflectedInterface.properties[6].type.as(ReflectedInterfaceRef).reflectedInterface;
        expect(sub.properties.length).to.equal(2);
        expect(sub.properties[0].name).to.equal("a");
        expect(sub.properties[0].type.kind).to.equal("class");
        expect(sub.properties[0].type.as("class").isClass(Number)).to.equal(true);
        expect(sub.properties[1].name).to.equal("b");
        expect(sub.properties[1].type.kind).to.equal("class");
        expect(sub.properties[1].type.as("class").isClass(String)).to.equal(true);
        expect(sub.properties[1].isOptional).to.equal(true);

    });

    it('TupleTypeBuilder', async () => {
        const builder = new TupleTypeBuilder();
        builder.push(Number,String);

        const v = builder.getType();
        expect(v.kind).to.equal("tuple");
        expect(v.as("tuple").elements.length).to.equal(2);
        expect(v.as("tuple").elements[0].type.as("class").class).to.equal(Number);
        expect(v.as("tuple").elements[1].type.as("class").class).to.equal(String);
    });

    it('ArrayTypeBuilder', async () => {
        const builder = new ArrayTypeBuilder();
        builder.type = Number;

        const v = builder.getType();
        expect(v.kind).to.equal("array");
        expect(v.as("array").elementType.as("class").class).to.equal(Number);
    });

    it('UnionTypeBuilder', async () => {
        const builder = new UnionTypeBuilder();
        builder.push(Number,String);

        const v = builder.getType();
        expect(v.kind).to.equal("union");
        expect(v.as("union").types[0].isClass(Number)).to.equal(true);
        expect(v.as("union").types[1].isClass(String)).to.equal(true);
    });

    it('IntersectionTypeBuilder', async () => {
        const builder = new IntersectionTypeBuilder();
        builder.push(Number,String);

        const v = builder.getType();
        expect(v.kind).to.equal("intersection");
        expect(v.as("intersection").types[0].isClass(Number)).to.equal(true);
        expect(v.as("intersection").types[1].isClass(String)).to.equal(true);
    });

    it('GenericTypeBuilder', async () => {
        const builder = new GenericTypeBuilder();
        builder.setBaseType(Array);
        builder.addParameters(Number,String,Boolean);

        const v = builder.getType();
        expect(v.kind).to.equal("generic");
        expect(v.as("generic").baseType.as("class").class).to.equal(Array);
        expect(v.as("generic").typeParameters.length).to.equal(3);
        expect(v.as("generic").typeParameters[0].as("class").class).to.equal(Number);
        expect(v.as("generic").typeParameters[1].as("class").class).to.equal(String);
        expect(v.as("generic").typeParameters[2].as("class").class).to.equal(Boolean);
    });
});
