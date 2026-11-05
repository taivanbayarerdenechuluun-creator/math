import { Brain, BookOpen, Calendar, Compass, Flame, MemoryStick, Scale, Shapes, Sparkles, Target, Zap, type LucideProps } from "lucide-react";
import { ACHIEVEMENTS } from "@/lib/gamification";

const ICONS = { sparkles: Sparkles, target: Target, brain: Brain, shapes: Shapes, memory: MemoryStick, zap: Zap, scale: Scale, flame: Flame, compass: Compass, calendar: Calendar, book: BookOpen };

export function AchIcon({ code, ...p }: { code: string } & LucideProps) {
  const Icon = ICONS[ACHIEVEMENTS.find((a) => a.code === code)?.icon ?? "sparkles"];
  return <Icon {...p} />;
}

export function Badge({ code, locked = false, size = 56 }: { code: string; locked?: boolean; size?: number }) {
  return (
    <div
      className={`grid place-items-center rounded-full ${locked ? "bg-line text-muted" : "bg-gradient-to-br from-violet to-cyan text-white shadow-[var(--glow)]"}`}
      style={{ width: size, height: size }}
    >
      <AchIcon code={code} size={size * 0.46} aria-hidden="true" />
    </div>
  );
}
