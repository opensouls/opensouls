import React from 'react';
import { createRoot } from "react-dom/client"

export const render = async (component: React.ReactNode) => {
  document.body.innerHTML = '<div id="root"></div>';
  const el = document.getElementById('root');
  if (!el) throw new Error("missing root element")
  const root = createRoot(el);
  await React.act(async () => {
    root.render(
      component
    )
  })
  return el
}