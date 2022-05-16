export type RootType = "Query" | "Mutation";
export type Schema = Record<string, SchemaType | SchemaScalar> & Record<RootType, SchemaType>;

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
    args?: string[] | false;
    file: string;
  };
}

export interface SchemaStaticField {
  kind: "staticField";
  name: string;
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
