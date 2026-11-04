import { WidgetIdentityBridge } from "@/components/widget-identity-bridge";

export default async function EmbedLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ publicId: string }>;
}>) {
  const { publicId } = await params;
  return (
    <>
      <WidgetIdentityBridge publicId={publicId} />
      {children}
    </>
  );
}
