// src/ai/gemini/mapper.ts
// Converts standard MCP Tool definitions to Gemini FunctionDeclaration format

import { FunctionDeclaration, Schema, Type } from '@google/genai';
import { McpToolDefinition, McpToolProperty, McpToolInputSchema } from '../mcp-tools/definitions';

function mapJsonTypeToGeminiType(type?: string): Type {
  switch (type?.toLowerCase()) {
    case 'string':
      return Type.STRING;
    case 'number':
      return Type.NUMBER;
    case 'integer':
      return Type.INTEGER;
    case 'boolean':
      return Type.BOOLEAN;
    case 'array':
      return Type.ARRAY;
    case 'object':
      return Type.OBJECT;
    default:
      return Type.STRING;
  }
}

function convertPropertyToGeminiSchema(prop: McpToolProperty): Schema {
  const schema: Schema = {
    type: mapJsonTypeToGeminiType(prop.type)
  };

  if (prop.description) {
    schema.description = prop.description;
  }

  if (prop.enum && prop.enum.length > 0) {
    schema.enum = prop.enum.map(String);
  }

  if (prop.type === 'array' && prop.items) {
    schema.items = convertPropertyToGeminiSchema(prop.items as McpToolProperty);
  }

  if (prop.type === 'object' && prop.properties) {
    schema.properties = {};
    for (const [key, childProp] of Object.entries(prop.properties)) {
      schema.properties[key] = convertPropertyToGeminiSchema(childProp);
    }
    if (prop.required && prop.required.length > 0) {
      schema.required = prop.required;
    }
  }

  return schema;
}

/**
 * Converts an McpToolDefinition into a Gemini FunctionDeclaration.
 */
export function mcpToolToGeminiFunction(tool: McpToolDefinition): FunctionDeclaration {
  const properties: Record<string, Schema> = {};

  if (tool.inputSchema?.properties) {
    for (const [key, prop] of Object.entries(tool.inputSchema.properties)) {
      properties[key] = convertPropertyToGeminiSchema(prop);
    }
  }

  const parameters: Schema = {
    type: Type.OBJECT,
    properties,
    description: tool.description
  };

  if (tool.inputSchema?.required && tool.inputSchema.required.length > 0) {
    parameters.required = tool.inputSchema.required;
  }

  return {
    name: tool.name,
    description: tool.description,
    parameters
  };
}

/**
 * Converts a list of McpToolDefinitions to Gemini FunctionDeclarations.
 */
export function mcpToolsToGeminiFunctions(tools: McpToolDefinition[]): FunctionDeclaration[] {
  return tools.map(mcpToolToGeminiFunction);
}
