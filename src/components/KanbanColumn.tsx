import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { Plus } from "lucide-react";
import TaskCard from "./TaskCard";
import TaskModal from "./TaskModal";

type Task = Database["public"]["Tables"]["tasks"]["Row"];

interface KanbanColumnProps {
  title: string;
  status: "todo" | "in_progress";
  tasks: Task[];
  userId: string;
  onTasksChanged: () => void;
  accentColor: string;
  gradientBg: string;
  onDragStart: (task: Task) => void;
  onDrop: (status: "todo" | "in_progress") => void;
}

export default function KanbanColumn({
  title,
  status,
  tasks,
  userId,
  onTasksChanged,
  accentColor,
  gradientBg,
  onDragStart,
  onDrop,
}: KanbanColumnProps) {
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    onDrop(status);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  return (
    <>
      <div
        className="flex flex-col rounded-2xl border transition-all duration-300"
        style={{
          minWidth: "320px",
          width: "100%",
          maxWidth: "400px",
          background: "hsl(var(--card))",
          border: isDragOver ? `2px solid ${accentColor}` : "1px solid hsl(var(--border))",
          boxShadow: isDragOver ? `0 0 24px ${accentColor}33` : "none",
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={() => setIsDragOver(false)}
      >
        {/* Column Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
          <div className="flex items-center gap-3">
            {/* Accent dot */}
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ background: accentColor, boxShadow: `0 0 8px ${accentColor}80` }}
            />
            <h2 className="font-semibold text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {title}
            </h2>
            <span
              className="inline-flex items-center justify-center w-6 h-6 rounded-lg text-xs font-bold"
              style={{ background: gradientBg, color: accentColor }}
            >
              {tasks.length}
            </span>
          </div>
          <button
            onClick={() => { setEditingTask(null); setShowModal(true); }}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
            title="Afegir tasca"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Tasks list */}
        <div className="flex-1 p-4 space-y-3 overflow-y-auto scrollbar-thin" style={{ maxHeight: "calc(100vh - 220px)" }}>
          {tasks.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-12 rounded-xl border-2 border-dashed border-border/40 text-center"
              style={{ background: gradientBg }}
            >
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: `${accentColor}20` }}>
                <Plus className="w-5 h-5" style={{ color: accentColor }} />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Cap tasca aquí</p>
              <button
                onClick={() => { setEditingTask(null); setShowModal(true); }}
                className="mt-2 text-xs font-medium transition-colors hover:underline"
                style={{ color: accentColor }}
              >
                Crear la primera
              </button>
            </div>
          ) : (
            tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onEdit={(t) => { setEditingTask(t); setShowModal(true); }}
                onDeleted={onTasksChanged}
                onDragStart={onDragStart}
              />
            ))
          )}
        </div>

        {/* Footer - Add task button */}
        <div className="px-4 pb-4 pt-1">
          <button
            onClick={() => { setEditingTask(null); setShowModal(true); }}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-muted-foreground border border-dashed border-border/50 hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-all"
          >
            <Plus className="w-4 h-4" />
            Afegir tasca
          </button>
        </div>
      </div>

      {showModal && (
        <TaskModal
          task={editingTask}
          status={status}
          userId={userId}
          onClose={() => { setShowModal(false); setEditingTask(null); }}
          onSaved={onTasksChanged}
        />
      )}
    </>
  );
}
