"use client";

import { Tabs } from "@radix-ui/themes";
import { useState } from "react";
import { InspectorData } from "../../../../../lib/queries/admin/documentQueries";
import InspectJson from "./InspectJson";

export default function Inspector({ debugChat, debugChatVersions, soulCycleVector, soulSession, soulSessionState, soulSource: soulSourceDoc }: InspectorData) {
  const [currentTab, setCurrentTab] = useState(debugChat ? "debugChat" : "soulSession");

  const tabData = [
    { value: "debugChat", label: "Debug chat", doc: debugChat },
    { value: "debugChatVersions", label: "Debug chat versions", doc: debugChatVersions },
    { value: "soulSession", label: "Soul session", doc: soulSession },
    { value: "soulSessionState", label: "Soul session state", doc: soulSessionState },
    { value: "soulCycleVector", label: "Soul cycle vector", doc: soulCycleVector },
    { value: "soulSourceDoc", label: "Soul source doc", doc: soulSourceDoc },
  ];

  return (
    <Tabs.Root className="" value={currentTab} onValueChange={setCurrentTab}>
      <div className="sticky top-0 z-10 bg-[var(--color-page-background)]">
        <Tabs.List>
          {tabData.map((tab) => (
            <Tabs.Trigger key={tab.value} value={tab.value} disabled={!tab.doc} className="text-slate-400 disabled:opacity-50">
              {tab.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
      </div>

      {tabData.map((tab) => (
        <TabContent key={tab.value} value={tab.value} currentTab={currentTab}>
          <InspectDocument title={tab.label} doc={tab.doc} />
        </TabContent>
      ))}
    </Tabs.Root>
  );
}

function TabContent({ children, value, currentTab }: { children: React.ReactNode; value: string; currentTab: string }) {
  return (
    <Tabs.Content forceMount value={currentTab} className={`mt-4 px-4 ${value === currentTab ? "block" : "hidden"}`}>
      {children}
    </Tabs.Content>
  );
}

function InspectDocument({ title, doc }: { title: string; doc: unknown }) {
  return (
    <div className="flex flex-col gap-4">
      <h2>Inspecting: {title}</h2>
      {doc ? <InspectJson object={doc} /> : <></>}
    </div>
  );
}
