import {
  ErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

// ヘルプツール
import {
  helpTool,
  HelpToolInputSchema,
  type HelpToolInput
} from '../tools/help/help-tool.js';

// 統合ツール
import {
  executeTool,
  ExecuteToolInputSchema,
  type ExecuteToolInput
} from '../tools/unified/execute-tool.js';

export class ToolHandler {
  private validateAndParseInput<T>(
    args: unknown,
    schema: z.ZodType<T>,
    toolName: string
  ): T {
    try {
      return schema.parse(args || {});
    } catch (error) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid parameters for ${toolName}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private formatResponse(result: unknown) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }

  async executeTool(name: string, args: unknown) {
    switch (name) {
      // ヘルプツール
      case 'zaim_help': {
        const input = this.validateAndParseInput<HelpToolInput>(args, HelpToolInputSchema, name);
        const result = await helpTool(input);
        return this.formatResponse(result);
      }

      // 統合ツール
      case 'zaim_execute': {
        const input = this.validateAndParseInput<ExecuteToolInput>(args, ExecuteToolInputSchema, name);
        const result = await executeTool(input);
        return this.formatResponse(result);
      }

      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${name}`
        );
    }
  }
}
