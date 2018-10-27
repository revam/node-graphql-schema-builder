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
   * The sort order of definitions, resolvers and directives.
   */
  protected readonly order: ReadonlyArray<string> = ["index", "Query", "Mutation", "Subscription"];

  public constructor(order?: string[] | ReadonlyArray<string>) {
    if (order && order instanceof Array && order.length) {
      this.order = order;
    }
  }

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
        if (typeof imported.definitions === "string" || typeof imported.definietions === "object") {
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
      }
    }
    // Return the identifier if we imported any definitions, resolvers or
    // directives.
    if (this.has(id)) {
      return id;
    }
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
   * Apply sort logic on iterator values and map values to
   */
  protected applySortAndMap<T>(iterator: Iterable<[string, T]> | IterableIterator<[string, T]>): T[] {
    const sort = sortMapInOrder(this.order);
    return Array.from(iterator).sort(sort).map(([, item]) => item);
  }

  protected applySortAndMerge<T extends {}>(iterator: Iterable<[string, T]> | IterableIterator<[string, T]>): T {
    return merge<T>({} as any, ...this.applySortAndMap(iterator));
  }
}

/**
 * Sort an array according to `order` for any known ids and preserve index for all other.
 * @param order Sorted ids
 */
function sortMapInOrder(order: ReadonlyArray<string>): ([aN]: [string, any], [bN]: [string, any]) => number {
  return ([aN], [bN]) => {
    const aI = order.indexOf(aN);
    const bI = order.indexOf(bN);
    return aI >= 0 ? bI >= 0 ? aI - bI : 1 : bI >= 0 ? -1 : 0;
  };
}

export interface PreparedApolloSchema {
  resolvers?: IResolvers;
  schemaDirectives?: SchemaDirectives;
  typeDefs: DocumentNode | DocumentNode[];
}

export type SchemaDirectives = Record<string, typeof SchemaDirectiveVisitor>;
