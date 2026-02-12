"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, X, RotateCcw } from "lucide-react";

export interface FilterBarProps {
  search?: string;
  onSearchChange?: (val: string) => void;
  dateFrom?: string;
  dateTo?: string;
  onDateFromChange?: (val: string) => void;
  onDateToChange?: (val: string) => void;
  serviceId?: string;
  services?: { id: string; name: string }[];
  onServiceChange?: (val: string) => void;
  onReset?: () => void;
  children?: React.ReactNode;
}

export function FilterBar({
  search,
  onSearchChange,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  serviceId,
  services,
  onServiceChange,
  onReset,
  children,
}: FilterBarProps) {
  const [localSearch, setLocalSearch] = useState(search || "");

  useEffect(() => {
    setLocalSearch(search || "");
  }, [search]);

  const handleSearchDebounce = useCallback(
    (() => {
      let timer: ReturnType<typeof setTimeout>;
      return (val: string) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          onSearchChange?.(val);
        }, 400);
      };
    })(),
    [onSearchChange]
  );

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-white p-4 shadow-sm">
      {onSearchChange && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="ค้นหา..."
            value={localSearch}
            onChange={(e) => {
              setLocalSearch(e.target.value);
              handleSearchDebounce(e.target.value);
            }}
            className="rounded-xl border px-3 py-2 pl-9 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          {localSearch && (
            <button
              onClick={() => {
                setLocalSearch("");
                onSearchChange("");
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {onDateFromChange && (
        <input
          type="date"
          value={dateFrom || ""}
          onChange={(e) => onDateFromChange(e.target.value)}
          className="rounded-xl border px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
      )}

      {onDateToChange && (
        <input
          type="date"
          value={dateTo || ""}
          onChange={(e) => onDateToChange(e.target.value)}
          className="rounded-xl border px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
      )}

      {onServiceChange && services && (
        <select
          value={serviceId || ""}
          onChange={(e) => onServiceChange(e.target.value)}
          className="rounded-xl border px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
        >
          <option value="">บริการทั้งหมด</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      )}

      {children}

      {onReset && (
        <button
          onClick={onReset}
          className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm text-gray-500 hover:bg-gray-50"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          รีเซ็ต
        </button>
      )}
    </div>
  );
}
