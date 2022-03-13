
export function findRelativePathToFile(fromFile : string, toFile : string) {
    fromFile = fromFile.replace(/\\/g, '/');
    toFile = toFile.replace(/\\/g, '/');

    if (fromFile.startsWith('./'))
        fromFile = fromFile.slice(2);
    if (toFile.startsWith('./'))
        toFile = toFile.slice(2);
    
    let fromAbsolute = /^[A-Za-z]:/.test(fromFile) || /^\//.test(fromFile);
    let toAbsolute = /^[A-Za-z]:/.test(toFile) || /^\//.test(toFile);

    if (fromAbsolute !== toAbsolute)
        throw new Error(`Cannot determine relationship between an absolute and a relative path!`);
    
    if (!fromAbsolute && !toAbsolute) {
        fromFile = `/${fromFile}`;
        toFile = `/${toFile}`;
    }

    let from = fromFile.split('/');
    let to = toFile.split('/');
    let parents = 0;
    let toFileName = to.pop();
    
    while (from.length > 0 && !(to.join('/')+'/').startsWith(from.join('/')+'/')) {
        parents += 1;
        from.pop();
    }

    let result : string;

    if (from.length === 0) {
        // Could be different drive letters, ie C:/ vs D:/ -- in that case, we just have to 
        // use the absolute path
        return undefined;
    } else {
        if (parents > 1) {
            result = [ ...Array(parents - 1).fill('..'), ...to.slice(from.length), toFileName].join('/');
        } else {
            result = ['.', ...to.slice(from.length), toFileName].join('/');
        }
    }

    return result;
}
