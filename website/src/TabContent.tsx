import { useState } from "react";

import { TabNode } from "@aptre/flex-layout";

// TabContent renders content for a tab based on its component type.
export function TabContent({ node }: { node: TabNode }) {
  const component = node.getComponent();
  const config = node.getConfig() as Record<string, string> | undefined;

  if (component === "welcome") {
    return <WelcomeContent />;
  }
  if (component === "counter") {
    return <CounterContent />;
  }
  if (component === "colors") {
    return <ColorsContent />;
  }
  if (component === "explorer") {
    return <ExplorerContent />;
  }
  if (component === "code") {
    return <CodeContent language={config?.language ?? "ts"} />;
  }

  return (
    <div className="tab-content">
      <p>{config?.text ?? "Tab content"}</p>
    </div>
  );
}

function WelcomeContent() {
  return (
    <div className="tab-content">
      <h3>Welcome to FlexLayout</h3>
      <p>
        This is an interactive demo of the <code>@aptre/flex-layout</code>{" "}
        library. Try the following:
      </p>
      <ul style={{ margin: "12px 0", paddingLeft: 20, lineHeight: 2 }}>
        <li>Drag tabs between panels</li>
        <li>Drag a tab to an edge to split the view</li>
        <li>Double-click a tab set header to maximize</li>
        <li>Double-click a tab label to rename it</li>
        <li>Click the border tabs on the left and bottom edges</li>
        <li>Use the toolbar to switch themes and layouts</li>
        <li>Click "+ Add Tab" to add new tabs dynamically</li>
      </ul>
      <pre>{`import { Layout, Model } from "@aptre/flex-layout";
import "@aptre/flex-layout/style/light.css";

const model = Model.fromJson(json);

function App() {
  const factory = (node) => {
    return <div>{node.getName()}</div>;
  };
  return <Layout model={model} factory={factory} />;
}`}</pre>
    </div>
  );
}

function CounterContent() {
  const [count, setCount] = useState(0);
  return (
    <div className="counter-tab">
      <span>{count}</span>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => setCount((c) => c - 1)}>-</button>
        <button onClick={() => setCount(0)}>Reset</button>
        <button onClick={() => setCount((c) => c + 1)}>+</button>
      </div>
      <p style={{ fontSize: 12, color: "#888" }}>
        State is preserved when you move this tab
      </p>
    </div>
  );
}

function ColorsContent() {
  const colors = [
    "#ef4444", "#f97316", "#eab308", "#22c55e",
    "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
    "#f43f5e", "#14b8a6", "#6366f1", "#a855f7",
    "#d946ef", "#0ea5e9", "#84cc16", "#f59e0b",
  ];
  return (
    <div className="color-swatch">
      {colors.map((c) => (
        <div key={c} style={{ background: c }} title={c} />
      ))}
    </div>
  );
}

function ExplorerContent() {
  const files = [
    { name: "src/", indent: 0, dir: true },
    { name: "index.ts", indent: 1, dir: false },
    { name: "App.tsx", indent: 1, dir: false },
    { name: "model/", indent: 1, dir: true },
    { name: "Model.ts", indent: 2, dir: false },
    { name: "TabNode.ts", indent: 2, dir: false },
    { name: "Actions.ts", indent: 2, dir: false },
    { name: "view/", indent: 1, dir: true },
    { name: "Layout.tsx", indent: 2, dir: false },
    { name: "TabSet.tsx", indent: 2, dir: false },
    { name: "Splitter.tsx", indent: 2, dir: false },
    { name: "style/", indent: 0, dir: true },
    { name: "light.css", indent: 1, dir: false },
    { name: "dark.css", indent: 1, dir: false },
    { name: "package.json", indent: 0, dir: false },
  ];
  return (
    <div className="tab-content" style={{ fontSize: 13, lineHeight: 1.8 }}>
      {files.map((f, i) => (
        <div
          key={i}
          style={{
            paddingLeft: f.indent * 16,
            fontWeight: f.dir ? 600 : 400,
            cursor: "default",
          }}
        >
          {f.dir ? "\u25B8 " : "  "}{f.name}
        </div>
      ))}
    </div>
  );
}

function CodeContent({ language }: { language: string }) {
  const code = language === "tsx"
    ? `import { useState, useCallback } from "react";
import { Layout, Model, Actions } from "@aptre/flex-layout";
import "@aptre/flex-layout/style/light.css";

const json = {
  global: {},
  borders: [],
  layout: {
    type: "row",
    weight: 100,
    children: [{
      type: "tabset",
      weight: 50,
      children: [
        { type: "tab", name: "Tab 1", component: "panel" },
      ],
    }],
  },
};

export function App() {
  const [model] = useState(() => Model.fromJson(json));

  const factory = useCallback((node) => {
    return <div>{node.getName()}</div>;
  }, []);

  return <Layout model={model} factory={factory} />;
}`
    : `const model = Model.fromJson(json);
model.doAction(Actions.addNode(
  { type: "tab", name: "New", component: "panel" },
  "tabset1",
  DockLocation.CENTER,
  -1,
));`;

  return (
    <div className="tab-content">
      <pre>{code}</pre>
    </div>
  );
}
