import ts from "typescript";
import type { Schema, SchemaArgument, SchemaOutputType, SchemaScalar, SchemaType } from "../../src/core/schema";
import { areTypesEqual, getModuleScopeFileName, isModuleApiFile, isModuleFile, isNodeModule, not, or } from "./utils";

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
  protected typesRegexes: [RegExp, string][];

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
        staticFields: {},
        from: []
      },
      Mutation: {
        kind: "type",
        name: "Mutation",
        description: "The root mutation type",
        fields: {},
        staticFields: {},
        from: []
      }
    };

    this.program = this.watch.getCurrentProgram().getProgram();
    this.checker = this.program.getTypeChecker();
    this.sourceFiles = this.program.getSourceFiles().filter(not(isNodeModule));

    this.nodeUtils = new NodeUtils(this.checker);

    this.scanScalars();
    this.scanTypes();
    this.typesRegexes = this.buildTypesRegexes();
  }

  getTypes() {
    return this.types;
  }

  replace(content?: string) {
    if (!content) return content;
    return this.typesRegexes.reduce((c, [rex, replace]) => {
      return c.replace(rex, replace);
    }, content);
  }

  protected buildTypesRegexes(): typeof this.typesRegexes {
    return [
      [new RegExp(`new (${Object.keys(this.types).join("|")})`, "g"), "new __classes.$1"],
      [new RegExp(`(${Object.keys(this.types).join("|")})\\.`, "g"), "__classes.$1."]
    ];
  }

  refreshTypes(sourceFile?: ts.SourceFile): UpdateResult {
    if (!sourceFile) return UpdateResult.NOTHING;
    return Math.max(this.updateScalars(sourceFile), this.updateTypes(sourceFile));
  }

  protected scanScalars() {
    for (const sourceFile of this.sourceFiles) {
      this.updateScalars(sourceFile);
    }
  }

  protected updateScalars(sourceFile: ts.SourceFile): UpdateResult {
    if (!isModuleFile(sourceFile.fileName)) return UpdateResult.NOTHING;

    const moduleFileName = getModuleScopeFileName(sourceFile.fileName);
    const scalars: Record<string, SchemaScalar> = {};

    for (const aliasDeclaration of sourceFile.statements.filter(ts.isTypeAliasDeclaration)) {
      const scalarName = aliasDeclaration.name.text;
      const type = aliasDeclaration.type;
      if (!ts.isTypeReferenceNode(type)) continue;
      // TODO: Check for actual symbol
      if (!ts.isIdentifier(type.typeName) || type.typeName.text !== "Scalar") continue;

      try {
        scalars[scalarName] = {
          kind: "scalar",
          name: scalarName,
          description: this.nodeUtils.getNodeDescription(aliasDeclaration),
          type: this.nodeUtils.getTypeNodeOutputType(type.typeArguments![0]),
          from: moduleFileName
        };
      } catch (e) {
        console.error(e);
        throw new ScanError(null, moduleFileName, scalarName);
      }
    }

    let result = UpdateResult.NOTHING;
    const oldScalars: Record<string, SchemaScalar> = {};

    for (const [scalarName, scalar] of Object.entries(this.types)) {
      if (scalar.kind === "scalar" && scalar.from === moduleFileName) {
        delete this.types[scalarName];
        oldScalars[scalarName] = scalar;
      }
    }

    for (const scalarName in scalars) {
      const scalar = scalars[scalarName];

      if (scalarName in this.types) {
        throw new ScanError(`Duplicate scalar name`, moduleFileName, scalarName);
      }

      if (!areTypesEqual(Object.entries(oldScalars).find(([oldScalarName]) => oldScalarName === scalarName)?.[1], scalar)) {
        result = UpdateResult.SCHEMA;
      }

      this.types[scalarName] = scalar;
    }

    if (Object.keys(oldScalars).length !== Object.keys(scalars).length) {
      result = UpdateResult.FULL;
    } else {
      for (const scalar in scalars) {
        if (!(scalar in oldScalars)) {
          result = UpdateResult.FULL;
          break;
        }
      }
    }

    return result;
  }

  protected scanTypes() {
    for (const sourceFile of this.sourceFiles) {
      this.updateTypes(sourceFile);
    }
  }

  protected updateTypes(sourceFile: ts.SourceFile): UpdateResult {
    if (!isModuleApiFile(sourceFile.fileName)) return UpdateResult.NOTHING;

    const moduleFileName = getModuleScopeFileName(sourceFile.fileName);
    const types: Record<string, SchemaType> = {};

    for (const node of sourceFile.statements) {
      if (!(ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node))) continue;
      if (!this.nodeUtils.isNodeExported(node)) continue;

      const classOrInterfaceDeclaration = node as ts.ClassDeclaration | ts.InterfaceDeclaration;
      const typeName = classOrInterfaceDeclaration.name?.text;
      if (!typeName) continue;

      types[typeName] = {
        kind: "type",
        name: typeName,
        fields: {},
        staticFields: {},
        description: this.nodeUtils.getNodeDescription(classOrInterfaceDeclaration),
        from: [moduleFileName]
      };

      const type = types[typeName] as SchemaType;

      for (const member of classOrInterfaceDeclaration.members) {
        if (!(ts.isMethodDeclaration(member) || ts.isGetAccessor(member) || ts.isPropertySignature(member))) continue;
        const { name: fieldName, member: memberName } = this.nodeUtils.getFieldName(member);
        if (!fieldName) continue;
        if (fieldName === "data" && !(member.modifierFlagsCache & ts.ModifierFlags.Static)) throw new ScanError("Reserved field", moduleFileName, typeName, fieldName);

        if (member.modifierFlagsCache & ts.ModifierFlags.Static) {
          type.staticFields[memberName] = {
            kind: "staticField",
            name: fieldName,
            from: [moduleFileName]
          };
        } else {
          try {
            type.fields[memberName] = {
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
                file: moduleFileName,
              }
            };
          } catch (e) {
            if (e instanceof Error) {
              throw new ScanError(e.message, moduleFileName, typeName, fieldName);
            }
            throw e;
          }
        }
      }
    }

    let result = UpdateResult.NOTHING;
    const updatedTypes: string[] = [];

    for (const [typeName, oldType] of Object.entries(this.types)) {
      if (oldType.kind !== "type") continue;

      if (!(typeName in types)) {
        if (!oldType.from.includes(moduleFileName)) continue;

        result = UpdateResult.FULL;
        // Type is removed from file
        if (oldType.from.length === 1) {
          delete this.types[typeName];
          continue;
        }

        // Remove all references to file
        Object.assign(oldType, {
          from: oldType.from.filter(f => f !== moduleFileName),
          fields: Object.entries(oldType.fields).reduce((fields, [fieldName, field]) => {
            if (field.resolve.file === moduleFileName) return fields;
            fields[fieldName] = field;

            return fields;
          }, {} as typeof oldType.fields),
          staticFields: Object.entries(oldType.staticFields).reduce((fields, [fieldName, field]) => {
            if (field.from.includes(moduleFileName)) {
              field.from = field.from.filter(from => from !== moduleFileName);
            };
            if (field.from.length) {
              fields[fieldName] = field;
            }

            return fields;
          }, {} as typeof oldType.staticFields)
        });
        oldType.from = oldType.from.filter(from => from !== moduleFileName);
      } else {
        // Update types
        const type = types[typeName];
        const updatedFields: string[] = [];
        const updatedStaticFields: string[] = [];

        // Update old fields
        Object.assign(oldType, {
          description: type.description,
          fields: Object.entries(oldType.fields).reduce((fields, [fieldName, oldField]) => {
            if (fieldName in type.fields) {
              const field = type.fields[fieldName];

              if (oldField.resolve.file !== moduleFileName) {
                throw new ScanError(`Field is already defined`, moduleFileName, typeName, fieldName);
              }
              if (!areTypesEqual(oldField, field)) {
                result = Math.max(result, UpdateResult.SCHEMA);
                oldField = field;
              }
              if (fieldName in type.fields) {
                fields[fieldName] = oldField;
              }
            } else {
              if (oldField.resolve.file !== moduleFileName) {
                fields[fieldName] = oldField;
              }
            }
            updatedFields.push(fieldName);
            return fields;
          }, {} as typeof oldType.fields),
          staticFields: Object.entries(oldType.staticFields).reduce((fields, [fieldName, oldField]) => {
            if (!(fieldName in type.staticFields)) {
              oldField.from = oldField.from.filter(from => from !== moduleFileName);
              result = Math.max(result, UpdateResult.SCHEMA);
            } else {
              if (!oldField.from.includes(moduleFileName)) {
                oldField.from.push(moduleFileName);
              }
            }
            if (oldField.from.length) {
              fields[fieldName] = oldField;
            }
            updatedStaticFields.push(fieldName);
            return fields;
          }, {} as typeof oldType.staticFields)
        });

        // Push new fields
        Object.assign(oldType.fields, Object.entries(type.fields).reduce((fields, [fieldName, field]) => {
          if (updatedFields.includes(fieldName)) return fields;
          fields[fieldName] = field;
          result = Math.max(result, UpdateResult.SCHEMA);
          return fields;
        }, {} as typeof oldType.fields));
        Object.assign(oldType.staticFields, Object.entries(type.staticFields).reduce((fields, [fieldName, field]) => {
          if (updatedStaticFields.includes(fieldName)) return fields;
          fields[fieldName] = field;
          result = Math.max(result, UpdateResult.SCHEMA);
          return fields;
        }, {} as typeof oldType.staticFields));

        if (updatedFields.length || updatedStaticFields.length || Object.keys(type.fields).length || Object.keys(type.staticFields).length) {
          if (!oldType.from.includes(moduleFileName)) {
            oldType.from.push(moduleFileName);
          }
        }

        updatedTypes.push(typeName);
      }
    }

    for (const typeName in types) {
      if (!updatedTypes.includes(typeName)) {
        result = UpdateResult.FULL;
        this.types[typeName] = types[typeName];
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

  getFieldName(member: ts.MethodDeclaration | ts.GetAccessorDeclaration | ts.PropertySignature) {
    if (!ts.isIdentifier(member.name)) return { member: undefined, name: undefined };
    const symbol = this.checker.getSymbolAtLocation(member.name);
    if (symbol === undefined) throw new Error(`Could not get symbol for node ${member.name}`);
    const docTag = symbol?.getJsDocTags(this.checker).find(tag => tag.name === "gqlField");

    return docTag && docTag.text ? {
      member: member.name.text,
      name: ts.displayPartsToString(docTag.text)
    } : {
      member: member.name.text,
      name: member.name.text.replace(/^get([A-Z])/, (_, match) => match.toLowerCase())
    };
  }
}

export class ScanError extends Error {
  constructor(
    message: string | null,
    private _fileName: string,
    private _typeName: string,
    private _fieldName?: string
  ) {
    super(message ?? undefined);
  }

  get fileName() {
    return this._fileName;
  }

  get typeName() {
    return this._typeName;
  }

  get fieldName() {
    return this._fieldName;
  }
}
