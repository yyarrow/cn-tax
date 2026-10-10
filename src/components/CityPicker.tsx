"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CITY_PRESETS, HOT_CITY_IDS, getCity, type CityPreset } from "@/lib/tax";
import { searchCities } from "@/lib/citySearch";
import { inputCls } from "./ui";

const MAX_RESULTS = 50;
/** 对应下拉的 min-w-[12rem] */
const MIN_LIST_WIDTH = 192;

interface Group {
  label: string;
  cities: CityPreset[];
}

/** 空搜索时的分组：热门 → 直辖市 → 各省 → 其他 */
function buildGroups(): Group[] {
  const byId = new Map(CITY_PRESETS.map((c) => [c.id, c]));
  const hot = HOT_CITY_IDS.map((id) => byId.get(id)).filter((c): c is CityPreset => !!c);
  const provinces = new Map<string, Group>();
  const municipalities: CityPreset[] = [];
  const rest: CityPreset[] = [];
  for (const c of CITY_PRESETS) {
    if (c.id === "other" || !c.provinceId) {
      rest.push(c);
      continue;
    }
    let g = provinces.get(c.provinceId);
    if (!g) provinces.set(c.provinceId, (g = { label: c.province, cities: [] }));
    g.cities.push(c);
  }
  const provinceGroups: Group[] = [];
  for (const g of provinces.values()) {
    // 直辖市：省名即城市名，且只有这一座城
    if (g.cities.length === 1 && g.cities[0].name === g.label) municipalities.push(g.cities[0]);
    else provinceGroups.push(g);
  }
  const groups: Group[] = [];
  if (hot.length) groups.push({ label: "热门", cities: hot });
  if (municipalities.length) groups.push({ label: "直辖市", cities: municipalities });
  groups.push(...provinceGroups);
  if (rest.length) groups.push({ label: "其他", cities: rest });
  return groups;
}

export function CityPicker({
  value,
  onChange,
  className = "",
  ariaLabel = "城市",
}: {
  value: string;
  onChange: (id: string) => void;
  className?: string;
  ariaLabel?: string;
}) {
  const uid = useId();
  const listId = `${uid}-list`;
  const optId = (i: number) => `${uid}-opt-${i}`;
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const current = getCity(value);
  const [open, setOpen] = useState(false);
  /** null = 没在输入，输入框显示当前城市名 */
  const [query, setQuery] = useState<string | null>(null);
  const [activeRaw, setActive] = useState(0);
  /** 输入框靠近视口右缘时，下拉改为右对齐，避免撑出横向滚动 */
  const [alignRight, setAlignRight] = useState(false);

  const groups = useMemo(() => buildGroups(), []);
  const searching = !!query && query.trim() !== "";
  const results = useMemo(() => (searching ? searchCities(CITY_PRESETS, query ?? "", MAX_RESULTS) : []), [searching, query]);

  // 可导航的选项（跳过组标题）：搜索时是结果平铺，否则是各组依次展开
  const options = useMemo(() => (searching ? results : groups.flatMap((g) => g.cities)), [searching, results, groups]);
  const active = Math.min(activeRaw, Math.max(0, options.length - 1));

  const close = () => {
    setOpen(false);
    setQuery(null);
  };
  const openList = () => {
    if (open) return;
    const r = rootRef.current?.getBoundingClientRect();
    if (r) setAlignRight(r.left + Math.max(r.width, MIN_LIST_WIDTH) > window.innerWidth - 8);
    setOpen(true);
    const idx = groups.flatMap((g) => g.cities).findIndex((c) => c.id === current.id);
    setActive(Math.max(0, idx));
  };
  const choose = (c: CityPreset) => {
    if (c.id !== value) onChange(c.id);
    close();
  };

  // 点外部关闭（iOS Safari 点空白处不一定让 input 失焦，所以不能只靠 blur）
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery(null);
      }
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  // 高亮项滚动进视野
  useEffect(() => {
    if (!open) return;
    document.getElementById(`${uid}-opt-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, uid]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case "ArrowDown":
      case "ArrowUp": {
        e.preventDefault();
        if (!open) {
          openList();
          return;
        }
        const n = options.length;
        if (n) setActive((active + (e.key === "ArrowDown" ? 1 : n - 1)) % n);
        break;
      }
      case "Enter":
        e.preventDefault();
        if (!open) openList();
        else if (options[active]) choose(options[active]);
        break;
      case "Escape":
        if (open) {
          e.preventDefault();
          close();
        }
        break;
      case "Tab":
        close();
        break;
    }
  };

  let optIndex = 0;
  const renderOption = (c: CityPreset, withProvince: boolean) => {
    const i = optIndex++;
    const selected = c.id === current.id;
    return (
      <div
        key={`${i}-${c.id}`}
        id={optId(i)}
        role="option"
        aria-selected={selected}
        onClick={(e) => {
          e.preventDefault(); // 外层若是 <label>，避免点击被转发回输入框重新展开
          choose(c);
          inputRef.current?.blur();
        }}
        onMouseMove={() => i !== active && setActive(i)}
        className={`flex cursor-pointer items-baseline justify-between gap-2 px-3 py-2.5 text-base sm:py-1.5 sm:text-sm ${
          i === active ? "bg-accent/10" : ""
        } ${selected ? "font-semibold text-accent-text" : "text-ink"}`}
      >
        <span>{c.name}</span>
        {withProvince && c.province && c.province !== c.name && <span className="text-xs font-normal text-muted">{c.province}</span>}
      </div>
    );
  };

  return (
    <div
      ref={rootRef}
      className={`relative min-w-0 ${className}`}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) close();
      }}
    >
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && options.length ? optId(active) : undefined}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="done"
        className={`${inputCls} pr-7`}
        value={query ?? current.name}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={(e) => {
          e.target.select();
          openList();
        }}
        onClick={openList}
        onKeyDown={onKeyDown}
      />
      <svg aria-hidden="true" viewBox="0 0 24 24" className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M6 9l6 6 6-6" />
      </svg>
      <div
        id={listId}
        role="listbox"
        aria-label={`${ariaLabel}列表`}
        hidden={!open}
        // 阻止 mousedown 抢走输入框焦点（否则点选项/拖滚动条会先触发 blur 关闭）
        onMouseDown={(e) => e.preventDefault()}
        className={`absolute ${alignRight ? "right-0" : "left-0"} top-full z-30 mt-1 max-h-[60vh] w-full min-w-[12rem] overflow-y-auto overscroll-contain rounded-lg border border-line bg-white py-1 shadow-lg`}
      >
        {open &&
          (searching ? (
            results.length ? (
              results.map((c) => renderOption(c, true))
            ) : (
              <div className="px-3 py-3 text-sm text-muted">没有找到，可选“其他城市”</div>
            )
          ) : (
            groups.map((g) => (
              <div key={g.label} role="group" aria-label={g.label}>
                <div aria-hidden="true" className="sticky top-0 bg-paper px-3 py-1 text-xs font-medium text-muted">
                  {g.label}
                </div>
                {g.cities.map((c) => renderOption(c, false))}
              </div>
            ))
          ))}
      </div>
    </div>
  );
}
