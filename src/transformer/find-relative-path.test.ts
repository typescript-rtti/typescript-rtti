import { expect } from "chai";
import { describe } from "razmin";
import { findRelativePathToFile } from "./find-relative-path";

describe('findRelativePath', it => {
    it('works as expected', () => {
        expect(findRelativePathToFile('/foo/bar/baz.ts', '/foo/bar.ts')).to.equal('../bar.ts');
        expect(findRelativePathToFile('/1/2/3/4/5.ts', '/1/2/3a/4.ts')).to.equal('../../3a/4.ts');
        expect(findRelativePathToFile('/1/2/3.ts', '/1/2/3/4.ts')).to.equal('./3/4.ts');
        expect(findRelativePathToFile('/1/2/3a.ts', '/1/2/3b.ts')).to.equal('./3b.ts');
        
        expect(findRelativePathToFile('\\foo\\bar\\baz.ts', '\\foo\\bar.ts')).to.equal('../bar.ts');
        expect(findRelativePathToFile('\\1\\2\\3\\4\\5.ts', '\\1\\2\\3a\\4.ts')).to.equal('../../3a/4.ts');
        expect(findRelativePathToFile('\\1\\2\\3.ts', '\\1\\2\\3\\4.ts')).to.equal('./3/4.ts');
        expect(findRelativePathToFile('\\1\\2\\3a.ts', '\\1\\2\\3b.ts')).to.equal('./3b.ts');
        
        expect(findRelativePathToFile('C:\\foo\\bar\\baz.ts', 'C:\\foo\\bar.ts')).to.equal('../bar.ts');
        expect(findRelativePathToFile('C:\\1\\2\\3\\4\\5.ts', 'C:\\1\\2\\3a\\4.ts')).to.equal('../../3a/4.ts');
        expect(findRelativePathToFile('C:\\1\\2\\3.ts', 'C:\\1\\2\\3\\4.ts')).to.equal('./3/4.ts');
        expect(findRelativePathToFile('C:\\1\\2\\3a.ts', 'C:\\1\\2\\3b.ts')).to.equal('./3b.ts');
        
        expect(findRelativePathToFile('C:/foo/bar/baz.ts', 'C:/foo/bar.ts')).to.equal('../bar.ts');
        expect(findRelativePathToFile('C:/1/2/3/4/5.ts', 'C:/1/2/3a/4.ts')).to.equal('../../3a/4.ts');
        expect(findRelativePathToFile('C:/1/2/3.ts', 'C:/1/2/3/4.ts')).to.equal('./3/4.ts');
        expect(findRelativePathToFile('C:/1/2/3a.ts', 'C:/1/2/3b.ts')).to.equal('./3b.ts');
    });
});