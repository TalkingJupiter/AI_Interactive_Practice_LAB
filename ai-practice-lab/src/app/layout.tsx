import "./globals.css";
import NavBar from "@/app/components/NavBar";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50">
        <NavBar />
        {children}
      </body>
    </html>
  );
}
