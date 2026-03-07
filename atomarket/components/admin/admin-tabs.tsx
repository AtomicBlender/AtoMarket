import Link from "next/link";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "markets", label: "Markets" },
  { key: "users", label: "Users" },
  { key: "disputes", label: "Disputes" },
] as const;

export function AdminTabs({
  activeTab,
  buildHref,
}: {
  activeTab: string;
  buildHref: (tab: string) => string;
}) {
  return (
    <nav className="inline-flex rounded-xl border border-slate-800 bg-slate-950/70 p-1">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={buildHref(tab.key)}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            activeTab === tab.key
              ? "bg-slate-800 text-slate-100"
              : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
