import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const tools = [
  {
    type: "function",
    function: {
      name: "create_task",
      description: "Create a new task on the Kanban board.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Task title" },
          description: { type: "string", description: "Optional task description" },
          priority: { type: "string", enum: ["low", "medium", "high"], description: "Task priority" },
          status: { type: "string", enum: ["todo", "in_progress", "done"], description: "Column to place the task in" },
          due_date: { type: "string", description: "Optional due date in YYYY-MM-DD format" },
          tags: { type: "array", items: { type: "string" }, description: "Optional list of tags" },
        },
        required: ["title", "priority", "status"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "edit_task",
      description: "Edit an existing task on the Kanban board. Only include fields that need to change.",
      parameters: {
        type: "object",
        properties: {
          task_id: { type: "string", description: "The ID of the task to edit" },
          title: { type: "string", description: "New title" },
          description: { type: "string", description: "New description" },
          priority: { type: "string", enum: ["low", "medium", "high"], description: "New priority" },
          status: { type: "string", enum: ["todo", "in_progress", "done"], description: "New status/column" },
          due_date: { type: "string", description: "New due date in YYYY-MM-DD format" },
          tags: { type: "array", items: { type: "string" }, description: "New list of tags" },
        },
        required: ["task_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_task",
      description: "Delete a task from the Kanban board.",
      parameters: {
        type: "object",
        properties: {
          task_id: { type: "string", description: "The ID of the task to delete" },
        },
        required: ["task_id"],
        additionalProperties: false,
      },
    },
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, boardContext } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const taskList = boardContext?.tasks
      ?.map((t: { id: string; title: string; status: string; priority: string }) =>
        `- ID: ${t.id} | "${t.title}" | ${t.status} | ${t.priority} priority`
      )
      .join("\n") || "No tasks yet";

    const systemPrompt = `You are an intelligent Kanban board assistant with the ability to take actions on the board.

Current board state:
- To-Do tasks: ${boardContext?.todoCount ?? 0}
- In Progress tasks: ${boardContext?.inProgressCount ?? 0}
- Done tasks: ${boardContext?.doneCount ?? 0}

Tasks (with IDs for editing/deleting):
${taskList}

You can:
1. Answer general productivity and project management questions
2. Suggest how to organize or prioritize tasks
3. **Create new tasks** using the create_task tool
4. **Edit existing tasks** (title, description, priority, status, due date, tags) using the edit_task tool
5. **Delete tasks** using the delete_task tool
6. Summarize and analyze the board

IMPORTANT RULES:
- When the user asks you to create, edit or delete tasks, ALWAYS use the provided tools — never just describe what you would do.
- When using edit_task or delete_task, you MUST use the exact task ID from the board state above.
- If the user refers to a task by name, find its ID from the list and use it.
- After performing an action, briefly confirm what you did in a friendly way.
- Be concise, helpful, and professional. Use markdown formatting for clarity.
- Respond in the same language as the user (Catalan, Spanish, or English).`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        tools,
        stream: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI usage limit reached. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI service error. Please try again." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Chat function error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error occurred" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
