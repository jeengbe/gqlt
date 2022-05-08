import * as path from "path";
import ts from "typescript";
import type { Schema, SchemaArgument, SchemaOutputType, SchemaType } from "../src/core/schema";
import { __src } from "./compile";
import { isModuleApiSourceFile, isNodeModule, not, or } from "./utils";

export function scan(options: ts.CreateProgramOptions): Schema {
  const program = ts.createProgram(options);

  const checker = program.getTypeChecker();

  const [, ...moduleSourceFiles] = program.getSourceFiles().filter(not(isNodeModule));

  const types: Schema = {
    Query: {
      kind: "type",
      name: "Query",
      description: "The root query type",
      fields: {},
      from: []
    },
    Mutation: {
      kind: "type",
      name: "Mutation",
      description: "The root mutation type",
      fields: {},
      from: []
    }
  };

  // Collect Scalars
  for (const sourceFile of moduleSourceFiles) {
    if (!sourceFile.isDeclarationFile || !path.normalize(sourceFile.fileName).startsWith(path.resolve(__src, "modules"))) continue;

    for (const aliasDeclaration of sourceFile.statements.filter(ts.isTypeAliasDeclaration)) {
      const scalarName = aliasDeclaration.name.text;

      if (scalarName in types) {
        throw new Error(`Duplicate scalar name: ${scalarName}`);
      }

      const type = aliasDeclaration.type;
      if (!ts.isTypeReferenceNode(type)) continue;
      if ((type.typeName as ts.Identifier).text !== "Scalar") continue;

      try {
        types[scalarName] = {
          kind: "scalar",
          name: scalarName,
          description: getNodeDescription(aliasDeclaration),
          type: getTypeNodeOutputType(type.typeArguments![0])
        };
      } catch (e) {
        console.error(`Error while parsing scalar ${scalarName} in ${sourceFile.fileName}:`);
        throw e;
      }
    }
  }

  // Collect Types
  for (const sourceFile of moduleSourceFiles.filter(isModuleApiSourceFile)) {
    const fileName = path.normalize(sourceFile.fileName).substring((__src + "/modules/").length, path.normalize(sourceFile.fileName).length - 3).replace(/\\/g, "/");

    for (const node of sourceFile.statements.filter(or(ts.isClassDeclaration, ts.isInterfaceDeclaration)).filter(isNodeExported)) {
      const classOrInterfaceDeclaration = node as ts.ClassDeclaration | ts.InterfaceDeclaration;
      const typeName = classOrInterfaceDeclaration.name?.text;
      if (typeName === undefined) continue;

      if (!(typeName in types)) {
        types[typeName] = {
          kind: "type",
          name: typeName,
          fields: {},
          description: getNodeDescription(classOrInterfaceDeclaration),
          from: [fileName]
        };
      } else {
        const type = types[typeName];
        if (type.kind === "scalar") throw new Error(`Type "${typeName}" is already defined as a scalar type`);
        if (getNodeDescription(classOrInterfaceDeclaration) !== "") throw new Error(`Type "${typeName}" already has a description`);
        if (!type.from.includes(fileName)) type.from.push(fileName);
      }
      const type = types[typeName] as SchemaType;

      for (const member of (classOrInterfaceDeclaration.members as ts.NodeArray<ts.ClassElement | ts.TypeElement>).filter(m => ts.isMethodDeclaration(m) || ts.isGetAccessor(m) || ts.isPropertySignature(m))) {
        const fieldName = (member.name as ts.Identifier)?.text;
        if (fieldName in type.fields) {
          throw new Error(`Field "${fieldName}" is already defined in type "${typeName}"`);
        }

        try {
          type.fields[fieldName] = {
            kind: "field",
            name: fieldName,
            description: getNodeDescription(member),
            type: getNodeOutputType(member),
            args: member.kind === ts.SyntaxKind.MethodDeclaration ? (member as ts.MethodDeclaration).parameters.reduce((parameters, p) => {
              const parameterName = (p.name as ts.Identifier).text;

              parameters[parameterName] = {
                kind: "argument",
                name: parameterName,
                description: getNodeDescription(p),
                type: getNodeOutputType(p),
              };
              return parameters;
            }, {} as Record<string, SchemaArgument>) : {},
            resolve: {
              args: member.kind === ts.SyntaxKind.MethodDeclaration ? (member as ts.MethodDeclaration).parameters?.map(p => (p.name as ts.Identifier).text) : false,
              from: fileName
            }
          };
        } catch (e) {
          console.error(`Error while parsing field "${fieldName}" in "${typeName}" in ${sourceFile.fileName}:`);
          throw e;
        }
      }
    }
  }

  return types;

  function isNodeExported(node: ts.Node): boolean {
    return (
      (ts.getCombinedModifierFlags(node as ts.Declaration) & ts.ModifierFlags.Export) !== 0 ||
      (!!node.parent && node.parent.kind === ts.SyntaxKind.SourceFile)
    );
  }

  function getNodeDescription(node: ts.NamedDeclaration): string | undefined {
    const symbol = node.name && checker.getSymbolAtLocation(node.name);
    if (symbol === undefined) throw new Error(`Could not get symbol for node ${node.name}`);

    return ts.displayPartsToString(symbol.getDocumentationComment(checker));
  }

  function getNodeOutputType(node: ts.NamedDeclaration) {
    const symbol = node.name && checker.getSymbolAtLocation(node.name);
    if (symbol === undefined) throw new Error(`Could not get symbol for node ${node.name}`);
    const symbolType = checker.getTypeOfSymbolAtLocation(symbol, node);
    const typeNode = checker.typeToTypeNode(symbolType, node, ts.NodeBuilderFlags.None)!;

    return getTypeNodeOutputType(typeNode);
  }
}

function getTypeNodeOutputType(type: ts.TypeNode, isNullable = false): SchemaOutputType {
  switch (type.kind) {
    // case ts.SyntaxKind.StringLiteral:
    case ts.SyntaxKind.StringKeyword:
      // `String` scalar
      return nonNull({
        kind: "type",
        name: "string",
      }, isNullable);

    // case ts.SyntaxKind.TrueKeyword:
    // case ts.SyntaxKind.FalseKeyword:
    case ts.SyntaxKind.BooleanKeyword:
      // `Boolean` scalar
      return nonNull({
        kind: "type",
        name: "boolean"
      }, isNullable);

    // case ts.SyntaxKind.NumericLiteral:
    case ts.SyntaxKind.NumberKeyword:
      // JavaScript `number` is ambiguous as it could both be `Float` or `Integer`
      throw new Error("Number literals are not supported! Use `integer` or `float` from `@core/scalars` instead.");

    case ts.SyntaxKind.FunctionType:
      // Resolve function return types
      return getTypeNodeOutputType((type as ts.FunctionOrConstructorTypeNode).type);

    case ts.SyntaxKind.TypeReference:
      // We have a type reference
      const typeReference = type as ts.TypeReferenceNode;
      if ((typeReference.typeName as ts.Identifier).text === "Promise") {
        // If the type is a promise, resolve the promise's type
        return getTypeNodeOutputType(typeReference.typeArguments![0]);
      }
      return nonNull({
        kind: "type",
        name: (typeReference.typeName as ts.Identifier).text,
      }, isNullable);

    case ts.SyntaxKind.ArrayType:
      return nonNull({
        kind: "array",
        of: getTypeNodeOutputType((type as ts.ArrayTypeNode).elementType)
      }, isNullable);

    case ts.SyntaxKind.UnionType:
      const unionType = type as ts.UnionTypeNode;
      if (unionType.types.length === 2 && unionType.types.filter(or(isNullLiteral, isUndefined)).length === 1) {
        return getTypeNodeOutputType(unionType.types.find(not(or(isNullLiteral, isUndefined)))!, true);
      }
      throw new Error("Union types are not supported!");

    case ts.SyntaxKind.VoidKeyword:
      return nonNull({
        kind: "type",
        name: "void"
      }, true);

    default:
      console.error(type);
      throw new Error(`Unsupported type: ${ts.SyntaxKind[type.kind]}`);
  }
}

function nonNull<T extends SchemaOutputType>(type: T, isNullable: boolean) {
  if (isNullable) {
    return type;
  }
  return {
    kind: "nonNull" as const,
    of: type
  };
}

function isNullLiteral(type: ts.TypeNode) {
  return type.kind === ts.SyntaxKind.LiteralType && (type as ts.LiteralTypeNode).literal.kind === ts.SyntaxKind.NullKeyword;
}

function isUndefined (type: ts.TypeNode) {
  return type.kind === ts.SyntaxKind.UndefinedKeyword;
}
