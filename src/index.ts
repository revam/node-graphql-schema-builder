
import { exists, readdir, stat } from "fs";
import { GraphQLSchema } from "graphql";
import { IDirectiveResolvers, IResolvers, makeExecutableSchema } from "graphql-tools";
import { recursive as merge } from "merge";
import { basename, extname, join, resolve } from "path";
import { promisify } from "util";

// tslint:disable-next-line:deprecation
const existsAsync = promisify(exists);
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
  protected readonly definitions: Map<string, string> = new Map();

  /**
   * All registered resolvers, mapped to a sortable identifier.
   */
  protected readonly resolvers: Map<string, IResolvers> = new Map();

  /**
   * All registered directives, mapped to a sortable identifier.
   */
  protected readonly directives: Map<string, IDirectiveResolvers> = new Map();

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
  public addDefinions(id: string, definitions: string): this {
    this.definitions.set(id, definitions);
    return this;
  }

  /**
   * Add resolvers for definitions to the built schema.
   * @param id Sort identifier
   * @param resolvers Resolvers
   */
  public addResolvers(id: string, resolvers: IResolvers): this {
    this.resolvers.set(id, resolvers);
    return this;
  }

  /**
   * Add directives to the built schema.
   * @param id Sort identifier
   * @param directives Directives
   */
  public addDirectives(id: string, directives: IDirectiveResolvers): this {
    this.directives.set(id, directives);
    return this;
  }

  /**
   * Import all definitions, directives and resolvers from files in a folder.
   * No recursive search, only top-level files with an extension whitelisted in
   * `extensions` will be included.
   *
   * Accepted export values is as follow:
   *   - "definitons" - definitions, as a string.
   *   - "resolvers" - resolvers for definitions, as an object.
   *   - "directives" - directives for definitions, as an object.
   *
   * @param path Import from this folder.
   * @param extensions Extensions to load.
   */
  public async importFrom(path: string, extensions: string[] = [".js"]): Promise<void> {
    path = resolve(path);
    if (await existsAsync(path)) {
      for (const entry of await readdirAsync(path)) {
        const extName = extname(entry);
        const baseName = basename(entry, extName);
        const entryPath = join(path, entry);
        if (extensions.includes(extName) && await statAsync(entryPath).then((s) => s.isFile())) {
          const imported = await import(entryPath);
          if ("definitions" in imported && typeof imported.definitions === "string") {
            this.addDefinions(baseName, imported.definitions);
          }
          if ("resolvers" in imported && typeof imported.resolvers === "object") {
            this.addResolvers(baseName, imported.resolvers);
          }
          if ("directives" in imported && typeof imported.directives === "object") {
            this.addDirectives(baseName, imported.directives);
          }
        }
      }
    }
  }

  /**
   * Build a schema with the current definitions, resolvers and directives.
   */
  public buildSchema(): GraphQLSchema {
    const sort = sortMapInOrder(this.order);
    const typeDefs = Array.from(this.definitions).sort(sort).map(([, t]) => t);
    const resolvers = Array.from(this.resolvers).sort(sort).reduce((p, [, c]) => merge(p, c), {});
    const directiveResolvers = Array.from(this.directives).sort(sort).reduce((p, [, c]) => merge(p, c), {});
    return makeExecutableSchema({typeDefs, resolvers, directiveResolvers});
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
