export type Sinks = Record<string, Sink[]>;

export interface Sink {
  module: string;
  file: string;
  /**
   * Default export if `null`
   */
  export: string | null;
}
