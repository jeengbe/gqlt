export type RootType = "Query" | "Mutation";
export type Schema = Record<string, SchemaType | SchemaScalar> & Record<RootType, SchemaType>;

/**
 * Equivalent to a GraphQL scalar
 */
export interface SchemaScalar {
  kind: "scalar";
  name: string;
  description?: string;
  type: SchemaOutputType;
  from: string;
}

export interface SchemaType {
  kind: "type";
  name: string;
  description?: string;
  fields: Record<string, SchemaField>;
  staticFields: Record<string, SchemaStaticField>;
  from: string[];
}

export interface SchemaField {
  kind: "field";
  name: string;
  description?: string;
  args: Record<string, SchemaArgument>;
  type: SchemaOutputType;
  resolve: {
    /**
     * Order in which to pass the args
     */
    // This matters because GraphQL supports named arguments in any order while JS does not
    // Hence, we need to retain argument order to properly map name -> position
    args?: string[] | false;
    /**
     * In which file the field is implemented
     */
    file: string;
    /**
     * Whether the field is only used internally and not supposed to be exposed to the client
     */
    internal: boolean;
  };
}

export interface SchemaStaticField {
  kind: "staticField";
  name: string;
  /**
   * Which files implement the field
   */
  from: string[];
}

export type SchemaOutputType = {
  kind: "nonNull";
  of: SchemaOutputType;
} | {
  kind: "array";
  of: SchemaOutputType;
} | {
  kind: "type";
  name: string;
};

export interface SchemaArgument {
  kind: "argument";
  name: string;
  description?: string;
  type: SchemaOutputType;
}
