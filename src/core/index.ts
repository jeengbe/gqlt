import cors from "cors";
import express from "express";
import { graphqlHTTP } from "express-graphql";
import * as fs from "fs";
import * as path from "path";
import { GraphQLBoolean, GraphQLFieldResolver, GraphQLFloat, GraphQLID, GraphQLInt, GraphQLList, GraphQLNonNull, GraphQLNullableType, GraphQLObjectType, GraphQLOutputType, GraphQLScalarType, GraphQLSchema, GraphQLString, GraphQLType } from "graphql";
import classes, { init } from "./classes";
import { Schema, SchemaOutputType } from "./schema";
import { __core } from "@paths";

// eslint-disable-next-line @typescript-eslint/no-require-imports
require("source-map-support").install();

const schema = JSON.parse(fs.readFileSync(path.resolve(__core, "generated/schema.json"), "utf-8")) as Schema;

function array(type: GraphQLType) {
  return new GraphQLList(type);
}

function nonNull(type: GraphQLNullableType) {
  return new GraphQLNonNull(type);
}

function resolve(field: string, functionArgs: string[] | false = false) {
  return (async (source, args) => {
    if (functionArgs !== false) {
      // Is callable
      return await source[field](...functionArgs.map(arg => args[arg]));
    } else {
      // Not callable
      return await source[field];
    }
  }) as GraphQLFieldResolver<any, any, any>;
}

const types = {
  string: GraphQLString,
  integer: GraphQLInt,
  float: GraphQLFloat,
  boolean: GraphQLBoolean,
  id: GraphQLID
} as Record<string, any>;

function convertType(type: SchemaOutputType): GraphQLOutputType {
  if (type.kind === "nonNull") {
    return nonNull(convertType(type.of));
  } else if (type.kind === "array") {
    return array(convertType(type.of));
  } else {
    return types[type.name];
  }
}

for (const name in schema) {
  const type = schema[name];

  switch (type.kind) {
    case "scalar":
      types[name] = new GraphQLScalarType({
        name: type.name,
        description: type.description
      });
      break;
    case "type":
      types[name] = new GraphQLObjectType({
        name: type.name,
        description: type.description,
        fields: () => Object.values(type.fields).reduce((fields, field) => {
          fields[field.name] = {
            type: convertType(field.type),
            description: field.description,
            resolve: resolve(field.name, field.resolve.args),
            args: Object.values(field.args)?.reduce((args, arg) => {
              args[arg.name] = {
                type: convertType(arg.type),
                description: arg.description
              };
              return args;
            }, {} as Record<string, any>)
          };
          return fields;
        }, {} as Record<string, any>)
      });
      break;
  }
}

init().then(() => {
  const app = express();

  app.use(cors());
  app.use(
    graphqlHTTP({
      schema: new GraphQLSchema({
        query: types["Query"],
      }),
      rootValue: new classes["Query"](),
      graphiql: true,
      customFormatErrorFn: (error) => {
        console.log(error);
        return error;
      }
    }),
  );

  app.listen(4000);
});
