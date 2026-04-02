"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { updateKanbanTaskSchedule } from "@/app/actions/tasks";
import type { KanbanTaskDto } from "@/lib/kanban-task-dto";
import { formatPotentialEurDe } from "@/lib/format-potential-eur";
import {
  WeekTimelineTaskBlock,
  type SchedulePreviewPatch,
} from "@/components/week-timeline-task-block";
import {
  TaskDetailModal,
  type TaskDetailCustomerOption,
} from "@/components/task-detail-modal";
import {
  addDays,
  getMonthGrid,
  getWeekFromMonday,
  isSameDay,
  startOfWeekMonday,
} from "@/lib/calendar-month-grid";
import { KANBAN_COLUMNS, type KanbanStatus } from "@/lib/kanban-columns";
import {
  formatDurationDe,
  utcIsoToLocalDate,
  utcIsoToLocalTime,
} from "@/lib/task-schedule-format";
import { getBayernHolidayMapBetween } from "@/lib/bayern-holidays";
import { cn } from "@/lib/utils/cn";

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] as const;

type ViewMode = "month" | "week";

function statusMeta(status: KanbanStatus): { bar: string; dot: string; label: string } {
  switch (status) {
    case "open":
      return {
        bar: "border-l-amber-500",
        dot: "bg-amber-400",
        label: KANBAN_COLUMNS.find((c) => c.id === "open")!.title,
      };
    case "in_progress":
      return {
        bar: "border-l-sky-500",
        dot: "bg-sky-400",
        label: KANBAN_COLUMNS.find((c) => c.id === "in_progress")!.title,
      };
    case "paused":
      return {
        bar: "border-l-violet-500",
        dot: "bg-violet-400",
        label: KANBAN_COLUMNS.find((c) => c.id === "paused")!.title,
      };
    case "done":
      return {
        bar: "border-l-emerald-500",
        dot: "bg-emerald-400",
        label: KANBAN_COLUMNS.find((c) => c.id === "done")!.title,
      };
    default:
      return { bar: "border-l-foreground/35", dot: "bg-foreground/40", label: status };
  }
}

function groupByLocalDay(tasks: KanbanTaskDto[]): Map<string, KanbanTaskDto[]> {
  const map = new Map<string, KanbanTaskDto[]>();
  for (const t of tasks) {
    if (!t.starts_at) continue;
    const key = utcIsoToLocalDate(t.starts_at);
    if (!key) continue;
    const list = map.get(key) ?? [];
    list.push(t);
    map.set(key, list);
  }
  for (const [, list] of map) {
    list.sort((a, b) => new Date(a.starts_at!).getTime() - new Date(b.starts_at!).getTime());
  }
  return map;
}

function ymdKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatWeekRangeTitle(monday: Date, sunday: Date): string {
  const short: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  const withYear: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
  };
  const sameYear = monday.getFullYear() === sunday.getFullYear();
  const startFmt = new Intl.DateTimeFormat(
    "de-DE",
    sameYear ? short : withYear,
  ).format(monday);
  const endFmt = new Intl.DateTimeFormat("de-DE", withYear).format(sunday);
  return `${startFmt} – ${endFmt}`;
}

/** Kompakter Monats-Titel für Mobile (eine Zeile), wenn die Woche im selben Monat liegt. */
function formatWeekMonthYearTitleMobile(monday: Date, sunday: Date): string {
  const sameMonth =
    monday.getMonth() === sunday.getMonth() && monday.getFullYear() === sunday.getFullYear();
  if (sameMonth) {
    return new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" }).format(monday);
  }
  return formatWeekRangeTitle(monday, sunday);
}

const MONTH_DRAG_THRESHOLD_PX = 6;

function dayKeyFromPoint(clientX: number, clientY: number): string | null {
  const stack = document.elementsFromPoint(clientX, clientY);
  if (!stack) return null;
  for (const el of stack) {
    const cell = el.closest("[data-month-day]");
    if (cell) {
      const k = cell.getAttribute("data-month-day");
      if (k) return k;
    }
  }
  return null;
}

/** Gleiche lokale Uhrzeit wie bisher, aber am Zieltag (yyyy-mm-dd). */
function localDateOnYmdKeepingTime(isoStart: string, targetYmd: string): Date | null {
  const orig = new Date(isoStart);
  const parts = targetYmd.split("-");
  if (parts.length !== 3) return null;
  const y = Number(parts[0]);
  const mo = Number(parts[1]);
  const d = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  return new Date(y, mo - 1, d, orig.getHours(), orig.getMinutes(), 0, 0);
}

type MonthTaskDragState = {
  pointerId: number;
  startX: number;
  startY: number;
  taskId: string;
  sourceDayKey: string;
  /** Unveränderliche Start-Zeit während des Zugs (Vorschau bleibt stabil). */
  originStartsAtIso: string;
  storedDuration: number | null;
  didDrag: boolean;
  tapTask: KanbanTaskDto;
};

function MonthDayTaskRow({
  task,
  sourceDayKey,
  onSelect,
  onRowPointerDown,
}: {
  task: KanbanTaskDto;
  sourceDayKey: string;
  onSelect: (t: KanbanTaskDto) => void;
  onRowPointerDown: (e: React.PointerEvent, task: KanbanTaskDto, sourceDayKey: string) => void;
}) {
  const meta = statusMeta(task.status);
  const time = task.starts_at ? utcIsoToLocalTime(task.starts_at) : "";
  const amountDe = formatPotentialEurDe(task.potential_amount_eur);
  const tip = [
    time,
    task.customer_name ?? undefined,
    task.duration_minutes != null && task.duration_minutes > 0
      ? formatDurationDe(task.duration_minutes)
      : undefined,
    amountDe ?? undefined,
    meta.label,
    "Ziehen zum Verschieben auf einen anderen Tag",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      role="button"
      tabIndex={0}
      title={tip}
      onPointerDown={(e) => onRowPointerDown(e, task, sourceDayKey)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(task);
        }
      }}
      className={cn(
        "w-full cursor-grab truncate rounded-lg border border-foreground/8 border-l-[3px] bg-foreground/[0.04] px-1.5 py-1 text-left text-[0.65rem] font-medium leading-tight text-foreground/90 transition-colors hover:bg-foreground/10 active:cursor-grabbing sm:text-xs",
        meta.bar,
      )}
    >
      <span className="tabular-nums text-foreground/50">{time}</span>{" "}
      <span className="text-foreground/90">{task.title}</span>
      {amountDe ? (
        <span className="text-foreground/45"> · {amountDe}</span>
      ) : null}
    </div>
  );
}

/** Google-Kalender-ähnliches Raster: erste sichtbare Stunde (inkl.) … letzte (exkl.) */
const WEEK_GRID_FIRST_HOUR = 6;
const WEEK_GRID_LAST_HOUR = 22;
const WEEK_PX_PER_HOUR = 52;

function minutesSinceMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

type DayLayoutItem = {
  task: KanbanTaskDto;
  s: number;
  ein: number;
  lane: number;
  colSpan: number;
};

function layoutDayColumnForWeek(items: Omit<DayLayoutItem, "lane" | "colSpan">[]): DayLayoutItem[] {
  const sorted = [...items].sort((a, b) => a.s - b.s || a.ein - b.ein);
  const laneEnd: number[] = [];
  const withLane: DayLayoutItem[] = sorted.map((it) => {
    let L = 0;
    while (L < laneEnd.length && laneEnd[L]! > it.s) L++;
    if (L === laneEnd.length) laneEnd.push(it.ein);
    else laneEnd[L] = it.ein;
    return { ...it, lane: L, colSpan: 1 };
  });
  return withLane.map((it) => {
    const overlapping = withLane.filter((o) => o.s < it.ein && o.ein > it.s);
    const colSpan = Math.max(...overlapping.map((o) => o.lane + 1), 1);
    return { ...it, colSpan };
  });
}

function weekGridTaskBackground(status: KanbanStatus): string {
  switch (status) {
    case "open":
      return "bg-amber-500/25 border-amber-600/35 hover:bg-amber-500/35 dark:bg-amber-500/20";
    case "in_progress":
      return "bg-sky-500/25 border-sky-600/35 hover:bg-sky-500/35 dark:bg-sky-500/20";
    case "paused":
      return "bg-violet-500/25 border-violet-600/35 hover:bg-violet-500/35 dark:bg-violet-500/20";
    case "done":
      return "bg-emerald-500/25 border-emerald-600/35 hover:bg-emerald-500/35 dark:bg-emerald-500/20";
    default:
      return "bg-foreground/10 border-foreground/20 hover:bg-foreground/15";
  }
}

function formatHourLabelDe(hour: number): string {
  const d = new Date(2000, 0, 1, hour, 0, 0);
  return new Intl.DateTimeFormat("de-DE", { hour: "numeric", minute: "2-digit" }).format(d);
}

function GoogleStyleWeekBody({
  weekDays,
  byDay,
  holidayByYmd,
  clock,
  onSelectTask,
  onSchedulePreview,
  onCommitSchedule,
}: {
  weekDays: Date[];
  byDay: Map<string, KanbanTaskDto[]>;
  holidayByYmd: Map<string, string>;
  clock: Date;
  onSelectTask: (t: KanbanTaskDto) => void;
  onSchedulePreview: (patch: SchedulePreviewPatch | null) => void;
  onCommitSchedule: (
    taskId: string,
    startsAt: Date,
    durationMin: number | null,
  ) => Promise<boolean>;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const gridStartMin = WEEK_GRID_FIRST_HOUR * 60;
  const gridEndMin = WEEK_GRID_LAST_HOUR * 60;
  const gridHeightPx = (WEEK_GRID_LAST_HOUR - WEEK_GRID_FIRST_HOUR) * WEEK_PX_PER_HOUR;
  const hours = useMemo(
    () =>
      Array.from(
        { length: WEEK_GRID_LAST_HOUR - WEEK_GRID_FIRST_HOUR },
        (_, i) => WEEK_GRID_FIRST_HOUR + i,
      ),
    [],
  );

  const clockDayKey = ymdKey(clock);
  const todayColumnIndex = useMemo(
    () => weekDays.findIndex((d) => ymdKey(d) === clockDayKey),
    [weekDays, clockDayKey],
  );
  const weekKey = useMemo(() => weekDays.map(ymdKey).join("|"), [weekDays]);

  const centerTodayColumnMobile = useCallback(() => {
    if (todayColumnIndex < 0) return;
    if (!window.matchMedia("(max-width: 767px)").matches) return;
    const sc = scrollRef.current;
    if (!sc) return;
    const dayEl = sc.querySelector(
      `[data-week-day-header="${todayColumnIndex}"]`,
    ) as HTMLElement | null;
    if (!dayEl) return;
    const dayRect = dayEl.getBoundingClientRect();
    const scRect = sc.getBoundingClientRect();
    const dayLeftInScroller = dayRect.left - scRect.left + sc.scrollLeft;
    const target = dayLeftInScroller + dayRect.width / 2 - sc.clientWidth / 2;
    const maxScroll = Math.max(0, sc.scrollWidth - sc.clientWidth);
    sc.scrollLeft = Math.max(0, Math.min(target, maxScroll));
  }, [todayColumnIndex]);

  useLayoutEffect(() => {
    if (todayColumnIndex < 0) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(centerTodayColumnMobile);
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [weekKey, todayColumnIndex, centerTodayColumnMobile]);

  useEffect(() => {
    if (todayColumnIndex < 0) return;
    const mq = window.matchMedia("(max-width: 767px)");
    const onResizeOrBreakpoint = () => centerTodayColumnMobile();
    window.addEventListener("resize", onResizeOrBreakpoint);
    mq.addEventListener("change", onResizeOrBreakpoint);
    return () => {
      window.removeEventListener("resize", onResizeOrBreakpoint);
      mq.removeEventListener("change", onResizeOrBreakpoint);
    };
  }, [weekKey, todayColumnIndex, centerTodayColumnMobile]);

  return (
    <div
      ref={scrollRef}
      className="max-h-[min(78vh,52rem)] max-md:max-h-[min(82vh,56rem)] overflow-auto rounded-xl border border-foreground/10 bg-background max-md:rounded-lg"
    >
      <div className="min-w-[min(100%,720px)] max-md:min-w-[52rem]">
        <div className="sticky top-0 z-30 flex border-b border-foreground/10 bg-background">
          <div className="sticky left-0 z-40 w-11 shrink-0 border-r border-foreground/10 bg-background max-md:w-9 sm:w-14" />
          {weekDays.map((date, idx) => {
            const today = isSameDay(date, clock);
            const ymd = ymdKey(date);
            const holidayName = holidayByYmd.get(ymd);
            return (
              <div
                key={ymd}
                data-week-day={idx}
                data-week-day-header={idx}
                title={holidayName ?? undefined}
                className={cn(
                  "relative min-w-0 flex-1 border-l py-1 text-center max-md:py-1 sm:py-2.5",
                  holidayName
                    ? "border-amber-500/25 bg-gradient-to-b from-amber-500/[0.12] via-amber-500/[0.04] to-transparent dark:from-amber-500/15 dark:via-amber-500/5"
                    : "border-foreground/10",
                )}
              >
                {holidayName ? (
                  <span
                    className="pointer-events-none absolute right-0.5 top-0.5 text-[0.45rem] leading-none text-amber-600/80 dark:text-amber-400/90"
                    aria-hidden
                  >
                    ◆
                  </span>
                ) : null}
                <p
                  className={cn(
                    "text-[0.6rem] font-semibold uppercase tracking-wide max-md:text-[0.55rem]",
                    today ? "text-teal-600 dark:text-teal-400" : "text-foreground/45",
                  )}
                >
                  {WEEKDAYS[idx]}
                </p>
                <div className="mt-0.5 flex justify-center max-md:mt-0">
                  <span
                    className={cn(
                      "inline-flex min-h-[1.375rem] min-w-[1.375rem] items-center justify-center text-base font-semibold tabular-nums max-md:min-h-[1.5rem] max-md:min-w-[1.5rem] max-md:text-sm sm:min-h-0 sm:min-w-0 sm:text-xl md:text-2xl",
                      today
                        ? "rounded-full bg-teal-500 px-0 text-white shadow-sm dark:bg-teal-600 max-md:px-1.5 sm:rounded-none sm:bg-transparent sm:px-0 sm:text-teal-600 sm:shadow-none sm:dark:bg-transparent sm:dark:text-teal-400"
                        : "text-foreground",
                    )}
                  >
                    {date.getDate()}
                  </span>
                </div>
                {holidayName ? (
                  <p className="mx-auto mt-0.5 max-w-[5.5rem] px-0.5 text-[0.5rem] font-medium leading-tight text-amber-800 dark:text-amber-200/95 max-md:max-w-[6.5rem] max-md:text-[0.48rem] sm:text-[0.52rem]">
                    {holidayName}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="flex">
          <div className="sticky left-0 z-20 w-11 shrink-0 border-r border-foreground/10 bg-background max-md:w-9 sm:w-14">
            {hours.map((h) => (
              <div
                key={h}
                className="box-border border-b border-foreground/10 pr-0.5 text-right max-md:pr-0"
                style={{ height: WEEK_PX_PER_HOUR }}
              >
                <span className="relative -top-2 inline-block text-[0.55rem] tabular-nums leading-none text-foreground/45 max-md:-top-1.5 sm:text-[0.68rem]">
                  {formatHourLabelDe(h)}
                </span>
              </div>
            ))}
          </div>

          <div className="flex min-w-0 flex-1">
            {weekDays.map((date, dayIdx) => {
              const key = ymdKey(date);
              const dayTasks = byDay.get(key) ?? [];
              const today = isSameDay(date, clock);
              const holidayHere = holidayByYmd.get(key);

              const raw: Omit<DayLayoutItem, "lane" | "colSpan">[] = [];
              for (const task of dayTasks) {
                if (!task.starts_at) continue;
                const d = new Date(task.starts_at);
                const startMin = minutesSinceMidnight(d);
                const dur =
                  task.duration_minutes != null && task.duration_minutes > 0
                    ? task.duration_minutes
                    : 30;
                const endMin = startMin + dur;
                const s = Math.max(startMin, gridStartMin);
                const ein = Math.min(endMin, gridEndMin);
                if (ein <= s) continue;
                raw.push({ task, s, ein });
              }

              const laidOut = layoutDayColumnForWeek(raw);
              const nowMin = minutesSinceMidnight(clock);
              const showNowLine = today && nowMin >= gridStartMin && nowMin <= gridEndMin;
              const nowTopPx = ((nowMin - gridStartMin) / 60) * WEEK_PX_PER_HOUR;

              return (
                <div
                  key={key}
                  data-week-day={dayIdx}
                  className={cn(
                    "relative min-w-[5.5rem] max-md:min-w-[7rem] flex-1 border-l bg-background",
                    holidayHere
                      ? "border-amber-500/15 bg-[linear-gradient(180deg,rgba(245,158,11,0.07)_0%,transparent_22%,transparent_100%),linear-gradient(180deg,rgba(20,184,166,0.04)_0%,transparent_35%)] dark:border-amber-400/20"
                      : "border-foreground/10",
                  )}
                  style={{ height: gridHeightPx }}
                >
                  {hours.map((_, i) => (
                    <div
                      key={i}
                      className="pointer-events-none absolute left-0 right-0 border-t border-foreground/10"
                      style={{ top: i * WEEK_PX_PER_HOUR }}
                    />
                  ))}

                  {showNowLine ? (
                    <div
                      className="pointer-events-none absolute left-0 right-0 z-10"
                      style={{ top: nowTopPx }}
                      aria-hidden
                    >
                      <div className="flex items-center">
                        <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
                        <div className="h-0.5 min-w-0 flex-1 bg-red-500" />
                      </div>
                    </div>
                  ) : null}

                  {laidOut.map((it) => {
                    const topPx = ((it.s - gridStartMin) / 60) * WEEK_PX_PER_HOUR;
                    const heightPx = Math.max(((it.ein - it.s) / 60) * WEEK_PX_PER_HOUR, 32);
                    const leftPct = (it.lane / it.colSpan) * 100;
                    const widthPct = 100 / it.colSpan;

                    return (
                      <WeekTimelineTaskBlock
                        key={it.task.id}
                        task={it.task}
                        dayIndex={dayIdx}
                        weekDays={weekDays}
                        gridStartMin={gridStartMin}
                        gridEndMin={gridEndMin}
                        weekPxPerHour={WEEK_PX_PER_HOUR}
                        statusMeta={statusMeta}
                        weekGridTaskBackground={weekGridTaskBackground}
                        onPreview={onSchedulePreview}
                        onTap={() => onSelectTask(it.task)}
                        onCommitSchedule={onCommitSchedule}
                        style={{
                          top: topPx,
                          height: heightPx,
                          left: `calc(${leftPct}% + 1px)`,
                          width: `calc(${widthPct}% - 2px)`,
                        }}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusLegend({ unplannedCount }: { unplannedCount: number }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-foreground/10 px-0 pt-3 text-[0.65rem] text-foreground/50 max-md:mt-3 max-md:gap-1.5 max-md:pt-2 sm:mt-6 sm:gap-3 sm:px-1 sm:pt-5 sm:text-xs">
      <span className="font-medium text-foreground/60">Status:</span>
      {(["open", "in_progress", "paused", "done"] as const).map((s) => {
        const m = statusMeta(s);
        return (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className={cn("h-2 w-2 rounded-full", m.dot)} />
            {m.label}
          </span>
        );
      })}
      {unplannedCount > 0 ? (
        <span className="ml-auto text-foreground/40">
          {unplannedCount} ohne Termin (nur im Board)
        </span>
      ) : null}
    </div>
  );
}

type Props = {
  tasks: KanbanTaskDto[];
  customers: TaskDetailCustomerOption[];
};

export function TaskCalendar({ tasks: initialTasks, customers }: Props) {
  const [clock, setClock] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [weekStartMonday, setWeekStartMonday] = useState(() => startOfWeekMonday(new Date()));
  const [tasks, setTasks] = useState(initialTasks);
  const [detailTask, setDetailTask] = useState<KanbanTaskDto | null>(null);
  const [schedulePreview, setSchedulePreview] = useState<SchedulePreviewPatch | null>(null);

  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  useEffect(() => {
    setSchedulePreview(null);
  }, [weekStartMonday, viewMode, year, month]);

  useEffect(() => {
    const id = window.setInterval(() => setClock(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const scheduled = useMemo(() => tasks.filter((t) => t.starts_at), [tasks]);
  const scheduledWithPreview = useMemo(() => {
    if (!schedulePreview) return scheduled;
    return scheduled.map((t) =>
      t.id === schedulePreview.taskId
        ? {
            ...t,
            starts_at: schedulePreview.starts_at,
            duration_minutes: schedulePreview.duration_minutes,
          }
        : t,
    );
  }, [scheduled, schedulePreview]);
  const byDayDisplayed = useMemo(
    () => groupByLocalDay(scheduledWithPreview),
    [scheduledWithPreview],
  );
  const unplannedCount = tasks.length - scheduled.length;

  const commitWeekSchedule = useCallback(
    async (taskId: string, startsAt: Date, durationMin: number | null) => {
      const rawDur = durationMin == null ? "" : String(durationMin);
      const res = await updateKanbanTaskSchedule(taskId, startsAt.toISOString(), rawDur);
      if (!res.ok) return false;
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, starts_at: startsAt.toISOString(), duration_minutes: durationMin }
            : t,
        ),
      );
      return true;
    },
    [],
  );

  const monthDragRef = useRef<MonthTaskDragState | undefined>(undefined);

  const handleMonthRowPointerDown = useCallback(
    (e: React.PointerEvent, task: KanbanTaskDto, sourceDayKey: string) => {
      if (e.button !== 0 || !task.starts_at) return;
      e.preventDefault();
      e.stopPropagation();
      const storedDuration =
        task.duration_minutes != null && task.duration_minutes > 0 ? task.duration_minutes : null;
      monthDragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        taskId: task.id,
        sourceDayKey,
        originStartsAtIso: task.starts_at,
        storedDuration,
        didDrag: false,
        tapTask: task,
      };

      const onMove = (ev: PointerEvent) => {
        const d = monthDragRef.current;
        if (!d || ev.pointerId !== d.pointerId) return;
        const adx = Math.abs(ev.clientX - d.startX);
        const ady = Math.abs(ev.clientY - d.startY);
        if (adx > MONTH_DRAG_THRESHOLD_PX || ady > MONTH_DRAG_THRESHOLD_PX) {
          d.didDrag = true;
          const targetKey = dayKeyFromPoint(ev.clientX, ev.clientY);
          if (!targetKey) {
            setSchedulePreview(null);
            return;
          }
          const next = localDateOnYmdKeepingTime(d.originStartsAtIso, targetKey);
          if (!next) {
            setSchedulePreview(null);
            return;
          }
          setSchedulePreview({
            taskId: d.taskId,
            starts_at: next.toISOString(),
            duration_minutes: d.storedDuration,
          });
        }
      };

      const onUp = async (ev: PointerEvent) => {
        if (ev.pointerId !== monthDragRef.current?.pointerId) return;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        const d = monthDragRef.current;
        monthDragRef.current = undefined;
        if (!d) return;
        if (!d.didDrag) {
          setSchedulePreview(null);
          setDetailTask(d.tapTask);
          return;
        }
        const targetKey = dayKeyFromPoint(ev.clientX, ev.clientY);
        if (!targetKey || targetKey === d.sourceDayKey) {
          setSchedulePreview(null);
          return;
        }
        const next = localDateOnYmdKeepingTime(d.originStartsAtIso, targetKey);
        if (!next) {
          setSchedulePreview(null);
          return;
        }
        await commitWeekSchedule(d.taskId, next, d.storedDuration);
        setSchedulePreview(null);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [commitWeekSchedule, setDetailTask, setSchedulePreview],
  );

  const grid = useMemo(() => getMonthGrid(year, month), [year, month]);
  const weekDays = useMemo(() => getWeekFromMonday(weekStartMonday), [weekStartMonday]);
  const weekSunday = weekDays[6]!;

  const holidayByYmd = useMemo(() => {
    if (viewMode === "month") {
      if (!grid.length) return new Map<string, string>();
      let minT = grid[0]!.date.getTime();
      let maxT = minT;
      for (const { date } of grid) {
        const t = date.getTime();
        if (t < minT) minT = t;
        if (t > maxT) maxT = t;
      }
      return getBayernHolidayMapBetween(new Date(minT), new Date(maxT));
    }
    return getBayernHolidayMapBetween(weekDays[0]!, weekDays[6]!);
  }, [viewMode, grid, weekDays]);

  const monthTitle = new Intl.DateTimeFormat("de-DE", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month, 1));

  const primaryTitle =
    viewMode === "month" ? monthTitle : formatWeekRangeTitle(weekStartMonday, weekSunday);
  const weekTitleMobile = formatWeekMonthYearTitleMobile(weekStartMonday, weekSunday);

  function goPrevMonth() {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  }

  function goNextMonth() {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  }

  function goPrevWeek() {
    setWeekStartMonday((prev) => addDays(prev, -7));
  }

  function goNextWeek() {
    setWeekStartMonday((prev) => addDays(prev, 7));
  }

  function goToday() {
    const t = new Date();
    setYear(t.getFullYear());
    setMonth(t.getMonth());
    setWeekStartMonday(startOfWeekMonday(t));
  }

  /** Wochen-Tab: immer die **aktuelle** Woche zeigen (nicht die Woche um den 15. des Monats). */
  function switchToWeekView() {
    if (viewMode === "month") {
      const t = new Date();
      setWeekStartMonday(startOfWeekMonday(t));
      setYear(t.getFullYear());
      setMonth(t.getMonth());
    }
    setViewMode("week");
  }

  function openMonthView() {
    if (viewMode === "week") {
      const midWeek = addDays(weekStartMonday, 3);
      setYear(midWeek.getFullYear());
      setMonth(midWeek.getMonth());
    }
    setViewMode("month");
  }

  return (
    <div className="relative">
      <div
        className="pointer-events-none absolute -left-24 top-1/3 h-96 w-96 rounded-full bg-teal-400/15 blur-3xl dark:bg-teal-500/10"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-cyan-400/12 blur-3xl dark:bg-cyan-500/10"
        aria-hidden
      />

      <div className="relative overflow-hidden rounded-2xl bg-background/80 backdrop-blur-xl max-md:rounded-xl dark:bg-background/55 md:rounded-[1.75rem]">
        <header
          className={cn(
            "relative flex flex-col gap-4 border-b border-foreground/10 px-3 py-3 sm:gap-5 sm:px-5 sm:py-5 md:flex-row md:items-center md:justify-between md:px-7 md:py-6",
            "max-md:gap-2 max-md:py-2",
          )}
        >
          <div className="min-w-0 flex-1">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-teal-600 max-md:hidden dark:text-teal-400">
              Übersicht
            </p>
            <h1
              className={cn(
                "font-semibold tracking-tight text-foreground max-md:mt-0 max-md:text-lg max-md:leading-snug md:mt-1 md:text-2xl lg:text-3xl",
                "max-md:line-clamp-2",
              )}
            >
              {viewMode === "week" ? (
                <>
                  <span className="md:hidden">{weekTitleMobile}</span>
                  <span className="hidden md:inline">{primaryTitle}</span>
                </>
              ) : (
                monthTitle
              )}
            </h1>
            <p className="mt-1 max-w-md text-sm text-foreground/50 max-md:hidden">
              {scheduled.length} Termin{scheduled.length === 1 ? "" : "e"} ·{" "}
              <Link href="/board" className="text-teal-600 underline-offset-2 hover:underline dark:text-teal-400">
                Zum Board
              </Link>
            </p>
          </div>

          <div
            className={cn(
              "flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-3",
              "max-md:flex-row max-md:flex-wrap max-md:items-center max-md:justify-end max-md:gap-2",
            )}
          >
            <div
              className={cn(
                "flex rounded-xl border border-foreground/12 bg-foreground/[0.03] p-1",
                "max-md:order-2 max-md:flex-1",
              )}
              role="tablist"
              aria-label="Kalenderansicht"
            >
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === "week"}
                onClick={switchToWeekView}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-medium transition-colors max-md:px-2.5 max-md:py-1.5 max-md:text-xs",
                  viewMode === "week"
                    ? "bg-teal-500/15 text-teal-800 dark:text-teal-200"
                    : "text-foreground/60 hover:text-foreground",
                )}
              >
                Woche
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === "month"}
                onClick={openMonthView}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-medium transition-colors max-md:px-2.5 max-md:py-1.5 max-md:text-xs",
                  viewMode === "month"
                    ? "bg-teal-500/15 text-teal-800 dark:text-teal-200"
                    : "text-foreground/60 hover:text-foreground",
                )}
              >
                Monat
              </button>
            </div>

            <div
              className={cn(
                "flex flex-wrap items-center gap-2",
                "max-md:order-1 max-md:flex-1 max-md:justify-start",
              )}
            >
              <button
                type="button"
                onClick={viewMode === "month" ? goPrevMonth : goPrevWeek}
                className="rounded-xl border border-foreground/15 bg-background px-3 py-2 text-sm font-medium text-foreground/80 hover:border-foreground/25 hover:bg-foreground/5 max-md:px-2.5 max-md:py-1.5"
                aria-label={viewMode === "month" ? "Vorheriger Monat" : "Vorherige Woche"}
              >
                ←
              </button>
              <button
                type="button"
                onClick={goToday}
                className="rounded-xl border border-teal-500/40 bg-teal-500/10 px-4 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-500/15 max-md:px-2.5 max-md:py-1.5 max-md:text-xs dark:text-teal-200"
              >
                Heute
              </button>
              <button
                type="button"
                onClick={viewMode === "month" ? goNextMonth : goNextWeek}
                className="rounded-xl border border-foreground/15 bg-background px-3 py-2 text-sm font-medium text-foreground/80 hover:border-foreground/25 hover:bg-foreground/5 max-md:px-2.5 max-md:py-1.5"
                aria-label={viewMode === "month" ? "Nächster Monat" : "Nächste Woche"}
              >
                →
              </button>
            </div>
          </div>
        </header>

        {viewMode === "month" ? (
          <div className="relative px-2 pb-4 pt-3 sm:px-5 sm:pb-7 sm:pt-4" key={`m-${year}-${month}`}>
            <div className="mb-2 grid grid-cols-7 gap-1 text-center sm:gap-2">
              {WEEKDAYS.map((d) => (
                <div
                  key={d}
                  className="py-2 text-[0.65rem] font-semibold uppercase tracking-wider text-foreground/40"
                >
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {grid.map(({ date, inCurrentMonth }, i) => {
                const key = ymdKey(date);
                const dayTasks = byDayDisplayed.get(key) ?? [];
                const today = isSameDay(date, clock);
                const holidayName = holidayByYmd.get(key);

                return (
                  <div
                    key={`${key}-${i}`}
                    data-month-day={key}
                    title={holidayName ?? undefined}
                    className={cn(
                      "relative flex min-h-[5.5rem] flex-col rounded-2xl border p-1.5 transition-colors sm:min-h-[7.5rem] sm:p-2",
                      inCurrentMonth
                        ? "border-foreground/10 bg-background/70 dark:bg-background/40"
                        : "border-transparent bg-foreground/[0.02] opacity-50 dark:bg-foreground/[0.04]",
                      today && "ring-2 ring-teal-500/60 ring-offset-2 ring-offset-background dark:ring-teal-400/50",
                      holidayName &&
                        inCurrentMonth &&
                        "border-amber-500/30 bg-[linear-gradient(145deg,rgba(245,158,11,0.12)_0%,transparent_42%,rgba(20,184,166,0.08)_100%)] shadow-[inset_0_1px_0_0_rgba(245,158,11,0.15)] dark:border-amber-400/25 dark:shadow-[inset_0_1px_0_0_rgba(251,191,36,0.12)]",
                      holidayName &&
                        !inCurrentMonth &&
                        "border-amber-500/15 bg-amber-500/[0.06] dark:border-amber-400/10",
                    )}
                  >
                    <div className="flex items-start justify-between gap-1 px-0.5 pt-0.5">
                      <span
                        className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold sm:h-8 sm:w-8 sm:text-sm",
                          today
                            ? "bg-teal-500 text-white dark:bg-teal-600"
                            : inCurrentMonth
                              ? "text-foreground/85"
                              : "text-foreground/35",
                        )}
                      >
                        {date.getDate()}
                      </span>
                      {dayTasks.length > 0 ? (
                        <span className="text-[0.6rem] font-medium tabular-nums text-foreground/35 sm:text-[0.65rem]">
                          {dayTasks.length}
                        </span>
                      ) : null}
                    </div>
                    {holidayName ? (
                      <p className="mt-0.5 line-clamp-2 px-0.5 text-[0.58rem] font-semibold leading-snug text-amber-900 dark:text-amber-100/95">
                        {holidayName}
                      </p>
                    ) : null}

                    <ul className="mt-1 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
                      {dayTasks.slice(0, 3).map((t) => (
                        <li key={t.id}>
                          <MonthDayTaskRow
                            task={t}
                            sourceDayKey={key}
                            onSelect={setDetailTask}
                            onRowPointerDown={handleMonthRowPointerDown}
                          />
                        </li>
                      ))}
                    </ul>
                    {dayTasks.length > 3 ? (
                      <p className="mt-auto px-0.5 pb-0.5 text-[0.6rem] text-foreground/45">
                        +{dayTasks.length - 3}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <StatusLegend unplannedCount={unplannedCount} />
          </div>
        ) : (
          <div
            className="relative px-1 pb-4 pt-2 sm:px-4 sm:pb-7 sm:pt-4"
            key={`w-${ymdKey(weekStartMonday)}`}
          >
            <GoogleStyleWeekBody
              weekDays={weekDays}
              byDay={byDayDisplayed}
              holidayByYmd={holidayByYmd}
              clock={clock}
              onSelectTask={setDetailTask}
              onSchedulePreview={setSchedulePreview}
              onCommitSchedule={commitWeekSchedule}
            />
            <StatusLegend unplannedCount={unplannedCount} />
          </div>
        )}
      </div>

      <TaskDetailModal
        task={detailTask}
        customers={customers}
        open={detailTask !== null}
        onClose={() => setDetailTask(null)}
        onSaved={(taskId, patch) => {
          setTasks((prev) => prev.map((item) => (item.id === taskId ? { ...item, ...patch } : item)));
          setDetailTask((prev) => (prev?.id === taskId ? { ...prev, ...patch } : prev));
        }}
        onDeleted={(taskId) => {
          setTasks((prev) => prev.filter((t) => t.id !== taskId));
          setDetailTask((prev) => (prev?.id === taskId ? null : prev));
          setSchedulePreview((p) => (p?.taskId === taskId ? null : p));
        }}
      />
    </div>
  );
}
