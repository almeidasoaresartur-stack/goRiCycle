import { generateHubMetadata, HubPage } from "@/components/HubPage";

export const metadata = generateHubMetadata("tablets");

export default function TabletsHubPage() {
  return <HubPage hubId="tablets" />;
}
