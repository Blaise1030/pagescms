import { SettingsLayout } from "@/components/settings/settings-layout";
import { Preferences } from "@/components/settings/preferences";
import { DocumentTitle } from "@/components/document-title";

export default function Page() {
  return (
    <SettingsLayout>
      <DocumentTitle title="Preferences" />
      <div className="max-w-screen-sm mx-auto space-y-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Preferences</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Customize how the interface looks and feels.
          </p>
        </div>
        <Preferences />
      </div>
    </SettingsLayout>
  );
}
