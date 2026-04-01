"use client";

import { useCallback, useRef } from "react";
import type { KanbanTaskDto } from "@/lib/kanban-task-dto";
import type { KanbanStatus } from "@/lib/kanban-columns";
import { formatDurationDe } from "@/lib/task-schedule-format";
import { cn } from "@/lib/utils/cn";

const DRAG_THRESHOLD_PX = 5;
const SNAP_MIN = 15;
const MIN_DURATION_MIN = 15;

type TimelineDragState = {
  kind: "move" | "resize";
  pointerId: number;
  startClientY: number;
  startClientX: number;
  origDayIndex: number;
  currentDayIndex: number;
  origStartMin: number;
  origDuration: number;
  storedDuration: number | null;
  didDrag: boolean;
};

function dayIndexFromPoint(clientX: number, clientY: number, fallback: number): number {
  const stack = document.elementsFromPoint(clientX, clientY);
  if (!stack) return fallback;
  for (const el of stack) {
    const col = el.closest("[data-week-day]");
    if (col) {
      const idx = Number.parseInt(col.getAttribute("data-week-day") ?? "", 10);
      if (!Number.isNaN(idx) && idx >= 0 && idx <= 6) return idx;
    }
  }
  return fallback;
}

function snapMinutes(m: number): number {
  return Math.round(m / SNAP_MIN) * SNAP_MIN;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function minutesSinceMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

function localDateAtDayMinutes(day: Date, totalMin: number): Date {
  const h = Math.floor(totalMin / 60);
  const mi = totalMin % 60;
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, mi, 0, 0);
}

function formatHmLocal(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

type StatusMetaFn = (status: KanbanStatus) => { bar: string; dot: string; label: string };
type BgFn = (status: KanbanStatus) => string;

export type SchedulePreviewPatch = {
  taskId: string;
  starts_at: string;
  duration_minutes: number | null;
};

type Props = {
  task: KanbanTaskDto;
  style: React.CSSProperties;
  dayIndex: number;
  weekDays: Date[];
  gridStartMin: number;
  gridEndMin: number;
  weekPxPerHour: number;
  statusMeta: StatusMetaFn;
  weekGridTaskBackground: BgFn;
  onPreview: (patch: SchedulePreviewPatch | null) => void;
  onTap: () => void;
  onCommitSchedule: (
    taskId: string,
    startsAt: Date,
    durationMin: number | null,
  ) => Promise<boolean>;
};

export function WeekTimelineTaskBlock({
  task,
  style,
  dayIndex,
  weekDays,
  gridStartMin,
  gridEndMin,
  weekPxPerHour,
  statusMeta,
  weekGridTaskBackground,
  onPreview,
  onTap,
  onCommitSchedule,
}: Props) {
  const meta = statusMeta(task.status);
  const dragRef = useRef<TimelineDragState | undefined>(undefined);

  const startD = task.starts_at ? new Date(task.starts_at) : null;
  const durForMath =
    task.duration_minutes != null && task.duration_minutes > 0 ? task.duration_minutes : 30;
  const storedDuration =
    task.duration_minutes != null && task.duration_minutes > 0 ? task.duration_minutes : null;

  const applyPreviewMove = useCallback(
    (clientX: number, clientY: number, d: TimelineDragState) => {
      d.currentDayIndex = dayIndexFromPoint(clientX, clientY, d.currentDayIndex);

      const dy = clientY - d.startClientY;
      const deltaMin = snapMinutes((dy / weekPxPerHour) * 60);
      let newMin = d.origStartMin + deltaMin;
      const dur = d.origDuration;
      newMin = clamp(newMin, gridStartMin, gridEndMin - dur);

      const targetDay = weekDays[d.currentDayIndex]!;
      const newStart = localDateAtDayMinutes(targetDay, newMin);

      onPreview({
        taskId: task.id,
        starts_at: newStart.toISOString(),
        duration_minutes: d.storedDuration,
      });
    },
    [gridEndMin, gridStartMin, onPreview, task.id, weekDays, weekPxPerHour],
  );

  const applyPreviewResize = useCallback(
    (clientY: number, d: TimelineDragState) => {
      const dy = clientY - d.startClientY;
      const deltaMin = snapMinutes((dy / weekPxPerHour) * 60);
      let newDur = d.origDuration + deltaMin;
      newDur = Math.max(MIN_DURATION_MIN, newDur);
      newDur = Math.min(newDur, gridEndMin - d.origStartMin);

      const day = weekDays[d.origDayIndex]!;
      const start = localDateAtDayMinutes(day, d.origStartMin);

      onPreview({
        taskId: task.id,
        starts_at: start.toISOString(),
        duration_minutes: newDur,
      });
    },
    [gridEndMin, onPreview, task.id, weekDays, weekPxPerHour],
  );

  const endDrag = useCallback(
    async (clientX: number, clientY: number, cancelled: boolean) => {
      const d = dragRef.current;
      dragRef.current = undefined;
      if (!d || cancelled) {
        onPreview(null);
        return;
      }

      if (!d.didDrag) {
        onPreview(null);
        onTap();
        return;
      }

      let startsAt: Date;
      let durationMin: number | null;

      if (d.kind === "move") {
        const newDayIdx = dayIndexFromPoint(clientX, clientY, d.currentDayIndex);
        const dy = clientY - d.startClientY;
        const deltaMin = snapMinutes((dy / weekPxPerHour) * 60);
        let newMin = d.origStartMin + deltaMin;
        newMin = clamp(newMin, gridStartMin, gridEndMin - d.origDuration);
        const targetDay = weekDays[newDayIdx]!;
        startsAt = localDateAtDayMinutes(targetDay, newMin);
        durationMin = d.storedDuration;
      } else {
        const dy = clientY - d.startClientY;
        const deltaMin = snapMinutes((dy / weekPxPerHour) * 60);
        let newDur = d.origDuration + deltaMin;
        newDur = Math.max(MIN_DURATION_MIN, newDur);
        newDur = Math.min(newDur, gridEndMin - d.origStartMin);
        const day = weekDays[d.origDayIndex]!;
        startsAt = localDateAtDayMinutes(day, d.origStartMin);
        durationMin = newDur;
      }

      await onCommitSchedule(task.id, startsAt, durationMin);
      onPreview(null);
    },
    [
      gridEndMin,
      gridStartMin,
      onCommitSchedule,
      onPreview,
      onTap,
      task.id,
      weekDays,
      weekPxPerHour,
    ],
  );

  if (!startD || !task.starts_at) return null;

  const startAt = new Date(task.starts_at);
  const endD = new Date(startAt.getTime() + durForMath * 60_000);
  const timeLabel = formatHmLocal(startAt);
  const endLabel = formatHmLocal(endD);
  const tip = [
    `${timeLabel}–${endLabel}`,
    task.customer_name ?? undefined,
    storedDuration != null ? formatDurationDe(storedDuration) : undefined,
    meta.label,
  ]
    .filter(Boolean)
    .join(" · ");

  function onMovePointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    e.stopPropagation();
    const origStartMin = minutesSinceMidnight(startAt);
    dragRef.current = {
      kind: "move",
      pointerId: e.pointerId,
      startClientY: e.clientY,
      startClientX: e.clientX,
      origDayIndex: dayIndex,
      currentDayIndex: dayIndex,
      origStartMin,
      origDuration: durForMath,
      storedDuration,
      didDrag: false,
    };

    const onMove = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (!d || ev.pointerId !== d.pointerId) return;
      const ady = Math.abs(ev.clientY - d.startClientY);
      const adx = Math.abs(ev.clientX - d.startClientX);
      if (ady > DRAG_THRESHOLD_PX || adx > DRAG_THRESHOLD_PX) {
        d.didDrag = true;
        applyPreviewMove(ev.clientX, ev.clientY, d);
      }
    };

    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== dragRef.current?.pointerId) return;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      void endDrag(ev.clientX, ev.clientY, false);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  function onResizePointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const origStartMin = minutesSinceMidnight(startAt);
    dragRef.current = {
      kind: "resize",
      pointerId: e.pointerId,
      startClientY: e.clientY,
      startClientX: e.clientX,
      origDayIndex: dayIndex,
      currentDayIndex: dayIndex,
      origStartMin,
      origDuration: durForMath,
      storedDuration,
      didDrag: false,
    };

    const onMove = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (!d || ev.pointerId !== d.pointerId) return;
      if (Math.abs(ev.clientY - d.startClientY) > DRAG_THRESHOLD_PX) {
        d.didDrag = true;
        applyPreviewResize(ev.clientY, d);
      }
    };

    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== dragRef.current?.pointerId) return;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      void endDrag(ev.clientX, ev.clientY, false);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  return (
    <div
      className={cn(
        "absolute box-border flex flex-col overflow-hidden rounded-md border shadow-sm",
        weekGridTaskBackground(task.status),
      )}
      style={style}
      title={tip}
    >
      <div
        role="button"
        tabIndex={0}
        onPointerDown={onMovePointerDown}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onTap();
          }
        }}
        className="flex min-h-0 flex-1 cursor-grab flex-col overflow-hidden px-1 py-0.5 active:cursor-grabbing sm:px-1.5 sm:py-1"
      >
        <span className="truncate text-[0.62rem] font-semibold leading-tight text-foreground sm:text-xs">
          {task.title}
        </span>
        <span className="truncate text-[0.58rem] tabular-nums text-foreground/60 sm:text-[0.62rem]">
          {timeLabel} – {endLabel}
          {task.customer_name ? ` · ${task.customer_name}` : ""}
        </span>
      </div>
      <div
        onPointerDown={onResizePointerDown}
        className="h-2 shrink-0 cursor-ns-resize touch-none border-t border-foreground/10 bg-foreground/5 hover:bg-foreground/10"
        aria-label="Dauer ändern"
      />
    </div>
  );
}
