"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PlanCard } from "@/components/PlanCard";
import { ActiveFilterChips, FilterPanel, FilterSelect, FiltersButton, Pill, PillRow, activeFilterList } from "@/components/FilterControls";
import type { TrainingPlan, PlanType } from "@/types/database";
import { PLAN_TYPE_LABELS, PLAN_TYPE_COLORS, PLAN_TYPE_TEXT_COLORS, DIFFICULTY_LABELS } from "@/lib/paceUtils";
import type { DifficultyType } from "@/types/database";

const FILTER_TABS: { value: PlanType | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "marathon", label: PLAN_TYPE_LABELS.marathon },
  { value: "half_marathon", label: PLAN_TYPE_LABELS.half_marathon },
  { value: "5k_10k", label: PLAN_TYPE_LABELS["5k_10k"] },
  { value: "base_building", label: PLAN_TYPE_LABELS.base_building },
  { value: "strength", label: PLAN_TYPE_LABELS.strength },
  { value: "custom", label: PLAN_TYPE_LABELS.custom },
];

// Order shown on the category landing page.
const CATEGORY_TYPES: PlanType[] = ["marathon", "half_marathon", "5k_10k", "base_building", "strength", "custom"];

export default function PlansPage() {
  const [plans, setPlans] = useState<TrainingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<PlanType | "all">("all");
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyType | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  // null = on the category-picker landing page; set once a category (or "all") is chosen.
  const [category, setCategory] = useState<PlanType | "all" | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [{ data }, { data: { user } }] = await Promise.all([
        supabase.from("training_plans").select("*").is("source_plan_id", null).order("created_at", { ascending: false }),
        supabase.auth.getUser(),
      ]);
      setPlans(data ?? []);
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
        setIsAdmin(profile?.role === "admin");
      }
      setLoading(false);
    }
    load();
  }, []);

  function enterCategory(type: PlanType | "all") {
    setActiveFilter(type);
    setDifficultyFilter("all");
    setSourceFilter("all");
    setCategory(type);
  }

  function backToCategories() {
    setCategory(null);
    setActiveFilter("all");
    setDifficultyFilter("all");
    setSourceFilter("all");
  }

  const filtered = plans.filter((p) => {
    if (activeFilter !== "all" && p.type !== activeFilter) return false;
    if (difficultyFilter !== "all" && p.difficulty !== difficultyFilter) return false;
    if (sourceFilter !== "all") {
      if (sourceFilter === "__none__") return !p.source;
      if (p.source !== sourceFilter) return false;
    }
    return true;
  });

  const typesInUse = new Set(plans.map((p) => p.type));
  const visibleTabs = FILTER_TABS.filter(
    (t) => t.value === "all" || typesInUse.has(t.value as PlanType)
  );

  const difficultiesInUse = new Set(plans.map((p) => p.difficulty).filter(Boolean)) as Set<DifficultyType>;
  const sourcesInUse = Array.from(new Set(plans.map((p) => p.source).filter(Boolean))) as string[];
  const hasUnsourced = plans.some((p) => !p.source);
  const hasMoreFilters = difficultiesInUse.size > 0 || sourcesInUse.length > 0 || hasUnsourced;
  const activeFilters = activeFilterList([
    difficultyFilter !== "all" && {
      key: "difficulty",
      label: DIFFICULTY_LABELS[difficultyFilter],
      clear: () => setDifficultyFilter("all"),
    },
    sourceFilter !== "all" && {
      key: "source",
      label: sourceFilter === "__none__" ? "No source" : sourceFilter,
      clear: () => setSourceFilter("all"),
    },
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Training Plans</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            Your saved training plans.
          </p>
        </div>
        {isAdmin && (
          <Link
            href="/plans/new"
            className="px-4 py-2 rounded-lg bg-[var(--foreground)] text-[var(--background)] text-sm font-medium hover:opacity-90 transition-opacity"
          >
            + New plan
          </Link>
        )}
      </div>

      {loading && <p className="text-sm text-[var(--muted)]">Loading…</p>}

      {!loading && plans.length === 0 && (
        <div className="rounded-xl border border-dashed border-[var(--border)] p-12 text-center space-y-3">
          <p className="font-medium">No plans yet</p>
          <p className="text-sm text-[var(--muted)]">
            Create your first training plan to get started.
          </p>
          <Link
            href="/plans/new"
            className="inline-block px-4 py-2 rounded-lg bg-[var(--foreground)] text-[var(--background)] text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Create a plan
          </Link>
        </div>
      )}

      {/* Category landing page — most people want just their one plan type,
          not the whole list, so land here first and filter down from a
          click rather than defaulting straight into everything. */}
      {!loading && plans.length > 0 && category === null && (
        <div className="space-y-4">
          <p className="text-sm text-[var(--muted)]">Pick a category to browse, or view everything at once.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {CATEGORY_TYPES.map((type) => {
              const count = plans.filter((p) => p.type === type).length;
              return (
                <button
                  key={type}
                  onClick={() => enterCategory(type)}
                  className={`group rounded-xl border border-[var(--border)] ${PLAN_TYPE_COLORS[type]} p-4 text-center space-y-1 hover:border-[var(--foreground)] transition-colors`}
                >
                  <p className={`text-lg font-semibold ${PLAN_TYPE_TEXT_COLORS[type]}`}>
                    {PLAN_TYPE_LABELS[type]}
                  </p>
                  <p className="text-xs opacity-70">
                    {count} plan{count === 1 ? "" : "s"}
                  </p>
                </button>
              );
            })}
          </div>
          <button
            onClick={() => enterCategory("all")}
            className="text-sm text-[var(--accent)] hover:underline"
          >
            View all plans →
          </button>
        </div>
      )}

      {!loading && plans.length > 0 && category !== null && (
        <div className="space-y-5">
          <button
            onClick={backToCategories}
            className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            ← All categories
          </button>

          {/* Plan type — one swipeable row */}
          {visibleTabs.length > 2 && (
            <PillRow>
              {visibleTabs.map(({ value, label }) => (
                <Pill
                  key={value}
                  active={activeFilter === value}
                  activeClass={value === "all" ? undefined : PLAN_TYPE_COLORS[value]}
                  onClick={() => enterCategory(value)}
                >
                  {label}
                </Pill>
              ))}
            </PillRow>
          )}

          {/* Filters toggle + result count + active filter chips */}
          <ActiveFilterChips
            count={filtered.length}
            noun={["plan", "plans"]}
            filters={activeFilters}
            leading={
              hasMoreFilters && (
                <span className="mr-1.5">
                  <FiltersButton
                    open={filtersOpen}
                    onToggle={() => setFiltersOpen((o) => !o)}
                    count={activeFilters.length}
                    controls="plan-filters"
                  />
                </span>
              )
            }
          />

          {filtersOpen && hasMoreFilters && (
            <FilterPanel id="plan-filters">
              {difficultiesInUse.size > 0 && (
                <FilterSelect
                  label="Difficulty"
                  value={difficultyFilter}
                  onChange={(v) => setDifficultyFilter(v as DifficultyType | "all")}
                >
                  <option value="all">Any</option>
                  {(["beginner", "intermediate", "advanced"] as DifficultyType[])
                    .filter((d) => difficultiesInUse.has(d))
                    .map((d) => <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>)}
                </FilterSelect>
              )}
              {(sourcesInUse.length > 0 || hasUnsourced) && (
                <FilterSelect label="Source" value={sourceFilter} onChange={setSourceFilter}>
                  <option value="all">Any</option>
                  {sourcesInUse.map((src) => <option key={src} value={src}>{src}</option>)}
                  {hasUnsourced && <option value="__none__">No source</option>}
                </FilterSelect>
              )}
            </FilterPanel>
          )}

          {filtered.length === 0 ? (
            <p className="text-sm text-[var(--muted)] py-8 text-center">
              No plans match this filter.
            </p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((plan) => (
                <PlanCard key={plan.id} plan={plan} isAdmin={isAdmin} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
