"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { highlightContent } from "../lib/highlight";
import { SunIcon, MoonIcon, PencilIcon } from "./icons";

const STORE_KEY = "mono-editor-data";
const SYNC_INTERVAL = 10000;

function makeId() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

function deriveTitle(content) {
  const line = content.split("\n").find((l) => l.trim().length > 0) || "";
  return line.trim().slice(0, 24) || "Untitled";
}

function emptyTab() {
  return { id: makeId(), title: "Untitled", customTitle: false, content: "" };
}

const INITIAL_DATA = {
  theme: "light",
  activeTabId: "1",
  tabs: [{ id: "1", title: "Untitled", customTitle: false, content: "" }],
};

function CodeEditor({ value, onChange, onKeyDown }) {
  const preRef = useRef(null);

  function syncScroll(e) {
    if (preRef.current) {
      preRef.current.scrollTop = e.target.scrollTop;
      preRef.current.scrollLeft = e.target.scrollLeft;
    }
  }

  return (
    <div className="code-editor">
      <pre ref={preRef} className="code-editor-highlight" aria-hidden="true">
        <code dangerouslySetInnerHTML={{ __html: highlightContent(value) }} />
      </pre>
      <textarea
        className="code-editor-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onScroll={syncScroll}
        spellCheck={false}
        placeholder="Start typing..."
      />
    </div>
  );
}

export default function Editor() {
  const router = useRouter();
  const [data, setData] = useState(INITIAL_DATA);
  const [hydrated, setHydrated] = useState(false);
  const [editingTabId, setEditingTabId] = useState(null);
  const [editingValue, setEditingValue] = useState("");

  const dataRef = useRef(data);
  dataRef.current = data;
  const dirtyRef = useRef(false);
  const tabsContainerRef = useRef(null);
  const prevTabCount = useRef(data.tabs.length);

  // Load from localStorage after mount only, so the server-rendered and
  // first client render match (avoids hydration mismatch / theme flash).
  // Only falls back to the DB when local storage has nothing -- normal
  // loads never touch it.
  useEffect(() => {
    let cancelled = false;

    async function init() {
      let loaded = null;
      try {
        loaded = JSON.parse(localStorage.getItem(STORE_KEY));
      } catch {}

      if (loaded && Array.isArray(loaded.tabs) && loaded.tabs.length > 0) {
        setData(loaded);
      } else {
        try {
          const res = await fetch("/api/tabs");
          const { tabs } = res.ok ? await res.json() : { tabs: [] };
          if (!cancelled && Array.isArray(tabs) && tabs.length > 0) {
            setData({ theme: loaded?.theme || "light", activeTabId: tabs[0].id, tabs });
          }
        } catch {}
      }

      if (!cancelled) setHydrated(true);
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(data));
    } catch {}
  }, [data, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.classList.toggle("dark", data.theme === "dark");
  }, [data.theme, hydrated]);

  useEffect(() => {
    if (data.tabs.length > prevTabCount.current && tabsContainerRef.current) {
      tabsContainerRef.current.scrollLeft = tabsContainerRef.current.scrollWidth;
    }
    prevTabCount.current = data.tabs.length;
  }, [data.tabs.length]);

  // Background write-behind sync to the DB: fires ~10s after a change,
  // independent of which note-tab is active or in view.
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!dirtyRef.current) return;
      dirtyRef.current = false;
      try {
        const res = await fetch("/api/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tabs: dataRef.current.tabs }),
        });
        if (!res.ok) dirtyRef.current = true;
      } catch {
        dirtyRef.current = true;
      }
    }, SYNC_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function flush() {
      if (!dirtyRef.current) return;
      const blob = new Blob([JSON.stringify({ tabs: dataRef.current.tabs })], {
        type: "application/json",
      });
      if (navigator.sendBeacon("/api/sync", blob)) dirtyRef.current = false;
    }
    function onVisibilityChange() {
      if (document.visibilityState === "hidden") flush();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", flush);
    };
  }, []);

  function updateActiveTabContent(newContent) {
    setData((prev) => ({
      ...prev,
      tabs: prev.tabs.map((t) =>
        t.id === prev.activeTabId
          ? { ...t, content: newContent, title: t.customTitle ? t.title : deriveTitle(newContent) }
          : t
      ),
    }));
    dirtyRef.current = true;
  }

  function switchTab(id) {
    setData((prev) => (prev.activeTabId === id ? prev : { ...prev, activeTabId: id }));
  }

  function addTab() {
    const tab = emptyTab();
    setData((prev) => ({ ...prev, tabs: [...prev.tabs, tab], activeTabId: tab.id }));
    dirtyRef.current = true;
  }

  function closeTab(id) {
    setData((prev) => {
      const idx = prev.tabs.findIndex((t) => t.id === id);
      if (idx === -1) return prev;

      let tabs = prev.tabs.filter((t) => t.id !== id);
      let activeTabId = prev.activeTabId;

      if (tabs.length === 0) {
        const tab = emptyTab();
        tabs = [tab];
        activeTabId = tab.id;
      } else if (activeTabId === id) {
        const nextIdx = idx < tabs.length ? idx : idx - 1;
        activeTabId = tabs[nextIdx].id;
      }

      return { ...prev, tabs, activeTabId };
    });
    dirtyRef.current = true;
  }

  function renameTab(id, title) {
    const trimmed = title.trim();
    setData((prev) => ({
      ...prev,
      tabs: prev.tabs.map((t) => {
        if (t.id !== id) return t;
        return trimmed ? { ...t, title: trimmed, customTitle: true } : { ...t, title: deriveTitle(t.content), customTitle: false };
      }),
    }));
    dirtyRef.current = true;
  }

  function toggleTheme() {
    setData((prev) => ({ ...prev, theme: prev.theme === "dark" ? "light" : "dark" }));
  }

  function startEditing(tab) {
    setEditingTabId(tab.id);
    setEditingValue(tab.title);
  }

  function commitEditing() {
    renameTab(editingTabId, editingValue);
    setEditingTabId(null);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  function handleKeyDown(e) {
    if (e.key !== "Tab") return;
    e.preventDefault();

    const el = e.target;
    const indent = "  ";
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const value = el.value;
    let newValue, newStart, newEnd;

    if (start === end) {
      newValue = value.slice(0, start) + indent + value.slice(end);
      newStart = newEnd = start + indent.length;
    } else {
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const selected = value.slice(lineStart, end);
      const indented = selected.replaceAll("\n", "\n" + indent);
      const updated = indent + indented;
      newValue = value.slice(0, lineStart) + updated + value.slice(end);
      newStart = lineStart;
      newEnd = lineStart + updated.length;
    }

    updateActiveTabContent(newValue);
    requestAnimationFrame(() => {
      el.selectionStart = newStart;
      el.selectionEnd = newEnd;
    });
  }

  const activeTab = data.tabs.find((t) => t.id === data.activeTabId) || data.tabs[0];

  return (
    <>
      <div className="header">
        <div className="tabs-container" ref={tabsContainerRef}>
          <div className="tabs">
            {data.tabs.map((tab) => (
              <div
                key={tab.id}
                className={"tab" + (tab.id === data.activeTabId ? " active" : "")}
                onClick={() => switchTab(tab.id)}
              >
                {editingTabId === tab.id ? (
                  <input
                    className="tab-title-input"
                    autoFocus
                    value={editingValue}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setEditingValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitEditing();
                      if (e.key === "Escape") setEditingTabId(null);
                    }}
                    onBlur={commitEditing}
                  />
                ) : (
                  <>
                    <span
                      className="tab-title"
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        startEditing(tab);
                      }}
                    >
                      {tab.title}
                    </span>
                    <span
                      className="tab-edit-btn"
                      title="Rename tab"
                      onClick={(e) => {
                        e.stopPropagation();
                        startEditing(tab);
                      }}
                    >
                      <PencilIcon />
                    </span>
                  </>
                )}
                <span
                  className="close-tab-btn"
                  title="Close tab"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                >
                  &times;
                </span>
              </div>
            ))}
          </div>
          <button className="add-tab-btn" title="New tab" onClick={addTab}>
            +
          </button>
        </div>
        <button className="icon-btn" title="Log out" onClick={logout}>
          Log out
        </button>
        <button className="icon-btn" title="Toggle theme" onClick={toggleTheme}>
          {data.theme === "dark" ? <SunIcon /> : <MoonIcon />}
        </button>
      </div>
      <div className="editor-container">
        <CodeEditor value={activeTab.content} onChange={updateActiveTabContent} onKeyDown={handleKeyDown} />
      </div>
    </>
  );
}
