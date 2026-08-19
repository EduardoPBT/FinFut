"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/cn";

export type SelectOption = {
  value: string;
  label: string;
  hint?: string;
};

type SelectProps = {
  name: string;
  options: SelectOption[];
  defaultValue?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  onValueChange?: (value: string) => void;
};

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className={cn(
        "h-4 w-4 shrink-0 text-slate-400 transition duration-200",
        open && "rotate-180 text-teal-600",
      )}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <path d="M5 7.5 10 12.5 15 7.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Select({
  name,
  options,
  defaultValue,
  required,
  disabled,
  placeholder = "Selecione",
  className,
  onValueChange,
}: SelectProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [value, setValue] = useState(
    () => defaultValue ?? options[0]?.value ?? "",
  );
  const [menuStyle, setMenuStyle] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
    placement: "bottom" | "top";
  } | null>(null);

  const selected = options.find((option) => option.value === value);

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const gap = 8;
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const placement = spaceBelow >= 180 || spaceBelow >= spaceAbove ? "bottom" : "top";
    const maxHeight = Math.min(280, placement === "bottom" ? spaceBelow : spaceAbove);

    setMenuStyle({
      top: placement === "bottom" ? rect.bottom + gap : rect.top - gap,
      left: rect.left,
      width: rect.width,
      maxHeight: Math.max(maxHeight, 120),
      placement,
    });
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updateMenuPosition();
    const onScrollOrResize = () => updateMenuPosition();
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((index) => Math.min(index + 1, options.length - 1));
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((index) => Math.max(index - 1, 0));
      }

      if (event.key === "Enter" && options[activeIndex]) {
        event.preventDefault();
        setValue(options[activeIndex].value);
        onValueChange?.(options[activeIndex].value);
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, activeIndex, options, onValueChange]);

  const openMenu = () => {
    if (disabled || options.length === 0) return;
    const selectedIndex = options.findIndex((option) => option.value === value);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  };

  const menu =
    mounted && open && menuStyle
      ? createPortal(
          <AnimatePresence>
            <motion.ul
              ref={menuRef}
              id={listId}
              role="listbox"
              initial={{ opacity: 0, y: menuStyle.placement === "bottom" ? -6 : 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: menuStyle.placement === "bottom" ? -4 : 4 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              className={cn(
                "fixed z-[70] overflow-y-auto rounded-[20px] border border-white/70 bg-white/95 p-1.5 shadow-[0_20px_50px_-24px_rgba(14,116,144,0.45)] backdrop-blur-xl",
                menuStyle.placement === "top" && "-translate-y-full",
              )}
              style={{
                top: menuStyle.top,
                left: menuStyle.left,
                width: menuStyle.width,
                maxHeight: menuStyle.maxHeight,
              }}
            >
              {options.map((option, index) => {
                const isSelected = option.value === value;
                const isActive = index === activeIndex;

                return (
                  <li key={option.value} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => {
                        setValue(option.value);
                        onValueChange?.(option.value);
                        setOpen(false);
                        triggerRef.current?.focus();
                      }}
                      className={cn(
                        "flex w-full items-start gap-2 rounded-2xl px-3 py-2.5 text-left transition duration-150",
                        isSelected && "bg-teal-50/90 text-teal-900",
                        !isSelected && isActive && "bg-sky-50/80 text-slate-800",
                        !isSelected && !isActive && "text-slate-700 hover:bg-white/80",
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className={cn("block text-sm", isSelected && "font-semibold")}>
                          {option.label}
                        </span>
                        {option.hint ? (
                          <span className="mt-0.5 block text-xs leading-snug text-slate-400">
                            {option.hint}
                          </span>
                        ) : null}
                      </span>
                      {isSelected ? (
                        <span aria-hidden className="mt-0.5 text-xs text-teal-600">
                          ✓
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </motion.ul>
          </AnimatePresence>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <input type="hidden" name={name} value={value} required={required} />
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => (open ? setOpen(false) : openMenu())}
        className={cn(
          "flex w-full items-center justify-between gap-3 rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-left text-sm text-slate-800 outline-none transition duration-200",
          "ring-teal-300/0 focus:ring-2 focus:ring-teal-300/80",
          open && "border-teal-200/80 bg-white/95 ring-2 ring-teal-300/60",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        <span className={cn("truncate", !selected && "text-slate-400")}>
          {selected?.label ?? placeholder}
        </span>
        <Chevron open={open} />
      </button>
      {menu}
    </div>
  );
}
