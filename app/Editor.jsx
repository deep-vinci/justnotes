"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { highlightContent } from "../lib/highlight";
import { SunIcon, MoonIcon, PencilIcon, CloudIcon } from "./icons";

const SAVE_DEBOUNCE = 1500;
const RETRY_DELAY = 3000;

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

export default function Editor({ initialTabs, initialTheme }) {
  const router = useRouter();
  const [data, setData] = useState(() => ({
    theme: initialTheme,
    activeTabId: (initialTabs[0] || emptyTab()).id,
    tabs: initialTabs.length > 0 ? initialTabs : [emptyTab()],
  }));
  const [editingTabId, setEditingTabId] = useState(null);
  const [editingValue, setEditingValue] = useState("");
  const [saveStatus, setSaveStatus] = useState("saved"); // "saved" | "pending"

  const dataRef = useRef(data);
  dataRef.current = data;
  const pendingRef = useRef(false);
  const saveTimerRef = useRef(null);
  const tabsContainerRef = useRef(null);
  const prevTabCount = useRef(data.tabs.length);

  useEffect(() => {
    if (data.tabs.length > prevTabCount.current && tabsContainerRef.current) {
      tabsContainerRef.current.scrollLeft = tabsContainerRef.current.scrollWidth;
    }
    prevTabCount.current = data.tabs.length;
  }, [data.tabs.length]);

  async function flushSave() {
    saveTimerRef.current = null;
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tabs: dataRef.current.tabs }),
      });
      if (res.ok) {
        pendingRef.current = false;
        setSaveStatus("saved");
      } else {
        saveTimerRef.current = setTimeout(flushSave, RETRY_DELAY);
      }
    } catch {
      saveTimerRef.current = setTimeout(flushSave, RETRY_DELAY);
    }
  }

  function markDirty() {
    pendingRef.current = true;
    setSaveStatus("pending");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(flushSave, SAVE_DEBOUNCE);
  }

  // Best-effort save when the tab is hidden/closed before the debounce fires.
  useEffect(() => {
    function flushBeacon() {
      if (!pendingRef.current) return;
      const blob = new Blob([JSON.stringify({ tabs: dataRef.current.tabs })], {
        type: "application/json",
      });
      navigator.sendBeacon("/api/sync", blob);
    }
    function onVisibilityChange() {
      if (document.visibilityState === "hidden") flushBeacon();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", flushBeacon);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", flushBeacon);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
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
    markDirty();
  }

  function switchTab(id) {
    setData((prev) => (prev.activeTabId === id ? prev : { ...prev, activeTabId: id }));
  }

  function addTab() {
    const tab = emptyTab();
    setData((prev) => ({ ...prev, tabs: [...prev.tabs, tab], activeTabId: tab.id }));
    markDirty();
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
    markDirty();
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
    markDirty();
  }

  function toggleTheme() {
    setData((prev) => {
      const theme = prev.theme === "dark" ? "light" : "dark";
      document.cookie = `theme=${theme}; path=/; max-age=31536000; samesite=lax`;
      document.documentElement.classList.toggle("dark", theme === "dark");
      return { ...prev, theme };
    });
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
        <span
          className={"icon-btn status-btn" + (saveStatus === "saved" ? " status-saved" : "")}
          title={saveStatus === "saved" ? "Saved" : "Saving…"}
        >
          <CloudIcon />
        </span>
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
