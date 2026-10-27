"""Discovery of GCP projects the OAuth-authorized Google identity can see."""

from typing import Any


def discover_accessible_projects(credentials: Any) -> list[dict[str, str | None]]:
    from google.cloud import resourcemanager_v3

    client = resourcemanager_v3.ProjectsClient(credentials=credentials)
    projects: list[dict[str, str | None]] = []
    for project in client.search_projects(query="state:ACTIVE", timeout=15.0):
        project_id = getattr(project, "project_id", None)
        if not project_id:
            continue
        projects.append(
            {
                "projectId": project_id,
                "displayName": getattr(project, "display_name", None),
                "projectNumber": str(getattr(project, "name", "")).removeprefix("projects/") or None,
            }
        )
    return projects
