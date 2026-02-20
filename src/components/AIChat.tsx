import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { Bot, X, Send, Loader2, Sparkles, Trash2, CheckCircle2, PlusCircle, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";

type Task = Database["public"]["Tables"]["tasks"]["Row"];

interface Message {
  role: "user" | "assistant";
  content: string;
  id: string;
  action?: ActionResult;
}

interface ActionResult {
  type: "create" | "edit" | "delete";
  taskTitle?: string;
}

interface AIChatProps {
  tasks: Task[];
  userId: string;
  onClose: () => void;
  onTasksChanged: () => void;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/kanban-chat`;

export default function AIChat({ tasks, userId, onClose, onTasksChanged }: AIChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hola! Soc el teu assistent KanbanAI 🤖\n\nAra puc realitzar **accions automàtiques** al tauler:\n- 🟢 **Crear tasques** — *\"Crea una tasca 'Reunió setmanal' amb prioritat alta\"*\n- ✏️ **Editar tasques** — *\"Canvia la prioritat de la tasca X a baixa\"*\n- 🗑️ **Eliminar tasques** — *\"Elimina la tasca 'Test'\"*\n- 💬 **Respondre preguntes** i analitzar el board\n\nEn què puc ajudar-te?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const boardContext = {
    todoCount: tasks.filter((t) => t.status === "todo").length,
    inProgressCount: tasks.filter((t) => t.status === "in_progress").length,
    doneCount: tasks.filter((t) => t.status === "done").length,
    tasks: tasks.map((t) => ({ id: t.id, title: t.title, status: t.status, priority: t.priority })),
  };

  const executeToolCall = async (toolName: string, args: Record<string, unknown>): Promise<ActionResult | null> => {
    try {
      if (toolName === "create_task") {
        const { title, description, priority, status, due_date, tags } = args as {
          title: string; description?: string; priority: string; status: string; due_date?: string; tags?: string[];
        };
        const { error } = await supabase.from("tasks").insert({
          user_id: userId,
          title,
          description: description ?? null,
          priority,
          status,
          due_date: due_date ?? null,
          tags: tags ?? [],
          position: tasks.length,
        });
        if (error) throw error;
        onTasksChanged();
        return { type: "create", taskTitle: title };
      }

      if (toolName === "edit_task") {
        const { task_id, ...updates } = args as { task_id: string; [key: string]: unknown };
        const cleanUpdates: Record<string, unknown> = {};
        if (updates.title !== undefined) cleanUpdates.title = updates.title;
        if (updates.description !== undefined) cleanUpdates.description = updates.description;
        if (updates.priority !== undefined) cleanUpdates.priority = updates.priority;
        if (updates.status !== undefined) cleanUpdates.status = updates.status;
        if (updates.due_date !== undefined) cleanUpdates.due_date = updates.due_date;
        if (updates.tags !== undefined) cleanUpdates.tags = updates.tags;

        const { error } = await supabase.from("tasks").update(cleanUpdates).eq("id", task_id).eq("user_id", userId);
        if (error) throw error;
        onTasksChanged();
        const task = tasks.find((t) => t.id === task_id);
        return { type: "edit", taskTitle: task?.title ?? "tasca" };
      }

      if (toolName === "delete_task") {
        const { task_id } = args as { task_id: string };
        const task = tasks.find((t) => t.id === task_id);
        const { error } = await supabase.from("tasks").delete().eq("id", task_id).eq("user_id", userId);
        if (error) throw error;
        onTasksChanged();
        return { type: "delete", taskTitle: task?.title ?? "tasca" };
      }
    } catch (err) {
      console.error("Tool execution error:", err);
      toast({ title: "Error executant l'acció", description: String(err), variant: "destructive" });
    }
    return null;
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    const conversationMessages = [...messages.filter((m) => m.id !== "welcome"), userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: conversationMessages, boardContext }),
      });

      if (resp.status === 429) {
        toast({ title: "Límit superat", description: "Massa sol·licituds. Torna a intentar-ho.", variant: "destructive" });
        setLoading(false);
        return;
      }
      if (resp.status === 402) {
        toast({ title: "Crèdits esgotats", description: "Afegeix crèdits per continuar.", variant: "destructive" });
        setLoading(false);
        return;
      }
      if (!resp.ok) throw new Error("Error de connexió");

      const data = await resp.json();
      if (data.error) throw new Error(data.error);

      const choice = data.choices?.[0];
      const assistantMessage = choice?.message;

      let actionResult: ActionResult | null = null;
      let assistantContent = assistantMessage?.content ?? "";

      // Handle tool calls
      if (assistantMessage?.tool_calls?.length) {
        for (const toolCall of assistantMessage.tool_calls) {
          const args = JSON.parse(toolCall.function.arguments);
          actionResult = await executeToolCall(toolCall.function.name, args);
        }

        // If no text content after tools, provide a fallback
        if (!assistantContent) {
          if (actionResult?.type === "create") assistantContent = `✅ Tasca **"${actionResult.taskTitle}"** creada correctament!`;
          else if (actionResult?.type === "edit") assistantContent = `✅ Tasca **"${actionResult.taskTitle}"** editada correctament!`;
          else if (actionResult?.type === "delete") assistantContent = `🗑️ Tasca **"${actionResult.taskTitle}"** eliminada correctament!`;
          else assistantContent = "✅ Acció realitzada correctament!";
        }
      }

      const assistantId = `assistant-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: assistantContent, action: actionResult ?? undefined },
      ]);

      // Persist to DB
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("chat_messages").insert({ user_id: user.id, role: "assistant", content: assistantContent });
      }
    } catch (err) {
      toast({ title: "Error", description: "No s'ha pogut connectar amb la IA.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([{
      id: "welcome",
      role: "assistant",
      content: "Conversa reiniciada. En què puc ajudar-te?",
    }]);
  };

  const getActionBadge = (action: ActionResult) => {
    if (action.type === "create") return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full mt-1"
        style={{ background: "hsl(var(--status-done-accent) / 0.15)", color: "hsl(var(--status-done-accent))" }}>
        <PlusCircle className="w-3 h-3" /> Tasca creada
      </span>
    );
    if (action.type === "edit") return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full mt-1"
        style={{ background: "hsl(var(--status-progress-accent) / 0.15)", color: "hsl(var(--status-progress-accent))" }}>
        <Pencil className="w-3 h-3" /> Tasca editada
      </span>
    );
    if (action.type === "delete") return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full mt-1"
        style={{ background: "hsl(var(--destructive) / 0.15)", color: "hsl(var(--destructive))" }}>
        <CheckCircle2 className="w-3 h-3" /> Tasca eliminada
      </span>
    );
  };

  return (
    <div
      className="fixed bottom-6 right-6 z-50 w-96 rounded-2xl flex flex-col animate-slide-up"
      style={{
        background: "hsl(var(--card))",
        border: "1px solid hsl(var(--border))",
        boxShadow: "var(--shadow-elevated)",
        height: "540px",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 rounded-t-2xl border-b border-border/60"
        style={{ background: "var(--gradient-primary)" }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Assistent KanbanAI</p>
            <p className="text-xs text-white/70">Pot crear, editar i eliminar tasques</p>
          </div>
        </div>
        <div className="flex gap-1">
          <button
            onClick={clearChat}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20 transition-all"
            title="Netejar conversa"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center mr-2 flex-shrink-0 mt-0.5"
                style={{ background: "var(--gradient-primary)" }}
              >
                <Bot className="w-4 h-4 text-white" />
              </div>
            )}
            <div className="flex flex-col max-w-[80%]">
              <div
                className={`rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "text-white rounded-br-sm"
                    : "text-foreground rounded-bl-sm bg-secondary border border-border/40"
                }`}
                style={msg.role === "user" ? { background: "var(--gradient-primary)" } : {}}
              >
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm prose-invert max-w-none [&>p]:m-0 [&>ul]:mt-1 [&>ul]:mb-0 [&>ol]:mt-1 [&>ol]:mb-0">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  msg.content
                )}
              </div>
              {msg.action && (
                <div className={msg.role === "user" ? "self-end" : "self-start"}>
                  {getActionBadge(msg.action)}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-start gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: "var(--gradient-primary)" }}
            >
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-secondary border border-border/40 rounded-xl rounded-bl-sm px-3.5 py-2.5">
              <div className="flex gap-1.5 items-center">
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border/60">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder="Ex: Crea una tasca 'Reunió' amb alta prioritat..."
            className="bg-secondary border-border/60 focus:border-primary/60 h-10 text-sm"
            disabled={loading}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0 disabled:opacity-50 transition-all"
            style={{ background: "var(--gradient-primary)" }}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
