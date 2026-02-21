import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { X, Calendar, Tag, AlertTriangle, Clock } from "lucide-react";
import { Database } from "@/integrations/supabase/types";

type Task = Database["public"]["Tables"]["tasks"]["Row"];
type TaskInsert = Database["public"]["Tables"]["tasks"]["Insert"];

interface TaskModalProps {
  task?: Task | null;
  status: "todo" | "in_progress" | "done";
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}

const PRIORITY_OPTIONS = [
  { value: "low", label: "Baixa", color: "text-green-400" },
  { value: "medium", label: "Mitjana", color: "text-yellow-400" },
  { value: "high", label: "Alta", color: "text-red-400" },
];

const TAG_SUGGESTIONS = ["Disseny", "Dev", "Màrqueting", "Research", "Testing", "Reunió", "Urgent"];

export default function TaskModal({ task, status, userId, onClose, onSaved }: TaskModalProps) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [priority, setPriority] = useState<"low" | "medium" | "high">(task?.priority as "low" | "medium" | "high" ?? "medium");
  const [dueDate, setDueDate] = useState(task?.due_date ?? "");
  const [duracioEstimada, setDuracioEstimada] = useState<number>(task?.duracio_estimada ?? 30);
  const [tags, setTags] = useState<string[]>(task?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const addTag = (tag: string) => {
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
    }
    setTagInput("");
  };

  const removeTag = (tag: string) => setTags(tags.filter((t) => t !== tag));

  const handleSave = async () => {
    if (!title.trim()) return;
    setLoading(true);

    try {
      const data: TaskInsert = {
        user_id: userId,
        title: title.trim(),
        description: description.trim() || null,
        status,
        priority,
        due_date: dueDate || null,
        duracio_estimada: duracioEstimada,
        tags,
      };

      let error;
      if (task) {
        ({ error } = await supabase.from("tasks").update(data).eq("id", task.id));
      } else {
        ({ error } = await supabase.from("tasks").insert(data));
      }

      if (error) throw error;

      toast({ title: task ? "Tasca actualitzada" : "Tasca creada!" });
      onSaved();
      onClose();
    } catch (err: unknown) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Error desant la tasca",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-lg card-surface rounded-2xl p-6 animate-scale-in"
        style={{ boxShadow: "var(--shadow-elevated)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            {task ? "Editar tasca" : "Nova tasca"}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground/80">Títol *</label>
            <Input
              placeholder="Nom de la tasca..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-secondary border-border/60 focus:border-primary/60 h-11"
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground/80">Descripció</label>
            <Textarea
              placeholder="Detalls de la tasca..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-secondary border-border/60 focus:border-primary/60 resize-none"
              rows={3}
            />
          </div>

          {/* Priority + Due Date */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/80 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Prioritat
              </label>
              <Select value={priority} onValueChange={(v) => setPriority(v as "low" | "medium" | "high")}>
                <SelectTrigger className="bg-secondary border-border/60 h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span className={opt.color}>{opt.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/80 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Data límit
              </label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="bg-secondary border-border/60 focus:border-primary/60 h-11"
              />
            </div>
          </div>

          {/* Duració estimada */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground/80 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Duració estimada (minuts)
            </label>
            <Input
              type="number"
              min={1}
              value={duracioEstimada}
              onChange={(e) => setDuracioEstimada(Math.max(1, parseInt(e.target.value) || 1))}
              className="bg-secondary border-border/60 focus:border-primary/60 h-11"
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground/80 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5" />
              Etiquetes
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-primary/20 text-primary border border-primary/30"
                >
                  {tag}
                  <button onClick={() => removeTag(tag)} className="hover:text-destructive transition-colors ml-0.5">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Afegir etiqueta..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag(tagInput))}
                className="bg-secondary border-border/60 focus:border-primary/60 h-9 text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {TAG_SUGGESTIONS.filter((t) => !tags.includes(t)).map((tag) => (
                <button
                  key={tag}
                  onClick={() => addTag(tag)}
                  className="px-2.5 py-1 rounded-lg text-xs text-muted-foreground border border-border/60 hover:border-primary/40 hover:text-primary transition-all"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <Button
            variant="ghost"
            onClick={onClose}
            className="flex-1 border border-border/60 text-muted-foreground hover:text-foreground hover:bg-secondary"
          >
            Cancel·lar
          </Button>
          <Button
            onClick={handleSave}
            disabled={!title.trim() || loading}
            className="flex-1 font-semibold text-white"
            style={{ background: "var(--gradient-primary)" }}
          >
            {loading ? "Desant..." : task ? "Actualitzar" : "Crear tasca"}
          </Button>
        </div>
      </div>
    </div>
  );
}
