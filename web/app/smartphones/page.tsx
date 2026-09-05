import { generateHubMetadata, HubPage } from "@/components/HubPage";

export const metadata = generateHubMetadata("smartphones");

export default function SmartphonesHubPage() {
  return <HubPage hubId="smartphones" />;
}
