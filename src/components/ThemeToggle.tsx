import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Default is always light unless user explicitly saved "dark"
    const saved = localStorage.getItem("qmark-theme");
    if (saved === "dark") {
      setIsDark(true);
      document.documentElement.classList.add("dark");
    } else {
      setIsDark(false);
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("qmark-theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("qmark-theme", "light");
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleTheme}
      className={`h-8 w-8 p-0 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors ${className}`}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label="Toggle theme"
    >
      {isDark ? <Sun className="size-4 text-[#D4AF37]" /> : <Moon className="size-4 text-[#0A1F44]" />}
    </Button>
  );
}
