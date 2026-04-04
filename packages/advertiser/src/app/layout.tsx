import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "HAT Advertiser Dashboard",
  description: "Manage ad campaigns with verified human attention",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, -apple-system, sans-serif", background: "#f9fafb" }}>
        {children}
      </body>
    </html>
  );
}
