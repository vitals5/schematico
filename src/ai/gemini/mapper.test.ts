// src/ai/gemini/mapper.test.ts
import { SCHEMATICO_MCP_TOOLS } from '../mcp-tools/definitions';
import { mcpToolToGeminiFunction, mcpToolsToGeminiFunctions } from './mapper';
import { Type } from '@google/genai';

function runMapperTests() {
  console.log('--- Testing Gemini Tool Mapper ---');

  const geminiFunctions = mcpToolsToGeminiFunctions(SCHEMATICO_MCP_TOOLS);

  // Test 1: Count matches
  if (geminiFunctions.length !== SCHEMATICO_MCP_TOOLS.length) {
    throw new Error(`Expected ${SCHEMATICO_MCP_TOOLS.length} mapped functions, got ${geminiFunctions.length}`);
  }
  console.log(`✓ Test 1: Converted all ${geminiFunctions.length} MCP tools to Gemini declarations`);

  // Test 2: Verify add_component schema structure
  const addCompTool = SCHEMATICO_MCP_TOOLS.find(t => t.name === 'add_component')!;
  const addCompDecl = mcpToolToGeminiFunction(addCompTool);

  if (addCompDecl.name !== 'add_component') {
    throw new Error(`Name mismatch: ${addCompDecl.name}`);
  }
  if (!addCompDecl.parameters || addCompDecl.parameters.type !== Type.OBJECT) {
    throw new Error(`Parameters root must be Type.OBJECT, got: ${addCompDecl.parameters?.type}`);
  }

  const props = addCompDecl.parameters.properties;
  if (!props || !props.x || !props.y || !props.symbolId) {
    throw new Error('Missing expected properties x, y, symbolId in mapped schema');
  }

  if (props.x.type !== Type.NUMBER || props.symbolId.type !== Type.STRING) {
    throw new Error(`Type mapping error: x=${props.x.type}, symbolId=${props.symbolId.type}`);
  }

  if (!addCompDecl.parameters.required?.includes('x') || !addCompDecl.parameters.required?.includes('y')) {
    throw new Error('Required fields [x, y] missing from mapped parameters');
  }
  console.log('✓ Test 2: add_component mapped correctly with required fields [x, y]');

  // Test 3: Verify enum mapping (rotation)
  if (!props.rotation || !props.rotation.enum || props.rotation.enum.length !== 4) {
    throw new Error(`Rotation enum mapping failed: ${JSON.stringify(props.rotation)}`);
  }
  console.log('✓ Test 3: Rotation enum correctly mapped to string list:', props.rotation.enum);

  console.log('All Gemini Mapper tests passed successfully! 🎉');
}

runMapperTests();
