import { extractScmRootUri } from '../scm';

describe('extractScmRootUri', () => {
    it('returns undefined for no argument', () => {
        expect(extractScmRootUri(undefined)).toBeUndefined();
    });

    it('returns undefined for primitive arguments', () => {
        expect(extractScmRootUri('foo')).toBeUndefined();
        expect(extractScmRootUri(42)).toBeUndefined();
        expect(extractScmRootUri(null)).toBeUndefined();
    });

    it('returns undefined when rootUri is missing', () => {
        expect(extractScmRootUri({})).toBeUndefined();
    });

    it('returns undefined when rootUri has no fsPath', () => {
        expect(extractScmRootUri({ rootUri: {} })).toBeUndefined();
    });

    it('extracts rootUri from a SourceControl-like object', () => {
        const rootUri = { fsPath: '/repo2', scheme: 'file', path: '/repo2' };
        const sourceControl = { rootUri, id: 'git', label: 'repo2' };
        expect(extractScmRootUri(sourceControl)).toBe(rootUri);
    });

    it('extracts rootUri from a Repository-like object', () => {
        const rootUri = { fsPath: '/repo1', scheme: 'file', path: '/repo1' };
        const repository = { rootUri, inputBox: { value: '' } };
        expect(extractScmRootUri(repository)).toBe(rootUri);
    });
});
