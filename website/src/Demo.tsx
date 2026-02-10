import { useState, useCallback, useRef, useEffect } from "react";

import { Layout, Model, Actions, DockLocation, TabNode, IJsonModel } from "@aptre/flex-layout";

import { TabContent } from "./TabContent";

import lightCss from "@aptre/flex-layout/style/light.css?url";
import darkCss from "@aptre/flex-layout/style/dark.css?url";
import grayCss from "@aptre/flex-layout/style/gray.css?url";
import underlineCss from "@aptre/flex-layout/style/underline.css?url";

const themeUrls: Record<string, string> = {
  light: lightCss,
  dark: darkCss,
  gray: grayCss,
  underline: underlineCss,
};

const themes = ["light", "dark", "gray", "underline"] as const;
type Theme = (typeof themes)[number];

const layouts: Record<string, IJsonModel> = {
  default: {
    global: {
      tabEnableRename: true,
      tabSetEnableMaximize: true,
      borderBarSize: 40,
    },
    borders: [
      {
        type: "border",
        location: "left",
        size: 200,
        children: [
          { type: "tab", name: "Explorer", component: "explorer" },
          { type: "tab", name: "Search", component: "text", config: { text: "Search panel content." } },
        ],
      },
      {
        type: "border",
        location: "bottom",
        size: 150,
        children: [
          { type: "tab", name: "Console", component: "text", config: { text: "Console output appears here." } },
          { type: "tab", name: "Problems", component: "text", config: { text: "No problems detected." } },
        ],
      },
    ],
    layout: {
      type: "row",
      weight: 100,
      children: [
        {
          type: "tabset",
          weight: 60,
          children: [
            { type: "tab", name: "Welcome", component: "welcome" },
            { type: "tab", name: "Editor", component: "text", config: { text: "This is an editor tab. Try dragging it to another location." } },
          ],
        },
        {
          type: "tabset",
          weight: 40,
          children: [
            { type: "tab", name: "Counter", component: "counter" },
            { type: "tab", name: "Colors", component: "colors" },
          ],
        },
      ],
    },
  },
  simple: {
    global: {},
    borders: [],
    layout: {
      type: "row",
      weight: 100,
      children: [
        {
          type: "tabset",
          weight: 50,
          children: [
            { type: "tab", name: "Tab 1", component: "text", config: { text: "Content for tab 1. Drag this tab to rearrange." } },
            { type: "tab", name: "Tab 2", component: "counter" },
          ],
        },
        {
          type: "tabset",
          weight: 50,
          children: [
            { type: "tab", name: "Tab 3", component: "colors" },
            { type: "tab", name: "Tab 4", component: "text", config: { text: "Content for tab 4." } },
          ],
        },
      ],
    },
  },
  complex: {
    global: {
      tabEnableRename: true,
      tabSetEnableMaximize: true,
      borderBarSize: 40,
    },
    borders: [
      {
        type: "border",
        location: "left",
        size: 180,
        children: [
          { type: "tab", name: "Files", component: "explorer" },
        ],
      },
      {
        type: "border",
        location: "right",
        size: 200,
        children: [
          { type: "tab", name: "Outline", component: "text", config: { text: "Document outline." } },
        ],
      },
      {
        type: "border",
        location: "bottom",
        size: 140,
        children: [
          { type: "tab", name: "Terminal", component: "text", config: { text: "$ _" } },
          { type: "tab", name: "Output", component: "text", config: { text: "Build output." } },
        ],
      },
    ],
    layout: {
      type: "row",
      weight: 100,
      children: [
        {
          type: "row",
          weight: 60,
          children: [
            {
              type: "tabset",
              weight: 70,
              children: [
                { type: "tab", name: "main.tsx", component: "code", config: { language: "tsx" } },
                { type: "tab", name: "App.tsx", component: "code", config: { language: "tsx" } },
              ],
            },
            {
              type: "tabset",
              weight: 30,
              children: [
                { type: "tab", name: "Minimap", component: "colors" },
              ],
            },
          ],
        },
        {
          type: "tabset",
          weight: 40,
          children: [
            { type: "tab", name: "Preview", component: "welcome" },
            { type: "tab", name: "Counter", component: "counter" },
          ],
        },
      ],
    },
  },
};

// Demo renders the interactive layout demo with theme and layout switching.
export function Demo() {
  const [theme, setTheme] = useState<Theme>("light");
  const [layoutKey, setLayoutKey] = useState("default");
  const [model, setModel] = useState(() => Model.fromJson(layouts.default));
  const layoutRef = useRef<Layout>(null);
  const tabCounter = useRef(1);

  // Swap the theme stylesheet by manipulating a <link> element in <head>.
  useEffect(() => {
    const id = "flexlayout-theme";
    let link = document.getElementById(id) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    link.href = themeUrls[theme];
    return () => {
      link?.remove();
    };
  }, [theme]);

  const switchLayout = useCallback((key: string) => {
    const json = layouts[key];
    if (!json) return;
    setLayoutKey(key);
    setModel(Model.fromJson(json));
  }, []);

  const addTab = useCallback(() => {
    const id = tabCounter.current++;
    model.doAction(
      Actions.addNode(
        {
          type: "tab",
          name: `New Tab ${id}`,
          component: "text",
          config: { text: `This is dynamically added tab #${id}.` },
        },
        model.getActiveTabset()?.getId() ?? model.getRoot().getChildren()[0]?.getId() ?? "",
        DockLocation.CENTER,
        -1,
      ),
    );
  }, [model]);

  const factory = useCallback((node: TabNode) => {
    return <TabContent node={node} />;
  }, []);

  // Force re-key the Layout on theme change so styles apply cleanly.
  const themeKey = `${theme}-${layoutKey}`;

  return (
    <div className="demo-page">
      <div className="demo-toolbar">
        <label>Theme:</label>
        <select value={theme} onChange={(e) => setTheme(e.target.value as Theme)}>
          {themes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <label>Layout:</label>
        <select value={layoutKey} onChange={(e) => switchLayout(e.target.value)}>
          <option value="default">Default (IDE-like)</option>
          <option value="simple">Simple (2 panels)</option>
          <option value="complex">Complex (nested)</option>
        </select>
        <div className="spacer" />
        <button className="btn btn-secondary" onClick={addTab}>
          + Add Tab
        </button>
        <button className="btn btn-secondary" onClick={() => switchLayout(layoutKey)}>
          Reset Layout
        </button>
      </div>
      <div className="demo-container">
        <Layout key={themeKey} ref={layoutRef} model={model} factory={factory} />
      </div>
    </div>
  );
}
