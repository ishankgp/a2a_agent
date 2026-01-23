#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

const GAMMA_API_KEY = process.env.GAMMA_API_KEY;
if (!GAMMA_API_KEY) {
    console.error("Error: GAMMA_API_KEY environment variable is required");
    process.exit(1);
}

const server = new Server(
    {
        name: "gamma-mcp-server",
        version: "1.0.0",
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

async function gammaRequest(endpoint, method = "GET", body = null) {
    const url = `https://api.gamma.app/v1/${endpoint}`;
    const headers = {
        "Authorization": `Bearer ${GAMMA_API_KEY}`,
        "Content-Type": "application/json",
    };

    const options = {
        method,
        headers,
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gamma API error: ${response.status} ${response.statusText} - ${errorText}`);
    }
    return response.json();
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "gamma_generate",
                description: "Generate a new presentation, document, or webpage using Gamma API",
                inputSchema: zodToJsonSchema(
                    z.object({
                        inputText: z.string().describe("Content to generate from. Can be a prompt, notes, or structured text."),
                        textMode: z.enum(["generate", "condense", "preserve"]).optional().default("generate").describe("How to treat the input text: 'generate' (expand), 'condense' (summarize), or 'preserve' (keep as is)."),
                        format: z.enum(["presentation", "document", "webpage", "social"]).optional().default("presentation").describe("Format of the output artifact."),
                        numCards: z.number().int().min(1).max(30).optional().default(10).describe("Approximate number of cards/slides to generate (if cardSplit is auto)."),
                        exportAs: z.enum(["pdf", "pptx"]).optional().describe("If specified, exports the result to this format immediately."),
                        additionalInstructions: z.string().optional().describe("Extra instructions for style, layout, or content."),
                    })
                ),
            },
            {
                name: "gamma_get_status",
                description: "Get the status of a generation job and retrieve final URLs",
                inputSchema: zodToJsonSchema(
                    z.object({
                        generationId: z.string().describe("The ID of the generation job returned by gamma_generate"),
                    })
                ),
            },
            {
                name: "gamma_list_themes",
                description: "List available themes",
                inputSchema: zodToJsonSchema(z.object({})),
            },
        ],
    };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
        const { name, arguments: args } = request.params;

        if (name === "gamma_generate") {
            const { inputText, textMode = "generate", format = "presentation", numCards = 10, exportAs, additionalInstructions } = args;

            const payload = {
                inputText,
                textMode,
                format,
                numCards,
                ...(additionalInstructions && { additionalInstructions }),
                ...(exportAs && { exportAs }),
            };

            // Gamma API requires these top-level parameters to be nested or structured? 
            // Checking docs: Top-level parameters are direct.
            // https://developers.gamma.app/docs/generate-api-parameters-explained

            const result = await gammaRequest("generate", "POST", payload);
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(result, null, 2),
                    },
                ],
            };
        }

        if (name === "gamma_get_status") {
            const { generationId } = args;
            const result = await gammaRequest(`generations/${generationId}`, "GET");
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(result, null, 2),
                    },
                ],
            };
        }

        if (name === "gamma_list_themes") {
            const result = await gammaRequest("themes", "GET");
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(result, null, 2),
                    },
                ],
            };
        }

        throw new Error(`Unknown tool: ${name}`);
    } catch (error) {
        return {
            content: [
                {
                    type: "text",
                    text: `Error: ${error.message}`,
                },
            ],
            isError: true,
        };
    }
});

// Helper to convert Zod schema to JSON Schema for MCP
function zodToJsonSchema(schema) {
    // Simple conversion for the specific schemas we used
    // In a full implementation, use 'zod-to-json-schema' package
    const zodType = schema._def.typeName;

    if (zodType === "ZodObject") {
        const properties = {};
        const required = [];

        for (const [key, value] of Object.entries(schema.shape)) {
            properties[key] = zodToJsonSchema(value);
            if (!value.isOptional()) {
                required.push(key);
            }
        }

        return {
            type: "object",
            properties,
            required: required.length > 0 ? required : undefined,
        };
    }

    if (zodType === "ZodString") {
        const def = { type: "string" };
        if (schema.description) def.description = schema.description;

        // Check for enum
        if (schema._def.checks) {
            // This is a simplified check, accessing internal _def structures can be brittle usually
            // but sufficient for this snippet if we stick to basic Zod usage.
        }
        return def;
    }

    if (zodType === "ZodEnum") {
        return {
            type: "string",
            enum: schema._def.values,
            description: schema.description
        }
    }

    if (zodType === "ZodNumber") {
        const def = { type: "number" };
        if (schema.description) def.description = schema.description;
        return def;
    }

    if (zodType === "ZodOptional") {
        return zodToJsonSchema(schema._def.innerType);
    }

    if (zodType === "ZodDefault") {
        // For default, we just process the inner type, JSON schema doesn't strictly enforce default in the same way 
        // but we can denote it if we used a library.
        return zodToJsonSchema(schema._def.innerType);
    }

    return { type: "string" }; // Fallback
}

const transport = new StdioServerTransport();
await server.connect(transport);
