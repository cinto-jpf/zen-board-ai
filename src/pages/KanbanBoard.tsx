import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { User } from "@supabase/supabase-js";
import { Kanban, LogOut, Bot, Sparkles, RefreshCw, CheckCircle2, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import KanbanColumn from "@/components/KanbanColumn";
import AIChat from "@/components/AIChat";
import { Progress } from "@/components/ui/progress";

type Task = Database["public"]["Tables"]["tasks"]["Row"];

interface KanbanBoardProps {
  user: User;
  onLogout: () => void;
}

export default function KanbanBoard({ user, onLogout }: KanbanBoardProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const { toast } = useToast();

  const displayName = user.email?.split("@")[0] ?? "Usuari";

  const loadTasks = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", user.id)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      toast({ title: "Error carregant tasques", variant: "destructive" });
    } else {
      setTasks(data ?? []);
    }
    setLoading(false);
  }, [user.id, toast]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    onLogout();
  };

  const handleDrop = async (newStatus: "todo" | "in_progress" | "done") => {
    if (!draggedTask || draggedTask.status === newStatus) {
      setDraggedTask(null);
      return;
    }

    const updateData: Record<string, unknown> = { status: newStatus };
    if (newStatus === "done") {
      updateData.finalitzacio_tasca = new Date().toISOString();
    } else {
      updateData.finalitzacio_tasca = null;
    }

    const { error } = await supabase
      .from("tasks")
      .update(updateData)
      .eq("id", draggedTask.id);

    if (error) {
      toast({ title: "Error movent tasca", variant: "destructive" });
    } else {
      setTasks((prev) =>
        prev.map((t) => (t.id === draggedTask.id ? { ...t, status: newStatus } : t))
      );
      const statusLabels: Record<string, string> = {
        todo: "Per fer",
        in_progress: "En curs",
        done: "Fet ✓",
      };
      toast({ title: `Tasca moguda a ${statusLabels[newStatus]}` });
    }
    setDraggedTask(null);
  };

  const todoTasks = tasks.filter((t) => t.status === "todo");
  const inProgressTasks = tasks.filter((t) => t.status === "in_progress");
  const doneTasks = tasks.filter((t) => t.status === "done");

  const completionRate = tasks.length > 0 ? Math.round((doneTasks.length / tasks.length) * 100) : 0;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Navbar */}
      <header
        className="flex items-center justify-between px-6 py-4 border-b border-border/60 sticky top-0 z-40"
        style={{ background: "hsl(var(--card) / 0.95)", backdropFilter: "blur(16px)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-primary)" }}
          >
            <Kanban className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              KanbanAI
            </h1>
            <p className="text-xs text-muted-foreground">Hola, {displayName}!</p>
          </div>
        </div>

        {/* Stats */}
        <div className="hidden md:flex items-center gap-4">
          {/* Completion rate */}
          <div className="flex flex-col gap-1 min-w-[120px]">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                Completat
              </span>
              <span className="text-xs font-bold" style={{ color: "hsl(var(--status-done-accent))" }}>
                {completionRate}%
              </span>
            </div>
            <Progress
              value={completionRate}
              className="h-1.5"
              style={{ background: "hsl(var(--secondary))" }}
            />
          </div>
          <div className="w-px h-10 bg-border/60" />
          <div className="text-center">
            <p className="text-xl font-bold text-foreground">{tasks.length}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
          <div className="w-px h-10 bg-border/60" />
          <div className="text-center">
            <p className="text-xl font-bold" style={{ color: "hsl(var(--status-todo-accent))" }}>
              {todoTasks.length}
            </p>
            <p className="text-xs text-muted-foreground">Per fer</p>
          </div>
          <div className="w-px h-10 bg-border/60" />
          <div className="text-center">
            <p className="text-xl font-bold" style={{ color: "hsl(var(--status-progress-accent))" }}>
              {inProgressTasks.length}
            </p>
            <p className="text-xs text-muted-foreground">En curs</p>
          </div>
          <div className="w-px h-10 bg-border/60" />
          <div className="text-center flex flex-col items-center gap-0.5">
            <div className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "hsl(var(--status-done-accent))" }} />
              <p className="text-xl font-bold" style={{ color: "hsl(var(--status-done-accent))" }}>
                {doneTasks.length}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">Fet</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={loadTasks}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
            title="Actualitzar"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowChat(!showChat)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-white transition-all"
            style={{
              background: showChat ? "hsl(var(--primary) / 0.8)" : "var(--gradient-primary)",
              boxShadow: "var(--shadow-primary)",
            }}
          >
            <Sparkles className="w-4 h-4" />
            <span className="hidden sm:inline">IA Assistent</span>
            <Bot className="w-4 h-4 sm:hidden" />
          </button>
          <button
            onClick={handleLogout}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
            title="Tancar sessió"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Board */}
      <main className="flex-1 p-6">
        {loading ? (
          <div className="flex gap-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-2xl border border-border/60 skeleton"
                style={{ minWidth: "320px", height: "500px" }}
              />
            ))}
          </div>
        ) : (
          <div className="flex gap-6 h-full overflow-x-auto pb-4">
            <KanbanColumn
              title="Per fer"
              status="todo"
              tasks={todoTasks}
              userId={user.id}
              onTasksChanged={loadTasks}
              accentColor="hsl(var(--status-todo-accent))"
              gradientBg="hsl(var(--status-todo-accent) / 0.06)"
              onDragStart={setDraggedTask}
              onDrop={handleDrop}
            />
            <KanbanColumn
              title="En curs"
              status="in_progress"
              tasks={inProgressTasks}
              userId={user.id}
              onTasksChanged={loadTasks}
              accentColor="hsl(var(--status-progress-accent))"
              gradientBg="hsl(var(--status-progress-accent) / 0.06)"
              onDragStart={setDraggedTask}
              onDrop={handleDrop}
            />
            <KanbanColumn
              title="Fet"
              status="done"
              tasks={doneTasks}
              userId={user.id}
              onTasksChanged={loadTasks}
              accentColor="hsl(var(--status-done-accent))"
              gradientBg="hsl(var(--status-done-accent) / 0.06)"
              onDragStart={setDraggedTask}
              onDrop={handleDrop}
            />
          </div>
        )}
      </main>

      {/* AI Chat */}
      {showChat && <AIChat tasks={tasks} userId={user.id} onClose={() => setShowChat(false)} onTasksChanged={loadTasks} />}
    </div>
  );
}
