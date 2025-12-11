import "./globals.css";
import "@radix-ui/themes/styles.css";

import { Theme } from "@radix-ui/themes";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Soul Engine",
  description: "Creating AI souls.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark-theme dark" style={{ colorScheme: "dark" }}>
      <link rel="icon" href="/icon.png" sizes="any" />
      <body>
        <Theme
          appearance="dark"
          accentColor="iris"
          grayColor="slate"
          panelBackground="solid"
          radius="small"
        >
          {children}
        </Theme>
      </body>
    </html>
  );
}
