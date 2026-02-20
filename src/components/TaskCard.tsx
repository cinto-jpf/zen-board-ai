import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { Calendar, Tag, AlertTriangle, Pencil, Trash2, GripVertical, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Task = Database["public"]["Tables"]["tasks"]["Row"];

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDeleted: () => void;
  onDragStart: (task: Task) => void;
  isDone?: boolean;
}

const PRIORITY_CONFIG = {
  high: { label: "Alta", color: "text-red-400", bg: "bg-red-400/10 border-red-400/20" },
  medium: { label: "Mitjana", color: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-400/20" },
  low: { label: "Baixa", color: "text-green-400", bg: "bg-green-400/10 border-green-400/20" },
};

const formatDate = (date: string | null) => {
  if (!date) return null;
  return new Date(date).toLocaleDateString("ca-ES", { day: "numeric", month: "short" });
};

const isOverdue = (date: string | null) => {
  if (!date) return false;
  return new Date(date) < new Date();
};

export default function TaskCard({ task, onEdit, onDeleted, onDragStart, isDone = false }: TaskCardProps) {
  const [hovering, setHovering] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  const priority = PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG] ?? PRIORITY_CONFIG.medium;
  const overdue = !isDone && isOverdue(task.due_date);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Eliminar "${task.title}"?`)) return;
    setDeleting(true);
    const { error } = await supabase.from("tasks").delete().eq("id", task.id);
    if (error) {
      toast({ title: "Error eliminant", variant: "destructive" });
    } else {
      onDeleted();
    }
    setDeleting(false);
  };

  return (
    <div
      draggable
      onDragStart={() => onDragStart(task)}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onClick={() => onEdit(task)}
      className="group relative rounded-xl border p-4 cursor-pointer transition-all duration-200 animate-fade-in"
      style={{
        background: isDone
          ? "linear-gradient(145deg, hsl(142 70% 50% / 0.08), hsl(142 70% 50% / 0.04))"
          : hovering ? "hsl(var(--surface-hover))" : "var(--gradient-card)",
        borderColor: isDone ? "hsl(142 70% 50% / 0.25)" : "hsl(var(--border) / 0.6)",
        boxShadow: hovering ? "var(--shadow-elevated)" : "var(--shadow-card)",
        transform: hovering ? "translateY(-2px)" : "translateY(0)",
        opacity: isDone ? 0.85 : 1,
      }}
    >
      {/* Done checkmark */}
      {isDone && (
        <div className="absolute top-3 left-3">
          <CheckCircle2 className="w-4 h-4" style={{ color: "hsl(142 70% 50%)" }} />
        </div>
      )}

      {/* Drag handle */}
      {!isDone && (
        <div className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-40 transition-opacity cursor-grab">
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </div>
      )}

      {/* Action buttons */}
      <div className={`absolute top-3 right-3 flex gap-1 transition-opacity ${hovering ? "opacity-100" : "opacity-0"}`}>
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(task); }}
          className="w-6 h-6 rounded-md flex items-center justify-center bg-secondary/80 hover:bg-primary/20 hover:text-primary text-muted-foreground transition-all"
        >
          <Pencil className="w-3 h-3" />
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="w-6 h-6 rounded-md flex items-center justify-center bg-secondary/80 hover:bg-destructive/20 hover:text-destructive text-muted-foreground transition-all"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      <div className={`${isDone ? "pl-6" : ""} pr-12`}>
        {/* Priority badge */}
        <div className="flex items-center gap-2 mb-2">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${isDone ? "opacity-50" : ""} ${priority.bg} ${priority.color}`}>
            <AlertTriangle className="w-2.5 h-2.5" />
            {priority.label}
          </span>
        </div>

        {/* Title */}
        <h3 className={`text-sm font-semibold leading-snug mb-2 line-clamp-2 ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>
          {task.title}
        </h3>

        {/* Description */}
        {task.description && (
          <p className="text-xs text-muted-foreground mb-3 line-clamp-2 leading-relaxed">
            {task.description}
          </p>
        )}

        {/* Tags */}
        {task.tags && task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {task.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="flex items-center gap-0.5 px-2 py-0.5 rounded-md text-xs bg-primary/15 text-primary/80 border border-primary/20">
                <Tag className="w-2.5 h-2.5" />
                {tag}
              </span>
            ))}
            {task.tags.length > 3 && (
              <span className="px-2 py-0.5 rounded-md text-xs text-muted-foreground bg-muted">
                +{task.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Footer */}
        {task.due_date && (
          <div className={`flex items-center gap-1.5 text-xs ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
            <Calendar className="w-3.5 h-3.5" />
            {overdue ? "⚠ " : ""}{formatDate(task.due_date)}
          </div>
        )}
      </div>
    </div>
  );
}
