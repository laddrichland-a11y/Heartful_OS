"use client";

import { Check, ChevronDown } from "@/components/ui/HeartfulIcon";
import { KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { cx } from "@/lib/utils";

export interface FilterSelectOption {
  value: string;
  label: string;
}

export default function FilterSelect({
  ariaLabel,
  value,
  options,
  onChange,
  active = false,
  disabled = false,
  autoFlip = false,
  className,
  menuClassName,
}: {
  ariaLabel: string;
  value: string;
  options: FilterSelectOption[];
  onChange: (value: string) => void;
  active?: boolean;
  disabled?: boolean;
  autoFlip?: boolean;
  className?: string;
  menuClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const [highlightedIndex, setHighlightedIndex] = useState(selectedIndex);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const id = useId().replace(/:/g, "");
  const listboxId = `filter-select-${id}`;
  const selectedOption = options[selectedIndex];

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    (listRef.current?.children[highlightedIndex] as HTMLElement | undefined)?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex, open]);

  function selectOption(index: number) {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    setOpen(false);
    requestAnimationFrame(() => buttonRef.current?.focus());
  }

  function openMenu() {
    const button = buttonRef.current?.getBoundingClientRect();
    if (autoFlip && button) {
      const estimatedMenuHeight = Math.min(260, options.length * 42 + 12);
      const below = window.innerHeight - button.bottom;
      setOpenUp(below < estimatedMenuHeight + 8 && button.top > below);
    } else {
      setOpenUp(false);
    }
    setHighlightedIndex(selectedIndex);
    setOpen(true);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        openMenu();
        return;
      }
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setHighlightedIndex((current) => (current + direction + options.length) % options.length);
      return;
    }
    if (event.key === "Home" && open) {
      event.preventDefault();
      setHighlightedIndex(0);
      return;
    }
    if (event.key === "End" && open) {
      event.preventDefault();
      setHighlightedIndex(options.length - 1);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open) selectOption(highlightedIndex);
      else openMenu();
      return;
    }
    if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div
      ref={rootRef}
      className={cx("relative", className)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        role="combobox"
        data-active={active ? "true" : "false"}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-autocomplete="none"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={open ? `${listboxId}-option-${highlightedIndex}` : undefined}
        onClick={() => {
          if (open) setOpen(false);
          else openMenu();
        }}
        onKeyDown={handleKeyDown}
        className={cx(
          "flex h-9 w-full items-center justify-between gap-3 rounded-lg border bg-[var(--surface-control)] px-3 text-left text-sm outline-none transition-colors",
          "focus-visible:border-clay-300 focus-visible:ring-2 focus-visible:ring-clay-100",
          active
            ? "border-clay-300 bg-clay-50 text-clay-800"
            : "border-ink-100 text-ink-500 hover:border-ink-200 hover:text-ink-700",
          open && "border-ink-200"
        )}
      >
        <span className="min-w-0 truncate">{selectedOption?.label}</span>
        <ChevronDown className={cx("h-3.5 w-3.5 shrink-0 text-ink-400 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel}
          data-placement={openUp ? "top" : "bottom"}
          className={cx(
            "absolute left-0 top-full z-30 mt-1.5 min-w-full overflow-hidden rounded-xl border border-ink-100 bg-[var(--surface-control)] p-1.5 shadow-lg shadow-ink-900/8",
            menuClassName
          )}
        >
          {options.map((option, index) => {
            const selected = option.value === value;
            const highlighted = index === highlightedIndex;
            return (
              <div
                key={option.value}
                id={`${listboxId}-option-${index}`}
                role="option"
                aria-selected={selected}
                data-highlighted={highlighted ? "true" : "false"}
                onMouseEnter={() => setHighlightedIndex(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectOption(index)}
                className={cx(
                  "flex h-9 cursor-pointer items-center justify-between gap-3 rounded-lg px-2.5 text-sm text-ink-700",
                  selected ? "bg-clay-50 font-medium text-ink-900" : highlighted ? "bg-ink-50" : "bg-transparent"
                )}
              >
                <span>{option.label}</span>
                {selected && <Check className="h-3.5 w-3.5 shrink-0 text-clay-700" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
