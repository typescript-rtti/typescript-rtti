export function Sealed() {
    return (target) => {
        Object.seal(target);
        return target;
    };
}