declare module "merge" {
	/**
	 * Merge one or more objects
	 * @param bool? clone
	 * @param mixed,... arguments
	 * @return object
	 */
  function merge(...args: any[]): any;
  function merge(clone?: boolean, ...args: any[]): any;
  namespace merge {
    export function recursive<T>(target: T, source: T): T;
    export function recursive<T, S1>(target: T, source1: S1): T & S1;
    export function recursive<T, S1, S2>(target: T, source1: S1, source2: S2): T & S1 & S2;
    export function recursive<T>(target: T, ...sources: T[]): T;
    export function recursive<T>(clone: true, ...sources: T[]): T;
    export function recursive(...args: any[]): any;
    export function recursive(clone?: boolean, ...args: any[]): any;
  }
  export = merge;
}
