export default function ScrollableBody({ children }: { children: React.ReactNode }) {
  return <div className="h-[calc(100vh_-_var(--souls-header-height)_-_var(--souls-subheader-height))] overflow-y-scroll hide-scrollbar">{children}</div>;
}
