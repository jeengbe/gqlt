import ts from "typescript";
import type { Schema, SchemaArgument, SchemaOutputType, SchemaType } from "../src/core/schema";
import { getModuleScopeFileName, isModuleApiFile, isModuleFile, isNodeModule, not, or } from "./utils";

export enum UpdateResult {
  /**
   * Nothing changed, do not recompile
   */
  NOTHING,
  /**
   * Parameters or arguments changed, recompile schema only
   */
  SCHEMA,
  /**
   * New types or scalars added, recompile everything
   */
  FULL
}

export class Scanner {
  protected types: Schema;
  protected typesRegex: RegExp;

  protected nodeUtils: NodeUtils;

  protected program: ts.Program;
  protected checker: ts.TypeChecker;
  protected sourceFiles: ts.SourceFile[];

  constructor(
    protected watch: ReturnType<typeof ts.createWatchProgram>
  ) {
    this.types = {
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

    this.typesRegex = this.buildTypesRegex();

    this.program = this.watch.getCurrentProgram().getProgram();
    this.checker = this.program.getTypeChecker();
    this.sourceFiles = this.program.getSourceFiles().filter(not(isNodeModule));

    this.nodeUtils = new NodeUtils(this.checker);

    this.scanScalars();
    this.scanTypes();
  }

  getTypes() {
    return this.types;
  }

  getTypesRegex() {
    return this.typesRegex;
  }

  protected buildTypesRegex() {
    return new RegExp(`new (${Object.keys(this.types).join("|")})`, "g");
  }

  refreshTypes(sourceFile?: ts.SourceFile): UpdateResult {
    if (!sourceFile) return UpdateResult.NOTHING;
    return Math.max(this.updateScalars(sourceFile), this.updateTypes(sourceFile));
  }

  protected scanScalars() {
    for (const sourceFile of this.sourceFiles) {
      this.updateScalars(sourceFile, false);
    }
  }

  protected updateScalars(sourceFile: ts.SourceFile, replace = true): UpdateResult {
    if (!sourceFile.isDeclarationFile) return UpdateResult.NOTHING;
    if (!isModuleFile(sourceFile.fileName)) return UpdateResult.NOTHING;

    let result = UpdateResult.NOTHING;
    const moduleFileName = getModuleScopeFileName(sourceFile.fileName);

    for (const aliasDeclaration of sourceFile.statements.filter(ts.isTypeAliasDeclaration)) {
      const scalarName = aliasDeclaration.name.text;

      if (scalarName in this.types) {
        // Only bother if not replacing or origins don't match
        if (!replace || this.types[scalarName].from !== moduleFileName) {
          throw new Error(`Duplicate scalar name: ${scalarName}`);
        }
      } else {
        if (replace) {
          // We found a new scalar
          result = UpdateResult.FULL;
        }
      }

      const type = aliasDeclaration.type;
      if (!ts.isTypeReferenceNode(type)) continue;
      // TODO: Check for actual symbol
      if (!ts.isIdentifier(type.typeName) || type.typeName.text !== "Scalar") continue;

      try {
        this.types[scalarName] = {
          kind: "scalar",
          name: scalarName,
          description: this.nodeUtils.getNodeDescription(aliasDeclaration),
          type: this.nodeUtils.getTypeNodeOutputType(type.typeArguments![0]),
          from: moduleFileName
        };
      } catch (e) {
        console.error(`Error while parsing scalar ${scalarName} in ${sourceFile.fileName}:`);
        throw e;
      }
    }

    return result;
  }

  protected scanTypes() {
    for (const sourceFile of this.sourceFiles) {
      this.updateTypes(sourceFile, false);
    }
  }

  protected updateTypes(sourceFile: ts.SourceFile, replace = true): UpdateResult {
    if (!isModuleApiFile(sourceFile.fileName)) return UpdateResult.NOTHING;

    let result = UpdateResult.NOTHING;
    const moduleFileName = getModuleScopeFileName(sourceFile.fileName);

    for (const node of sourceFile.statements) {
      if (!(ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node))) continue;
      if (!this.nodeUtils.isNodeExported(node)) continue;

      const classOrInterfaceDeclaration = node as ts.ClassDeclaration | ts.InterfaceDeclaration;
      const typeName = classOrInterfaceDeclaration.name?.text;
      if (!typeName) continue;

      if (typeName in this.types) {
        const type = this.types[typeName];
        if (!replace) {
          if (type.kind === "scalar") {
            throw new Error(`Type "${typeName}" is already defined as a scalar type`);
          }
          if (this.nodeUtils.getNodeDescription(classOrInterfaceDeclaration) !== "") {
            throw new Error(`Type "${typeName}" already has a description`);
          }
          if (!type.from.includes(moduleFileName)) {
            type.from.push(moduleFileName);
          }
        } else {
          result = UpdateResult.SCHEMA;
        }
      } else {
        this.types[typeName] = {
          kind: "type",
          name: typeName,
          fields: {},
          description: this.nodeUtils.getNodeDescription(classOrInterfaceDeclaration),
          from: [moduleFileName]
        };

        result = UpdateResult.FULL;
      }
      const type = this.types[typeName] as SchemaType;

      for (const member of classOrInterfaceDeclaration.members) {
        if (!(ts.isMethodDeclaration(member) || ts.isGetAccessor(member) || ts.isPropertySignature(member))) continue;
        if (!ts.isIdentifier(member.name)) continue;
        const fieldName = member.name.text;
        if (fieldName in type.fields) {
          if (!replace || type.fields[fieldName].resolve.from !== moduleFileName) {
            throw new Error(`Field "${fieldName}" is already defined in type "${typeName}"`);
          }
        } else {
          if (replace) {
            result = UpdateResult.FULL;
          }
        }

        try {
          type.fields[fieldName] = {
            kind: "field",
            name: fieldName,
            description: this.nodeUtils.getNodeDescription(member),
            type: this.nodeUtils.getNodeOutputType(member),
            args: ts.isMethodDeclaration(member)
              ? member.parameters.reduce((params, p) => {
                if (!ts.isIdentifier(p.name)) return params;
                const parameteName = p.name.text;

                params[parameteName] = {
                  kind: "argument",
                  name: parameteName,
                  description: this.nodeUtils.getNodeDescription(p),
                  type: this.nodeUtils.getNodeOutputType(p)
                };
                return params;
              }, {} as Record<string, SchemaArgument>)
              : {},
            resolve: {
              args: ts.isMethodDeclaration(member)
                ? member.parameters.map(p => p.name).filter(ts.isIdentifier).map(n => n.text)
                : false,
              from: moduleFileName
            }
          };
        } catch (e) {
          console.error(`Error while parsing field "${fieldName}" in "${typeName}" in ${sourceFile.fileName}:`);
          throw e;
        }
      }
    }

    return result;
  }
}

class NodeUtils {
  constructor(
    protected checker: ts.TypeChecker
  ) { }

  isNodeExported(node: ts.Node): boolean {
    return (
      (ts.getCombinedModifierFlags(node as ts.Declaration) & ts.ModifierFlags.Export) !== 0 ||
      (!!node.parent && node.parent.kind === ts.SyntaxKind.SourceFile)
    );
  }

  getNodeDescription(node: ts.NamedDeclaration): string | undefined {
    const symbol = node.name && this.checker.getSymbolAtLocation(node.name);
    if (symbol === undefined) throw new Error(`Could not get symbol for node ${node.name}`);

    return ts.displayPartsToString(symbol.getDocumentationComment(this.checker));
  }

  getNodeOutputType(node: ts.NamedDeclaration) {
    const symbol = node.name && this.checker.getSymbolAtLocation(node.name);
    if (symbol === undefined) throw new Error(`Could not get symbol for node ${node.name}`);
    const symbolType = this.checker.getTypeOfSymbolAtLocation(symbol, node);
    const typeNode = this.checker.typeToTypeNode(symbolType, node, ts.NodeBuilderFlags.None)!;

    return this.getTypeNodeOutputType(typeNode);
  }


  getTypeNodeOutputType(type: ts.TypeNode, isNullable = false): SchemaOutputType {
    switch (type.kind) {
      // case ts.SyntaxKind.StringLiteral:
      case ts.SyntaxKind.StringKeyword:
        // `String` scalar
        return this.nonNull({
          kind: "type",
          name: "string",
        }, isNullable);

      // case ts.SyntaxKind.TrueKeyword:
      // case ts.SyntaxKind.FalseKeyword:
      case ts.SyntaxKind.BooleanKeyword:
        // `Boolean` scalar
        return this.nonNull({
          kind: "type",
          name: "boolean"
        }, isNullable);

      // case ts.SyntaxKind.NumericLiteral:
      case ts.SyntaxKind.NumberKeyword:
        // JavaScript `number` is ambiguous as it could both be `Float` or `Integer`
        throw new Error("Number literals are not supported! Use `integer` or `float` from `@core/scalars` instead.");

      case ts.SyntaxKind.FunctionType:
        // Resolve function return types
        return this.getTypeNodeOutputType((type as ts.FunctionOrConstructorTypeNode).type);

      case ts.SyntaxKind.TypeReference:
        // We have a type reference
        const typeReference = type as ts.TypeReferenceNode;
        if ((typeReference.typeName as ts.Identifier).text === "Promise") {
          // If the type is a promise, return the promise's type
          return this.getTypeNodeOutputType(typeReference.typeArguments![0]);
        }
        return this.nonNull({
          kind: "type",
          name: (typeReference.typeName as ts.Identifier).text,
        }, isNullable);

      case ts.SyntaxKind.ArrayType:
        return this.nonNull({
          kind: "array",
          of: this.getTypeNodeOutputType((type as ts.ArrayTypeNode).elementType)
        }, isNullable);

      case ts.SyntaxKind.UnionType:
        const unionType = type as ts.UnionTypeNode;
        if (unionType.types.length === 2 && unionType.types.filter(or(this.isNullLiteral, this.isUndefined)).length === 1) {
          return this.getTypeNodeOutputType(unionType.types.find(not(or(this.isNullLiteral, this.isUndefined)))!, true);
        }
        throw new Error("Union types are not supported!");

      case ts.SyntaxKind.VoidKeyword:
        return this.nonNull({
          kind: "type",
          name: "void"
        }, true);

      default:
        console.error(type);
        throw new Error(`Unsupported type: ${ts.SyntaxKind[type.kind]}`);
    }
  }

  nonNull<T extends SchemaOutputType>(type: T, isNullable: boolean) {
    if (isNullable) {
      return type;
    }
    return {
      kind: "nonNull" as const,
      of: type
    };
  }

  isNullLiteral(type: ts.TypeNode) {
    return type.kind === ts.SyntaxKind.LiteralType && (type as ts.LiteralTypeNode).literal.kind === ts.SyntaxKind.NullKeyword;
  }

  isUndefined(type: ts.TypeNode) {
    return type.kind === ts.SyntaxKind.UndefinedKeyword;
  }
}
