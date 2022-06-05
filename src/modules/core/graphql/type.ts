export abstract class Type<T> {
  constructor(
    protected readonly data: T
  ) { }

  /**
   * This method is used to save the current changes to the database
   * Each type must implement this method so that it saves exactly the data is operates on
   *
   * @example
   * ```ts
   * async save() {
   *   await query`
   *     LET data = {
   *       name: ${this.data.name},
   *       path: ${this.data.path}
   *     }
   *
   *     UPSERT {
   *       _key: ${this.data._key}
   *     } INSERT MERGE({
   *       _key: ${this.data._key}
   *     }, data) UPDATE data IN modules
   *   `;
   * }
   * ```
   */
  abstract save(): Promise<void> | void;

  /**
   * This method is used to validate and format data and must be implemented in each type accordingly
   *
   * @example
   * ```ts
   * static async formatData(data: unknown): Promise<IModule> {
   *   if (!isRecordUnknown(data)) throw new DataError();
   *   if (!isString(data.path)) throw new DataError("path");
   *   if (!isString(data.name)) throw new DataError("name");
   *
   *   return {
   *     _key: data.path.replace(/\//g, "_"),
   *     name: data.name,
   *     path: data.path,
   *   };
   * }
   * ```
   */
  static async formatData(data: unknown): Promise<unknown> {
    throw new Error("Not implemented");
  }
}

export abstract class Scalar<T> {
  constructor(
    protected readonly data: T
  ) { }
}
