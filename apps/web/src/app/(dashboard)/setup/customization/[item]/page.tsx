import SetupSectionPage from "../../section-page";

const items = {
  modules: { label: "Modules", description: "Manage CRM modules and their availability.", href: "/setup/customization/modules" },
  fields: { label: "Fields", description: "Manage fields inside each CRM module.", href: "/setup/customization/fields" },
  layouts: { label: "Layouts", description: "Arrange module fields into create, edit, and view screens.", href: "/setup/customization/layouts" },
  objects: { label: "Object Manager", description: "Create and configure CRM objects and fields.", href: "/admin/object-manager" },
  picklists: { label: "Picklist Values", description: "Manage selectable values used by CRM fields.", href: "/admin/object-manager" },
};

export default async function CustomizationSetupPage({ params }: { params: { item: string } }) {
  const item = items[params.item as keyof typeof items];
  return <SetupSectionPage title={item?.label || "Customization"} description={item?.description || "Shape CRM data and user experiences."} items={item ? [item] : Object.values(items)} />;
}
