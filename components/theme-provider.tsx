"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export type ThemeMode = "light" | "dark";
export type ColorTheme = "charcoal" | "moss" | "navy" | "sand" | "crimson";
export type CardEdge = "sharp" | "rounded" | "playful";

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  colorTheme: ColorTheme;
  setColorTheme: (color: ColorTheme) => void;
  cardEdge: CardEdge;
  setCardEdge: (edge: CardEdge) => void;
  accentBg: string;
  accentText: string;
  accentBorder: string;
  accentBadge: string;
  accentRing: string;
  cardRadius: string;
  buttonRadius: string;
  inputRadius: string;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("light");
  const [colorTheme, setColorThemeState] = useState<ColorTheme>("charcoal");
  const [cardEdge, setCardEdgeState] = useState<CardEdge>("sharp");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const storedTheme = localStorage.getItem("theme_mode");
    if (storedTheme === "light" || storedTheme === "dark") {
      setThemeState(storedTheme);
    }
    const storedColor = localStorage.getItem("theme_color");
    if (storedColor && ["charcoal", "moss", "navy", "sand", "crimson"].includes(storedColor)) {
      setColorThemeState(storedColor as ColorTheme);
    }
    const storedEdge = localStorage.getItem("theme_edge");
    if (storedEdge && ["sharp", "rounded", "playful"].includes(storedEdge)) {
      setCardEdgeState(storedEdge as CardEdge);
    }
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  const setTheme = (mode: ThemeMode) => {
    setThemeState(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem("theme_mode", mode);
    }
  };

  const setColorTheme = (color: ColorTheme) => {
    setColorThemeState(color);
    if (typeof window !== "undefined") {
      localStorage.setItem("theme_color", color);
    }
  };

  const setCardEdge = (edge: CardEdge) => {
    setCardEdgeState(edge);
    if (typeof window !== "undefined") {
      localStorage.setItem("theme_edge", edge);
    }
  };

  // Calculate dynamic style maps
  let accentBg =
    "bg-zinc-900 hover:bg-zinc-800 text-zinc-50 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900";
  let accentText = "text-zinc-900 dark:text-zinc-100";
  let accentBorder =
    "border-zinc-300 dark:border-zinc-800 focus:border-zinc-900 dark:focus:border-zinc-100";
  let accentRing =
    "focus-visible:ring-zinc-900 dark:focus-visible:ring-zinc-100";
  let accentBadge =
    "bg-zinc-100 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-850";

  switch (colorTheme) {
    case "moss":
      accentBg =
        "bg-emerald-700 hover:bg-emerald-800 text-white dark:bg-emerald-600 dark:hover:bg-emerald-700 dark:text-white";
      accentText = "text-emerald-700 dark:text-emerald-400";
      accentBorder =
        "border-emerald-200 dark:border-emerald-900 focus:border-emerald-600 dark:focus:border-emerald-500";
      accentRing =
        "focus-visible:ring-emerald-500 dark:focus-visible:ring-emerald-400";
      accentBadge =
        "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-100 dark:border-emerald-900/60";
      break;
    case "navy":
      accentBg =
        "bg-blue-800 hover:bg-blue-900 text-white dark:bg-blue-700 dark:hover:bg-blue-800 dark:text-white";
      accentText = "text-blue-800 dark:text-blue-400";
      accentBorder =
        "border-blue-200 dark:border-blue-900 focus:border-blue-600 dark:focus:border-blue-500";
      accentRing =
        "focus-visible:ring-blue-500 dark:focus-visible:ring-blue-400";
      accentBadge =
        "bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border-blue-100 dark:border-blue-900/60";
      break;
    case "sand":
      accentBg =
        "bg-amber-600 hover:bg-amber-700 text-white dark:bg-amber-550 dark:hover:bg-amber-650 dark:text-zinc-950";
      accentText = "text-amber-700 dark:text-amber-400";
      accentBorder =
        "border-amber-200 dark:border-amber-900/60 focus:border-amber-600 dark:focus:border-amber-500";
      accentRing = "focus-visible:ring-amber-500";
      accentBadge =
        "bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border-amber-100 dark:border-amber-900/40";
      break;
    case "crimson":
      accentBg =
        "bg-rose-700 hover:bg-rose-800 text-white dark:bg-rose-600 dark:hover:bg-rose-700 dark:text-white";
      accentText = "text-rose-700 dark:text-rose-400";
      accentBorder =
        "border-rose-200 dark:border-rose-900 focus:border-rose-600 dark:focus:border-rose-500";
      accentRing =
        "focus-visible:ring-rose-500 dark:focus-visible:ring-rose-400";
      accentBadge =
        "bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-100 dark:border-rose-900/60";
      break;
  }

  let cardRadius = "rounded-none";
  let buttonRadius = "rounded-none";
  let inputRadius = "rounded-none";

  if (cardEdge === "rounded") {
    cardRadius = "rounded-lg";
    buttonRadius = "rounded-md";
    inputRadius = "rounded-md";
  } else if (cardEdge === "playful") {
    cardRadius = "rounded-2xl";
    buttonRadius = "rounded-full";
    inputRadius = "rounded-xl";
  }

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        colorTheme,
        setColorTheme,
        cardEdge,
        setCardEdge,
        accentBg,
        accentText,
        accentBorder,
        accentBadge,
        accentRing,
        cardRadius,
        buttonRadius,
        inputRadius,
      }}
    >
      <div
        className={`min-h-screen flex flex-col bg-background text-foreground transition-colors duration-150`}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
