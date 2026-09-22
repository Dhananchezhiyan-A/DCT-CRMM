import SetupSectionPage from "../../section-page";

const items = {
  reports: { label: "Reports", description: "Build and review reports for CRM data.", href: "/reports" },
  "import-export": { label: "Import and Export", description: "Prepare controlled data import and export workflows." },
};

export default async function DataSetupPage({ params }: { params: { item: string } }) {
  const item = items[params.item as keyof typeof items];
  return <SetupSectionPage title={item?.label || "Data Administration"} description={item?.description || "Prepare the system for data operations."} items={item ? [item] : Object.values(items)} />;
}
