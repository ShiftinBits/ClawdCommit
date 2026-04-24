/**
 * Vendored type definitions from VS Code's built-in git extension.
 * Source: https://github.com/microsoft/vscode/blob/main/extensions/git/src/api/git.d.ts
 * License: MIT (Microsoft)
 *
 * Only the subset of interfaces needed by this extension are included.
 */

import { Uri, Event, Disposable } from 'vscode';

export interface InputBox {
    value: string;
}

export interface Repository {
    readonly rootUri: Uri;
    readonly inputBox: InputBox;
    readonly state: RepositoryState;
    status(): Promise<void>;
    diff(cached?: boolean): Promise<string>;
    log(options?: LogOptions): Promise<Commit[]>;
    show(ref: string, path: string): Promise<string>;
}

export interface RepositoryState {
    readonly HEAD: Ref | undefined;
    readonly indexChanges: Change[];
    readonly workingTreeChanges: Change[];
}

export interface Ref {
    readonly name: string | undefined;
    readonly commit: string | undefined;
    readonly type: RefType;
}

export const enum RefType {
    Head,
    RemoteHead,
    Tag,
}

export interface Change {
    readonly uri: Uri;
    readonly originalUri: Uri;
    readonly renameUri: Uri | undefined;
    readonly status: Status;
}

export const enum Status {
    INDEX_MODIFIED,
    INDEX_ADDED,
    INDEX_DELETED,
    INDEX_RENAMED,
    INDEX_COPIED,
    MODIFIED,
    DELETED,
    UNTRACKED,
    IGNORED,
    INTENT_TO_ADD,
}

export interface Commit {
    readonly hash: string;
    readonly message: string;
    readonly parents: string[];
    readonly authorDate?: Date;
    readonly authorName?: string;
    readonly authorEmail?: string;
    readonly commitDate?: Date;
}

export interface LogOptions {
    readonly maxEntries?: number;
    readonly path?: string;
    readonly range?: string;
    readonly reverse?: boolean;
    readonly sortByAuthorDate?: boolean;
    readonly shortStats?: boolean;
    readonly author?: string;
    readonly grep?: string;
}

export interface API {
    readonly repositories: Repository[];
    getRepository(uri: Uri): Repository | null;
    onDidOpenRepository: Event<Repository>;
    onDidCloseRepository: Event<Repository>;
}

export interface GitExtension {
    readonly enabled: boolean;
    getAPI(version: 1): API;
}
