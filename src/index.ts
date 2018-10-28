import { readdir, stat } from "fs";
import { DocumentNode, GraphQLSchema } from "graphql";
import gqlTag from "graphql-tag";
import { IResolvers, makeExecutableSchema, SchemaDirectiveVisitor } from "graphql-tools";
import { recursive as merge } from "merge";
import { basename, extname, join, resolve } from "path";
import { promisify } from "util";

export { IResolvers, SchemaDirectiveVisitor } from "graphql-tools";

// This currently provides the ability to have syntax highlighting as well as
// consistency between client and server gql tags
export const gql: (
  template: TemplateStringsArray | string,
  ...substitutions: any[]
) => DocumentNode = gqlTag;
const readdirAsync = promisify(readdir);
const statAsync = promisify(stat);

/**
 * Helper class for building a schema spawning multiple files (contained in the same
 * folder).
 */
export default class SchemaBuilder {
  /**
   * All registered definitions, mapped to a sortable identifier.
   */
  protected readonly definitions: Map<string, DocumentNode> = new Map();

  /**
   * All registered resolvers, mapped to a sortable identifier.
   */
  protected readonly resolvers: Map<string, IResolvers> = new Map();

  /**
   * All registered directives, mapped to a sortable identifier.
   */
  protected readonly directives: Map<string, SchemaDirectives> = new Map();

  /**
   * Contains all imported identifiers.
   */
  protected readonly importedIdentifiers: Set<string> = new Set();

  /**
   *
   */
  protected readonly sortAfterMap: Map<string, Set<string>> = new Map();

  /**
   *
   */
  protected readonly sortBeforeMap: Map<string, Set<string>> = new Map();

  /**
   *
   */
  protected readonly sortEndSet: Set<string> = new Set();

  /**
   *
   */
  protected readonly sortStartSet: Set<string> = new Set(["index", "Query", "Mutation", "Subscription"]);

  /**
   * Add definietions to the built schema.
   * @param id Sort identifier
   * @param definitions Definitions
   */
  public addDefinions(id: string, definitions: DocumentNode | string): this {
    if (this.definitions.has(id)) {
      throw new Error(`Cannot import definitions for id "${id}" multiple times.`);
    }
    this.importedIdentifiers.add(id);
    if (typeof definitions === "string") {
      definitions = gql(definitions);
    }
    this.definitions.set(id, definitions);
    return this;
  }

  /**
   * Add resolvers for definitions to the built schema.
   * @param id Sort identifier
   * @param resolvers Resolvers
   */
  public addResolvers(id: string, resolvers: IResolvers): this {
    if (this.resolvers.has(id)) {
      throw new Error(`Cannot import resolvers for id "${id}" multiple times.`);
    }
    this.importedIdentifiers.add(id);
    this.resolvers.set(id, resolvers);
    return this;
  }

  /**
   * Add directives to the built schema.
   * @param id Sort identifier
   * @param directives Directives
   */
  public addDirectives(id: string, directives: SchemaDirectives): this {
    if (this.directives.has(id)) {
      throw new Error(`Cannot import directives for id "${id}" multiple times.`);
    }
    this.importedIdentifiers.add(id);
    this.directives.set(id, directives);
    return this;
  }

  /**
   *  Check if any definitions has been added for `id`.
   * @param id Identifier.
   */
  public hasDefinitions(id): boolean {
    return this.definitions.has(id);
  }

  /**
   *  Check if any resolvers has been added for `id`.
   * @param id Identifier.
   */
  public hasResolvers(id: string): boolean {
    return this.resolvers.has(id);
  }

  /**
   *  Check if any directives has been added for `id`.
   * @param id Identifier.
   */
  public hasDirectives(id: string): boolean {
    return this.directives.has(id);
  }

  /**
   * Check if any definitions, resolvers or directives has been added for `id`.
   * @param id Identifier.
   */
  public has(id: string): boolean {
    return this.importedIdentifiers.has(id);
  }

  /**
   * Import any recognised export values from all files in a folder.
   * Only top-level files with an extension as part of `extensions` will be
   * included in the import.
   *
   * Recognised export values are:
   *   - "definitons" = string | DocumentNode
   *   - "resolvers" = IResolvers
   *   - "directives" = SchemaDirectives
   *   - "sortAfter" = [string, ...string[]]
   *   - "sortBefore" = [string, ...string[]]
   *   - "sortStart" = boolean
   *   - "sortEnd" = boolean
   *
   * @param path Import from this folder.
   * @param extensions Extensions to import in folder.
   * @throws when importing multiple files with same basename.
   * @returns a list of idenitifiers for imports.
   */
  public async importFrom(path: string, extensions: string[] = [".js"]): Promise<string[]> {
    path = resolve(path);
    const imports: string[] = [];
    // Check if path exists and leads to a folder.
    if (await statAsync(path).catch<false>(() => false).then((s) => s && s.isDirectory())) {
      for (const entry of await readdirAsync(path)) {
        const extName = extname(entry);
        if (extensions.includes(extName)) {
          const id = basename(entry, extName);
          if (this.has(id)) {
            throw new Error(`Cannot import id "${id}" multiple times. Check import directory or allowed extensions.`);
          }
          await this.importFile(join(path, entry));
          imports.push(id);
        }
      }
    }
    return imports;
  }

  /**
   * Import any recognised export values from file.
   *
   * Recognised export values are:
   *   - "definitons" = string | DocumentNode
   *   - "resolvers" = IResolvers
   *   - "directives" = SchemaDirectives
   *   - "sortAfter" = [string, ...string[]]
   *   - "sortBefore" = [string, ...string[]]
   *   - "sortStart" = boolean
   *   - "sortEnd" = boolean
   *
   * @param path Import this file.
   * @returns the identifier for the import.
   */
  public async importFile(path: string): Promise<string | undefined> {
    path = resolve(path);
    const extName = extname(path);
    const id = basename(path, extName);
    if (this.has(id)) {
      throw new Error(`Cannot import id ${id} multiple times. Check import path.`);
    }
    // Check if path exists and leads to a file.
    if (await statAsync(path).catch<false>(() => false).then((s) => s && s.isFile())) {
      const imported = await import(path);
      if (typeof imported === "object" || typeof imported === "function") {
        // Accepted values are: 1) raw definition strings, and 2) document nodes.
        if (typeof imported.definitions === "string" || typeof imported.definitions === "object") {
          this.addDefinions(id, imported.definitions);
        }
        // Accepted values are: 1) resolvers.
        if (typeof imported.resolvers === "object") {
          this.addResolvers(id, imported.resolvers);
        }
        // Accepted values are: 1) a record of schema definition visitors.
        if (typeof imported.directives === "object") {
          this.addDirectives(id, imported.directives);
        }
        // Accepted values are: 1) an array (of strings).
        if (typeof imported.sortAfter === "object" && imported.sortAfter instanceof Array) {
          this.sortAfter(id, ...imported.sortAfter as [any, ...any[]]);
        }
        // Accepted values are: 1) an array (of strings).
        if (typeof imported.sortAfter === "object" && imported.sortBefore instanceof Array) {
          this.sortBefore(id, ...imported.sortBefore as [any, ...any[]]);
        }
        // Accepted values are: 1) a boolean.
        if (typeof imported.sortStart === "boolean" && imported.sortStart) {
          this.sortStart(id);
        }
        // Accepted values are: 1) a boolean.
        if (typeof imported.sortEnd === "boolean" && imported.sortEnd) {
          this.sortEnd(id);
        }
      }
    }
    // Return the identifier if we imported any definitions, resolvers or
    // directives.
    if (this.has(id)) {
      return id;
    }
  }

  /**
   * Ensures `id` is sorted __after__ all identifier in `ids`
   */
  public sortAfter(id: string, ...ids: [string, ...string[]]): this {
    if (ids.length > 0) {
      this.sortAfterMap.set(id, new Set(ids));
    }
    return this;
  }

  /**
   * Ensures `id` is sorted __before__ all identifers in `ids`.
   */
  public sortBefore(id: string, ...ids: [string, ...string[]]): this {
    if (ids.length > 0) {
      this.sortBeforeMap.set(id, new Set(ids));
    }
    return this;
  }

  /**
   * Ensures any identifiers in `ids` is sorted at __the end of__ the list.
   */
  public sortEnd(...ids: [string, ...string[]]): this {
    ids.forEach((id) => this.sortEndSet.add(id));
    return this;
  }

  /**
   * Ensures any identifiers in `ids` is sorted at __the start of__ the list.
   */
  public sortStart(...ids: [string, ...string[]]): this {
    ids.forEach((id) => this.sortStartSet.add(id));
    return this;
  }

  /**
   * Prepare schema
   */
  public prepareSchema(): PreparedApolloSchema {
    const typeDefs = this.definitions.size ? this.applySortAndMap(this.definitions) : gql("");
    const resolvers = this.resolvers.size ? this.applySortAndMerge(this.resolvers) : undefined;
    const schemaDirectives = this.directives.size ? this.applySortAndMerge(this.directives) : undefined;
    return { typeDefs, resolvers, schemaDirectives };
  }

  /**
   * Build a schema with the current definitions, resolvers and directives.
   */
  public buildSchema(): GraphQLSchema {
    return makeExecutableSchema(this.prepareSchema());
  }

  /**
   * Apply sort logic on iterator key-value pairs and map to values.
   * @throws SortError
   */
  protected applySortAndMap<T>(iterator: Iterable<[string, T]> | IterableIterator<[string, T]>): T[] {
    const array = Array.from(iterator);
    array.sort(([A], [B]) => {
      // TODO: Simplify or substitute logic.
      let n: number = 0;
      // A wants to go up (A ↑)
      if (this.sortStartSet.has(A)) {
        n += 0b00000001; //    1
      }
      // B wants to go up (B ↑)
      if (this.sortStartSet.has(B)) {
        n += 0b00000010; //    2
      }
      // A wants to go down (A ↓)
      if (this.sortEndSet.has(A)) {
        n += 0b00000100; //    4
      }
      // B wants to go down (B ↓)
      if (this.sortEndSet.has(B)) {
        n += 0b00001000; //    8
      }
      // A after B (A → B)
      if (this.sortAfterMap.has(A) && this.sortAfterMap.get(A)!.has(B)) {
        n += 0b00010000; //   16
      }
      // B after A (B → A)
      if (this.sortAfterMap.has(B) && this.sortAfterMap.get(B)!.has(A)) {
        n += 0b00100000; //   32
      }
      // A before B (A ← B)
      if (this.sortBeforeMap.has(A) && this.sortBeforeMap.get(A)!.has(B)) {
        n += 0b01000000; //   64
      }
      // B before A (B ← A)
      if (this.sortBeforeMap.has(B) && this.sortBeforeMap.get(B)!.has(A)) {
        n += 0b10000000; //  128
      }
      // 46 known cases
      switch (n) {
        // "leave A and B unchanged with respect to each other" - MDN
        //   Binary      //  Int  //  Action
        case 0b00000000: //    0  //  None
        case 0b00000011: //    3  //   A ↑  +  B ↑
        case 0b00001100: //   12  //   A ↓  +  B ↓
          return 0;

        // "sort A to an index lower than B" - MDN
        //   Binary      //  Int  //  Action
        case 0b00000001: //    1  //   A ↑
        case 0b00001000: //    8  //   B ↓
        case 0b00001001: //    9  //   B ↓  +  A ↑
        case 0b00100000: //   32  //  B → A
        case 0b00100001: //   33  //  B → A +  A ↑
        case 0b00101000: //   40  //  B → A +  B ↓  +  A ↑
        case 0b00101001: //   41  //  B → A +  B ↓  +  A ↑
        case 0b01000000: //   64  //  A ← B
        case 0b01000001: //   65  //  A ← B +  A ↑
        case 0b01001000: //   72  //  A ← B +  B ↓
        case 0b01001001: //   73  //  A ← B +  B ↓  +  A ↑
        case 0b01100000: //   96  //  A ← B + B → A
        case 0b01100001: //   97  //  A ← B + B → A +  A ↑
        case 0b01101000: //  104  //  A ← B + B → A +  B ↓  +  A ↑
        case 0b01101001: //  105  //  A ← B + B → A +  B ↓  +  A ↑
          return -1;

        // "sort B to an index lower than A" - MDN
        //   Binary      //  Int  //  Action
        case 0b00000010: //    2  //   B ↑
        case 0b00000100: //    4  //   A ↓
        case 0b00000110: //    6  //   A ↓  +  B ↑
        case 0b00010000: //   16  //  A → B
        case 0b00010010: //   18  //  A → B +  B ↑
        case 0b00010100: //   20  //  A → B +  A ↓
        case 0b00010110: //   22  //  A → B +  A ↓  +  B ↑
        case 0b10000000: //  128  //  B ← A
        case 0b10000010: //  130  //  B ← A +  B ↑
        case 0b10000100: //  132  //  B ← A +  A ↓
        case 0b10000110: //  134  //  B ← A +  A ↓  +  B ↑
        case 0b10010000: //  144  //  B ← A + A → B
        case 0b10010010: //  146  //  B ← A + A → B +  B ↑
        case 0b10010100: //  148  //  B ← A + A → B +  A ↓
        case 0b10010110: //  150  //  B ← A + A → B +  A ↓  +  B ↑
          return 1;

        // Conflict with A
        //   Binary      //  Int  //  Action
        case 0b00000101: //    5  //   A ↓  +  A ↑
        case 0b00000111: //    7  //   A ↓  +  B ↑  +  A ↑
        case 0b00001101: //   13  //   B ↓  +  A ↓  +  A ↑
          throw sortError(`Conflict with identifier "${A}" (${n})`, n, A);

        // Conflict with B
        //   Binary      //  Int  //  Action
        case 0b00001010: //   10  //
        case 0b00001011: //   11  //
        case 0b00001110: //   14  //
          throw sortError(`Conflict with identifier "${B}" (${n})`, n, B);

        // Conflict A and B
        //   Binary      //  Int  //  Action
        case 0b00001111: //   15  //   B ↓  +  A ↓  +  B ↑  +  A ↑
        case 0b00110000: //   48  //  B → A + A → B
        case 0b00111111: //   63  //  B → A + A → B +  B ↓  +  A ↓  +  B ↑  +  A ↑
        case 0b11000000: //  192  //  B ← A + A ← B
        case 0b11001111: //  207  //  B ← A + A ← B +  B ↓  +  A ↓  +  B ↑  +  A ↑
        case 0b11110000: //  240  //  B ← A + A ← B + B → A + A → B
        case 0b11111111: //  255  //  B ← A + A ← B + B → A + A → B +  B ↓  +  A ↓  +  B ↑  +  A ↑
        throw sortError(`Conflict with identifiers "${A}" and "${B}" (${n})`, n, A, B);

        // Unknown combination
        default:
          throw sortError(`Unknown combination (${n})`, n, A, B);
      }
    });
    return array.map(([, item]) => item);
  }

  protected applySortAndMerge<T extends {}>(iterator: Iterable<[string, T]> | IterableIterator<[string, T]>): T {
    return merge<T>({} as any, ...this.applySortAndMap(iterator));
  }
}

/**
 * Produce a SortError.
 */
function sortError(message: string, n: number, ...ids: [string, string?]): SortError {
  const error = new Error(message) as SortError;
  error.n = n;
  error.identifiers = ids;
  return error;
}

export interface PreparedApolloSchema {
  resolvers?: IResolvers;
  schemaDirectives?: SchemaDirectives;
  typeDefs: DocumentNode | DocumentNode[];
}

export interface SortError extends Error {
  /**
   * A combination of any or all well-known numbers listed below.
   *
   * Well-known numbers:
   *  -   0 = <none>
   *  -   1 =  A ↑
   *  -   2 =  B ↑
   *  -   4 =  A ↓
   *  -   8 =  B ↓
   *  -  16 = A → B
   *  -  32 = B → B
   *  -  64 = A ← B
   *  - 128 = B ← A
   */
  n: number;
  /**
   * Identifiers with the sort conflict.
   */
  identifiers: [string, string?];
}

export type SchemaDirectives = Record<string, typeof SchemaDirectiveVisitor>;
