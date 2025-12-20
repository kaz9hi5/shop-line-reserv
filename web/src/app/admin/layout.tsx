import { AdminAccessProvider } from "@/components/admin/AdminAccessContext";
import { AdminAccessGate } from "@/components/admin/AdminAccessGate";

export default function AdminLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-dvh bg-[#999999]">
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 lg:px-8">
        <AdminAccessProvider>
          <AdminAccessGate>{children}</AdminAccessGate>
        </AdminAccessProvider>
      </div>
    </div>
  );
}


