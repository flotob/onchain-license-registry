import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";

type Theme = "light" | "dark";

interface ThemeSettings {
  theme: Theme;
  bgColor: string;
}

interface ThemeContextType extends ThemeSettings {}

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  bgColor: "#F1F1F1",
});

const STORAGE_KEY = "cg-theme-settings";

function getStoredSettings(): ThemeSettings | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.theme && parsed.bgColor) {
        return parsed as ThemeSettings;
      }
    }
  } catch {
    // Invalid JSON or localStorage not available
  }
  return null;
}

function saveSettings(settings: ThemeSettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // localStorage not available
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [searchParams] = useSearchParams();
  const [settings, setSettings] = useState<ThemeSettings>(() => {
    // Initial state: try URL params first, then localStorage, then defaults
    const urlTheme = searchParams.get("cg_theme");
    const urlBgColor = searchParams.get("cg_bg_color");

    if (urlTheme && urlBgColor) {
      return {
        theme: (urlTheme === "dark" ? "dark" : "light") as Theme,
        bgColor: urlBgColor,
      };
    }

    const stored = getStoredSettings();
    if (stored) {
      return stored;
    }

    return {
      theme: "light",
      bgColor: "#F1F1F1",
    };
  });

  // Update settings when URL params change (e.g., CG sends new theme)
  useEffect(() => {
    const urlTheme = searchParams.get("cg_theme");
    const urlBgColor = searchParams.get("cg_bg_color");

    if (urlTheme && urlBgColor) {
      // Fresh params from CG - these are authoritative
      const newSettings: ThemeSettings = {
        theme: (urlTheme === "dark" ? "dark" : "light") as Theme,
        bgColor: urlBgColor,
      };
      setSettings(newSettings);
      saveSettings(newSettings);
    }
    // If URL params are missing, we keep using current state (from localStorage)
  }, [searchParams]);

  // Apply theme to DOM
  useEffect(() => {
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(settings.theme);
    document.documentElement.style.setProperty("--cg-bg-color", settings.bgColor);
  }, [settings]);

  const value = useMemo(() => settings, [settings]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
