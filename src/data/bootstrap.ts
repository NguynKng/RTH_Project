import { listSites, listStaff, listStatuses } from "../api/endpoints";
import { useBoardStore } from "./store";
export async function bootstrapData(signal: AbortSignal) {
  useBoardStore.setState({ bootstrap: "loading", bootstrapError: undefined });
  try {
    const [sites, staff, statuses] = await Promise.all([
      listSites(signal),
      listStaff(signal),
      listStatuses(signal),
    ]);
    if (signal.aborted) return;
    // Validate zones before using them in business rules, rather than crashing during render.
    for (const site of sites.data)
      new Intl.DateTimeFormat("en", { timeZone: site.timezone }).format();
    if (!sites.data.length)
      throw new Error("The helpdesk did not return any sites.");
    useBoardStore.setState({
      sites: Object.fromEntries(sites.data.map((site) => [site.id, site])),
      staff: Object.fromEntries(
        staff.data.map((person) => [person.id, person.name]),
      ),
      statusLabels: Object.fromEntries(
        statuses.data.map((status) => [status.value, status.label]),
      ),
      bootstrap: "ready",
    });
  } catch (error) {
    if (!signal.aborted)
      useBoardStore.setState({
        bootstrap: "error",
        bootstrapError:
          error instanceof Error
            ? error.message
            : "Could not load sites and staff.",
      });
  }
}
