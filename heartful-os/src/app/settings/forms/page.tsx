import AppShell from "@/components/layout/AppShell";
import { getFormTemplates } from "@/lib/data";
import FormLibraryManager from "@/components/forms/FormLibraryManager";

export const dynamic = "force-dynamic";

export default async function FormLibraryPage() {
  const templates = await getFormTemplates();

  return (
    <AppShell title="Form Library">
      <FormLibraryManager templates={templates} />
    </AppShell>
  );
}
