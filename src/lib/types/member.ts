import * as format from '../../common/format';
import { Constructor } from '../constructor';
import { ClassType } from './class-type';
import { ConstructorMember } from './constructor-member';
import { Flags } from './flags';
import { MatchesValueOptions } from './matches-values-options';
import { Method } from './method';
import { Property } from './property';
import { Type } from './type';
import { Visibility } from './visibility';

/**
 * Reflection data for a class member
 */
export class Member {
    constructor(
        readonly ref: format.RtObjectMember
    ) {
    }

    private _flags: Flags;

    static createFromRef(ref: format.RtObjectMember) {
        const brand = new Flags(ref.f).memberBrand ?? format.F_PROPERTY;

        if (!this.kinds[brand])
            throw new Error(`Unknown member brand '${brand}'`);

        return new this.kinds[brand](ref);
    }

    /**
     * @internal
     */
    static kinds: Partial<Record<format.RtMemberBrand, Constructor<Member>>> = {};
    static Kind(kind: format.RtMemberBrand) {
        return target => (Member.kinds[kind] = target, undefined);
    }

    /**
     * The overall type of the member. If this is a method,
     * this is the function type describing the method. If this
     * is a property, it is the property's type, etc.
     */
    get type(): Type {
        return undefined;
    }

    /**
     * Given a method function, return a Method representing it.
     * If the function is not a method, throws an error. See also getClassOfMethod().
     * @param func
     * @returns
     */
    static from(func: Function) {
        const klass = this.getClassOfMethod(func);
        const flags = String(Reflect.getMetadata('rt:f', func) ?? '');

        if (!klass)
            throw new Error(`Function does not appear to be a method`);

        if (flags.includes(format.F_STATIC))
            return ClassType.from(klass).getStaticMethod(func.name);
        else
            return ClassType.from(klass).getMethod(func.name);
    }

    /**
     * Given a method function, return the constructor for the class the method
     * was declared in, if available.
     * @param func
     * @returns
     */
    static getClassOfMethod(func: Function) {
        return <Constructor<any>>Reflect.getMetadata('rt:h', func)?.();
    }

    get name() { return this.ref.n; }

    /**
     * Get the flags for this member. Includes modifiers and other properties about
     * the member.
     */
    get flags(): Readonly<Flags> {
        if (this._flags)
            return this._flags;

        return this._flags = new Flags(this.ref.f);
    }

    /**
     * True if this member is static.
     */
    get isStatic() { return this.flags.isStatic; }

    /**
     * True if this member is abstract.
     */
    get isAbstract() { return this.flags.isAbstract; }

    /**
     * True if this member has private visibility.
     */
    get isPrivate() { return this.flags.isPrivate; }

    /**
     * True if this member has public visibility.
     */
    get isPublic() { return this.visibility === 'public'; }

    /**
     * True if this member is specifically marked as public
     * (as opposed to default visibility).
     */
    get isMarkedPublic() { return this.flags.isPublic; }

    /**
     * True if this member has protected visibility.
     */
    get isProtected() { return this.flags.isProtected; }

    /**
     * Get the visibility (accessibility) of this member.
     * Can be 'public', 'protected', or 'private'
     */
    get visibility(): Visibility {
        return this.isMarkedPublic ? 'public'
            : this.isProtected ? 'protected'
                : this.isPrivate ? 'private'
                    : 'public';
    }

    /**
     * Whether this member is marked as optional.
     */
    get isOptional() {
        return this.flags.isOptional;
    }

    get isReadOnly() {
        return this.flags.isReadOnly;
    }

    matchesValue(value, options?: MatchesValueOptions): boolean {
        throw new Error(`Not determinable`);
    }

    equals(member: this) {
        return this.matches(member);
    }

    protected matches(member: this) {
        return member instanceof this.constructor && this.name === member.name
            && this.flags.toString() === member.flags.toString();
    }
}
